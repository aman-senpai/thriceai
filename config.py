# config.py

import io
import os
import contextlib

# --- API KEY NAME ---
# The environment variable name for the ElevenLabs API key in the .env file
ELEVEN_API_KEY_NAME = "ELEVEN_API" 
# NEW: The environment variable name for the Gemini API key
GEMINI_API_KEY_NAME = "GEMINI_API_KEY" 

# --- TTS SERVICE RATE LIMIT CONFIGURATION --- # <--- ADDED SECTION
# To respect the Gemini Free Tier limit of 3 requests per minute (RPM).
# 60 seconds / 3 requests = 20 seconds minimum delay between calls.
GEMINI_TTS_WAIT_SECONDS = 6.0

# --- TTS TOGGLE ---
# NOTE: USE_ELEVENLABS is now handled dynamically in main.py and elevenlabs_service.py

# --- DIRECTORY CONFIGURATION ---
INPUT_DIR = "contents" 
VIDEO_DIR = "assets/bg_videos"
AVATAR_DIR = "assets/avatars" 
OUTPUT_DIR = "reels" 
TEMP_DIR = "temp"

# Temporary files for processing
TEMP_AIFF_PATH = os.path.join(TEMP_DIR, "temp_tts_audio_turn_{}.aiff") 
TEMP_MP3_PATH = os.path.join(TEMP_DIR, "temp_tts_audio_turn_{}.mp3") 
TEMP_WAV_PATH = os.path.join(TEMP_DIR, "temp_tts_audio_turn_{}.wav") # <--- ADDED
OUTPUT_FILE = os.path.join(TEMP_DIR, "temp_reel_export.mp4") 

# --- VIDEO CONFIGURATION ---
TARGET_W, TARGET_H = 1080, 1920 # 9:16 aspect ratio

# --- AVATAR CONFIGURATION (FINAL) ---
# Use a single dimension for resizing to ensure aspect ratio is maintained.
AVATAR_WIDTH = 800 # The desired width. Height will be calculated automatically.
AVATAR_Y_OFFSET = 0 # A small offset (in pixels) from the bottom edge of the screen
# This is the Y-coordinate the BOTTOM of the avatar will be anchored to.
AVATAR_Y_POS = TARGET_H - AVATAR_Y_OFFSET 
AVATAR_X_MARGIN = 35 # Horizontal margin from the edge

AVATAR_LEFT_POS = AVATAR_X_MARGIN # X position for left avatar
AVATAR_RIGHT_POS = TARGET_W - AVATAR_WIDTH - AVATAR_X_MARGIN # X position for right avatar

# --- TIMING CONFIGURATION (NEW) ---
VIDEO_PADDING_START = 0.5 # Add 0.5 seconds of padding at the start
VIDEO_PADDING_END = 0.5   # Add 0.5 seconds of padding at the end
# Total offset for content is VIDEO_PADDING_START

# --- FONT & CAPTION CONFIGURATION ---
FONT = "fonts/Inter_24pt-ExtraBoldItalic.ttf.ttf" 
FONT_SIZE = 105
TEXT_COLOR = 'white'
STROKE_COLOR = 'black'
STROKE_WIDTH = 6
CAPTION_POSITION = 'center' 
BOUNCE_SCALE_MAX = 1.20
MIN_CLIP_DURATION = 0.04 

# --- CUSTOM VOICE CONFIGURATION ---
# macOS 'say' voices (Fallback)
VOICE_AMAN_MAC = "Aman" 
VOICE_ISHA_MAC = "Isha (Premium)" 

# ElevenLabs Voice IDs (These are examples, replace with actual IDs)
VOICE_AMAN_ELEVEN = "KSsyodh37PbfWy29kPtx" # e.g., Rachel
VOICE_ISHA_ELEVEN = "RXe6OFmxoC0nlSWpuCDy" # e.g., Bella

# NEW: Gemini Prebuilt Voice Names
VOICE_AMAN_GEMINI = "Rasalgethi"
VOICE_ISHA_GEMINI = "Sulafat"
VOICE_MAP_MAC = {
    "Aman": VOICE_AMAN_MAC,
    "Isha": VOICE_ISHA_MAC
}

VOICE_MAP_ELEVEN = {
    "Aman": VOICE_AMAN_ELEVEN,
    "Isha": VOICE_ISHA_ELEVEN
}

VOICE_MAP_GEMINI = { # <--- ADDED
    "Aman": VOICE_AMAN_GEMINI,
    "Isha": VOICE_ISHA_GEMINI
}

# VOICE_MAP REMOVED (now determined in audio_processing.py)

# Map roles to their avatar file, position, and horizontal flip status
AVATAR_CONFIG = {
    "Aman": {
        "file": "aman.png",
        "pos_x": AVATAR_LEFT_POS, 
        "flip": False # FIXED: Do not flip
    },
    "Isha": {
        "file": "isha.png",
        "pos_x": AVATAR_RIGHT_POS, 
        "flip": False # Do not flip Isha
    }
}


@contextlib.contextmanager
def suppress_output():
    """Context manager to suppress stdout and stderr."""
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        yield