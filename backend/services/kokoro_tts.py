# services/kokoro_tts.py

import os
import sys
import numpy as np

try:
    from kokoro_onnx import Kokoro
except ImportError:
    Kokoro = None

try:
    import soundfile as sf
except ImportError:
    sf = None

try:
    from ..config import KOKORO_MODEL_PATH, KOKORO_VOICES_PATH
except ImportError:
    try:
        from config import KOKORO_MODEL_PATH, KOKORO_VOICES_PATH
    except ImportError:
        KOKORO_MODEL_PATH = "data/models/kokoro/kokoro-v1.0.onnx"
        KOKORO_VOICES_PATH = "data/models/kokoro/voices-v1.0.bin"

_KOKORO_INSTANCE = None

def _get_kokoro():
    """Returns a lazily initialized Kokoro instance."""
    global _KOKORO_INSTANCE
    if _KOKORO_INSTANCE is None:
        if Kokoro is None:
            raise ImportError("kokoro-onnx is not installed.")
        
        if not os.path.exists(KOKORO_MODEL_PATH):
            raise FileNotFoundError(f"Kokoro model not found at {KOKORO_MODEL_PATH}")
        if not os.path.exists(KOKORO_VOICES_PATH):
            raise FileNotFoundError(f"Kokoro voices not found at {KOKORO_VOICES_PATH}")
            
        print(f"  > Kokoro TTS: Loading model from {KOKORO_MODEL_PATH}...")
        _KOKORO_INSTANCE = Kokoro(KOKORO_MODEL_PATH, KOKORO_VOICES_PATH)
    return _KOKORO_INSTANCE

def is_service_available():
    """Checks if Kokoro and its dependencies/models are available."""
    if Kokoro is None or sf is None:
        return False
    return os.path.exists(KOKORO_MODEL_PATH) and os.path.exists(KOKORO_VOICES_PATH)

def generate_audio(text, voice_id, output_path, turn_index):
    """
    Generates audio using Kokoro-ONNX and saves it to a WAV file.
    """
    if not is_service_available():
        if Kokoro is None or sf is None:
            raise Exception("Kokoro dependencies (kokoro-onnx, soundfile) are not installed.")
        raise Exception(f"Kokoro model files not found. Please ensure they exist at {KOKORO_MODEL_PATH} and {KOKORO_VOICES_PATH}")

    try:
        kokoro = _get_kokoro()
        
        # Kokoro expects voice_id (e.g., 'af_sarah')
        # We can also pass speed=1.0 by default or allow customization later
        samples, sample_rate = kokoro.create(
            text, 
            voice=voice_id, 
            speed=1.0, 
            lang="en-us"
        )

        # Save to WAV file
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        sf.write(output_path, samples, sample_rate)

        if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
            raise FileNotFoundError(f"Kokoro failed to create audio file for turn {turn_index}.")

        return output_path

    except Exception as e:
        print(f"Kokoro TTS Error for turn {turn_index}: {e}", file=sys.stderr)
        raise
