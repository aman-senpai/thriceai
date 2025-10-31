# main.py

import os
import warnings
import shutil
import sys
# --- NEW IMPORTS for running the frontend ---
import subprocess
import threading
import time
# --- END NEW IMPORTS ---

# Import the server logic
import server
from config import TEMP_DIR

# Suppress resource_tracker warning (often related to multiprocessing/threading)
warnings.filterwarnings(
    "ignore",
    message="resource_tracker: There appear to be",
    category=UserWarning
)

# --- CONFIGURATION ---
# Define the directory where the frontend application resides
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), 'web_app')
FRONTEND_COMMAND = ["npm", "run", "dev"]
FRONTEND_URL = "http://localhost:3000"
BACKEND_URL = "http://127.0.0.1:8000"

# --- UTILITIES ---

def cleanup_temp_dir():
    """Removes temporary directory and contents."""
    if os.path.exists(TEMP_DIR):
        try:
            shutil.rmtree(TEMP_DIR)
        except Exception as e:
            print(f"Cleanup Warning: {e}")

def run_frontend():
    """Starts the Next.js development server in the background."""
    print("--------------------------------------------------")
    print(f"🚀 Starting Next.js Frontend (npm run dev)...")
    print(f"Access the Web UI at: {FRONTEND_URL}")
    print("--------------------------------------------------")
    
    try:
        # Use subprocess.Popen to start the process non-blockingly
        # cwd sets the current working directory to the frontend folder
        process = subprocess.Popen(
            FRONTEND_COMMAND,
            cwd=FRONTEND_DIR,
            # stdout=subprocess.PIPE, # Uncomment if you want to hide frontend logs
            # stderr=subprocess.STDOUT 
        )
        # Keep a reference to the process for potential cleanup, though Ctrl+C usually handles it
        # You might want to implement more robust process termination on exit.
        
    except FileNotFoundError:
        print(f"Error: Command '{FRONTEND_COMMAND[0]}' not found.")
        print("Please ensure Node.js and npm are installed and available in your PATH.")
    except Exception as e:
        print(f"Error starting frontend: {e}")

# --- MAIN ENTRY POINT ---

def run_web_ui():
    """Initializes cleanup, runs the FastAPI server, and starts the frontend."""
    print("\n" + "="*50)
    print("🌐 FACELESS REEL GENERATOR: FULL STACK START")
    print("="*50)
    
    # 1. Initial cleanup
    cleanup_temp_dir()

    # 2. Start the Frontend in a separate thread
    # This prevents the 'npm run dev' command from blocking the Python script
    frontend_thread = threading.Thread(target=run_frontend)
    frontend_thread.daemon = True # Allows Python to exit even if this thread is running
    frontend_thread.start()
    
    # Give the frontend a moment to start (optional, but can help)
    time.sleep(2) 

    # 3. Start the Backend (this is the blocking call that keeps the script alive)
    print("\n" + "-"*50)
    print(f"📦 Starting FastAPI Backend...")
    print(f"Backend API URL: {BACKEND_URL}")
    print("-"*-50)
    
    # Call the run function defined in server.py (This is the main blocking process)
    server.run_server()

if __name__ == "__main__":
    try:
        run_web_ui()
    except KeyboardInterrupt:
        print("\nProgram interrupted by user (Ctrl+C). Cleaning up...")
        # Note: Frontend subprocess might need explicit killing here in a complex scenario
        cleanup_temp_dir()
    finally:
        print("Program finished.")