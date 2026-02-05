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
import socket

# --- IMPORTS for .ENV and TELEGRAM BOT ---
from dotenv import load_dotenv
load_dotenv()

# Import logic with fallback for package vs direct execution
try:
    from .telegram_bot import start_bot
    from . import server
    from .config import TEMP_DIR, WEB_APP_OUT_DIR
except ImportError:
    from telegram_bot import start_bot
    import server
    from config import TEMP_DIR, WEB_APP_OUT_DIR


# Suppress resource_tracker warning
warnings.filterwarnings(
    "ignore",
    message="resource_tracker: There appear to be",
    category=UserWarning
)

# --- CONFIGURATION ---
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'web_app'))

FRONTEND_COMMAND = ["bun", "run", "dev"] # Kept as backup/reference
FRONTEND_BUILD_COMMAND = ["bun", "run", "build"]
FRONTEND_URL = "http://localhost:8008" # Updated to backend port
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

def get_local_ip():
    """Attempts to retrieve the local LAN IP address."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        # Doesn't need to be reachable
        s.connect(('10.255.255.255', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

def check_static_build():
    """Checks if static build exists. If not, builds it."""
    print("--------------------------------------------------")
    print(f"📦 Checking Frontend Build...")
    
    index_path = os.path.join(WEB_APP_OUT_DIR, "index.html")
    if os.path.exists(WEB_APP_OUT_DIR) and os.path.exists(index_path):
        print(f"✅ Static build found at: {WEB_APP_OUT_DIR}")
        print(f"   Skipping build step.")
        return

    print(f"⚠️ Static build NOT found. Building now...")
    print(f"   Running: {' '.join(FRONTEND_BUILD_COMMAND)}")
    print("--------------------------------------------------")
    
    try:
        # Run synchronous build
        subprocess.check_call(
            FRONTEND_BUILD_COMMAND,
            cwd=FRONTEND_DIR,
        )
        print("✅ Frontend build completed successfully.")
    except FileNotFoundError:
        print(f"Error: Command '{FRONTEND_BUILD_COMMAND[0]}' not found.")
        print("Please ensure Bun is installed and available in your PATH.")
    except subprocess.CalledProcessError as e:
        print(f"❌ Error building frontend: {e}")
        print("Continuing with potential missing frontend...")
    except Exception as e:
        print(f"Error during frontend build: {e}")

def run_dev_server():
    """Starts the Next.js development server (blocking for multiprocessing)."""
    print("--------------------------------------------------")
    print(f"🚀 Starting Next.js Dev Server (bun run dev)...")
    print(f"Access the Web UI at: {FRONTEND_URL.replace('8008', '3031')}")
    print("--------------------------------------------------")
    try:
        # Using call/run to keep the process alive so multiprocessing wrapper stays alive
        subprocess.run(
            FRONTEND_COMMAND,
            cwd=FRONTEND_DIR,
        )
    except Exception as e:
        print(f"Error running dev server: {e}")

# --- MAIN ENTRY POINT ---

def run_web_ui(headless: bool = False, dev_mode: bool = False):
    """Initializes cleanup, runs the FastAPI server, and starts the frontend and bot."""
    print("\n" + "="*50)
    print("🌐 FACELESS REEL GENERATOR: FULL STACK START")
    if dev_mode:
        print("🔧 MODE: DEVELOPMENT (Hot Reloading)")
    else:
        print("📦 MODE: PRODUCTION (Static Build)")
    print("="*50)
    
    frontend_process = None

    # 1. Frontend Setup
    if dev_mode:
         # Kill both ports to be clean
        kill_port_processes([8008, 3031])
        time.sleep(1)
        cleanup_temp_dir()

        # Start Dev Server in separate process
        frontend_process = multiprocessing.Process(target=run_dev_server, daemon=True)
        frontend_process.start()
    else:
        # Kill only backend port (8008), leave 3031 alone or kill it? 
        # Safest to kill 8008. User didn't ask to explicitly kill 3031 in prod, but "remove that next js ports" suggests they don't want interference.
        kill_port_processes([8008])
        time.sleep(1)
        cleanup_temp_dir()

        # Check/Build Static Frontend (Synchronous)
        check_static_build()
    
    # No separate process needed for frontend since we serve it statically
    # frontend_process = multiprocessing.Process(target=run_frontend, daemon=True)
    # frontend_process.start()
    
    # 3. Start the Telegram Bot in a separate PROCESS
    bot_process = multiprocessing.Process(target=start_bot, daemon=True)
    bot_process.start()
    
    # Give services a moment to start
    time.sleep(2) 

    # 4. Start the Backend in a separate thread so we can listen for keyboard input
    print("\n" + "-"*50)
    print(f"📦 Starting FastAPI Backend...")
    print(f"Backend API URL: {BACKEND_URL}")
    print(f"Network URL: http://{get_local_ip()}:8008")
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
        if headless:
            print("Headless mode enabled. Running indefinitely. Press Ctrl+C to stop or kill the process.")
            # In headless mode, we just wait for a signal. 
            # signal.pause() is efficient but only works on Unix. 
            # A simple loop is more portable if needed, but we're on Linux.
            while True:
                time.sleep(1)
        else:
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
    if frontend_process and frontend_process.is_alive():
        frontend_process.terminate()
        frontend_process.join(timeout=2)
    
    # Kill any remaining processes on ports
    kill_port_processes([8008, 3031])
    
    # Cleanup
    cleanup_temp_dir()
    print("\n✅ All services stopped. Goodbye!\n")


if __name__ == "__main__":
    import sys
    headless = "--headless" in sys.argv
    dev = "--dev" in sys.argv
    multiprocessing.freeze_support() 
    run_web_ui(headless=headless, dev_mode=dev)