# Faceless Reel Automation Project

![Project Banner](misc/image.png)

This project is a full-stack application designed to automate the creation of vertical (9:16) short-form videos, like Instagram Reels or TikToks. It features a web-based interface to generate content from scripts, convert text-to-speech (TTS) with multiple voice options, and combine it with animated captions over a background video.

The application is containerized with Docker for easy setup and deployment, and includes a Python backend powered by FastAPI and a Next.js frontend.

---

## Features

*   **Web Interface:** A user-friendly UI built with Next.js to manage content, characters, and video generation.
*   **Multiple TTS Providers:** Supports various text-to-speech services, including Google's Gemini, ElevenLabs, and macOS's native `say` command.
*   **Dockerized Environment:** Comes with a `docker-compose.yml` for a one-command setup of both the frontend and backend services.
*   **Customizable Characters:** Define characters with unique voices and avatars through a simple `characters.json` file.
*   **Dynamic Content Generation:** Use prompts to generate dialogue scripts for your videos.
*   **Precise Caption Sync:** Utilizes `whisper-timestamped` for millisecond-accurate, word-level synchronization of captions.
*   **Animated Captions:** Captions feature a subtle bounce animation synchronized with the audio.
*   **Telegram Bot Integration:** A simple bot to retrieve the local IP address for easy access to the web UI on your network.

---

## Tech Stack

*   **Backend:** Python, FastAPI, MoviePy, Whisper
*   **Frontend:** Next.js, React, Tailwind CSS
*   **Services:** Docker, FFmpeg

---

## 🚀 Getting Started

### Prerequisites

*   [Git](https://git-scm.com/)
*   [Docker](https://www.docker.com/get-started) and [Docker Compose](https://docs.docker.com/compose/install/)
*   [Node.js](https://nodejs.org/) (for local development)
*   [Python 3.10+](https://www.python.org/) (for local development)
*   [FFmpeg](https://ffmpeg.org/download.html) (for local development)

### Docker Setup (Recommended)

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd faceless_project
    ```

2.  **Create a `.env` file:**
    Create a `.env` file in the root of the project and add your API keys:
    ```env
    ELEVEN_API="your_elevenlabs_api_key"
    GEMINI_API_KEY="your_gemini_api_key"
    TELEGRAM_BOT="your_telegram_bot_token"
    ```

3.  **Build and run with Docker Compose:**
    ```bash
    docker-compose up --build
    ```
    The web interface will be available at [http://localhost:3000](http://localhost:3000).

### Local Development

1.  **Backend Setup:**
    ```bash
    pip install -r requirements.txt
    ```

2.  **Frontend Setup:**
    ```bash
    cd web_app
    npm install
    ```

3.  **Run the application:**
    From the root directory, run:
    ```bash
    python3 main.py
    ```
    This will start the FastAPI backend, the Next.js development server, and the Telegram bot.

---

## Project Structure

```
.
├── assets/
│   ├── avatars/
│   └── bg_videos/
├── contents/
│   └── captions/
├── processors/
├── services/
├── web_app/
│   ├── app/
│   └── components/
├── config.py
├── characters.json
├── docker-compose.yml
├── main.py
├── server.py
└── telegram_bot.py
```

---

## Configuration

*   **`config.py`**: Main configuration file for Python services. Here you can set paths, video styles, and TTS settings.
*   **`characters.json`**: Define the characters for your videos. Each character can have a name, a voice (mapped to a TTS service), and an avatar.
*   **`.env`**: For storing API keys and other secrets.

---

## Usage

### Web Interface

Access the web UI at [http://localhost:3000](http://localhost:3000). From here you can:
*   Generate new video scripts.
*   Select characters and a TTS service.
*   Generate reels from your scripts.
*   View and download previously generated reels.

### Telegram Bot

The Telegram bot is configured to respond to the command `ip` with the local IP address of the machine running the application. This is useful for accessing the web UI from other devices on the same network.

---

## Contributing

Contributions are welcome! Please feel free to submit a pull request.