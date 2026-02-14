# processors/audio_generator.py

import hashlib
import json
import os
import re
import shutil
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import whisper_timestamped as whisper
from moviepy.editor import AudioFileClip, concatenate_audioclips

# Global cache for the Whisper model
_WHISPER_MODEL = None

# Import necessary components from config
# Import necessary components from config
try:
    from ..config import (
        AUDIO_CACHE_DIR,
        CHARACTER_MAP,
        # --- NEW IMPORTS ---
        DEFAULT_TTS_PROCESSES,
        GEMINI_TTS_WAIT_SECONDS,
        IS_MAC,
        MIN_CLIP_DURATION,
        TEMP_AIFF_PATH,
        TEMP_MP3_PATH,
        TEMP_WAV_PATH,
        TTS_PROCESS_CONFIG,
        WHISPER_DEVICE,
        suppress_output,
    )
except ImportError:
    from config import (
        AUDIO_CACHE_DIR,
        CHARACTER_MAP,
        # --- NEW IMPORTS ---
        DEFAULT_TTS_PROCESSES,
        GEMINI_TTS_WAIT_SECONDS,
        IS_MAC,
        MIN_CLIP_DURATION,
        TEMP_AIFF_PATH,
        TEMP_MP3_PATH,
        TEMP_WAV_PATH,
        TTS_PROCESS_CONFIG,
        WHISPER_DEVICE,
        suppress_output,
    )


# --- CONFIGURATION FOR RETRY ---
MAX_GEMINI_RETRIES = 6
DEFAULT_RATE_LIMIT_WAIT = 60
GEMINI_API_NO_AUDIO_DATA = "no audio data"

# Import the services (assuming these are correct and handle the voice_id passed)
try:
    try:
        from ..services import elevenlabs_tts
    except ImportError:
        import services.elevenlabs_tts as elevenlabs_tts
except ImportError:

    class ElevenLabsServiceStub:
        def is_service_available(self):
            return False

        def generate_audio(self, *args, **kwargs):
            raise NotImplementedError("ElevenLabs service not implemented.")

    elevenlabs_tts = ElevenLabsServiceStub()


class GeminiServiceStub:
    def is_service_available(self):
        return False

    def generate_audio(self, *args, **kwargs):
        raise NotImplementedError("Gemini service not implemented.")


try:
    try:
        from ..services import gemini_tts

        GEMINI_RATE_LIMIT_ERROR_CODE = "429 RESOURCE_EXHAUSTED"
    except ImportError as e1:
        try:
            import services.gemini_tts as gemini_tts

            GEMINI_RATE_LIMIT_ERROR_CODE = "429 RESOURCE_EXHAUSTED"
        except ImportError as e2:
            print(f"DEBUG: Failed to import gemini_tts: {e1} | {e2}")
            gemini_tts = GeminiServiceStub()
except Exception as e:
    print(f"DEBUG: Unexpected error importing gemini_tts: {e}")
    if "gemini_tts" not in locals():
        gemini_tts = GeminiServiceStub()


try:
    if IS_MAC:
        try:
            from ..services import mac_say_tts
        except ImportError:
            import services.mac_say_tts as mac_say_tts
    else:
        raise ImportError("Not on macOS")
except ImportError:

    class MacSayServiceStub:
        def is_service_available(self):
            return False

        def generate_audio(self, *args, **kwargs):
            raise NotImplementedError("MacSay service not available on this platform.")

    mac_say_tts = MacSayServiceStub()


# --- VOICE ID LOOKUP UTILITY ---
def get_voice_id_for_role(role, tts_mode):
    """
    Retrieves the specific voice ID for a character and TTS mode from CHARACTER_MAP.
    """
    config = CHARACTER_MAP.get(role, {})

    # Map 'default' to 'gemini' for backward compatibility or simple selection
    effective_mode = "gemini" if tts_mode == "default" else tts_mode

    if effective_mode == "gemini":
        voice_key = "voice_gemini"
    elif effective_mode == "elevenlabs":
        voice_key = "voice_eleven"
    elif effective_mode == "mac_say":
        voice_key = "voice_mac"
    else:
        return None

    return config.get(voice_key)


