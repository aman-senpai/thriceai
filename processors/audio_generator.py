import os
import time
import json
import numpy as np
import sys
import contextlib
import io
from multiprocessing import Pool
from moviepy.editor import AudioFileClip, concatenate_audioclips
import whisper_timestamped as whisper 
import re 

# Import necessary components from config
from config import (
    VOICE_MAP_MAC,
    VOICE_MAP_ELEVEN, 
    VOICE_MAP_GEMINI, 
    TEMP_AIFF_PATH, 
    TEMP_MP3_PATH,
    TEMP_WAV_PATH,
    MIN_CLIP_DURATION, 
    GEMINI_TTS_WAIT_SECONDS,
    suppress_output
)

# --- CONFIGURATION FOR RETRY ---
MAX_GEMINI_RETRIES = 3 
# Default wait if no specific retry delay is provided by the API
DEFAULT_RATE_LIMIT_WAIT = 60 
GEMINI_API_NO_AUDIO_DATA = "no audio data"

# Import the ElevenLabs service
try:
    import services.elevenlabs_tts as elevenlabs_tts
except ImportError:
    # Fallback stub if the service module is not found
    class ElevenLabsServiceStub:
        def is_service_available(self): return False
        def generate_audio(self, *args, **kwargs): raise NotImplementedError("ElevenLabs service not implemented.")
    elevenlabs_tts = ElevenLabsServiceStub()

# Import the NEW Gemini service
try:
    import services.gemini_tts as gemini_tts
    GEMINI_RATE_LIMIT_ERROR_CODE = "429 RESOURCE_EXHAUSTED"
except ImportError:
    # Fallback stub if the service module is not found
    class GeminiTtsServiceStub:
        def is_service_available(self): return False
        def generate_audio(self, *args, **kwargs): raise NotImplementedError("Gemini TTS service not implemented.")
    gemini_tts = GeminiTtsServiceStub()


# Constants for process limits
MAX_ELEVENLABS_PROCESSES = 2
MAX_GEMINI_PROCESSES = 1
MAX_DEFAULT_PROCESSES = 8 

# --- HELPER FUNCTIONS FOR ERROR HANDLING ---

def _get_retry_delay_from_error(error_message):
    """
    Attempts to parse the specific retry delay (in seconds) from the error message.
    """
    match = re.search(r"Please retry in (\d+\.?\d*)s", error_message)
    if match:
        try:
            # Add a small buffer to the recommended delay
            return float(match.group(1)) * 1.05 
        except ValueError:
            pass
    
    # Fallback if specific delay is not found
    return DEFAULT_RATE_LIMIT_WAIT

# --- CORE FUNCTIONS ---

