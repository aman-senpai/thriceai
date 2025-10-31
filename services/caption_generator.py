# services/caption_generator.py

import os
import json
from dotenv import load_dotenv
from openai import OpenAI

# Assuming CAPTION_DIR and CAPTION_SYSTEM_PROMPT_PATH are in config
try:
    from config import CAPTION_DIR, CAPTION_SYSTEM_PROMPT_PATH
except ImportError:
    # Fallback/error handling if config isn't set up yet
    CAPTION_DIR = "outputs/captions"
    CAPTION_SYSTEM_PROMPT_PATH = "prompts/captions/blinked_thrice.txt"
    print("Warning: Could not import config variables for caption generation.")


load_dotenv()
client = None
try:
    client = OpenAI()
except Exception as e:
    print(f"Error initializing OpenAI client for caption generation: {e}")

def load_system_prompt() -> str:
    """Loads the system prompt from the dedicated text file."""
    try:
        with open(CAPTION_SYSTEM_PROMPT_PATH, 'r', encoding='utf-8') as f:
            return f.read().strip()
    except FileNotFoundError:
        print(f"Error: System prompt file not found at {CAPTION_SYSTEM_PROMPT_PATH}")
        return (
            "You are an expert Social Media Manager. Generate a highly engaging Instagram caption "
            "based on the provided script JSON. Focus on a hook, a brief summary, 3 relevant @mentions "
            "and 8-10 high-impact hashtags. Provide ONLY the caption text."
        )

def generate_caption(script_file_path: str) -> str | bool:
    """
    Generates an Instagram caption based on a provided video script JSON file.
    Returns the caption text on success, or False on failure.
    """
    if client is None:
        print("Error: OpenAI client is not initialized. Check your API key.")
        return False
    
    system_prompt = load_system_prompt()

    # 1. Load the Script JSON
    try:
        with open(script_file_path, 'r', encoding='utf-8') as f:
            script_json = json.load(f)
    except FileNotFoundError:
        print(f"Error: Script file not found at {script_file_path}")
        return False
    except json.JSONDecodeError:
        print(f"Error: Invalid JSON format in script file at {script_file_path}")
        return False

    script_json_str = json.dumps(script_json, indent=4)

    # 2. Call the API
    try:
        print(f"Generating Instagram caption for script: '{script_file_path}'...")
        
        res = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": script_json_str}
            ]
        )

        caption_text = res.choices[0].message.content.strip().strip('"').strip("'")
        usage = res.usage if hasattr(res, "usage") else None
        
        # 3. Save Output
        base_name = os.path.splitext(os.path.basename(script_file_path))[0]
        caption_file_path = os.path.join(CAPTION_DIR, f"{base_name}_caption.txt")

        os.makedirs(CAPTION_DIR, exist_ok=True)
        with open(caption_file_path, "w", encoding="utf-8") as f:
            f.write(caption_text)

        print(f"\n✅ Caption saved to: {caption_file_path}")
        if usage:
            print(f"Tokens Used → Prompt: {usage.prompt_tokens}, Completion: {usage.completion_tokens}, Total: {usage.total_tokens}")

        return caption_text
        
    except Exception as e:
        print(f"\n❌ API Error during caption generation: {e}")
        return False