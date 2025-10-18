# config.py

import io
import os
import contextlib

# --- DIRECTORY CONFIGURATION ---
INPUT_DIR = "contents" 
VIDEO_FILE = "assets/minecraft.mp4" 
OUTPUT_DIR = "reels" 
TEMP_DIR = "temp_files"

# Temporary files for processing
TEMP_AIFF_PATH = os.path.join(TEMP_DIR, "temp_tts_audio_turn_{}.aiff") 
OUTPUT_FILE = os.path.join(TEMP_DIR, "temp_reel_export.mp4") 

# --- VIDEO CONFIGURATION ---
TARGET_W, TARGET_H = 1080, 1920 # 9:16 aspect ratio

# --- FONT & CAPTION CONFIGURATION ---
FONT = "fonts/ComicNeue-Bold.ttf" 
FONT_SIZE = 110
TEXT_COLOR = 'white'
STROKE_COLOR = 'black'
STROKE_WIDTH = 6
CAPTION_POSITION = 'center' 
BOUNCE_SCALE_MAX = 1.20
MIN_CLIP_DURATION = 0.04 

# --- CUSTOM VOICE CONFIGURATION ---
VOICE_AMAN = "Aman" 
VOICE_ISHA = "Isha" 
VOICE_MAP = {
    "Aman": VOICE_AMAN,
    "Isha": VOICE_ISHA
}

@contextlib.contextmanager
def suppress_output():
    """Context manager to suppress stdout and stderr."""
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        yield