# audio_processing.py

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

from config import (
    VOICE_MAP, 
    TEMP_AIFF_PATH, 
    MIN_CLIP_DURATION, 
)

# --- UTILITY CONTEXT MANAGER (Defined locally for multiprocessing) ---
@contextlib.contextmanager
def suppress_output():
    """Context manager to suppress stdout and stderr. Defined here for multiprocessing safety."""
    # We use io.StringIO() and sys.stdout/stderr redirection
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        yield

# -------------------------------------------------------------------


def load_input_json(filepath):
    """Loads the conversation from the input JSON file."""
    start_time = time.time()
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        ordered_turns = data.get("conversation")

        if not ordered_turns:
            raise ValueError(
                "JSON input must contain a 'conversation' array of turn objects."
            )
            
        language_code = data.get("languageCode", "en")

        print(f"Loaded JSON input in {time.time() - start_time:.2f}s")
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

def process_single_turn(turn_data, language_code, turn_index):
    """
    Generates audio and gets word-level timestamps from Whisper using macOS 'say'.
    Returns: (turn_index, audio_duration, whisper_word_data, temp_aiff_path)
    """
    role = turn_data["role"]
    text = turn_data["text"]
    role_voice = VOICE_MAP.get(role)
    temp_aiff_path = TEMP_AIFF_PATH.format(turn_index)
    
    if not role_voice:
        print(f"Error: Role '{role}' not mapped to a voice. Skipping turn {turn_index}.")
        return None
        
    try:
        # 1. Generate Custom Audio using macOS 'say'
        escaped_text = text.replace('"', '\\"') 
        command = f'echo "{escaped_text}" | say -v "{role_voice}" -o {temp_aiff_path} -f -'
        # Note: os.system runs synchronously here
        os.system(command)
        
        if not os.path.exists(temp_aiff_path) or os.path.getsize(temp_aiff_path) == 0:
            raise FileNotFoundError(f"Failed to create audio for turn {turn_index}.")

        # 2. Transcribe with Whisper (for TIMING ONLY)
        with suppress_output():
            audio = whisper.load_audio(temp_aiff_path) 
        
        # Load model inside here for starmap compatibility, but note performance impact
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
        
        with suppress_output():
            audio_duration = AudioFileClip(temp_aiff_path).duration 
        
        return turn_index, audio_duration, whisper_word_data_raw, temp_aiff_path

    except Exception as e:
        print(f"Error processing turn {turn_index} ({role}): {e}", file=sys.stderr)
        return None

def generate_multi_role_audio_multiprocess(ordered_turns, language_code):
    """
    Generates audio for all turns concurrently, concatenates them, 
    and applies time scaling to align Whisper timestamps with true audio duration.
    """
    total_start_time = time.time()
    
    tasks = [
        (turn, language_code, i) 
        for i, turn in enumerate(ordered_turns)
    ]

    max_processes_limit = 8
    num_processes = min(os.cpu_count() or 1, max_processes_limit, len(tasks)) 
    print(f"Starting audio generation with {num_processes} parallel processes...")

    with Pool(processes=num_processes) as pool:
        all_results = pool.starmap(process_single_turn, tasks)

    valid_results = sorted([r for r in all_results if r is not None], key=lambda x: x[0])
    
    if not valid_results:
        raise ValueError("No audio clips were successfully generated for multi-role content.")

    # Concatenate Audio and Adjust Timestamps (sequentially)
    all_word_data = []
    audio_clips = []
    current_offset = 0.0
    
    print("Concatenating audio and adjusting timestamps...")
    
    for _, duration, whisper_word_data_raw, temp_aiff_path in valid_results:
        
        word_data_list = whisper_word_data_raw 
        
        # 1. Offset word timestamps
        for word_data in word_data_list:
            word_data['start'] += current_offset
            word_data['end'] += current_offset
        all_word_data.extend(word_data_list)
        
        # 2. Load audio clip and update offset
        with suppress_output():
            clip = AudioFileClip(temp_aiff_path)
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

        print(f"Applying time scale factor of {scale_factor:.4f} (Audio: {true_duration:.2f}s, Whisper: {whisper_total_time:.2f}s)")
        
        for word_data in all_word_data:
            word_data['start'] *= scale_factor
            word_data['end'] *= scale_factor

    print(f"Multi-Role TTS + Timestamps (Multiprocessing) completed in {time.time() - total_start_time:.2f}s")
            
    return final_audio_clip, all_word_data

def filter_word_data(word_data_list):
    """Filters out words that are too short in duration and empty text."""
    return [
        word_data for word_data in word_data_list 
        if (word_data['end'] - word_data['start']) >= MIN_CLIP_DURATION and word_data['word']
    ]