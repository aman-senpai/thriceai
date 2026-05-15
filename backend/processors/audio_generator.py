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

# Import necessary components from config
# Import necessary components from config
try:
    from ..config import (
        AUDIO_CACHE_DIR,
        CHARACTER_MAP,
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
            # print(f"DEBUG: Failed to import gemini_tts: {e1} | {e2}")
            gemini_tts = GeminiServiceStub()
except Exception as e:
    # print(f"DEBUG: Unexpected error importing gemini_tts: {e}")
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


try:
    try:
        from ..services import kokoro_tts
    except ImportError:
        import services.kokoro_tts as kokoro_tts
except ImportError:

    class KokoroServiceStub:
        def is_service_available(self):
            return False

        def generate_audio(self, *args, **kwargs):
            raise NotImplementedError("Kokoro service not implemented.")

    kokoro_tts = KokoroServiceStub()


try:
    try:
        from ..services import kokoro_mlx_tts
    except ImportError:
        import services.kokoro_mlx_tts as kokoro_mlx_tts
except ImportError:

    class KokoroMLXServiceStub:
        def is_service_available(self):
            return False

        def generate_audio_mlx(self, *args, **kwargs):
            raise NotImplementedError("Kokoro MLX service not implemented.")

    kokoro_mlx_tts = KokoroMLXServiceStub()


# --- VOICE ID LOOKUP UTILITY ---
# Language voice pools for auto-mapping (kokoro_mlx voices only)
# Keyed by ISO 639-1 language code
_LANG_VOICE_POOLS = {
    "hi": {"female": ["hf_alpha", "hf_beta"], "male": ["hm_omega", "hm_psi"]},
    "ja": {"female": ["jf_alpha", "jf_gongitsune"], "male": ["jm_kumo"]},
    "zh": {"female": ["zf_xiaobei", "zf_xiaoni"], "male": ["zm_yunjian", "zm_yunxi"]},
    "es": {"female": ["ef_dora"], "male": ["em_alex", "em_santa"]},
    "fr": {"female": ["ff_siwis"], "male": []},
    "it": {"female": ["if_sara"], "male": ["im_nicola"]},
    "pt": {"female": ["pf_dora"], "male": ["pm_alex", "pm_santa"]},
}


def _infer_gender(voice_id: str) -> str | None:
    """Infer voice gender from Kokoro prefix (second char: f=female, m=male)."""
    if len(voice_id) >= 2:
        gender_char = voice_id[1]
        if gender_char == "f":
            return "female"
        if gender_char == "m":
            return "male"
    return None


def _auto_map_voice(original_voice: str, language_code: str) -> str | None:
    """Map an English voice to a language-appropriate voice, preserving gender."""
    pool = _LANG_VOICE_POOLS.get(language_code)
    if not pool:
        return None
    gender = _infer_gender(original_voice)
    if not gender:
        return None
    candidates = pool.get(gender, [])
    if candidates:
        return candidates[0]
    # Fallback to any voice in the pool
    for g in ("female", "male"):
        if pool.get(g):
            return pool[g][0]
    return None


def get_voice_id_for_role(role, tts_mode, language_code=None):
    """
    Retrieves the specific voice ID for a character and TTS mode from CHARACTER_MAP.
    Falls back to case-insensitive matching if exact match fails.
    If language_code is set, auto-selects a language-appropriate voice.
    """
    config = CHARACTER_MAP.get(role)
    if config is None:
        # Case-insensitive fallback
        for key, val in CHARACTER_MAP.items():
            if key.lower() == role.lower():
                config = val
                break
    if config is None:
        config = {}
        print(
            f"  ⚠ Character '{role}' not found in config. Available: {list(CHARACTER_MAP.keys())}"
        )

    effective_mode = "gemini" if tts_mode == "default" else tts_mode

    if effective_mode == "gemini":
        voice_key = "voice_gemini"
    elif effective_mode == "elevenlabs":
        voice_key = "voice_eleven"
    elif effective_mode == "mac_say":
        voice_key = "voice_mac"
    elif effective_mode == "kokoro":
        voice_key = "voice_kokoro"
    elif effective_mode == "kokoro_mlx":
        voice_key = "voice_kokoro_mlx"
        voice_id = config.get(voice_key) or config.get("voice_kokoro")
        # For non-English languages, auto-map to a language-appropriate voice
        if voice_id and language_code and language_code != "en":
            mapped = _auto_map_voice(voice_id, language_code)
            if mapped:
                return mapped
        return voice_id
    else:
        return None

    return config.get(voice_key)


# --- AUDIO GENERATION CORE LOGIC ---


# --- AUDIO GENERATION CORE LOGIC ---


def _generate_tts_only(turn_index, turn, tts_mode, language_code="en", reel_name=None):
    """
    Generates audio file for a single turn and returns the path.
    """
    role = turn["role"]
    text = turn["text"]

    effective_mode = "gemini" if tts_mode == "default" else tts_mode

    # Enhance Kokoro output by mapping emotion tags to punctuation
    if effective_mode == "kokoro":
        # Mapping common emotion tags to punctuation-based cues
        text = re.sub(r"\[disbelief\]", "...?", text, flags=re.IGNORECASE)
        text = re.sub(r"\[(?:confused|questioning)\]", "?", text, flags=re.IGNORECASE)
        text = re.sub(
            r"\[(?:pause|thoughtful|hesitation)\]", "...", text, flags=re.IGNORECASE
        )
        text = re.sub(
            r"\[(?:excited|surprised|shouting|happy)\]", "!!", text, flags=re.IGNORECASE
        )
        text = re.sub(
            r"\[(?:interrupted|cutting off)\]", "—", text, flags=re.IGNORECASE
        )
        text = re.sub(r"\[(?:serious|stern|angry)\]", ".", text, flags=re.IGNORECASE)
        # Strip any remaining unknown [emotion] tags
        text = re.sub(r"\[.*?\]", "", text).strip()

        # Normalize numbers for Kokoro: ASCII digits only, skip non-Latin scripts
        text = re.sub(r"(?<=[0-9]),(?=[0-9])", "", text)
        text = re.sub(r"(?<=[0-9])\.(?=[0-9])", " point ", text)

    # Apply same normalization for kokoro_mlx
    if effective_mode == "kokoro_mlx":
        text = re.sub(r"\[.*?\]", "", text).strip()
        # Only normalize ASCII digits — don't touch non-English scripts (Devanagari, etc.)
        text = re.sub(r"(?<=[0-9]),(?=[0-9])", "", text)
        text = re.sub(r"(?<=[0-9])\.(?=[0-9])", " point ", text)

    # Strip [emotion] tags for mac_say since it doesn't support them
    # and would speak them literally (e.g. "open bracket disbelief close bracket")
    if effective_mode == "mac_say":
        text = re.sub(r"\[.*?\]", "", text).strip()

    voice_id = get_voice_id_for_role(role, tts_mode, language_code=language_code)

    if not voice_id:
        print(
            f"Error: Could not find voice ID for role '{role}' in mode '{tts_mode}'. Skipping turn {turn_index}."
        )
        return None

    temp_audio_path = None
    service = None

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
    elif effective_mode == "kokoro":
        service = kokoro_tts
        temp_audio_path = TEMP_WAV_PATH.format(turn_index)
        ext = ".wav"
    elif effective_mode == "kokoro_mlx":
        service = kokoro_mlx_tts
        temp_audio_path = TEMP_WAV_PATH.format(turn_index)
        ext = ".wav"
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
                # print(
                #     f"  > Using cached Gemini audio for turn {turn_index} ({reel_name})"
                # )
                shutil.copy2(cache_path, temp_audio_path)
                return {
                    "index": turn_index,
                    "audio_path": temp_audio_path,
                    "role": role,
                    "text": text,
                }
        except Exception as e:
            print(f"Warning: Cache check failed: {e}")

    # print(
    #     f"  > {effective_mode.upper()} TTS: Generating audio for turn {turn_index} with voice '{voice_id}'."
    # )

    if not service.is_service_available():
        print(
            f"Error: {tts_mode.upper()} service is not available. Check API key/installation."
        )
        return None

    # Retry logic for Gemini TTS rate limits
    for attempt in range(MAX_GEMINI_RETRIES):
        try:
            # --- FIX: Added turn_index as a positional argument to generate_audio for all services. ---
            success = False
            if effective_mode == "kokoro_mlx":
                if service.generate_audio_mlx(
                    text,
                    voice_id,
                    temp_audio_path,
                    turn_index,
                    language_code=language_code,
                ):
                    success = True
            elif service.generate_audio(text, voice_id, temp_audio_path, turn_index):
                success = True

            if success:
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


def _tokenize_text(text):
    """Strips [emotion/direction] tags from script text and splits into words."""
    # Remove anything in square brackets (e.g., [disbelief], [fast], [sarcastically])
    cleaned = re.sub(r"\[.*?\]", "", text)
    # Split on whitespace, filter empty strings
    words = [w.strip() for w in cleaned.split() if w.strip()]
    return words


def generate_multi_role_audio_multiprocess(
    ordered_turns: list, language_code: str, tts_mode: str, reel_name=None
):
    """
    Optimized generation:
    1. Parallel TTS Generation (IO Bound) using ThreadPoolExecutor.
    2. Script-based word timing (uses original text with proportional distribution).
    """
    # print(f"\nSelected TTS Mode: {tts_mode.upper()}")

    # --- PHASE 1: PARALLEL AUDIO GENERATION ---
    start_time = time.time()

    # Determine number of threads based on config
    effective_mode_for_config = "gemini" if tts_mode == "default" else tts_mode
    num_threads = TTS_PROCESS_CONFIG.get(
        effective_mode_for_config, DEFAULT_TTS_PROCESSES
    )

    if num_threads < 1:
        num_threads = 1

    # print(f"  > Spawning {num_threads} threads for TTS generation...")

    tts_results = []

    with ThreadPoolExecutor(max_workers=num_threads) as executor:
        future_to_turn = {
            executor.submit(
                _generate_tts_only,
                i,
                turn,
                tts_mode,
                language_code=language_code,
                reel_name=reel_name,
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

    # print(f"  > TTS Phase completed in {time.time() - start_time:.2f}s")

    # --- PHASE 2: WHISPER TRANSCRIPTION FOR WORD TIMESTAMPS ---
    # print(f"  > Loading Whisper model ({WHISPER_DEVICE}) once for all turns...")

    # Load model ONCE for all turns
    try:
        with suppress_output():
            whisper_model = whisper.load_model("tiny", device=WHISPER_DEVICE)
    except Exception as e:
        print(f"Error loading Whisper model: {e}")
        return None, []

    all_word_data = []
    audio_clips = []
    current_offset = 0.0

    # print("  > Starting Whisper transcription...")

    for item in tts_results:
        turn_index = item["index"]
        audio_path = item["audio_path"]
        role = item["role"]

        try:
            # 1. Transcribe with Whisper to get word-level timestamps
            with suppress_output():
                # Use language_code for Whisper (ISO 639-1), fallback to "en"
                whisper_lang = language_code if language_code else "en"
                result = whisper.transcribe(
                    whisper_model, audio_path, language=whisper_lang, verbose=False
                )

            # 2. Get original text (emotion tags already stripped by TTS)
            original_text = item.get("text", "")
            original_words = _tokenize_text(original_text) if original_text else []

            # 3. Extract word data from Whisper result (timing only)
            #    Replace transcribed word text with original script words for accuracy
            turn_word_data = []
            whisper_words = []
            for segment in result["segments"]:
                for word in segment["words"]:
                    whisper_words.append(word)

            # Use original words if counts match, otherwise use a proportional mapping
            if len(original_words) == len(whisper_words):
                for i, w in enumerate(whisper_words):
                    turn_word_data.append(
                        {
                            "word": original_words[i],
                            "start": w["start"],
                            "end": w["end"],
                            "role": role,
                        }
                    )
            elif len(original_words) > 0:
                # Proportional mapping: distribute Whisper timestamps across original words
                total_duration = whisper_words[-1]["end"] if whisper_words else 0
                per_word = total_duration / len(original_words) if original_words else 0
                for i, word_text in enumerate(original_words):
                    turn_word_data.append(
                        {
                            "word": word_text,
                            "start": i * per_word,
                            "end": (i + 1) * per_word,
                            "role": role,
                        }
                    )
            else:
                # Fallback: use Whisper output directly
                for w in whisper_words:
                    turn_word_data.append(
                        {
                            "word": w["text"],
                            "start": w["start"],
                            "end": w["end"],
                            "role": role,
                        }
                    )

            # 3. Apply offset for multi-turn concatenation
            for word in turn_word_data:
                word["start"] += current_offset
                word["end"] += current_offset
                all_word_data.append(word)

            # 4. Load Audio Clip for concatenation
            with suppress_output():
                clip = AudioFileClip(audio_path)
            audio_clips.append(clip)
            current_offset += clip.duration

        except Exception as e:
            print(f"Error processing audio for turn {turn_index}: {e}")
            continue

    if not audio_clips:
        raise Exception("Failed to generate any audio clips. Cannot create reel.")

    final_audio_clip = concatenate_audioclips(audio_clips)

    # Normalize timestamps to match actual audio duration (eliminates drift)
    if all_word_data:
        true_duration = final_audio_clip.duration
        whisper_total_time = all_word_data[-1]["end"] if all_word_data else 0.0

        if whisper_total_time > 0 and abs(true_duration - whisper_total_time) > 0.1:
            scale_factor = true_duration / whisper_total_time
        else:
            scale_factor = 1.0

        for word_data in all_word_data:
            word_data["start"] *= scale_factor
            word_data["end"] *= scale_factor

    return final_audio_clip, all_word_data


def filter_word_data(word_data_list):
    """Filters out words that are too short to display."""
    filtered = []

    # Require at least one word character (Unicode-aware — supports Devanagari, CJK, etc.)
    word_pattern = re.compile(r"\w", re.UNICODE)

    for word in word_data_list:
        duration = word["end"] - word["start"]
        has_word_char = word_pattern.search(word["word"])
        if duration >= MIN_CLIP_DURATION and has_word_char:
            filtered.append(word)

    return filtered


# --- JSON INPUT LOAD UTILITY ---


def load_input_json(file_path):
    """Loads and validates the input JSON content file."""
    try:
        with open(file_path, "r") as f:
            data = json.load(f)

        ordered_turns = data["conversation"]
        # Support both top-level languageCode and nested metadata.language
        language_code = data.get("languageCode") or data.get("metadata", {}).get(
            "language", "en"
        )

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
