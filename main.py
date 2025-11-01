# main.py

import os
import warnings
import shutil
import subprocess
import time
from datetime import datetime, time as dt_time
import asyncio 
import multiprocessing 

# --- IMPORTS for .ENV and TELEGRAM BOT ---
from dotenv import load_dotenv
from telegram_bot import start_bot
# --- END IMPORTS ---

# Load environment variables in the parent process
load_dotenv() 

# Import the server logic
import server
from config import TEMP_DIR

# Suppress resource_tracker warning
warnings.filterwarnings(
    "ignore",
    message="resource_tracker: There appear to be",
    category=UserWarning
)

# --- CONFIGURATION ---
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), 'web_app')
FRONTEND_COMMAND = ["npm", "run", "dev"]
FRONTEND_URL = "http://localhost:3031"
BACKEND_URL = "http://127.0.0.1:8000"

# --- TELEGRAM BOT CONFIGURATION ---
# Time window: 10:00 AM to 3:00 AM (across midnight)
START_HOUR = 10 
END_HOUR = 3
MESSAGE_TEXT = f"🌐 Faceless Reel Generator Web UI is running!\n\nAccess it here: {FRONTEND_URL}"
# --- END TELEGRAM BOT CONFIGURATION ---

# --- UTILITIES ---

def cleanup_temp_dir():
    """Removes temporary directory and contents."""
    # FIX APPLIED HERE: Use os.path.exists()
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
        subprocess.Popen(
            FRONTEND_COMMAND,
            cwd=FRONTEND_DIR,
        )
    except FileNotFoundError:
        print(f"Error: Command '{FRONTEND_COMMAND[0]}' not found.")
        print("Please ensure Node.js and npm are installed and available in your PATH.")
    except Exception as e:
        print(f"Error starting frontend: {e}")

# --- MAIN ENTRY POINT ---

def run_web_ui():
    """Initializes cleanup, runs the FastAPI server, and starts the frontend and bot."""
    print("\n" + "="*50)
    print("🌐 FACELESS REEL GENERATOR: FULL STACK START")
    print("="*50)
    
    # 1. Initial cleanup
    cleanup_temp_dir()

    # 2. Start the Frontend in a separate process
    frontend_process = multiprocessing.Process(target=run_frontend, daemon=True)
    frontend_process.start()
    
    # 3. Start the Telegram Bot in a separate PROCESS
    bot_process = multiprocessing.Process(target=start_bot, daemon=True)
    bot_process.start()
    
    # Give services a moment to start
    time.sleep(2) 

    # 4. Start the Backend (this is the blocking call that keeps the script alive)
    print("\n" + "-"*50)
    print(f"📦 Starting FastAPI Backend...")
    print(f"Backend API URL: {BACKEND_URL}")
    print("-"*-50)
    
    server.run_server()

if __name__ == "__main__":
    multiprocessing.freeze_support() 
    try:
        run_web_ui()
    except KeyboardInterrupt:
        print("\nProgram interrupted by user (Ctrl+C). Cleaning up...")
        cleanup_temp_dir()
    finally:
        print("Program finished.")