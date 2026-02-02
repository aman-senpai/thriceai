# Use the official Python base image
FROM python:3.12.12-slim

# Set the working directory in the container
WORKDIR /app

# Copy project files
COPY pyproject.toml uv.lock* ./

# ----------------------------------------------------------------------
# Install UV and system dependencies
# UV provides much faster installation compared to pip
# ----------------------------------------------------------------------
RUN apt-get update && \
    # Install FFmpeg and necessary libraries for Pillow (libjpeg, zlib) 
    # and Python compilation (build-essential)
    apt-get install -y --no-install-recommends \
        ffmpeg \
        build-essential \
        libjpeg-dev \
        zlib1g-dev \
        curl && \
    \
    # Install UV
    curl -LsSf https://astral.sh/uv/install.sh | sh && \
    export PATH="/root/.local/bin:$PATH" && \
    \
    # Install Python dependencies with UV (much faster than pip)
    uv sync --frozen && \
    \
    # Cleanup: Remove build tools and cache to keep the image size minimal
    apt-get purge -y build-essential curl && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*
# ----------------------------------------------------------------------

# Add UV to PATH
ENV PATH="/root/.local/bin:$PATH"

# Copy the rest of the current directory's content into the container
COPY . .

# Expose the application's port
EXPOSE 8008

# *** UPDATED CMD INSTRUCTION ***
# Use uv run to execute uvicorn within the UV-managed environment
CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8008"]