# --- AUDIO GENERATION CORE LOGIC ---


# --- AUDIO GENERATION CORE LOGIC ---


def _generate_tts_only(turn_index, turn, tts_mode, reel_name=None):
    """
    Generates audio file for a single turn and returns the path.
    Does NOT run Whisper.
    """
    role = turn["role"]
    text = turn["text"]

    voice_id = get_voice_id_for_role(role, tts_mode)

    if not voice_id:
        print(
            f"Error: Could not find voice ID for role '{role}' in mode '{tts_mode}'. Skipping turn {turn_index}."
        )
        return None

    temp_audio_path = None
    service = None

    effective_mode = "gemini" if tts_mode == "default" else tts_mode

    if effective_mode == "gemini":
        service = gemini_tts
        temp_audio_path = TEMP_WAV_PATH.format(turn_index)
        ext = ".wav"
    elif effective_mode == "elevenlabs":
        service = elevenlabs_tts
        temp_audio_path = TEMP_MP3_PATH.format(turn_index)
        ext = ".mp3"
    elif effective_mode == "mac_say":
        service = mac_say_tts
        temp_audio_path = TEMP_AIFF_PATH.format(turn_index)
        ext = ".aiff"
    else:
        return None

    # --- CACHING LOGIC ---
    cache_path = None
    if reel_name and effective_mode == "gemini":
        try:
            # Create a unique hash for the text and voice to avoid collisions
            text_hash = hashlib.md5(f"{voice_id}_{text}".encode()).hexdigest()
            cache_subdir = os.path.join(AUDIO_CACHE_DIR, reel_name)
            os.makedirs(cache_subdir, exist_ok=True)
            cache_path = os.path.join(
                cache_subdir, f"turn_{turn_index}_{text_hash}{ext}"
            )

            if os.path.exists(cache_path):
                print(
                    f"  > Using cached Gemini audio for turn {turn_index} ({reel_name})"
                )
                shutil.copy2(cache_path, temp_audio_path)
                return {
                    "index": turn_index,
                    "audio_path": temp_audio_path,
                    "role": role,
                    "text": text,
                }
        except Exception as e:
            print(f"Warning: Cache check failed: {e}")

    print(
        f"  > {effective_mode.upper()} TTS: Generating audio for turn {turn_index} with voice '{voice_id}'."
    )

    if not service.is_service_available():
        print(
            f"Error: {tts_mode.upper()} service is not available. Check API key/installation."
        )
        return None

    # Retry logic for Gemini TTS rate limits
    for attempt in range(MAX_GEMINI_RETRIES):
        try:
            # --- FIX: Added turn_index as a positional argument to generate_audio for all services. ---
            if service.generate_audio(text, voice_id, temp_audio_path, turn_index):
                # Save to cache if enabled
                if cache_path:
                    try:
                        shutil.copy2(temp_audio_path, cache_path)
                    except Exception as e:
                        print(f"Warning: Failed to save to cache: {e}")
                # -----------------------------------------------------------------------------------------
                # print(f"  > {tts_mode.upper()} TTS: Successfully saved audio to {os.path.basename(temp_audio_path)}")
                return {
                    "index": turn_index,
                    "audio_path": temp_audio_path,
                    "role": role,
                    "text": text,
                }
            else:
                raise Exception(f"{tts_mode.upper()} TTS failed to save file.")
        except Exception as e:
            if tts_mode == "gemini" and GEMINI_RATE_LIMIT_ERROR_CODE in str(e):
                wait_time = DEFAULT_RATE_LIMIT_WAIT + attempt * 10
                print(
                    f"  > Gemini TTS Rate Limit Hit. Waiting {wait_time}s before retrying (Attempt {attempt + 1}/{MAX_GEMINI_RETRIES})..."
                )
                time.sleep(wait_time)
            elif GEMINI_API_NO_AUDIO_DATA in str(e) and tts_mode == "gemini":
                print(
                    f"  > Gemini TTS returned no audio data. Retrying with delay (Attempt {attempt + 1}/{MAX_GEMINI_RETRIES})..."
                )
                time.sleep(GEMINI_TTS_WAIT_SECONDS)
            else:
                # Re-raise if it's a signature mismatch to alert developer
                if "missing 1 required positional argument: 'turn_index'" in str(e):
                    raise
                print(
                    f"Error generating audio for turn {turn_index} with {tts_mode}: {e}"
                )
                return None
    else:
        print(
            f"Critical Error: Failed to generate audio for turn {turn_index} after {MAX_GEMINI_RETRIES} attempts."
        )
        return None


