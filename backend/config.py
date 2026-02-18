# config.py

import contextlib
import io
import json
import os
import sys

from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# --- DIRECTORY CONFIGURATION ---
# Determine project root (assuming this file is in backend/config.py)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")


# --- PIP ASSET CONFIGURATION ---
PIP_DIR = os.path.join(DATA_DIR, "assets", "pip")
PIP_WIDTH = 900  # Width of the PIP asset
PIP_Y_OFFSET = 100  # Distance above the captions (if centered) or from top
# -------------------------------

# --- API KEY NAME ---
ELEVEN_API_KEY_NAME = "ELEVEN_API"
GEMINI_API_KEY_NAME = "GEMINI_API_KEY"

# --- TTS SERVICE RATE LIMIT CONFIGURATION ---
GEMINI_TTS_WAIT_SECONDS = 6.0

# --- TTS MULTIPROCESSING CONFIGURATION ---
# Default to 1 for services without a specific config
DEFAULT_TTS_PROCESSES = 1
TTS_PROCESS_CONFIG = {
    "gemini": 3,  # Increased to 3 for parallel generation
    "elevenlabs": 2,  # Configured to 2
    "mac_say": 10,  # Configured to 10
}


# --- DIRECTORY CONFIGURATION ---
# Determine project root (assuming this file is in backend/config.py)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")


INPUT_DIR = os.path.join(BASE_DIR, "contents")
WEB_APP_OUT_DIR = os.path.join(BASE_DIR, "web_app", "out")

VIDEO_DIR = os.path.join(DATA_DIR, "assets", "bg_videos")
AVATAR_DIR = os.path.join(DATA_DIR, "assets", "avatars")
OUTPUT_DIR = os.path.join(BASE_DIR, "reels")
TEMP_DIR = os.path.join(BASE_DIR, "temp")  # Keep temp in root or data
AUDIO_CACHE_DIR = os.path.join(DATA_DIR, "audio_cache")
PROMPTS_DIR = os.path.join(DATA_DIR, "prompts")
CHARACTER_CONFIG_FILE = os.path.join(DATA_DIR, "characters.json")
CAPTION_DIR = os.path.join(BASE_DIR, "contents", "captions")
CAPTION_SYSTEM_PROMPT_PATH = os.path.join(
    DATA_DIR, "prompts", "captions", "blinked_thrice.txt"
)

# Temporary files for processing
TEMP_AIFF_PATH = os.path.join(TEMP_DIR, "temp_tts_audio_turn_{}.aiff")
TEMP_MP3_PATH = os.path.join(TEMP_DIR, "temp_tts_audio_turn_{}.mp3")
TEMP_WAV_PATH = os.path.join(TEMP_DIR, "temp_tts_audio_turn_{}.wav")
OUTPUT_FILE = os.path.join(TEMP_DIR, "temp_reel_export.mp4")


# --- VIDEO & TEXT STYLES ---
TARGET_W, TARGET_H = 1080, 1920  # Vertical 9:16
VIDEO_PADDING_START = 0.5  # Seconds of silence at start
VIDEO_PADDING_END = 0.5  # Seconds of silence at end
FONT = os.path.join(DATA_DIR, "fonts", "Inter_28pt-ExtraBold.ttf")
FONT_SIZE = 90
TEXT_COLOR = "white"
STROKE_COLOR = "black"
STROKE_WIDTH = 4
CAPTION_POSITION = "center"
BOUNCE_SCALE_MAX = 1.0
HIGHLIGHT_PALETTE = ["#FF4500", "#FFA500", "#FFD700", "#32CD32", "#1E90FF", "#9370DB"]
MIN_CLIP_DURATION = 0.04

# --- PLATFORM DETECTION ---
import platform

IS_MAC = platform.system() == "Darwin"

# --- HARDWARE ACCELERATION CONFIGURATION ---
if IS_MAC:
    # Use h264_videotoolbox for macOS hardware acceleration
    VIDEO_CODEC = "h264_videotoolbox"
else:
    # Linux/Windows configuration
    VIDEO_CODEC = "libx264"

# --- WHISPER DEVICE CONFIGURATION ---
import torch

if IS_MAC:
    WHISPER_DEVICE = "mps"
elif torch.cuda.is_available():
    WHISPER_DEVICE = "cuda"
else:
    WHISPER_DEVICE = "cpu"

# --- AVATAR DISPLAY CONFIGURATION ---
AVATAR_WIDTH = 800
AVATAR_Y_POS = 1920  # Y position for the avatars on screen

# --- CHARACTER CONFIGURATION (DYNAMICALLY LOADED) ---
# Load character/voice/avatar mapping from a central file
CHARACTER_MAP = {}
try:
    if os.path.exists(CHARACTER_CONFIG_FILE):
        with open(CHARACTER_CONFIG_FILE, "r") as f:
            CHARACTER_MAP = json.load(f)
    else:
        print(
            f"Error: Character config file '{CHARACTER_CONFIG_FILE}' not found. Using empty map."
        )
except json.JSONDecodeError:
    print(
        f"Error: Character config file '{CHARACTER_CONFIG_FILE}' contains invalid JSON. Using empty map."
    )


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
