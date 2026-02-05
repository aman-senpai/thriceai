import warnings
# Filter out MoviePy syntax warnings on Python 3.12+
warnings.filterwarnings("ignore", category=SyntaxWarning, module="moviepy")

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
    headless_mode = "--headless" in sys.argv
    dev_mode = "--dev" in sys.argv
    run_web_ui(headless=headless_mode, dev_mode=dev_mode)