def generate_multi_role_audio_multiprocess(
    ordered_turns: list, language_code: str, tts_mode: str, reel_name=None
):
    """
    Optimized generation:
    1. Parallel TTS Generation (IO Bound) using ThreadPoolExecutor.
    2. Sequential Whisper Transcription (CPU/GPU Bound) with single model load.
    """
    print(f"\nSelected TTS Mode: {tts_mode.upper()}")

    # --- PHASE 1: PARALLEL AUDIO GENERATION ---
    start_time = time.time()

    # Determine number of threads based on config
    # For IO-bound tasks like API calls, we can use more threads than CPU cores
    effective_mode_for_config = "gemini" if tts_mode == "default" else tts_mode
    num_threads = TTS_PROCESS_CONFIG.get(
        effective_mode_for_config, DEFAULT_TTS_PROCESSES
    )

    # Only force 1 thread if specifically configured (e.g. strict rate limits),
    # but theoretically Gemini/ElevenLabs handle concurrency fine on their end.
    if num_threads < 1:
        num_threads = 1

    print(f"  > Spawning {num_threads} threads for TTS generation...")

    tts_results = []

    with ThreadPoolExecutor(max_workers=num_threads) as executor:
        # Submit all tasks
        future_to_turn = {
            executor.submit(
                _generate_tts_only, i, turn, tts_mode, reel_name=reel_name
            ): i
            for i, turn in enumerate(ordered_turns)
        }

        for future in as_completed(future_to_turn):
            try:
                result = future.result()
                if result:
                    tts_results.append(result)
            except Exception as e:
                print(f"Error in TTS thread: {e}")

    # Sort results by index to ensure processing order
    tts_results.sort(key=lambda x: x["index"])

    if not tts_results:
        raise Exception("Failed to generate any audio files.")

    print(f"  > TTS Phase completed in {time.time() - start_time:.2f}s")

    # --- PHASE 2: SEQUENTIAL WHISPER TRANSCRIPTION ---
    print(f"  > Loading Whisper model ({WHISPER_DEVICE})...")

    global _WHISPER_MODEL

    # Load model ONCE per process (Caching)
    if _WHISPER_MODEL is None:
        try:
            with suppress_output():
                _WHISPER_MODEL = whisper.load_model("tiny", device=WHISPER_DEVICE)
            print("  > Whisper model loaded and cached.")
        except Exception as e:
            print(f"Error loading Whisper model: {e}")
            return None, []
    else:
        print("  > Using cached Whisper model.")

    whisper_model = _WHISPER_MODEL

    all_word_data = []
    audio_clips = []
    current_offset = 0.0

    print("  > Starting transcription...")

    for item in tts_results:
        turn_index = item["index"]
        audio_path = item["audio_path"]
        role = item["role"]

        # 1. Transcribe
        try:
            # For remote services/MacSay, ensure a common format if needed, but Whisper handles most.
            with suppress_output():
                result = whisper.transcribe(
                    whisper_model, audio_path, language="en", verbose=False
                )

            # 2. Extract Word Data
            turn_word_data = []
            for segment in result["segments"]:
                for word in segment["words"]:
                    turn_word_data.append(
                        {
                            "word": word["text"],
                            "start": word["start"],
                            "end": word["end"],
                            "role": role,
                        }
                    )

            # 3. Apply Offset immediately
            for word in turn_word_data:
                word["start"] += current_offset
                word["end"] += current_offset
                all_word_data.append(word)

            # 4. Load Audio Clip for concatenation
            with suppress_output():
                clip = AudioFileClip(audio_path)
            audio_clips.append(clip)
            current_offset += clip.duration

            # Clean up file?
            # MoviePy loads the file; if we delete it now, it might be fine if fully loaded into RAM?
            # AudioFileClip DOES NOT load into RAM by default, it streams.
            # So we MUST NOT delete the file until we are done with the clip or write the final one.
            # However, `concatenate_audioclips` will need to read them.
            # Strategy: Keep files until the end of this function where we concatenate?
            # Actually, `concatenate_audioclips` creates a composed clip.
            # We need to be careful. For safety in this script, we usually let OS/temp dir cleanup handle it,
            # or delete after writing the FINAL audio.
            # But the previous code deleted it immediately after loading AudioFileClip?
            # "Clean up the file here, after MoviePy has loaded it" -> This implies MoviePy loaded it fully?
            # AudioFileClip usually keeps a handle.
            # Let's keep the files for now to be safe, or check if AudioFileClip reads fully.
            # Reverting to previous behavior: if it worked before, AudioFileClip might be reading it?
            # Actually, `concatenate_audioclips` just references them.
            # To be safe, we will NOT delete them here. `reel_generator.py` cleans up `TEMP_DIR`?
            # No, `reel_generator.py` cleans `temp_output_file` but maybe not these individual chunks.
            # Let's verify `reel_generator` cleanup.
            # It cleans `temp-audio.m4a`.
            # Let's add a robust cleanup in `reel_generator` or just ignore for now as they are in `temp/`.

        except Exception as e:
            print(f"Error processing audio for turn {turn_index}: {e}")
            continue

    if not audio_clips:
        raise Exception("Failed to generate any audio clips. Cannot create reel.")

    final_audio_clip = concatenate_audioclips(audio_clips)

    # 3. Final Time Normalization/Scaling to Eliminate Lag
    if all_word_data:
        true_duration = final_audio_clip.duration
        whisper_total_time = (
            all_word_data[-1]["end"]
            if all_word_data and "end" in all_word_data[-1]
            else 0.0
        )

        if whisper_total_time > 0 and abs(true_duration - whisper_total_time) > 0.1:
            scale_factor = true_duration / whisper_total_time
            # print("-> Normalizing timestamps: Scaling by {:.4f}".format(scale_factor))
        else:
            scale_factor = 1.0

        for word_data in all_word_data:
            word_data["start"] *= scale_factor
            word_data["end"] *= scale_factor

    return final_audio_clip, all_word_data


