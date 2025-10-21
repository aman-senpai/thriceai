# main.py

import os
import warnings
import shutil
import sys 
# Import the server logic
import server 
from config import TEMP_DIR

# Suppress resource_tracker warning
warnings.filterwarnings(
    "ignore",
    message="resource_tracker: There appear to be",
    category=UserWarning
)

# --- UTILITIES ---

def cleanup_temp_dir():
    """Removes temporary directory and contents."""
    if os.path.exists(TEMP_DIR):
        try:
            shutil.rmtree(TEMP_DIR)
        except Exception as e:
            print(f"Cleanup Warning: {e}")

# --- MAIN ENTRY POINT ---

def run_web_ui():
    """Initializes cleanup and runs the FastAPI server."""
    print("\n" + "="*50)
    print("🌐 FACELESS REEL GENERATOR WEB UI")
    print("="*50)
    
    # Initial cleanup before starting the server
    cleanup_temp_dir()
    
    print(f"Starting FastAPI server...")
    print(f"Access the Web UI at: http://127.0.0.1:8000")
    
    # Call the run function defined in server.py
    server.run_server()

if __name__ == "__main__":
    run_web_ui()
    # Cleanup on exit will be handled by the server's shutdown event, 
    # but the initial cleanup is done before the server starts.
    print("Program finished.")