import sys
import os

# Add the project root to sys.path explicitly
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

try:
    from backend.main import run_web_ui
except ImportError as e:
    print(f"Error importing backend: {e}")
    # Fallback: try appending backend directly
    sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))
    try:
        from main import run_web_ui
    except ImportError as e2:
         print(f"Critical error importing main: {e2}")
         sys.exit(1)

if __name__ == "__main__":
    run_web_ui()
