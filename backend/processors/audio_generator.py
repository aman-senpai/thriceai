# processors/audio_generator.py

import os
import time
import json
import numpy as np
import sys
import contextlib
import io
from multiprocessing import Pool # Still imported, but conditionally used
from moviepy.editor import AudioFileClip, concatenate_audioclips
import whisper_timestamped as whisper 
import re 

# Import necessary components from config
# Import necessary components from config
try:
    from ..config import (
        CHARACTER_MAP, 
        TEMP_AIFF_PATH, 
        TEMP_MP3_PATH,
        TEMP_WAV_PATH,
        MIN_CLIP_DURATION, 
        GEMINI_TTS_WAIT_SECONDS,
        suppress_output,
        # --- NEW IMPORTS ---
        DEFAULT_TTS_PROCESSES,
        TTS_PROCESS_CONFIG
    )
except ImportError:
    from config import (
        CHARACTER_MAP, 
        TEMP_AIFF_PATH, 
        TEMP_MP3_PATH,
        TEMP_WAV_PATH,
        MIN_CLIP_DURATION, 
        GEMINI_TTS_WAIT_SECONDS,
        suppress_output,
        # --- NEW IMPORTS ---
        DEFAULT_TTS_PROCESSES,
        TTS_PROCESS_CONFIG
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
        def is_service_available(self): return False
        def generate_audio(self, *args, **kwargs): raise NotImplementedError("ElevenLabs service not implemented.")
    elevenlabs_tts = ElevenLabsServiceStub()


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
            class GeminiServiceStub:
                def is_service_available(self): return False
                def generate_audio(self, *args, **kwargs): raise NotImplementedError("Gemini service not implemented.")
            gemini_tts = GeminiServiceStub()
except Exception as e:
    print(f"DEBUG: Unexpected error importing gemini_tts: {e}")
    class GeminiServiceStub:
        def is_service_available(self): return False
        def generate_audio(self, *args, **kwargs): raise NotImplementedError("Gemini service not implemented.")
    gemini_tts = GeminiServiceStub()


try:
    try:
        from ..services import mac_say_tts
    except ImportError:
        import services.mac_say_tts as mac_say_tts
except ImportError:
    class MacSayServiceStub:
        def is_service_available(self): return False
        def generate_audio(self, *args, **kwargs): raise NotImplementedError("MacSay service not implemented.")
    mac_say_tts = MacSayServiceStub()



# --- VOICE ID LOOKUP UTILITY ---
def get_voice_id_for_role(role, tts_mode):
    """
    Retrieves the specific voice ID for a character and TTS mode from CHARACTER_MAP.
    """
    config = CHARACTER_MAP.get(role, {})
    
    if tts_mode == 'gemini':
        voice_key = 'voice_gemini'
    elif tts_mode == 'elevenlabs':
        voice_key = 'voice_eleven'
    elif tts_mode == 'mac_say':
        voice_key = 'voice_mac'
    else:
        return None # Should not happen

    return config.get(voice_key)


# --- AUDIO GENERATION CORE LOGIC ---

def _generate_audio_for_turn(turn_index, turn, tts_mode):
    """Generates audio for a single turn and returns word-level data."""
    role = turn['role']
    text = turn['text']
    
    voice_id = get_voice_id_for_role(role, tts_mode)
    
    if not voice_id:
        print(f"Error: Could not find voice ID for role '{role}' in mode '{tts_mode}'. Skipping turn {turn_index}.")
        return None

    temp_audio_path = None
    
    if tts_mode == 'gemini':
        service = gemini_tts
        temp_audio_path = TEMP_WAV_PATH.format(turn_index)
        print(f"  > Gemini TTS: Generating audio for turn {turn_index} with voice '{voice_id}'.")
    elif tts_mode == 'elevenlabs':
        service = elevenlabs_tts
        temp_audio_path = TEMP_MP3_PATH.format(turn_index)
        print(f"  > ElevenLabs TTS: Generating audio for turn {turn_index} with voice '{voice_id}'.")
    elif tts_mode == 'mac_say':
        service = mac_say_tts
        temp_audio_path = TEMP_AIFF_PATH.format(turn_index)
        print(f"  > MAC_SAY TTS: Generating audio for turn {turn_index} with voice '{voice_id}'.")
    else:
        return None # Invalid mode

    if not service.is_service_available():
        print(f"Error: {tts_mode.upper()} service is not available. Check API key/installation.")
        return None

    # Retry logic for Gemini TTS rate limits
    for attempt in range(MAX_GEMINI_RETRIES):
        try:
            # --- FIX: Added turn_index as a positional argument to generate_audio for all services. ---
            if service.generate_audio(text, voice_id, temp_audio_path, turn_index):
            # -----------------------------------------------------------------------------------------
                print(f"  > {tts_mode.upper()} TTS: Successfully saved audio to {os.path.basename(temp_audio_path)}")
                break
            else:
                raise Exception(f"{tts_mode.upper()} TTS failed to save file.")
        except Exception as e:
            if tts_mode == 'gemini' and GEMINI_RATE_LIMIT_ERROR_CODE in str(e):
                wait_time = DEFAULT_RATE_LIMIT_WAIT + attempt * 10
                print(f"  > Gemini TTS Rate Limit Hit. Waiting {wait_time}s before retrying (Attempt {attempt+1}/{MAX_GEMINI_RETRIES})...")
                time.sleep(wait_time)
            elif GEMINI_API_NO_AUDIO_DATA in str(e) and tts_mode == 'gemini':
                print(f"  > Gemini TTS returned no audio data. Retrying with delay (Attempt {attempt+1}/{MAX_GEMINI_RETRIES})...")
                time.sleep(GEMINI_TTS_WAIT_SECONDS)
            else:
                # Re-raise the error if it's the specific missing argument error, otherwise log and continue retrying
                if "missing 1 required positional argument: 'turn_index'" in str(e):
                    # This means the service implementation is wrong, which is outside this file's scope.
                    # Reraise so the user is aware of the core service file needing modification.
                    raise
                print(f"Error generating audio for turn {turn_index} with {tts_mode}: {e}")
                return None
    else:
        print(f"Critical Error: Failed to generate audio for turn {turn_index} after {MAX_GEMINI_RETRIES} attempts.")
        return None
    
    # Run Whisper to get word timestamps
    if tts_mode == 'mac_say':
        # Whisper can't read aiff directly on all systems, but should handle local files.
        # Fallback to direct mp3/wav if needed, but for now use the generated file.
        model_path = temp_audio_path 
    else:
        # For remote services, ensure a common format for Whisper
        model_path = temp_audio_path 

    print(f"  > Whisper: Generating word timestamps...")
    try:
        with suppress_output():
            model = whisper.load_model("tiny", device='cpu')
            result = whisper.transcribe(model, model_path, language="en", verbose=False)
            
        word_data = []
        for segment in result['segments']:
            for word in segment['words']:
                word_data.append({
                    'word': word['text'],
                    'start': word['start'],
                    'end': word['end'],
                    'role': role 
                })

        return {
            'index': turn_index,
            'audio_path': temp_audio_path,
            'word_data': word_data
        }
    except Exception as e:
        print(f"Error processing audio with Whisper for turn {turn_index}: {e}")
        return None


def generate_multi_role_audio_multiprocess(ordered_turns: list, language_code: str, tts_mode: str):
    """
    Generates audio and word data for all turns using multiprocessing or sequential
    processing based on the TTS mode.
    """
    print(f"\nSelected TTS Mode: {tts_mode.upper()} TTS")
    
    tasks = [(i, turn, tts_mode) for i, turn in enumerate(ordered_turns)]
    
    # --- FIX: Use sequential processing for Gemini TTS to prevent multiprocessing issues ---
    if tts_mode == 'gemini':
        print("Using sequential processing for GEMINI TTS.")
        results = []
        for task in tasks:
            # Unpack task tuple: (turn_index, turn, tts_mode)
            result = _generate_audio_for_turn(*task) 
            results.append(result)
    else:
        # Determine the number of processes using the centralized configuration
        num_processes = TTS_PROCESS_CONFIG.get(tts_mode, DEFAULT_TTS_PROCESSES)
        
        # Fallback/cap: Use the minimum of the configured value and the CPU count
        # and ensure it's at least 1.
        num_processes = max(1, min(num_processes, os.cpu_count() or 1))
        
        print(f"Using {num_processes} parallel process(es) for {tts_mode.upper()} TTS audio generation.")
        
        # Use Pool to execute the generation tasks for parallel processing
        with Pool(processes=num_processes) as pool:
            results = pool.starmap(_generate_audio_for_turn, tasks)
    # ------------------------------------------------------------------------------------------

    
    # Aggregate results
    all_word_data = []
    audio_clips = []
    current_offset = 0.0

    # Sort results by turn index to maintain conversation order
    successful_results = sorted([r for r in results if r is not None], key=lambda x: x['index'])

    for result in successful_results:
        turn_index = result['index']
        temp_audio_path = result['audio_path']
        word_data = result['word_data']
        
        # 1. Update word data with the offset
        for word in word_data:
            # Shift the word start/end times by the current cumulative offset
            word['start'] += current_offset
            word['end'] += current_offset
            all_word_data.append(word)

        # 2. Load audio clip and update offset
        try:
            with suppress_output():
                clip = AudioFileClip(temp_audio_path)
            audio_clips.append(clip)
            current_offset += clip.duration
        finally:
             # Clean up the file here, after MoviePy has loaded it
            if os.path.exists(temp_audio_path):
                os.remove(temp_audio_path)

    if not audio_clips:
        raise Exception("Failed to generate any audio clips. Cannot create reel.")

    final_audio_clip = concatenate_audioclips(audio_clips)
    
    # 3. Final Time Normalization/Scaling to Eliminate Lag
    # This step is critical to ensure MoviePy video duration (from audio) matches 
    # the scaled word times derived from Whisper (which might be slightly off 
    # due to Whisper's internal processing latency/accuracy).
    if all_word_data:
        true_duration = final_audio_clip.duration
        # The end time of the last word in the list represents Whisper's calculated end of speech
        whisper_total_time = all_word_data[-1]['end'] if all_word_data and 'end' in all_word_data[-1] else 0.0
        
        if whisper_total_time > 0 and abs(true_duration - whisper_total_time) > 0.1: # Only scale if difference > 0.1s
            scale_factor = true_duration / whisper_total_time
            # print(f"-> Normalizing timestamps: Scaling by {scale_factor:.4f} (True Duration: {true_duration:.2f}s, Whisper End: {whisper_total_time:.2f}s)")
        else:
            scale_factor = 1.0

        for word_data in all_word_data:
            word_data['start'] *= scale_factor
            word_data['end'] *= scale_factor
            
    return final_audio_clip, all_word_data

def filter_word_data(word_data_list):
    """Filters out words that are too short to display and adjusts timestamps."""
    filtered = []
    
    # This regex attempts to skip words that are likely just punctuation/whisper noise.
    # It requires at least one alphanumeric character.
    word_pattern = re.compile(r'[a-zA-Z0-9]') 
    
    for word in word_data_list:
        if (word['end'] - word['start'] >= MIN_CLIP_DURATION) and word_pattern.search(word['word']):
            filtered.append(word)
        # else:
            # print(f"Skipping short/empty word: {word['word']} ({word['end'] - word['start']:.3f}s)")
            
    return filtered


# --- JSON INPUT LOAD UTILITY ---

def load_input_json(file_path):
    """Loads and validates the input JSON content file."""
    try:
        with open(file_path, 'r') as f:
            data = json.load(f)
            
        ordered_turns = data['conversation']
        language_code = data.get('metadata', {}).get('language', 'en')
        
        if not isinstance(ordered_turns, list) or not ordered_turns:
            raise ValueError("JSON file must contain a non-empty list under the 'conversation' key.")
        
        # Basic validation of turn structure
        for turn in ordered_turns:
            if 'role' not in turn or 'text' not in turn:
                raise ValueError("Each turn in 'conversation' must have 'role' and 'text' keys.")
                
        return ordered_turns, language_code
        
    except FileNotFoundError:
        print(f"Error: Input file not found at {file_path}")
        return [], 'en'
    except json.JSONDecodeError:
        print(f"Error: Invalid JSON format in {file_path}")
        return [], 'en'
    except ValueError as e:
        print(f"Error in content structure for {file_path}: {e}")
        return [], 'en'