def load_input_json(filepath):
    """Loads the conversation from the input JSON file."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        ordered_turns = data.get("conversation")

        if not ordered_turns:
            raise ValueError(
                "JSON input must contain a 'conversation' array of turn objects."
            )
            
        language_code = data.get("languageCode", "en")

        return ordered_turns, language_code 
        
    except FileNotFoundError:
        print(f"Error: Input JSON file '{filepath}' not found.")
        return [], ""
    except json.JSONDecodeError:
        print(f"Error: Invalid JSON format in '{filepath}'.")
        return [], ""
    except Exception as e:
        print(f"Error loading JSON: {e}")
        return [], ""


def process_single_turn_wrapper(args):
    """Wrapper function to unpack arguments for multiprocessing pool."""
    turn_data, language_code, turn_index, voice_map, use_elevenlabs_mode = args
    return process_single_turn(turn_data, language_code, turn_index, voice_map, use_elevenlabs_mode)


def process_single_turn(turn_data, language_code, turn_index, voice_map, use_elevenlabs_mode):
    """
    Generates audio and gets word-level timestamps from Whisper, with retry logic for Gemini.
    Returns: (turn_index, audio_duration, whisper_word_data, temp_audio_path)
    """
    
    # Determine the actual service to use based on user choice AND availability
    is_elevenlabs_active = (use_elevenlabs_mode == "elevenlabs") and elevenlabs_tts.is_service_available()
    is_gemini_active = (use_elevenlabs_mode == "gemini") and gemini_tts.is_service_available()
    
    role = turn_data["role"]
    text = turn_data["text"]
    role_voice = voice_map.get(role)
    
    if not role_voice:
        print(f"Error: Role '{role}' not mapped to a voice in the current voice map. Skipping turn {turn_index}.")
        return None
    
    # Determine output path and extension based on method
    if is_elevenlabs_active:
        temp_audio_path = TEMP_MP3_PATH.format(turn_index)
    elif is_gemini_active:
        temp_audio_path = TEMP_WAV_PATH.format(turn_index)
    else:
        temp_audio_path = TEMP_AIFF_PATH.format(turn_index)

    # --- RETRY LOOP FOR GEMINI ---
    attempts = 0
    while attempts < MAX_GEMINI_RETRIES:
        attempts += 1
        
        try:
            # 1. Generate Custom Audio
            if is_elevenlabs_active:
                # ElevenLabs path - Call the service
                elevenlabs_tts.generate_audio(text, role_voice, temp_audio_path, turn_index)
            elif is_gemini_active:
                # Gemini path - Call the service
                gemini_tts.generate_audio(text, role_voice, temp_audio_path, turn_index)
            else:
                # macOS 'say' path (Default/Fallback)
                escaped_text = text.replace('"', '\\"') 
                command = f'echo "{escaped_text}" | say -v "{role_voice}" -o {temp_audio_path} -f -'
                os.system(command)
            
            # Post-generation check for file integrity
            if not os.path.exists(temp_audio_path) or os.path.getsize(temp_audio_path) == 0:
                raise FileNotFoundError(f"Failed to create audio or file is empty for turn {turn_index}.")

            # 2. Transcribe with Whisper (for TIMING ONLY) - Works on AIFF, MP3, and WAV
            with suppress_output():
                audio = whisper.load_audio(temp_audio_path) 
                # Model loading might be slow, consider passing the model in if using a pool
                # For now, keeping it here as intended by the original script
                model = whisper.load_model("base", device="cpu") 
                
                result = whisper.transcribe(
                    model, 
                    audio, 
                    language=language_code, 
                    compute_word_confidence=False,
                    verbose=False 
                )
            
            whisper_word_data_raw = []
            for segment in result.get('segments', []):
                for word_data in segment.get('words', []):
                    whisper_word_data_raw.append({
                        'word': word_data['text'].strip(),
                        'start': word_data['start'],
                        'end': word_data['end'],
                        'role': role
                    })
            
            # 3. Get true audio duration
            with suppress_output():
                clip = AudioFileClip(temp_audio_path) 
            
            audio_duration = clip.duration
            
            # Success, break the retry loop and return
            return turn_index, audio_duration, whisper_word_data_raw, temp_audio_path

        except Exception as e:
            error_message = str(e)
            
            # Check for recoverable errors only if Gemini is active
            is_recoverable_gemini_error = is_gemini_active and (
                GEMINI_RATE_LIMIT_ERROR_CODE in error_message or
                GEMINI_API_NO_AUDIO_DATA in error_message
            )
            
            if is_recoverable_gemini_error:
                
                if attempts < MAX_GEMINI_RETRIES:
                    
                    # Determine delay based on error type
                    if GEMINI_RATE_LIMIT_ERROR_CODE in error_message:
                        retry_delay = _get_retry_delay_from_error(error_message)
                        error_type = "Rate Limit"
                    else:
                        retry_delay = GEMINI_TTS_WAIT_SECONDS # Use standard wait for internal errors
                        error_type = "Internal TTS"
                    
                    print(f"⚠️ {error_type} Error on turn {turn_index} (Attempt {attempts}/{MAX_GEMINI_RETRIES}).")
                    print(f"   Waiting for {retry_delay:.2f} seconds before retrying...")
                    print(f"   Original error: {error_message.splitlines()[0]}", file=sys.stderr) # Print only the first line of the error
                    time.sleep(retry_delay)
                    # Continue to next iteration (retry)
                    continue 
                else:
                    # Max retries reached
                    print(f"❌ Max retries ({MAX_GEMINI_RETRIES}) reached for turn {turn_index} ({role}). Giving up.", file=sys.stderr)
                    print(f"   Last error: {error_message.splitlines()[0]}", file=sys.stderr)
                    return None
            else:
                # Handle non-recoverable errors or other services' errors
                # This includes FileNotFoundError from the post-generation check if not Gemini.
                print(f"Error processing turn {turn_index} ({role}): {e}", file=sys.stderr)
                # For non-recoverable errors, don't retry, just return None
                return None
    
    return None


def generate_multi_role_audio_multiprocess(ordered_turns, language_code, mode):
    """
    Generates audio for all turns concurrently, concatenates them, 
    and applies time scaling to align Whisper timestamps with true audio duration.
    
    Args:
        mode (str): 'elevenlabs', 'gemini', or 'default'.
    """
    
    tasks = []
    
    # 1. Determine active service, voice map, and process limit
    is_elevenlabs_active = (mode == "elevenlabs") and elevenlabs_tts.is_service_available()
    is_gemini_active = (mode == "gemini") and gemini_tts.is_service_available()

    if is_elevenlabs_active:
        max_processes_limit = MAX_ELEVENLABS_PROCESSES
        voice_map = VOICE_MAP_ELEVEN
        service_name = "ElevenLabs"
    elif is_gemini_active:
        max_processes_limit = MAX_GEMINI_PROCESSES
        voice_map = VOICE_MAP_GEMINI
        service_name = "Gemini TTS"
    else:
        max_processes_limit = MAX_DEFAULT_PROCESSES
        voice_map = VOICE_MAP_MAC
        service_name = "Default System TTS ('say')"
    
    print(f"Selected TTS Mode: {service_name}")
    
    for i, turn in enumerate(ordered_turns):
        tasks.append((turn, language_code, i, voice_map, mode)) # Pass mode and map to wrapper

    num_processes = min(os.cpu_count() or 1, max_processes_limit, len(tasks)) 
    
    print(f"Using {num_processes} parallel process(es) for {service_name} audio generation.")
    
    all_results = []
    
    # --- MODIFIED RATE LIMIT WAITING LOGIC (Log Reduction) ---
    if is_gemini_active and num_processes == 1:
        
        # Initial safety delay
        time.sleep(GEMINI_TTS_WAIT_SECONDS) 
        
        for i, task in enumerate(tasks):
            
            result = process_single_turn_wrapper(task)
            all_results.append(result)
            
            # Wait AFTER completing the request (regardless of success or failure/retry within the turn) 
            # only if there are more turns to process.
            if i < len(tasks) - 1:
                # Removed print statement for the standard interval wait
                time.sleep(GEMINI_TTS_WAIT_SECONDS)
            
    else:
        # Use multiprocessing pool for all other modes
        with Pool(processes=num_processes) as pool:
            all_results = pool.map(process_single_turn_wrapper, tasks)
    
    # --- END MODIFIED BLOCK ---

    valid_results = sorted([r for r in all_results if r is not None], key=lambda x: x[0])
    
    if not valid_results:
        raise ValueError("No audio clips were successfully generated for multi-role content.")

    # Concatenate Audio and Adjust Timestamps (sequentially)
    all_word_data = []
    audio_clips = []
    current_offset = 0.0
        
    for _, duration, whisper_word_data_raw, temp_audio_path in valid_results:
        
        word_data_list = whisper_word_data_raw 
        
        # 1. Offset word timestamps
        for word_data in word_data_list:
            word_data['start'] += current_offset
            word_data['end'] += current_offset
        all_word_data.extend(word_data_list)
        
        # 2. Load audio clip and update offset
        with suppress_output():
            clip = AudioFileClip(temp_audio_path)
        audio_clips.append(clip)
        current_offset += clip.duration

    final_audio_clip = concatenate_audioclips(audio_clips)
    
    # 3. Final Time Normalization/Scaling to Eliminate Lag
    if all_word_data:
        true_duration = final_audio_clip.duration
        whisper_total_time = all_word_data[-1]['end'] if all_word_data and 'end' in all_word_data[-1] else 0.0
        
        if whisper_total_time > 0:
            scale_factor = true_duration / whisper_total_time
        else:
            scale_factor = 1.0

        for word_data in all_word_data:
            word_data['start'] *= scale_factor
            word_data['end'] *= scale_factor
            
    return final_audio_clip, all_word_data

def filter_word_data(word_data_list):
    """Filters out words that are too short in duration and empty text."""
    return [
        word_data for word_data in word_data_list 
        if (word_data['end'] - word_data['start']) >= MIN_CLIP_DURATION and word_data['word']
    ]