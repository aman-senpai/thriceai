# services/deepseek_writer.py

import json
import os
import string

from dotenv import load_dotenv
from openai import OpenAI

try:
    from ..config import (
        DEEPSEEK_API_KEY_NAME,
        DEEPSEEK_BASE_URL,
        DEEPSEEK_MODEL,
        INPUT_DIR,
    )
except ImportError:
    try:
        from config import (
            DEEPSEEK_API_KEY_NAME,
            DEEPSEEK_BASE_URL,
            DEEPSEEK_MODEL,
            INPUT_DIR,
        )
    except ImportError:
        INPUT_DIR = "input"
        DEEPSEEK_API_KEY_NAME = "DEEPSEEK_API_KEY"
        DEEPSEEK_BASE_URL = "https://api.deepseek.com"
        DEEPSEEK_MODEL = "deepseek-v4-pro"

load_dotenv(override=True)


def get_client():
    api_key = os.getenv(DEEPSEEK_API_KEY_NAME)
    if not api_key:
        print(f"Error: {DEEPSEEK_API_KEY_NAME} not found in environment variables.")
        return None
    return OpenAI(api_key=api_key, base_url=DEEPSEEK_BASE_URL)


def generate_content(
    query: str,
    file_name: str,
    prompt_file_path: str,
    char_a_name: str,
    char_b_name: str,
    language: str = "en",
) -> bool:
    """
    Generates content using DeepSeek API (OpenAI-compatible format).
    Substitutes character names dynamically using string.Template.
    """
    client = get_client()
    if client is None:
        return False

    file_path = os.path.join(INPUT_DIR, file_name)

    # 1. Load the System Prompt Template
    try:
        with open(prompt_file_path, "r", encoding="utf-8") as f:
            prompt_template = f.read()
    except FileNotFoundError:
        print(f"Error: Prompt file not found at {prompt_file_path}")
        return False

    # 2. Format the Template
    try:
        template = string.Template(prompt_template)
        system_prompt = template.substitute(
            CHARACTER_A_NAME=char_a_name,
            CHARACTER_B_NAME=char_b_name,
            USER_TOPIC=query,
            LANGUAGE=language,
        )
    except KeyError as e:
        print(
            f"Error: Prompt template is missing a required placeholder. Missing key: {e}"
        )
        return False

    # 3. Call DeepSeek API
    try:
        response = client.chat.completions.create(
            model=DEEPSEEK_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": query},
            ],
            response_format={"type": "json_object"},
            temperature=0.8,
        )

        raw_text = response.choices[0].message.content
        if not raw_text:
            print("Error: Model returned no text.")
            return False

        # Parse JSON
        try:
            content = json.loads(raw_text)
        except json.JSONDecodeError:
            print("Error: Model returned invalid JSON.")
            return False

        # Save JSON output
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(content, f, ensure_ascii=False, indent=4)

        return True

    except Exception as e:
        print(f"\n❌ DeepSeek API Error during content generation: {e}")
        return False
