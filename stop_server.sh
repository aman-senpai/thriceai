#!/bin/bash
# Stop the Faceless Reel Generator Server and Client
# Kills processes running on port 8008 (Backend) and 3031 (Frontend)

echo "🛑 Stopping server and client..."

# Find PIDs on ports 8008 and 3031 (only listening processes)
PIDS=$(lsof -ti:8008,3031 -sTCP:LISTEN)

if [ -z "$PIDS" ]; then
  echo "✅ No services found running on ports 8008 or 3031."
else
  # Kill the processes
  echo "⚠️ Killing processes: $PIDS"
  kill -9 $PIDS
  echo "✅ Services stopped successfully."
fi