def filter_word_data(word_data_list):
    """Filters out words that are too short to display and adjusts timestamps."""
    filtered = []

    # This regex attempts to skip words that are likely just punctuation/whisper noise.
    # It requires at least one alphanumeric character.
    word_pattern = re.compile(r"[a-zA-Z0-9]")

    for word in word_data_list:
        if (word["end"] - word["start"] >= MIN_CLIP_DURATION) and word_pattern.search(
            word["word"]
        ):
            filtered.append(word)
        # else:
        # print(f"Skipping short/empty word: {word['word']} ({word['end'] - word['start']:.3f}s)")

    return filtered


# --- JSON INPUT LOAD UTILITY ---


def load_input_json(file_path):
    """Loads and validates the input JSON content file."""
    try:
        with open(file_path, "r") as f:
            data = json.load(f)

        ordered_turns = data["conversation"]
        language_code = data.get("metadata", {}).get("language", "en")

        if not isinstance(ordered_turns, list) or not ordered_turns:
            raise ValueError(
                "JSON file must contain a non-empty list under the 'conversation' key."
            )

        # Basic validation of turn structure
        for turn in ordered_turns:
            if "role" not in turn or "text" not in turn:
                raise ValueError(
                    "Each turn in 'conversation' must have 'role' and 'text' keys."
                )

        return ordered_turns, language_code

    except FileNotFoundError:
        print(f"Error: Input file not found at {file_path}")
        return [], "en"
    except json.JSONDecodeError:
        print(f"Error: Invalid JSON format in {file_path}")
        return [], "en"
    except ValueError as e:
        print(f"Error in content structure for {file_path}: {e}")
        return [], "en"
