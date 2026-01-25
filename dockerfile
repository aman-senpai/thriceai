# Use the official Python base image
FROM python:3.12.12-slim

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file into the container
COPY requirements.txt .

# ----------------------------------------------------------------------
# Install system dependencies (build tools, ffmpeg) and Python packages
# This is done in a single RUN instruction for smaller, cleaner layers.
# ----------------------------------------------------------------------
RUN apt-get update && \
    # Install FFmpeg and necessary libraries for Pillow (libjpeg, zlib) 
    # and Python compilation (build-essential)
    apt-get install -y --no-install-recommends \
        ffmpeg \
        build-essential \
        libjpeg-dev \
        zlib1g-dev && \
    \
    # Upgrade pip and install Python dependencies
    pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    \
    # Cleanup: Remove build tools and cache to keep the image size minimal
    apt-get purge -y build-essential && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*
# ----------------------------------------------------------------------

# Copy the rest of the current directory's content into the container
COPY . .

# Expose the application's port
EXPOSE 8008

# *** UPDATED CMD INSTRUCTION ***
# Command format: uvicorn <module_name>:<app_instance> --host 0.0.0.0 --port <port>
# Since your file is main.py, the module name is 'main'.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8008"]