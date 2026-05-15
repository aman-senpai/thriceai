# services/kokoro_mlx_tts.py

import os
import sys

import numpy as np

try:
    import mlx.core as mx
    import soundfile as sf
    from mlx_audio.tts.utils import load_model
except ImportError:
    load_model = None

try:
    from ..config import KOKORO_MLX_MODEL
except ImportError:
    try:
        from config import KOKORO_MLX_MODEL
    except ImportError:
        KOKORO_MLX_MODEL = "mlx-community/Kokoro-82M-bf16"

_MODEL_INSTANCE = None


def is_service_available():
    """Checks if mlx-audio is installed and we are on Apple Silicon."""
    if load_model is None:
        return False
    try:
        mx.array([1.0])
        return True
    except:
        return False


def _get_model():
    """Lazily loads the MLX model."""
    global _MODEL_INSTANCE
    if _MODEL_INSTANCE is None:
        if load_model is None:
            raise ImportError("mlx-audio is not installed.")

        # Use local suppression to keep terminal clean
        import contextlib
        import io

        # print(f"  > Kokoro MLX TTS: Loading model {KOKORO_MLX_MODEL}...")
        with contextlib.redirect_stdout(io.StringIO()):
            _MODEL_INSTANCE = load_model(KOKORO_MLX_MODEL)
    return _MODEL_INSTANCE


# Voice prefix → Kokoro lang_code mapping
# See VOICES.md for full reference
_VOICE_LANG_MAP = {
    "af_": "a",
    "am_": "a",  # American English
    "bf_": "b",
    "bm_": "b",  # British English
    "jf_": "j",
    "jm_": "j",  # Japanese
    "zf_": "z",
    "zm_": "z",  # Mandarin Chinese
    "ef_": "e",
    "em_": "e",  # Spanish
    "ff_": "f",  # French
    "hf_": "h",
    "hm_": "h",  # Hindi
    "if_": "i",
    "im_": "i",  # Italian
    "pf_": "p",
    "pm_": "p",  # Brazilian Portuguese
}


def _infer_lang_code(voice_id: str) -> str:
    """Infer Kokoro lang_code from voice prefix. Defaults to 'a' (American English)."""
    for prefix, code in _VOICE_LANG_MAP.items():
        if voice_id.startswith(prefix):
            return code
    return "a"


# ISO 639-1 → Kokoro lang_code mapping
_ISO_TO_KOKORO = {
    "en": "a",  # English
    "hi": "h",  # Hindi
    "ja": "j",  # Japanese
    "zh": "z",  # Mandarin Chinese
    "es": "e",  # Spanish
    "fr": "f",  # French
    "it": "i",  # Italian
    "pt": "p",  # Portuguese
}


def _script_lang_to_kokoro(language_code: str | None) -> str | None:
    """Map script language_code (ISO 639-1) to Kokoro lang_code."""
    if language_code:
        return _ISO_TO_KOKORO.get(language_code)
    return None


def generate_audio_mlx(text, voice_id, output_path, turn_index, language_code=None):
    """
    Generates audio using MLX-Audio (optimized for Apple Silicon).

    Uses script language_code as primary lang_code source,
    falls back to voice prefix inference.

    Args:
        language_code: Script language code (ISO 639-1, e.g. 'en', 'hi', 'ja').
    """
    if not is_service_available():
        raise Exception("MLX-Audio service is not available.")

    try:
        model = _get_model()

        # Use script language_code as primary, fall back to voice inference
        lang_code = _script_lang_to_kokoro(language_code) or _infer_lang_code(voice_id)

        # Strip newlines — the model treats them as line separators and
        # errors when input/output line counts mismatch
        text = text.replace("\n", " ").replace("\r", " ").strip()

        # Generate audio using the model instance
        # model.generate returns a generator of results
        audio_chunks = []
        for result in model.generate(
            text=text, voice=voice_id, lang_code=lang_code, speed=1.0
        ):
            # result.audio is an mx.array, collect without conversion
            audio_chunks.append(result.audio)

        if not audio_chunks:
            raise Exception("No audio generated.")

        # Concatenate using MLX, then convert to numpy once
        full_audio = np.array(mx.concatenate(audio_chunks))

        # Save to file
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        sf.write(output_path, full_audio, 24000)  # Kokoro is 24kHz

        if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
            raise FileNotFoundError(f"MLX-Audio failed to create audio file.")

        return output_path

    except Exception as e:
        print(f"Kokoro MLX TTS Error for turn {turn_index}: {e}", file=sys.stderr)
        raise
