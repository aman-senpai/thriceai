# main.py

import os
import warnings
import shutil
import time
import glob # NEW: Required for glob.glob
from processors.reel_generator import ReelGenerator
from config import INPUT_DIR, VIDEO_DIR, TEMP_DIR
from services.content_writer import generate_content

warnings.filterwarnings(
    "ignore",
    message="resource_tracker: There appear to be",
    category=UserWarning
)

def cleanup_temp_dir():
    """Removes temporary directory and contents."""
    if os.path.exists(TEMP_DIR):
        try:
            shutil.rmtree(TEMP_DIR)
        except Exception as e:
            print(f"Cleanup Warning: {e}")

def get_files_from_dir(directory: str):
    """Returns a list of all JSON files in the specified directory."""
    return glob.glob(os.path.join(directory, "*.json"))

def generate_reels(files_to_process: list, audio_mode: str):
    """Generates video reels from provided JSON content files."""
    print("\nReel Generation Mode\n" + "-" * 25)

    if not os.path.isdir(VIDEO_DIR):
        print(f"Error: Video directory '{VIDEO_DIR}' not found.")
        return

    if not files_to_process:
        print("No content files found to process.")
        return

    print(f"Processing {len(files_to_process)} file(s)...\n")

    for i, input_path in enumerate(files_to_process, 1):
        json_file = os.path.basename(input_path)
        print(f"[{i}/{len(files_to_process)}] Generating reel: {json_file}")

        try:
            generator = ReelGenerator(input_path)
            generator.create_reel(audio_mode) # Pass the selected mode
        except Exception as e:
            print(f"Error generating reel for {json_file}: {e}")

        cleanup_temp_dir()
        time.sleep(1)

    print("\nAll reels generated successfully.\n")

def content_creation_cli():
    """Interactive CLI for content generation and reel initiation."""
    
    # 1. Select Audio Mode # <--- MODIFIED
    print("\nSelect Audio Mode:")
    print("  [1] elevenlabs (Premium TTS, requires API key)")
    print("  [2] default (System 'say' command, requires macOS)")
    print("  [3] gemini (Gemini TTS, requires GEMINI_API_KEY)") # <--- ADDED
    
    mode_selection = ""
    # Allow 1, 2, or 3
    while mode_selection not in ("1", "2", "3"): # <--- MODIFIED
        mode_selection = input("Enter 1, 2, or 3: ").strip() # <--- MODIFIED
    
    if mode_selection == "1":
        audio_mode = "elevenlabs"
    elif mode_selection == "2":
        audio_mode = "default"
    else: # mode_selection == "3"
        audio_mode = "gemini" # <--- ADDED
        
    print(f"Selected audio mode: {audio_mode.upper()}")
    
    print("\nReel Content Generator")
    print("-" * 25)
    print(f"Content Directory: {INPUT_DIR}")
    print("Commands:")
    print("  /s → Start reel generation for files added in this session.")
    print("  /g → Start reel generation for *ALL* existing JSON files in 'contents' directory (skips OpenAI).")
    print("  /q → Quit")
    print("  (Any other query will generate new content using OpenAI.)")
    print("-" * 25)

    count = 0
    files_to_process = []

    while True:
        query = input(f"\n[{count}] Enter query: ").strip()
        if not query:
            continue

        cmd = query.lower()
        if cmd == "/s":
            print("\nStarting reel generation for session files...\n")
            # Pass the selected mode to the generator
            generate_reels(files_to_process, audio_mode) 
            return
        elif cmd == "/g":
            print("\nStarting reel generation for ALL existing files...\n")
            all_files = get_files_from_dir(INPUT_DIR)
            if not all_files:
                print(f"Error: No JSON files found in {INPUT_DIR}. Please generate content first.")
                continue
            # Pass all files and the selected mode
            generate_reels(all_files, audio_mode)
            return
        elif cmd in ("/q", "/quit"):
            print("\nExiting.")
            return

        # Content generation path
        file_name = input("Enter file name: ").strip()
        if not file_name:
            print("File name cannot be empty.")
            continue

        file_name_clean = file_name.replace(" ", "_").lower()
        if not file_name_clean.endswith(".json"):
            file_name_clean += ".json"

        expected_path = os.path.join(INPUT_DIR, file_name_clean)

        # Assuming generate_content is an imported function
        if generate_content(query, file_name):
            count += 1
            files_to_process.append(expected_path)

if __name__ == "__main__":
    cleanup_temp_dir()
    content_creation_cli()
    cleanup_temp_dir()
    print("Program finished.")