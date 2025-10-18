# Faceless Reel Automation Project

This Python project automates the creation of vertical (9:16) short-form video content (like Instagram Reels or TikToks) from simple JSON conversation scripts. It synchronizes custom text-to-speech (TTS) audio with animated captions over a dynamic background video.

The project leverages **multiprocessing** for fast audio generation and **Whisper** for precise word-level timestamping.

## Features

* **Multi-Role TTS:** Uses macOS native `say` command with custom voices (`Aman`, `Isha`) for multi-role dialogue.
* **Precise Caption Sync:** Utilizes `whisper-timestamped` to get millisecond-accurate timing for word boundaries.
* **Animated Captions:** Captions feature a subtle, bouncy animation synchronized with speech.
* **Automatic Video Formatting:** Crops and resizes a source video to the 9:16 vertical standard (1080x1920) and loops/subclips it to match the audio duration.
* **Modular OOP Design:** Code is organized into reusable modules for easy maintenance and scaling.

## Prerequisites

This project is primarily designed to run on **macOS** because it relies on the native `say` command for high-quality, zero-latency Text-to-Speech audio generation.

1.  **Python 3.12**
2.  **macOS** (for the `say` command)
3.  **Required Libraries:**
    ```bash
    pip install -r requirements.txt
    # Key dependencies include: moviepy, numpy, whisper-timestamped
    ```
4.  **FFmpeg:** MoviePy requires FFmpeg to be installed on your system.
    ```bash
    # Install via Homebrew
    brew install ffmpeg
    ```

## Getting Started

### Project Structure

````.
    ├── assets/                 # Source background video files (e.g., minecraft.mp4)
    ├── contents/               # INPUT: JSON conversation scripts (one JSON = one video)
    ├── fonts/                  # Custom TrueType/OpenType font files
    ├── main.py                 # Project Entry Point
    ├── processors/             # Core logic modules (audio, generation, video)
    ├── reels/                  # OUTPUT: Final generated .mp4 videos
    └── temp/                   # Temporary files created during runtime (ignored by Git)
````

### 1. Configuration & Input

1.  **Source Video:** Place your background video (e.g., looping gameplay) into the `assets/` directory. Update the `VIDEO_FILE` variable in `config.py` if the name changes.
2.  **Fonts:** Ensure your desired font is in the `fonts/` directory and specified in `config.py`.
3.  **Conversation JSON:** Create a conversation script in the `contents/` directory (e.g., `dsa.json`) following this format:

    ```json
    {
      "languageCode": "en",
      "conversation": [
        {"role": "Aman", "text": "Dialogue for the first speaker."},
        {"role": "Isha", "text": "Dialogue for the second speaker."},
        ...
      ]
    }
    ```

### 2. Execution

Run the main script from the project root:

```bash
python3 main.py
````

The script will automatically process all `.json` files found in the `contents/` directory, generating a corresponding video in the `reels/` directory.

## Configuration

All user-facing settings are managed in **`config.py`**.

| Setting | Location | Description |
| :--- | :--- | :--- |
| `VIDEO_FILE` | `config.py` | Path to the background video asset. |
| `VOICE_MAP` | `config.py` | Maps roles (e.g., "Aman") to macOS voice names. |
| `TARGET_W`, `TARGET_H` | `config.py` | Final video resolution (should be 1080x1920). |
| `FONT`, `FONT_SIZE` | `config.py` | Caption styling options. |
| `MIN_CLIP_DURATION` | `config.py` | Minimum duration for a single word caption clip (to filter out noise/stutters). |

## Architecture

The project follows a modular, object-oriented design:

  * **`main.py`**: The entry point. It scans the `contents/` directory and iterates, instantiating the `ReelGenerator` for each file.
  * **`config.py`**: Holds all global variables, paths, and styling parameters.
  * **`processors/reel_generator.py`**: Contains the main `ReelGenerator` class, which orchestrates the entire process: loads data, prepares the video, creates text clips, and composites the final file.
  * **`processors/audio_processing.py`**: Contains the heavy-lifting logic for TTS and timing:
      * `process_single_turn`: Generates AIFF audio via `say` and transcribes it via `whisper-timestamped` using multiprocessing.
      * `generate_multi_role_audio_multiprocess`: Concatenates all audio clips and aligns the word timestamps to the total true audio duration.

<!-- end list -->