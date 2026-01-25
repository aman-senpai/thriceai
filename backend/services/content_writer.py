# services/content_writer.py

import os
import json
import string # NEW: Import string for Template
from dotenv import load_dotenv
from openai import OpenAI
try:
    from ..config import INPUT_DIR
except ImportError:
    from config import INPUT_DIR

load_dotenv()

# Initialize OpenAI client
client = None
try:
    client = OpenAI()
except Exception as e:
    print(f"Error initializing OpenAI client: {e}")
    
def generate_content(query: str, file_name: str, prompt_file_path: str, char_a_name: str, char_b_name: str) -> bool:
    """
    Generates content using the OpenAI API based on the system prompt template, 
    substituting character names dynamically using string.Template to avoid JSON brace conflicts.
    """
    if client is None:
        print("Error: OpenAI client is not initialized. Check your API key.")
        return False

    file_path = os.path.join(INPUT_DIR, file_name)

    # 1. Load the System Prompt Template
    try:
        with open(prompt_file_path, 'r', encoding='utf-8') as f:
            prompt_template = f.read()
    except FileNotFoundError:
        print(f"Error: Prompt file not found at {prompt_file_path}")
        return False
        
    # 2. Format the Template (Substitute Placeholders)
    # We use string.Template here, which requires $PLACEHOLDER syntax in the prompt file.
    try:
        template = string.Template(prompt_template)
        system_prompt = template.substitute(
            CHARACTER_A_NAME=char_a_name,
            CHARACTER_B_NAME=char_b_name
        )
    except KeyError as e:
        print(f"Error: Prompt template is missing a required placeholder. Ensure character names use $VARIABLE_NAME. Missing key: {e}")
        return False
    
    # 3. Call the API
    try:
        print(f"Generating content for query: '{query}'...")
        
        # The prompt is now fully formed with correct character names
        res = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": query}
            ],
            response_format={"type": "json_object"}
        )

        content_str = res.choices[0].message.content
        usage = res.usage if hasattr(res, "usage") else None

        # Parse JSON
        try:
            content = json.loads(content_str)
        except json.JSONDecodeError:
            print("Error: Model returned invalid JSON. Please refine your query.")
            return False

        # Display structured content neatly
        print("Generated Content:")
        print("-" * 80)
        for item in content["conversation"]:
            role = item.get("role", "Unknown")
            text = item.get("text", "")
            print(f"{role}: {text.strip()}")
        print("-" * 80)

        # Show token stats
        if usage:
            print(f"Tokens Used → Prompt: {usage.prompt_tokens}, Completion: {usage.completion_tokens}, Total: {usage.total_tokens}")

        # Save JSON output
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(content, f, ensure_ascii=False, indent=4)

        print(f"\n✅ Content saved to: {file_path}")
        return True

    except Exception as e:
        print(f"\n❌ API Error during content generation: {e}")
        return False