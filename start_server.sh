#!/bin/bash
# Start the Faceless Reel Generator Server in Headless Mode
# This script is ideal for use with Apple Shortcuts via SSH.

# Use the python executable from the virtual environment
PYTHON_EXEC="./.venv/bin/python3"

# Fallback to system python3 if venv not found (though venv is preferred)
if [ ! -f "$PYTHON_EXEC" ]; then
    echo "⚠️ Virtual environment not found at .venv, using system python3..."
    PYTHON_EXEC="python3"
fi

# Ensure bun is in the PATH (SSH sessions might miss .bashrc)
export PATH="$HOME/.bun/bin:$PATH"

nohup $PYTHON_EXEC run.py --headless > out.log 2> err.log &
PID=$!

echo "✅ Server started in background with PID: $PID"
echo "🌐 Network URL: http://$(hostname -I | cut -d' ' -f1):8008"
echo "🌐 Network URL: http://$(hostname -I | cut -d' ' -f1):3031"
echo "📄 Logs are being written to 'out.log' and 'err.log'"
