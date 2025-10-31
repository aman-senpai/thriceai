# config.py

import io
import os
import contextlib
import json 
import sys

# --- NEW FOLLOW ANIMATION CONFIGURATION ---
FOLLOW_ANIMATION_PATH = "assets/follow_animation/follow animation.webp"
FOLLOW_TRIGGER_WORD = "follow" # The word that triggers the animation
ANIMATION_DURATION = 1.0       # Duration (in seconds) the animation should play for
ANIMATION_Y_POS = 100          # Y position for the animation on screen
ANIMATION_SCALE = 0.5          # Scale factor for the animation
# -----------------------------------------

# --- API KEY NAME ---
ELEVEN_API_KEY_NAME = "ELEVEN_API" 
GEMINI_API_KEY_NAME = "GEMINI_API_KEY" 

# --- TTS SERVICE RATE LIMIT CONFIGURATION --- 
GEMINI_TTS_WAIT_SECONDS = 6.0

# --- TTS MULTIPROCESSING CONFIGURATION ---
# Default to 1 for services without a specific config
DEFAULT_TTS_PROCESSES = 1 
TTS_PROCESS_CONFIG = {
    'gemini': 1,      # Limited to 1 due to API/rate constraints
    'elevenlabs': 2,  # Configured to 2
    'mac_say': 10     # Configured to 10
}


# --- DIRECTORY CONFIGURATION ---
INPUT_DIR = "contents" 
VIDEO_DIR = "assets/bg_videos"
AVATAR_DIR = "assets/avatars" 
OUTPUT_DIR = "reels" 
TEMP_DIR = "temp"
PROMPTS_DIR = "prompts"
CHARACTER_CONFIG_FILE = "characters.json"
CAPTION_DIR = "contents/captions"
CAPTION_SYSTEM_PROMPT_PATH = "prompts/captions/blinked_thrice.txt"

# Temporary files for processing
TEMP_AIFF_PATH = os.path.join(TEMP_DIR, "temp_tts_audio_turn_{}.aiff") 
TEMP_MP3_PATH = os.path.join(TEMP_DIR, "temp_tts_audio_turn_{}.mp3") 
TEMP_WAV_PATH = os.path.join(TEMP_DIR, "temp_tts_audio_turn_{}.wav") 
OUTPUT_FILE = os.path.join(TEMP_DIR, "temp_reel_export.mp4") 


# --- VIDEO & TEXT STYLES ---
TARGET_W, TARGET_H = 1080, 1920 # Vertical 9:16
VIDEO_PADDING_START = 0.5  # Seconds of silence at start
VIDEO_PADDING_END = 0.5    # Seconds of silence at end
FONT = "fonts/Inter_24pt-ExtraBoldItalic.ttf.ttf" 
FONT_SIZE = 105
TEXT_COLOR = 'white'
STROKE_COLOR = 'black'
STROKE_WIDTH = 3
CAPTION_POSITION = 'center' 
BOUNCE_SCALE_MAX = 1.20
MIN_CLIP_DURATION = 0.04 

# --- AVATAR DISPLAY CONFIGURATION ---
AVATAR_WIDTH = 800 
AVATAR_Y_POS = 1920 # Y position for the avatars on screen

# --- CHARACTER CONFIGURATION (DYNAMICALLY LOADED) ---
# Load character/voice/avatar mapping from a central file
CHARACTER_MAP = {}
try:
    if os.path.exists(CHARACTER_CONFIG_FILE):
        with open(CHARACTER_CONFIG_FILE, 'r') as f:
            CHARACTER_MAP = json.load(f)
    else:
        print(f"Error: Character config file '{CHARACTER_CONFIG_FILE}' not found. Using empty map.")
except json.JSONDecodeError:
    print(f"Error: Character config file '{CHARACTER_CONFIG_FILE}' contains invalid JSON. Using empty map.")


# --- UTILITY CONTEXT MANAGER ---
@contextlib.contextmanager
def suppress_output():
    """Context manager to suppress stdout and stderr."""
    save_stdout = sys.stdout
    save_stderr = sys.stderr
    sys.stdout = io.StringIO()
    sys.stderr = io.StringIO()
    try:
        yield
    finally:
        sys.stdout = save_stdout
        sys.stderr = save_stderr