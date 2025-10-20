# elevenlabs_service.py

import os
import sys
from elevenlabs import ElevenLabs
from dotenv import load_dotenv

# Load environment variables (needed to check for API key)
load_dotenv() 

ELEVEN_CLIENT = None
# ELEVEN_API_KEY_NAME must match the one defined in config.py
ELEVEN_API_KEY_NAME = "ELEVEN_API" 

def initialize_elevenlabs_client():
    """Initializes the ElevenLabs client and returns True if successful."""
    global ELEVEN_CLIENT
    ELEVEN_API_KEY = os.getenv(ELEVEN_API_KEY_NAME)

    if ELEVEN_API_KEY:
        try:
            # The client initialization implicitly checks key validity
            ELEVEN_CLIENT = ElevenLabs(api_key=ELEVEN_API_KEY)
            return True
        except Exception as e:
            # Handles connection errors or immediate authentication failures
            print(f"Error initializing ElevenLabs client: {e}", file=sys.stderr)
            return False
    else:
        return False

# Initialize when the module is imported. The result determines availability.
SERVICE_AVAILABLE = initialize_elevenlabs_client()
if not SERVICE_AVAILABLE:
    # Print the warning only if the attempt failed due to missing key or initialization error
    print("Warning: ElevenLabs API key is missing or invalid. ElevenLabs mode will be disabled.")

def is_service_available():
    """Checks if the ElevenLabs client was successfully initialized."""
    return SERVICE_AVAILABLE

def generate_audio(text, voice_id, output_path, turn_index):
    """
    Generates audio using ElevenLabs API and saves it to a file.
    """
    if not ELEVEN_CLIENT:
        raise Exception("ElevenLabs client not initialized or unavailable.") 
        
    try:
        # 1. Get the audio stream (generator)
        audio_stream = ELEVEN_CLIENT.text_to_speech.convert( 
            text=text,
            voice_id=voice_id,
            model_id="eleven_multilingual_v2", 
            output_format="mp3_44100_128"
        )
        
        # 2. Iterate over the generator to write chunks to the file
        with open(output_path, "wb") as f:
            for chunk in audio_stream:
                f.write(chunk)
            
        if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
            raise FileNotFoundError(f"ElevenLabs failed to create audio file for turn {turn_index}.")
        
        return output_path
        
    except Exception as e:
        # Print the error but re-raise for upstream handling
        print(f"ElevenLabs API Error for turn {turn_index}: {e}", file=sys.stderr)
        raise