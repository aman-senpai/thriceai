# server.py - Pure Backend API
import asyncio
import glob
import json
import logging
import os
import shutil
import sys
import time
from collections import deque
from datetime import datetime
from typing import Any, Dict, List, Optional

import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from pydantic import BaseModel


# --- Custom Logging Handler for Terminal Log Streaming ---
class LogBuffer:
    """Thread-safe buffer to store log messages for streaming."""

    def __init__(self, maxlen=500):
        self.logs = deque(maxlen=maxlen)
        self.subscribers = set()
        self._lock = asyncio.Lock()

    async def add_log(self, message: str, log_type: str = "info"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        log_entry = {"timestamp": timestamp, "type": log_type, "message": message}
        async with self._lock:
            self.logs.append(log_entry)
        # Notify all subscribers
        for queue in list(self.subscribers):
            try:
                await queue.put(log_entry)
            except:
                pass

    async def subscribe(self):
        queue = asyncio.Queue()
        self.subscribers.add(queue)
        return queue

    async def unsubscribe(self, queue):
        self.subscribers.discard(queue)

    def get_recent_logs(self):
        return list(self.logs)


log_buffer = LogBuffer()


class StreamToLogBuffer:
    """Redirect stdout to both the console and the log buffer."""

    def __init__(self, original_stream, log_buffer_instance, log_type="info"):
        self.original_stream = original_stream
        self.log_buffer = log_buffer_instance
        self.log_type = log_type
        self.buffer = ""
        self.loop = None

    def write(self, message):
        if message.strip():  # Only log non-empty messages
            # Filter verbose logs
            msg_lower = message.lower()

            # Silence Uvicorn access logs and common repetitive loading logs
            silent_patterns = [
                "/api/logs/stream",
                "get /api/data/",
                "words count mismatch",
                "creating new kokoropipeline",
                "loading model mlx-community",
                "started server process",
                "waiting for application startup",
                "application startup complete",
                "uvicorn running on",
                "get /api/logs/recent",
                "get /health",
                "get /api/logs/stream",
                "get /reels/",
                "get /contents/",
                "get /avatars/",
                "post /api/generate-reel/single",
                "get /favicon.ico",
                "telegram bot starting",
                "authorized users:",
                "commands: /help",
            ]

            if any(pattern in msg_lower for pattern in silent_patterns):
                return

            # Write to original stream
            self.original_stream.write(message)

            # Determine log type based on message content
            log_type = self.log_type
            if (
                "error" in msg_lower
                or "failed" in msg_lower
                or "exception" in msg_lower
            ):
                log_type = "error"
            elif "warning" in msg_lower or "warn" in msg_lower:
                log_type = "warn"
            elif (
                "success" in msg_lower
                or "finished" in msg_lower
                or "completed" in msg_lower
                or "✅" in message
            ):
                log_type = "success"

            # Queue the log entry asynchronously
            try:
                if self.loop is None or self.loop.is_closed():
                    try:
                        self.loop = asyncio.get_running_loop()
                    except RuntimeError:
                        self.loop = asyncio.new_event_loop()

                asyncio.run_coroutine_threadsafe(
                    self.log_buffer.add_log(message.strip(), log_type), self.loop
                )
            except Exception:
                pass  # Silently fail if we can't log

    def flush(self):
        self.original_stream.flush()


# Store original stdout/stderr
original_stdout = sys.stdout
original_stderr = sys.stderr

# --- UTILITY AND BUSINESS LOGIC IMPORTS ---

# Ensure these imports are correct for your project structure
try:
    # Assuming config.py now includes CAPTION_DIR
    try:
        from .config import (
            AUDIO_MODES_FOR_PLATFORM,
            AVATAR_DIR,
            CAPTION_DIR,
            CHARACTER_CONFIG_FILE,
            CHARACTER_MAP,
            DATA_DIR,
            INPUT_DIR,
            LLM_PROVIDER,
            LLM_PROVIDERS,
            OUTPUT_DIR,
            PIP_DIR,
            PROMPTS_DIR,
            TEMP_DIR,
            VIDEO_DIR,
            WEB_APP_OUT_DIR,
        )
        from .processors.reel_generator import ReelGenerator
        from .services.caption_generator import generate_caption
        from .services.content_writer import generate_content as generate_content_gemini
        from .services.deepseek_writer import (
            generate_content as generate_content_deepseek,
        )
        from .services.rss_service import get_rss_service
    except ImportError:
        # Fallback for when running directly or PYTHONPATH is set to backend
        from config import (
            AUDIO_MODES_FOR_PLATFORM,
            AVATAR_DIR,
            CAPTION_DIR,
            CHARACTER_CONFIG_FILE,
            CHARACTER_MAP,
            DATA_DIR,
            INPUT_DIR,
            LLM_PROVIDER,
            LLM_PROVIDERS,
            OUTPUT_DIR,
            PIP_DIR,
            PROMPTS_DIR,
            TEMP_DIR,
            VIDEO_DIR,
            WEB_APP_OUT_DIR,
        )
        from processors.reel_generator import ReelGenerator
        from services.caption_generator import generate_caption
        from services.content_writer import generate_content as generate_content_gemini
        from services.deepseek_writer import (
            generate_content as generate_content_deepseek,
        )
        from services.rss_service import get_rss_service
except ImportError as e:
    print(f"Error importing modules (Check config.py, services/, processors/): {e}")
    sys.exit(1)


# --- UTILITIES ---


def get_content_writer(llm_provider: str):
    """Return the appropriate generate_content function for the given provider."""
    if llm_provider == "deepseek":
        return generate_content_deepseek
    return generate_content_gemini


def cleanup_temp_dir():
    """Removes temporary directory and contents."""
    if os.path.exists(TEMP_DIR):
        try:
            shutil.rmtree(TEMP_DIR)
        except Exception as e:
            print(f"Cleanup Warning: {e}")


def get_prompt_files():
    """Returns a list of available prompt files (basename and full path)."""
    prompt_files = sorted(glob.glob(os.path.join(PROMPTS_DIR, "*.txt")))
    return [
        {"name": os.path.basename(f), "path": f.replace("\\", "/")}
        for f in prompt_files
    ]


def _process_reels(items: List[Any], audio_mode: str):
    """
    Handles the core reel generation using ReelGenerator.
    items can be a list of file paths (str) or a list of dicts with 'path' and optional 'pip_asset_override'.
    """
    if not os.path.isdir(OUTPUT_DIR):
        raise HTTPException(
            status_code=500, detail=f"Error: Video directory '{OUTPUT_DIR}' not found."
        )

    try:
        os.makedirs(TEMP_DIR, exist_ok=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error setting up TEMP_DIR: {e}")

    total_start = time.time()
    results = []
    print(f"Starting generation for {len(items)} files in {audio_mode} mode.")
    for i, item in enumerate(items, 1):
        item_start = time.time()
        if isinstance(item, str):
            input_path = item
            pip_asset_override = None
        else:
            input_path = item.get("path")
            pip_asset_override = item.get("pip_asset_override")

        json_file = os.path.basename(input_path)
        print(f"PROGRESS:0:{json_file}")
        print(f"[{i}/{len(items)}] Processing: {json_file}")
        try:
            generator = ReelGenerator(input_path, pip_asset_override=pip_asset_override)
            generator.create_reel(audio_mode)
            results.append({"file": json_file, "status": "Success"})
            print(f"PROGRESS:100:{json_file}")
            print(
                f"  > [{i}/{len(items)}] Finished {json_file} in {time.time() - item_start:.2f}s"
            )
        except Exception as e:
            results.append({"file": json_file, "status": "Failed", "error": str(e)})
            print(f"PROGRESS:0:{json_file}:FAILED")
            print(f"Failed to generate reel for {json_file}: {e}")

    print(f"✅ Batch generation finished. Total time: {time.time() - total_start:.2f}s")
    return results


from fastapi.staticfiles import StaticFiles

# --- FastAPI Setup ---
app = FastAPI(title="Faceless Reel Generator API")

app.mount("/reels", StaticFiles(directory=OUTPUT_DIR), name="reels")
app.mount("/contents", StaticFiles(directory=INPUT_DIR), name="contents")
app.mount("/avatars", StaticFiles(directory=AVATAR_DIR), name="avatars")

# --- Static Frontend Serving ---
# 1. Serve _next assets
next_assets_dir = os.path.join(WEB_APP_OUT_DIR, "_next")
if os.path.exists(next_assets_dir):
    app.mount("/_next", StaticFiles(directory=next_assets_dir), name="next_assets")


# --- Schemas and Global State ---


class GenerateContentRequest(BaseModel):
    query: str
    file_name: str
    selected_prompt_path: str
    char_a_name: str
    char_b_name: str
    language: str = "en"


class ContentFile(BaseModel):
    name: str
    path: str


class CharacterRequest(BaseModel):
    name: str
    avatar: Optional[str] = None
    voice_gemini: Optional[str] = None
    voice_eleven: Optional[str] = None
    voice_mac: Optional[str] = None
    voice_kokoro: Optional[str] = None
    voice_kokoro_mlx: Optional[str] = None


class PromptRequest(BaseModel):
    name: str
    content: str


class BatchItem(BaseModel):
    topic: str
    file_name: Optional[str] = None
    character_a: str
    character_b: str
    prompt_filename: str
    pip_asset: Optional[str] = None


class BatchRequest(BaseModel):
    jobs: List[BatchItem]
    audio_mode: str = "default"
    llm_provider: str = "gemini"


current_session_files: List[ContentFile] = []

# --- API Endpoints (Pure Backend) ---


@app.get("/api/data/config")
async def get_config_data_api():
    """Returns initial configuration data and character details."""
    # Create config-ready character map with accessible avatar URLs
    api_character_map = {}
    for name, details in CHARACTER_MAP.items():
        api_character_map[name] = details.copy()
        # Prepend /avatars/ if it's a simple filename
        if "avatar" in details and not details["avatar"].startswith(("http", "/")):
            api_character_map[name]["avatar"] = f"/avatars/{details['avatar']}"

    # Scan for available Kokoro MLX voices and derive supported languages
    kokoro_voices = {}
    supported_langs = set()
    _prefix_to_lang = {
        "af_": "en",
        "am_": "en",
        "bf_": "en",
        "bm_": "en",
        "jf_": "ja",
        "jm_": "ja",
        "zf_": "zh",
        "zm_": "zh",
        "ef_": "es",
        "em_": "es",
        "ff_": "fr",
        "hf_": "hi",
        "hm_": "hi",
        "if_": "it",
        "im_": "it",
        "pf_": "pt",
        "pm_": "pt",
    }
    _prefix_to_group = {
        "af_": "American English (F)",
        "am_": "American English (M)",
        "bf_": "British English (F)",
        "bm_": "British English (M)",
        "jf_": "Japanese (F)",
        "jm_": "Japanese (M)",
        "zf_": "Mandarin (F)",
        "zm_": "Mandarin (M)",
        "ef_": "Spanish (F)",
        "em_": "Spanish (M)",
        "ff_": "French (F)",
        "hf_": "Hindi (F)",
        "hm_": "Hindi (M)",
        "if_": "Italian (F)",
        "im_": "Italian (M)",
        "pf_": "Portuguese (F)",
        "pm_": "Portuguese (M)",
    }
    try:
        voices_dir = os.path.join(DATA_DIR, "models", "kokoro-mlx", "voices")
        if os.path.isdir(voices_dir):
            for f in sorted(os.listdir(voices_dir)):
                if f.endswith(".safetensors"):
                    voice_name = f.replace(".safetensors", "")
                    prefix = voice_name[:3]
                    group = _prefix_to_group.get(prefix, "Other")
                    if group not in kokoro_voices:
                        kokoro_voices[group] = []
                    kokoro_voices[group].append(voice_name)
                    lang_code = _prefix_to_lang.get(prefix)
                    if lang_code:
                        supported_langs.add(lang_code)
    except Exception:
        pass

    # Build languages list from supported langs, with English first
    _lang_names = {
        "en": "English",
        "hi": "Hindi",
        "ja": "Japanese",
        "zh": "Mandarin Chinese",
        "es": "Spanish",
        "fr": "French",
        "it": "Italian",
        "pt": "Portuguese",
    }
    languages = []
    if "en" in supported_langs:
        languages.append({"code": "en", "name": "English"})
        supported_langs.discard("en")
    for code in sorted(supported_langs):
        languages.append({"code": code, "name": _lang_names.get(code, code)})

    return {
        "tts_modes": AUDIO_MODES_FOR_PLATFORM,
        "prompt_files": get_prompt_files(),
        "characters": api_character_map,
        "session_count": len(current_session_files),
        "llm_providers": LLM_PROVIDERS,
        "current_llm_provider": LLM_PROVIDER,
        "kokoro_voices": kokoro_voices,
        "languages": languages,
    }


@app.get("/api/data/reels")
async def get_reels_api():
    """Returns a list of all finished reel files with creation time."""
    reel_files = glob.glob(os.path.join(OUTPUT_DIR, "*.mp4"))

    reels_list = []
    for f_path in reel_files:
        try:
            content_name = os.path.splitext(os.path.basename(f_path))[0] + ".json"
            content_path = os.path.join(INPUT_DIR, content_name)

            reels_list.append(
                {
                    "name": os.path.basename(f_path),
                    "path": f_path,
                    "size_kb": round(os.path.getsize(f_path) / 1024, 2),
                    "modified": os.path.getmtime(f_path) * 1000,
                    "content_exists": os.path.exists(content_path),
                }
            )
        except Exception:
            reels_list.append(
                {
                    "name": os.path.basename(f_path),
                    "path": f_path,
                    "size_kb": 0,
                    "modified": os.path.getmtime(f_path) * 1000,
                    "content_exists": False,
                }
            )

    reels_list.sort(key=lambda x: x["modified"], reverse=True)
    return {"reels": reels_list}


@app.get("/api/data/contents")
async def get_contents_api():
    """Returns all JSON content files and parses them for dialogue preview."""
    content_files = glob.glob(os.path.join(INPUT_DIR, "*.json"))

    contents_list = []
    for f_path in content_files:
        dialogues = []
        data = {}
        try:
            with open(f_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            # Extract dialogues from 'conversation' or 'content' keys
            dialogue_list = data.get("conversation", data.get("content", []))
            for item in dialogue_list:
                speaker = item.get("role") or item.get("speaker")
                text = item.get("text") or item.get("dialogue")
                if speaker and text:
                    dialogues.append({"speaker": speaker, "dialogue": text})

            contents_list.append(
                {
                    "name": os.path.basename(f_path),
                    "path": f_path,
                    "modified": os.path.getmtime(f_path) * 1000,
                    "query": data.get("query", data.get("topic", "N/A")),
                    "dialogues": dialogues,
                }
            )
        except Exception as e:
            contents_list.append(
                {
                    "name": os.path.basename(f_path),
                    "path": f_path,
                    "modified": os.path.getmtime(f_path) * 1000,
                    "query": f"Error loading file: {e}",
                    "dialogues": [],
                }
            )

    contents_list.sort(key=lambda x: x["modified"], reverse=True)
    return {"contents": contents_list}


@app.get("/api/data/reels/{filename}")
async def get_reel_file(filename: str):
    """Allows downloading or streaming a finished reel file."""
    file_path = os.path.join(OUTPUT_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Reel file not found.")

    # NOTE: The Next.js frontend might need to stream this file directly
    return FileResponse(path=file_path, media_type="video/mp4", filename=filename)


@app.post("/api/generate-content")
async def generate_content_api(
    query: str = Form(...),
    file_name: str = Form(...),
    selected_prompt_path: str = Form(...),
    char_a_name: str = Form(...),
    char_b_name: str = Form(...),
    llm_provider: str = Form("gemini"),
    language: str = Form("en"),
):
    """API endpoint to trigger content generation."""

    data = GenerateContentRequest(
        query=query,
        file_name=file_name,
        selected_prompt_path=selected_prompt_path,
        char_a_name=char_a_name,
        char_b_name=char_b_name,
        language=language,
    )

    if data.char_a_name == data.char_b_name:
        raise HTTPException(
            status_code=400, detail="Character A and Character B must be different."
        )

    file_name_clean = data.file_name.replace(" ", "_").lower()
    if not file_name_clean.endswith(".json"):
        file_name_clean += ".json"

    expected_path = os.path.join(INPUT_DIR, file_name_clean)

    try:
        writer = get_content_writer(llm_provider)
        if writer(
            data.query,
            file_name_clean,
            data.selected_prompt_path,
            data.char_a_name,
            data.char_b_name,
            language=data.language,
        ):
            new_file = ContentFile(name=file_name_clean, path=expected_path)
            global current_session_files
            current_session_files.append(new_file)
            return {
                "message": "Content generated successfully",
                "file_name": file_name_clean,
                "session_count": len(current_session_files),
            }
        else:
            raise HTTPException(
                status_code=500, detail="Content generation service failed."
            )
    except Exception as e:
        print(f"Error during content generation: {e}")
        raise HTTPException(
            status_code=500, detail=f"Server error during generation: {e}"
        )


@app.post("/api/generate-caption/{filename}")
async def generate_caption_api(filename: str):
    """
    API endpoint to generate an Instagram caption for a finished content JSON file.
    The filename must be the name of the JSON content file (e.g., 'glutes.json').
    """

    if not filename.endswith(".json"):
        filename += ".json"

    script_file_path = os.path.join(INPUT_DIR, filename)

    if not os.path.exists(script_file_path):
        raise HTTPException(
            status_code=404, detail=f"Content file not found at {script_file_path}"
        )

    try:
        caption_text = generate_caption(script_file_path)

        if caption_text:
            return {
                "message": "Caption generated and saved successfully",
                "caption": caption_text,
            }
        else:
            raise HTTPException(
                status_code=500,
                detail="Caption generation failed due to an internal error or API failure. Check server logs.",
            )

    except Exception as e:
        print(f"Error calling generate_caption: {e}")
        raise HTTPException(
            status_code=500, detail=f"Server error during caption generation: {e}"
        )


@app.post("/api/upload-asset")
async def upload_asset_api(file: UploadFile = File(...)):
    """API endpoint to upload a PIP asset (image or video)."""
    os.makedirs(PIP_DIR, exist_ok=True)

    # Save the file to the PIP directory
    file_path = os.path.join(PIP_DIR, file.filename)

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        return {
            "message": f"Asset {file.filename} uploaded successfully.",
            "filename": file.filename,
        }
    except Exception as e:
        print(f"Error uploading asset: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to upload asset: {e}")


@app.get("/api/data/pip-asset")
async def get_pip_asset_api():
    """Returns the current PIP asset if it exists."""
    assets = glob.glob(os.path.join(PIP_DIR, "*"))
    if assets:
        return {"filename": os.path.basename(assets[0]), "exists": True}
    return {"filename": None, "exists": False}


@app.post("/api/clear-pip-asset")
async def clear_pip_asset_api():
    """Clears the current PIP asset."""
    for f in glob.glob(os.path.join(PIP_DIR, "*")):
        try:
            os.remove(f)
        except Exception:
            pass
    return {"message": "PIP asset cleared"}


@app.delete("/api/delete-script/{filename}")
async def delete_script_api(filename: str):
    """Delete a content script JSON file."""
    if not filename.endswith(".json"):
        filename += ".json"

    file_path = os.path.join(INPUT_DIR, filename)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"Script '{filename}' not found.")

    try:
        os.remove(file_path)
        # Also remove from session files if present
        global current_session_files
        current_session_files = [f for f in current_session_files if f.name != filename]
        return {
            "message": f"Script '{filename}' deleted successfully.",
            "session_count": len(current_session_files),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete script: {e}")


@app.delete("/api/delete-reel/{filename}")
async def delete_reel_api(filename: str):
    """Delete a generated reel video file."""
    if not filename.endswith(".mp4"):
        filename += ".mp4"

    file_path = os.path.join(OUTPUT_DIR, filename)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"Reel '{filename}' not found.")

    try:
        os.remove(file_path)
        return {"message": f"Reel '{filename}' deleted successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete reel: {e}")


@app.post("/api/update-content")
async def update_content_api(file_name: str = Form(...), content: str = Form(...)):
    """
    API endpoint to update an existing content JSON file.
    Parses the text-based script back into the expected JSON format.
    """
    if not file_name.endswith(".json"):
        file_name += ".json"

    file_path = os.path.join(INPUT_DIR, file_name)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"File {file_name} not found.")

    try:
        # Parse the content back to JSON structure
        # Expected format in text: "SPEAKER: Dialogue"
        lines = content.split("\n")
        conversation = []

        # Simple extraction logic for the formatted text sent by frontend
        for line in lines:
            line = line.strip()
            if not line or line.startswith("//") or line.startswith("---"):
                continue

            if ":" in line:
                speaker, text = line.split(":", 1)
                conversation.append(
                    {"role": speaker.strip().capitalize(), "text": text.strip()}
                )

        if not conversation:
            raise HTTPException(
                status_code=400,
                detail="Could not parse any valid dialogue lines from the content.",
            )

        # Re-construct the JSON object
        # We try to preserve the original query/topic if possible
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                original_data = json.load(f)
        except:
            original_data = {}

        updated_data = {
            "query": original_data.get("query", "Updated manually"),
            "conversation": conversation,
        }

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(updated_data, f, indent=4)

        return {"message": f"Successfully updated and reformatted {file_name}"}
    except Exception as e:
        print(f"Error updating content: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update content: {e}")


@app.get("/health")
async def health_check():
    return {"status": "ok", "timestamp": time.time()}


# --- Log Streaming Endpoints ---
@app.get("/api/logs/stream")
async def stream_logs(request: Request):
    """SSE endpoint for real-time log streaming."""

    async def event_generator():
        queue = await log_buffer.subscribe()
        try:
            # Send recent logs first
            for log in log_buffer.get_recent_logs()[-50:]:
                yield f"data: {json.dumps(log)}\n\n"

            # Then stream new logs
            while True:
                if await request.is_disconnected():
                    break
                try:
                    log_entry = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield f"data: {json.dumps(log_entry)}\n\n"
                except asyncio.TimeoutError:
                    # Send a keepalive comment
                    yield ": keepalive\n\n"
        finally:
            await log_buffer.unsubscribe(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/logs/recent")
async def get_recent_logs():
    """Returns recent logs for initial load."""
    return {"logs": log_buffer.get_recent_logs()[-100:]}


@app.post("/api/generate-reels/session")
def generate_session_reels_api(audio_mode: str = Form(...)):
    """API endpoint to trigger reel generation for current session files."""
    global current_session_files
    files_to_process_paths = [f.path for f in current_session_files]

    if not files_to_process_paths:
        raise HTTPException(
            status_code=400, detail="No files in the current session to process."
        )

    results = _process_reels(files_to_process_paths, audio_mode)
    current_session_files = []

    return {
        "message": "Session Reel generation finished.",
        "results": results,
        "session_count": 0,
    }


@app.post("/api/generate-reels/all")
def generate_all_reels_api(audio_mode: str = Form(...)):
    """API endpoint to trigger reel generation for ALL existing files."""
    all_files = glob.glob(os.path.join(INPUT_DIR, "*.json"))
    files_to_process_paths = all_files

    if not files_to_process_paths:
        raise HTTPException(
            status_code=404, detail=f"No JSON files found in {INPUT_DIR}."
        )

    results = _process_reels(files_to_process_paths, audio_mode)

    return {"message": "All Reels generation finished.", "results": results}


@app.post("/api/generate-reel/single")
def generate_single_reel_api(filename: str = Form(...), audio_mode: str = Form(...)):
    """API endpoint to generate a reel for a single content file."""
    if not filename.endswith(".json"):
        filename += ".json"

    file_path = os.path.join(INPUT_DIR, filename)

    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=404, detail=f"Content file '{filename}' not found."
        )

    results = _process_reels([file_path], audio_mode)

    return {
        "message": f"Reel generation for '{filename}' finished.",
        "results": results,
    }


@app.post("/api/characters")
async def add_character_api(char: CharacterRequest):
    """API endpoint to add a new character."""
    global CHARACTER_MAP

    CHARACTER_MAP[char.name] = {
        "avatar": char.avatar or f"{char.name.lower()}.png",
        "voice_gemini": char.voice_gemini or "Rasalgethi",
        "voice_eleven": char.voice_eleven or "KSsyodh37PbfWy29kPtx",
        "voice_mac": char.voice_mac or "Aman",
        "voice_kokoro": char.voice_kokoro or "am_liam",
        "voice_kokoro_mlx": char.voice_kokoro_mlx or char.voice_kokoro or "am_liam",
    }

    try:
        with open(CHARACTER_CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(CHARACTER_MAP, f, indent=4)
        return {"message": f"Character {char.name} added successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save character: {e}")


@app.post("/api/prompts")
async def add_prompt_api(prompt: PromptRequest):
    """API endpoint to add a new prompt."""
    file_name = prompt.name.replace(" ", "_").lower()
    if not file_name.endswith(".txt"):
        file_name += ".txt"

    file_path = os.path.join(PROMPTS_DIR, file_name)

    try:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(prompt.content)
        return {
            "message": f"Prompt {prompt.name} added successfully.",
            "file_path": file_path,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save prompt: {e}")


@app.post("/api/generate-reel/batch")
async def generate_batch_reels_api(request: BatchRequest):
    """API endpoint to generate multiple reels in a batch."""
    process_items = []

    writer = get_content_writer(request.llm_provider)

    for job in request.jobs:
        # Use provided file_name or fallback to topic-based one
        if job.file_name and job.file_name.strip():
            file_name_clean = job.file_name.replace(" ", "_").lower()
        else:
            file_name_clean = job.topic.replace(" ", "_").lower()

        if not file_name_clean.endswith(".json"):
            file_name_clean += ".json"

        expected_path = os.path.join(INPUT_DIR, file_name_clean)

        try:
            # First generate the script
            if writer(
                job.topic,
                file_name_clean,
                job.prompt_filename,
                job.character_a,
                job.character_b,
            ):
                process_items.append(
                    {"path": expected_path, "pip_asset_override": job.pip_asset}
                )
            else:
                print(f"Failed to generate script for topic: {job.topic}")
        except Exception as e:
            print(f"Error generating script for {job.topic}: {e}")

    if not process_items:
        raise HTTPException(
            status_code=400,
            detail="No scripts were successfully generated for batch processing.",
        )

    results = _process_reels(process_items, request.audio_mode)

    return {"message": "Batch generation finished.", "results": results}


# --- RSS Feed Endpoints ---


@app.get("/api/rss/videos")
async def get_rss_videos(refresh: bool = False):
    """Returns all videos from the configured RSS feeds."""
    try:
        service = get_rss_service()
        videos = service.fetch_all_videos(force_refresh=refresh)
        return {"videos": videos}
    except Exception as e:
        print(f"RSS Fetch Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/rss/transcript/{video_id}")
async def get_rss_transcript(video_id: str):
    """Returns the transcript for a given YouTube video ID."""
    try:
        service = get_rss_service()
        transcript = service.get_transcript(video_id)
        if not transcript:
            raise HTTPException(
                status_code=404,
                detail="Transcript not found or available for this video.",
            )
        return {"transcript": transcript}
    except Exception as e:
        print(f"Transcript Fetch Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/rss/channels")
async def get_rss_channels():
    """Returns the list of configured RSS channels."""
    from .config import DATA_DIR

    channels_file = os.path.join(DATA_DIR, "rss_channels.json")
    if not os.path.exists(channels_file):
        return {"channels": []}
    with open(channels_file, "r") as f:
        return {"channels": json.load(f)}


@app.post("/api/rss/channels")
async def update_rss_channels(channels: List[Dict[str, Any]]):
    """Updates the RSS channels configuration."""
    from .config import DATA_DIR

    channels_file = os.path.join(DATA_DIR, "rss_channels.json")
    try:
        with open(channels_file, "w") as f:
            json.dump(channels, f, indent=4)
        return {"message": "Channels updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save channels: {e}")


# --- Static Frontend Serving (Catch-All) ---
# This MUST be defined AFTER all specific API routes to avoid intercepting them.

# 2. Serve root index.html and other static files
html_routes = ["/", "/studio", "/batch", "/files", "/log"]  # Known client-side routes


@app.get("/{full_path:path}")
async def serve_spa_or_static(full_path: str):
    """
    Serves static files from WEB_APP_OUT_DIR or rewrites to index.html for SPA routes.
    Prioritizes API routes (handled by FastAPI automatically before this catch-all).
    """

    # 0. API routes are already handled. If we are here, it's not an API match (mostly).
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="API endpoint not found")

    # 1. Check if the file exists directly in the out directory (e.g., favicon.ico, robotic.svg)
    file_path = os.path.join(WEB_APP_OUT_DIR, full_path)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return FileResponse(file_path)

    # 2. Check if it is a known SPA route or root
    # For a static export, 'studio' might point to 'studio.html' if configured that way,
    # but usually standard React SPA uses index.html for everything.
    # WITH output: 'export', Next.js generates:
    #   - index.html
    #   - studio.html (if studio is a page)
    # Let's check if there is a corresponding .html file

    html_path = os.path.join(WEB_APP_OUT_DIR, f"{full_path}.html")
    if os.path.exists(html_path):
        return FileResponse(html_path)

    # 3. Fallback to index.html for root or unknown routes (SPA behavior)
    index_path = os.path.join(WEB_APP_OUT_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)

    # 4. If index.html is missing (build not done), return a helpful message
    return JSONResponse(
        status_code=404,
        content={
            "detail": "Frontend static build not found. Please run 'bun run build' in web_app/ or check configuration."
        },
    )


# --- Startup and Shutdown Hooks ---
@app.on_event("startup")
async def startup_event():
    global original_stdout, original_stderr

    # Redirect stdout and stderr to capture print statements
    stdout_redirector = StreamToLogBuffer(original_stdout, log_buffer, "info")
    stderr_redirector = StreamToLogBuffer(original_stderr, log_buffer, "error")

    # Set the event loop for the redirectors
    stdout_redirector.loop = asyncio.get_running_loop()
    stderr_redirector.loop = asyncio.get_running_loop()

    sys.stdout = stdout_redirector
    sys.stderr = stderr_redirector

    # Ensure necessary directories exist
    os.makedirs(INPUT_DIR, exist_ok=True)
    os.makedirs(PROMPTS_DIR, exist_ok=True)
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(CAPTION_DIR, exist_ok=True)
    os.makedirs(PIP_DIR, exist_ok=True)

    # Add initial log entry
    await log_buffer.add_log("Application startup: Directories confirmed.", "success")
    await log_buffer.add_log("Terminal log streaming enabled.", "info")


@app.on_event("shutdown")
async def shutdown_event():
    print("Application shutdown: Cleaning up temporary directory.")
    cleanup_temp_dir()


# --- Execution Block (for main.py to call) ---
def run_server():
    """Function to start the Uvicorn server with CORS configured."""

    # Configure CORS for Next.js frontend integration
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "*"
        ],  # Be specific in production: e.g., ["http://localhost:3000"]
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    uvicorn.run(app, host="0.0.0.0", port=8008)


if __name__ == "__main__":
    print("Starting FastAPI server directly (for testing)...")
    cleanup_temp_dir()
    run_server()
