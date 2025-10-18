# main.py

import os
from processors.reel_generator import ReelGenerator
from config import INPUT_DIR, VIDEO_FILE 

if __name__ == "__main__":
    
    if not os.path.isdir(INPUT_DIR):
        print(f"Error: Input directory '{INPUT_DIR}' not found. Please create it and place your JSON files inside.")
    elif not os.path.exists(VIDEO_FILE):
        print(f"Error: Video file '{VIDEO_FILE}' not found. Please ensure it is in the project root.")
    else:
        json_files = [f for f in os.listdir(INPUT_DIR) if f.endswith('.json')]
        
        if not json_files:
            print(f"No JSON files found in the '{INPUT_DIR}' directory. Ensure your JSON files have a 'conversation' array.")
        else:
            print(f"--- Starting Reel Generation for {len(json_files)} JSON files ---\n")
            
            for json_file in json_files:
                input_path = os.path.join(INPUT_DIR, json_file)
                print(f"=======================================================")
                print(f"Processing file: {input_path}")
                print(f"=======================================================")
                
                # Instantiate and run the generator for each file
                generator = ReelGenerator(input_path)
                generator.create_reel()

            print("\n--- Batch Processing Complete ---")