# services/mac_say_tts.py

import os
import subprocess
import time
import platform # Import the platform module

# --- Service Availability Check ---

def is_service_available():
    """
    Checks if the 'say' command is available, which indicates macOS.
    
    The original logic was:
    1. Check if the OS is Darwin (macOS/iOS family).
    2. Then, check if the 'say' command executes.
    """
    # 1. Check if the operating system is Darwin (the kernel for macOS)
    if platform.system() != 'Darwin':
        # This is the most common reason for failure.
        print("Warning: MAC_SAY TTS requires macOS (platform 'Darwin'). Current OS is:", platform.system())
        return False
        
    # 2. If it is macOS, check if the 'say' utility is actually executable
    try:
        # Check if the 'say' command executes without error
        # We don't need to check for '--version', just a quick execution test
        subprocess.run(
            ['say', '-v', '?', 'Hello'], # Use -v ? to quickly list voices, or just a small text
            check=True, 
            stdout=subprocess.PIPE, 
            stderr=subprocess.PIPE,
            timeout=5
        )
        return True
    except (FileNotFoundError, subprocess.CalledProcessError, TimeoutError) as e:
        print(f"Error: 'say' command failed to execute even on a macOS-identified system: {e}")
        return False


# --- Main Generation Function ---

def generate_audio(text: str, voice_name: str, output_path: str, turn_index: int, voice_id=None):
    """
    Generates audio using the macOS 'say' command and saves it as an AIFF file.

    voice_id is included for compatibility with other TTS service signatures.
    """
    # This check is technically redundant if the caller checks is_service_available(),
    # but it provides a clean failure point if called directly.
    if not is_service_available():
        # Raise an exception that is more specific than the generic message in audio_generator.py
        raise Exception("MAC_SAY TTS service is unavailable. Ensure the script runs on macOS and the 'say' command is functional.")

    # FIX: Ensure the output directory exists before writing the file
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # 1. Define the 'say' command
    command = [
        'say',
        '-o', os.path.abspath(output_path),
        '-v', voice_name,
        text
    ]

    print(f"  > MAC_SAY TTS: Executing command for turn {turn_index}: {' '.join(command[:4])} ...")

    # 2. Execute the command
    try:
        process = subprocess.run(
            command,
            check=True, 
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=30
        )
        
        # 3. Verification
        if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
            return output_path
        else:
            error_output = process.stderr.decode('utf-8')
            raise Exception(f"MAC_SAY failed to create audio file. Stderr: {error_output}")

    except subprocess.CalledProcessError as e:
        error_output = e.stderr.decode('utf-8')
        raise Exception(f"MAC_SAY command failed for turn {turn_index}. Error: {error_output}")
    except FileNotFoundError:
        # This error is expected on non-macOS systems without proper service check.
        raise Exception("The 'say' command was not found (FileNotFound). Are you on macOS?")
    except TimeoutError:
        raise Exception(f"MAC_SAY command timed out after 30 seconds for turn {turn_index}.")
    except Exception as e:
        raise Exception(f"An unexpected error occurred during MAC_SAY for turn {turn_index}: {e}")