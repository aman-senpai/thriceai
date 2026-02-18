# services/gemini_tts.py

import os
import struct
import mimetypes
from google import genai
from google.genai import types
from dotenv import load_dotenv
try:
    from ..config import GEMINI_API_KEY_NAME
except ImportError:
    try:
        from config import GEMINI_API_KEY_NAME
    except ImportError:
        GEMINI_API_KEY_NAME = "GEMINI_API_KEY"

# Load environment variables (force reload to ensure .env takes precedence)
load_dotenv(override=True)

# --- Utility Functions ---

def parse_audio_mime_type(mime_type: str) -> dict[str, int | None]:
    """Parses bits per sample and rate from an audio MIME type string.

    Assumes bits per sample is encoded like "L16" and rate as "rate=xxxxx".
    """
    bits_per_sample = 16
    rate = 24000

    parts = mime_type.split(";")
    for param in parts:
        param = param.strip()
        if param.lower().startswith("rate="):
            try:
                rate = int(param.split("=", 1)[1])
            except (ValueError, IndexError):
                pass
        elif param.startswith("audio/L"):
            try:
                # The mime type includes "audio/L<bits_per_sample>", e.g. audio/L16
                bits_per_sample = int(param.split("L", 1)[1])
            except (ValueError, IndexError):
                pass

    return {"bits_per_sample": bits_per_sample, "rate": rate}

def convert_to_wav(audio_data: bytes, mime_type: str) -> bytes:
    """Generates a WAV file header for the given raw audio data and parameters."""
    parameters = parse_audio_mime_type(mime_type)
    bits_per_sample = parameters["bits_per_sample"]
    sample_rate = parameters["rate"]
    num_channels = 1
    data_size = len(audio_data)
    bytes_per_sample = bits_per_sample // 8
    block_align = num_channels * bytes_per_sample
    byte_rate = sample_rate * block_align
    chunk_size = 36 + data_size

    # http://soundfile.sapp.org/doc/WaveFormat/

    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF",          # ChunkID
        chunk_size,        # ChunkSize (total file size - 8 bytes)
        b"WAVE",          # Format
        b"fmt ",          # Subchunk1ID
        16,                # Subchunk1Size (16 for PCM)
        1,                 # AudioFormat (1 for PCM)
        num_channels,      # NumChannels
        sample_rate,       # SampleRate
        byte_rate,         # ByteRate
        block_align,       # BlockAlign
        bits_per_sample,   # BitsPerSample
        b"data",          # Subchunk2ID
        data_size          # Subchunk2Size (size of audio data)
    )
    return header + audio_data


# --- Service Initialization ---

def initialize_gemini_client():
    """Initializes the Gemini client."""
    GEMINI_API_KEY = os.getenv(GEMINI_API_KEY_NAME)

    if GEMINI_API_KEY:
        try:
            # Client is initialized without the API key here, but relies on 
            # the API key being set in the environment or passed directly in
            # the generate_audio function for subsequent calls.
            # Returning None if the key is not available is a simple check.
            return genai.Client(api_key=GEMINI_API_KEY)
        except Exception as e:
            # It's better to initialize the client per call or check the key later.
            # For simplicity, we'll keep the key check in generate_audio.
            print(f"Error initializing Gemini client: {e}")
            return None
    return None

# --- Singleton Client ---
_GEMINI_CLIENT = None

def _get_client():
    """Returns a cached Gemini client singleton to avoid re-initialization per call."""
    global _GEMINI_CLIENT
    if _GEMINI_CLIENT is None:
        _GEMINI_CLIENT = genai.Client(api_key=os.environ.get(GEMINI_API_KEY_NAME))
    return _GEMINI_CLIENT

def is_service_available():
    """Checks if the Gemini client can be initialized (i.e., API key is set)."""
    return os.environ.get(GEMINI_API_KEY_NAME) is not None

# --- Main Generation Function ---

def generate_audio(text, voice_name, output_path, turn_index, voice_id=None):
    """
    Generates audio using Gemini TTS and saves it to a WAV file.

    voice_id=None is included to accept the fifth positional argument for compatibility.
    """
    if not is_service_available():
        raise Exception("Gemini API key not found. Please set GEMINI_API_KEY.")

    print(f"  > Gemini TTS: Generating audio for turn {turn_index} with voice '{voice_name}'.")

    client = _get_client()

    # --- Use the correct TTS API pattern ---
    contents = [
        types.Content(
            role="user",
            # Pass text as a keyword argument for maximum library compatibility
            parts=[types.Part.from_text(text=text)],
        ),
    ]

    generate_content_config = types.GenerateContentConfig(
        response_modalities=["audio"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                    voice_name=voice_name
                )
            ),
            # Assuming 'en-IN' as per the working file, adjust if needed
            language_code="en-IN"
        ),
    )

    # Use the dedicated TTS model
    TTS_MODEL = "gemini-2.5-flash-preview-tts"

    full_audio_data = b""
    # Default MIME type for the raw PCM audio data streamed from the API
    mime_type = "audio/L16;rate=24000"

    try:
        # Stream the audio chunks from the model
        response_stream = client.models.generate_content_stream(
            model=TTS_MODEL,
            contents=contents,
            config=generate_content_config,
        )

        for chunk in response_stream:
            # Check if the chunk contains inline audio data
            if (chunk.candidates and
                chunk.candidates[0].content and
                chunk.candidates[0].content.parts and
                chunk.candidates[0].content.parts[0].inline_data and
                chunk.candidates[0].content.parts[0].inline_data.data):

                inline_data = chunk.candidates[0].content.parts[0].inline_data
                full_audio_data += inline_data.data
                # Update mime_type with the one provided by the API in the chunk metadata
                mime_type = inline_data.mime_type

        if not full_audio_data:
            # Check for error message if no audio data was received
            if chunk.text:
                raise Exception(f"Gemini API returned an error: {chunk.text}")
            else:
                raise Exception("Gemini API returned no audio data.")

        # Convert the raw PCM data to a complete WAV file format by adding the header
        wav_data = convert_to_wav(full_audio_data, mime_type)

        # Save the final WAV file
        try:
            # FIX: Ensure the output directory exists before writing the file
            os.makedirs(os.path.dirname(output_path), exist_ok=True)

            with open(output_path, "wb") as f:
                f.write(wav_data)

            print(f"  > Gemini TTS: Successfully saved audio to {output_path}")
            return output_path

        except Exception as file_save_error:
            # Clean up partial file on save error
            if os.path.exists(output_path):
                 os.remove(output_path)
            raise Exception(f"Failed to save WAV file for turn {turn_index}: {file_save_error}")

    except Exception as e:
        # Re-raise the exception to be handled by the caller
        raise