# server.py
import os
import shutil
import glob
import sys
import uvicorn
import json
from fastapi import FastAPI, Request, Form, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Dict, Any
import time

# Ensure these imports are correct for your project structure
try:
    from config import INPUT_DIR, PROMPTS_DIR, CHARACTER_MAP, TEMP_DIR, VIDEO_DIR
    from services.content_writer import generate_content
    from processors.reel_generator import ReelGenerator 
except ImportError as e:
    print(f"Error importing modules (Check config.py, services/, processors/): {e}")
    sys.exit(1)

# --- UTILITIES ---

def cleanup_temp_dir():
    """Removes temporary directory and contents."""
    if os.path.exists(TEMP_DIR):
        try:
            shutil.rmtree(TEMP_DIR)
        except Exception as e:
            print(f"Cleanup Warning: {e}")

def get_prompt_files():
    """Returns a list of available prompt files (basename and full path)."""
    prompt_files = glob.glob(os.path.join(PROMPTS_DIR, "*.txt"))
    return [
        {"name": os.path.basename(f), "path": f}
        for f in prompt_files
    ]

def _process_reels(files_to_process_paths: List[str], audio_mode: str):
    """Handles the core reel generation using ReelGenerator."""
    if not os.path.isdir(VIDEO_DIR):
        raise HTTPException(status_code=500, detail=f"Error: Video directory '{VIDEO_DIR}' not found.")
        
    try:
        os.makedirs(TEMP_DIR, exist_ok=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error setting up TEMP_DIR: {e}")
    
    results = []
    print(f"Starting generation for {len(files_to_process_paths)} files in {audio_mode} mode.")
    for i, input_path in enumerate(files_to_process_paths, 1):
        json_file = os.path.basename(input_path)
        print(f"[{i}/{len(files_to_process_paths)}] Processing: {json_file}")
        try:
            # Assumes ReelGenerator is correctly imported and functions
            generator = ReelGenerator(input_path)
            generator.create_reel(audio_mode) 
            results.append({"file": json_file, "status": "Success"})
        except Exception as e:
            results.append({"file": json_file, "status": "Failed", "error": str(e)})
            print(f"Failed to generate reel for {json_file}: {e}")
            
    return results

# --- FastAPI Setup ---
app = FastAPI(title="Faceless Reel Generator WebUI")
templates = Jinja2Templates(directory="web_interface")

# Mount static files (JS, CSS)
app.mount("/static", StaticFiles(directory="web_interface/static"), name="static")

# Mount the assets directory (for character images/avatars)
# IMPORTANT: This assumes your images are in a folder named 'assets'
if os.path.isdir("assets"):
    # Note: We must ensure this mount is after the one above, or use a distinct name.
    # We will use the explicit /assets prefix to avoid conflict with root-served files.
    app.mount("/assets", StaticFiles(directory="assets"), name="assets")
else:
    print("Warning: 'assets' directory not found. Character images may not load.")

# --- Schemas and Global State ---

class GenerateContentRequest(BaseModel):
    query: str
    file_name: str
    selected_prompt_path: str
    char_a_name: str
    char_b_name: str

class ContentFile(BaseModel):
    name: str
    path: str

current_session_files: List[ContentFile] = []

# --- Endpoints ---

@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    """Serves the main web interface page."""
    # The frontend script.js will fetch all dynamic data via API
    return templates.TemplateResponse(
        "index.html",
        {"request": request}
    )

@app.get("/api/data/config")
async def get_config_data_api():
    """Returns initial configuration data and character details."""
    return {
        "tts_modes": ['gemini', 'elevenlabs', 'mac_say'],
        "prompt_files": get_prompt_files(),
        "characters": CHARACTER_MAP, 
        "session_count": len(current_session_files)
    }

@app.get("/api/data/reels")
async def get_reels_api():
    """Returns a list of all finished reel files with creation time."""
    reel_files = glob.glob(os.path.join(VIDEO_DIR, "*.mp4"))
    
    reels_list = []
    for f_path in reel_files:
        try:
            content_name = os.path.splitext(os.path.basename(f_path))[0] + ".json"
            content_path = os.path.join(INPUT_DIR, content_name)
            
            reels_list.append({
                "name": os.path.basename(f_path),
                "path": f_path,
                "size_kb": round(os.path.getsize(f_path) / 1024, 2),
                "modified": os.path.getmtime(f_path) * 1000, # Convert to milliseconds
                "content_exists": os.path.exists(content_path)
            })
        except Exception:
            reels_list.append({
                "name": os.path.basename(f_path),
                "path": f_path,
                "size_kb": 0,
                "modified": os.path.getmtime(f_path) * 1000,
                "content_exists": False
            })
            
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
            with open(f_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # *** UPDATED LOGIC ***
            # Try 'conversation' format (like glutes.json)
            dialogue_list = data.get('conversation', [])
            if dialogue_list:
                for item in dialogue_list:
                    if item.get('role') and item.get('text'):
                        dialogues.append({
                            "speaker": item['role'],
                            "dialogue": item['text']
                        })
            else:
                # Fallback to 'content' format (original code)
                dialogue_list = data.get('content', [])
                for item in dialogue_list:
                    if item.get('speaker') and item.get('dialogue'):
                        dialogues.append({
                            "speaker": item['speaker'],
                            "dialogue": item['dialogue']
                        })
            # *** END OF UPDATE ***
            
            contents_list.append({
                "name": os.path.basename(f_path),
                "path": f_path,
                "modified": os.path.getmtime(f_path) * 1000,
                "query": data.get('query', data.get('topic', 'N/A')), # Also check for 'topic'
                "dialogues": dialogues
            })
        except Exception as e:
            contents_list.append({
                "name": os.path.basename(f_path),
                "path": f_path,
                "modified": os.path.getmtime(f_path) * 1000,
                "query": f"Error loading file: {e}",
                "dialogues": []
            })
            
    return {"contents": contents_list}

@app.get("/api/download/reel/{filename}")
async def download_reel(filename: str):
    """Allows downloading a finished reel file."""
    file_path = os.path.join(VIDEO_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Reel file not found.")
    
    return FileResponse(
        path=file_path, 
        filename=filename, 
        media_type='video/mp4'
    )

@app.get("/api/preview/reel/{filename}")
async def preview_reel(filename: str):
    """Allows streaming/previewing a finished reel file."""
    file_path = os.path.join(VIDEO_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Reel file not found.")
    
    return FileResponse(
        path=file_path, 
        media_type='video/mp4'
    )

@app.post("/api/generate-content")
async def generate_content_api(data: GenerateContentRequest):
    """API endpoint to trigger content generation."""
    
    if data.char_a_name == data.char_b_name:
        raise HTTPException(status_code=400, detail="Character A and Character B must be different.")
        
    file_name_clean = data.file_name.replace(" ", "_").lower()
    if not file_name_clean.endswith(".json"):
        file_name_clean += ".json"
    
    expected_path = os.path.join(INPUT_DIR, file_name_clean)

    try:
        # Assumes generate_content is correctly imported
        if generate_content(
            data.query, 
            file_name_clean, 
            data.selected_prompt_path, 
            data.char_a_name, 
            data.char_b_name
        ):
            new_file = ContentFile(name=file_name_clean, path=expected_path)
            global current_session_files
            current_session_files.append(new_file)
            return {"message": "Content generated successfully", "file_name": file_name_clean, "session_count": len(current_session_files)}
        else:
            raise HTTPException(status_code=500, detail="Content generation service failed.")
    except Exception as e:
        print(f"Error during content generation: {e}")
        raise HTTPException(status_code=500, detail=f"Server error during generation: {e}")

@app.post("/api/generate-reels/session")
async def generate_session_reels_api(audio_mode: str = Form(...)):
    """API endpoint to trigger reel generation for current session files."""
    global current_session_files
    files_to_process_paths = [f.path for f in current_session_files]

    if not files_to_process_paths:
        raise HTTPException(status_code=400, detail="No files in the current session to process.")

    results = _process_reels(files_to_process_paths, audio_mode)
    current_session_files = [] 

    return {"message": "Session Reel generation finished.", "results": results, "session_count": 0}

@app.post("/api/generate-reels/all")
async def generate_all_reels_api(audio_mode: str = Form(...)):
    """API endpoint to trigger reel generation for ALL existing files."""
    all_files = glob.glob(os.path.join(INPUT_DIR, "*.json"))
    files_to_process_paths = all_files
    
    if not files_to_process_paths:
        raise HTTPException(status_code=404, detail=f"No JSON files found in {INPUT_DIR}.")

    results = _process_reels(files_to_process_paths, audio_mode)

    return {"message": "All Reels generation finished.", "results": results}


# --- Startup and Shutdown Hooks ---
@app.on_event("startup")
async def startup_event():
    # Ensure necessary directories exist
    os.makedirs(INPUT_DIR, exist_ok=True)
    os.makedirs(PROMPTS_DIR, exist_ok=True)
    os.makedirs(VIDEO_DIR, exist_ok=True)
    print("Application startup: Directories confirmed.")

@app.on_event("shutdown")
async def shutdown_event():
    print("Application shutdown: Cleaning up temporary directory.")
    cleanup_temp_dir()

# --- Execution Block (for main.py to call) ---
def run_server():
    """Function to start the Uvicorn server."""
    # This block is essential for main.py to invoke the server
    uvicorn.run(app, host="0.0.0.0", port=8000)

if __name__ == "__main__":
    print("Starting FastAPI server directly (for testing)...")
    cleanup_temp_dir()
    run_server()