# services/gemini_tts_service.py

import os
import struct
import mimetypes
from google import genai
from google.genai import types
# Assuming config is correctly imported and ELEVEN_API_KEY_NAME is GEMINI_API_KEY_NAME
from config import GEMINI_API_KEY_NAME 

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

# --- Core Service Functions ---

def is_service_available():
    """Checks if the Gemini API key is set."""
    # Note: Assumes GEMINI_API_KEY is correctly set in the environment or .env file
    return os.environ.get(GEMINI_API_KEY_NAME) is not None

def generate_audio(text: str, voice_name: str, output_path: str, turn_index: int):
    """Generates audio using Gemini TTS and saves it as a WAV file."""
    if not is_service_available():
        raise Exception("Gemini API key not found. Please set GEMINI_API_KEY.")

    print(f"  > Gemini TTS: Generating audio for turn {turn_index} with voice '{voice_name}'.")
    
    # Initialize client using the API key from environment variables
    client = genai.Client(api_key=os.environ.get(GEMINI_API_KEY_NAME))
    
    contents = [
        types.Content(
            role="user",
            # Use keyword argument for text to pass the input to the model
            parts=[types.Part.from_text(text=text)], 
        ),
    ]
    
    generate_content_config = types.GenerateContentConfig(
        # Temperature is used for controlling the creativity/randomness, though its effect
        # on TTS quality might be less pronounced than on text generation.
        temperature=1,
        response_modalities=["audio"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                    voice_name=voice_name
                )
            ),
            language_code="en-IN"
        ),
    )
    
    # Use the appropriate Gemini TTS model. 
    # 'gemini-2.5-flash-preview-tts' is suitable for cost-efficient everyday applications.
    # 'gemini-2.5-pro-preview-tts' is available for controllable, state-of-the-art quality.
    TTS_MODEL = "gemini-2.5-flash-preview-tts" 
    
    full_audio_data = b""
    # Default MIME type for the raw PCM audio data streamed from the API
    mime_type = "audio/L16;rate=24000" 
    
    try:
        # Stream the audio chunks from the model
        for chunk in client.models.generate_content_stream(
            model=TTS_MODEL,
            contents=contents,
            config=generate_content_config,
        ):
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
        with open(output_path, "wb") as f:
            f.write(wav_data)
            
        print(f"  > Gemini TTS: Successfully saved audio to {output_path}")

    except Exception as e:
        print(f"Error processing turn {turn_index} with voice '{voice_name}': {e}")
        # Re-raise the exception to be handled by the caller (e.g., a multiprocessing worker)
        raise