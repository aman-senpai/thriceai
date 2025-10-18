# main.py

import os
import warnings
import shutil
from processors.reel_generator import ReelGenerator
from config import INPUT_DIR, VIDEO_DIR, TEMP_DIR
warnings.filterwarnings(
    "ignore", 
    message="resource_tracker: There appear to be", 
    category=UserWarning
)

# --- CLEANUP FUNCTION ---
def cleanup_temp_dir():
    """Removes the temporary directory and all its contents."""
    if os.path.exists(TEMP_DIR):
        try:
            shutil.rmtree(TEMP_DIR)

        except Exception as e:
            print(f"Cleanup Warning: Could not remove {TEMP_DIR}. Files might be locked. Error: {e}")


if __name__ == "__main__":
    
    cleanup_temp_dir() 

    if not os.path.isdir(INPUT_DIR):
        print(f"Error: Input directory '{INPUT_DIR}' not found. Please create it and place your JSON files inside.")
    # CHANGED: Check for directory existence instead of file existence
    elif not os.path.isdir(VIDEO_DIR):
        print(f"Error: Video directory '{VIDEO_DIR}' not found. Please ensure it exists and contains video files.") 
    else:
        json_files = [f for f in os.listdir(INPUT_DIR) if f.endswith('.json')]
        
        if not json_files:
            print(f"No JSON files found in the '{INPUT_DIR}' directory. Ensure your JSON files have a 'conversation' array.")
        else:
            print(f"--- Starting Reel Generation for {len(json_files)} files ---")
            
            for json_file in json_files:
                input_path = os.path.join(INPUT_DIR, json_file)
                
                # Use a single, minimalist print for the file being processed
                print(f"\nProcessing: {input_path}")
                
                # Instantiate and run the generator for each file
                generator = ReelGenerator(input_path)
                generator.create_reel()
                
                # 2. Cleanup after each file is processed
                cleanup_temp_dir()

            print("\n--- All reels created ---")