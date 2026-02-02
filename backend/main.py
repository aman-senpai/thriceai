# main.py

import os
import warnings
import shutil
import subprocess
import time
import signal
from datetime import datetime, time as dt_time
import asyncio 
import multiprocessing 

# --- IMPORTS for .ENV and TELEGRAM BOT ---
from dotenv import load_dotenv
load_dotenv()

# Import logic with fallback for package vs direct execution
try:
    from .telegram_bot import start_bot
    from . import server
    from .config import TEMP_DIR
except ImportError:
    from telegram_bot import start_bot
    import server
    from config import TEMP_DIR


# Suppress resource_tracker warning
warnings.filterwarnings(
    "ignore",
    message="resource_tracker: There appear to be",
    category=UserWarning
)

# --- CONFIGURATION ---
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'web_app'))

FRONTEND_COMMAND = ["bun", "run", "dev"]
FRONTEND_URL = "http://localhost:3031"
BACKEND_URL = "http://127.0.0.1:8008"

# --- TELEGRAM BOT CONFIGURATION ---
START_HOUR = 10 
END_HOUR = 3
MESSAGE_TEXT = f"🌐 Faceless Reel Generator Web UI is running!\n\nAccess it here: {FRONTEND_URL}"
# --- END TELEGRAM BOT CONFIGURATION ---

# --- UTILITIES ---

def kill_port_processes(ports):
    """Kills any process running on the specified ports."""
    for port in ports:
        try:
            # Using lsof to find PIDs on the port
            # -ti returns just the PIDs
            result = subprocess.check_output(["lsof", "-ti", f":{port}"], stderr=subprocess.DEVNULL)
            pids = result.decode().strip().split('\n')
            for pid in pids:
                if pid:
                    print(f"⚠️ Port {port} is in use by PID {pid}. Terminating...")
                    try:
                        os.kill(int(pid), signal.SIGKILL)
                    except ProcessLookupError:
                        pass
        except subprocess.CalledProcessError:
            # No process found on this port, which is good
            pass
        except Exception as e:
            print(f"Error killing process on port {port}: {e}")

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
    
    # 0. Kill any existing instances on our ports
    kill_port_processes([8008, 3031])
    time.sleep(1) # Wait for ports to clear

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

    # 4. Start the Backend in a separate thread so we can listen for keyboard input
    print("\n" + "-"*50)
    print(f"📦 Starting FastAPI Backend...")
    print(f"Backend API URL: {BACKEND_URL}")
    print("-"*50)
    print("\n" + "="*50)
    print("💡 Press 's' + Enter to stop all services")
    print("="*50 + "\n")
    
    import threading
    
    # Event to signal shutdown
    shutdown_event = threading.Event()
    
    def run_server_thread():
        """Run the uvicorn server in a thread."""
        import uvicorn
        from fastapi.middleware.cors import CORSMiddleware
        
        # Add CORS middleware
        server.app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
        
        config = uvicorn.Config(server.app, host="0.0.0.0", port=8008, log_level="info")
        server_instance = uvicorn.Server(config)
        
        # Store server reference for shutdown
        run_server_thread.server = server_instance
        server_instance.run()
    
    # Start server in a thread
    server_thread = threading.Thread(target=run_server_thread, daemon=True)
    server_thread.start()
    
    # Listen for keyboard input to stop
    try:
        while True:
            user_input = input().strip().lower()
            if user_input == 's':
                print("\n" + "="*50)
                print("🛑 Stopping all services...")
                print("="*50)
                break
    except (KeyboardInterrupt, EOFError):
        print("\n🛑 Interrupt received, stopping...")
    
    # Shutdown sequence
    print("   ↳ Stopping FastAPI server...")
    if hasattr(run_server_thread, 'server'):
        run_server_thread.server.should_exit = True
    
    print("   ↳ Stopping Telegram bot...")
    if bot_process.is_alive():
        bot_process.terminate()
        bot_process.join(timeout=2)
    
    print("   ↳ Stopping Frontend...")
    if frontend_process.is_alive():
        frontend_process.terminate()
        frontend_process.join(timeout=2)
    
    # Kill any remaining processes on ports
    kill_port_processes([8008, 3031])
    
    # Cleanup
    cleanup_temp_dir()
    print("\n✅ All services stopped. Goodbye!\n")


if __name__ == "__main__":
    multiprocessing.freeze_support() 
    run_web_ui()