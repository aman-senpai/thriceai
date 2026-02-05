# services/content_writer.py

import os
import json
import string
from dotenv import load_dotenv
from google import genai
from google.genai import types

try:
    from ..config import INPUT_DIR, GEMINI_API_KEY_NAME
except ImportError:
    try:
        from config import INPUT_DIR, GEMINI_API_KEY_NAME
    except ImportError:
        INPUT_DIR = "input" # Fallback
        GEMINI_API_KEY_NAME = "GEMINI_API_KEY"

load_dotenv(override=True)

# Initialize Gemini client
def get_client():
    api_key = os.getenv(GEMINI_API_KEY_NAME)
    if not api_key:
        print(f"Error: {GEMINI_API_KEY_NAME} not found in environment variables.")
        return None
    return genai.Client(api_key=api_key)

def add_citations(response):
    """Adds inline citations to the response text based on grounding metadata."""
    if not response.candidates or not response.candidates[0].grounding_metadata:
        return response.text
        
    text = response.text
    metadata = response.candidates[0].grounding_metadata
    supports = metadata.grounding_supports
    chunks = metadata.grounding_chunks
    
    if not supports or not chunks:
        return text

    # Sort supports by end_index in descending order to avoid shifting issues when inserting.
    sorted_supports = sorted(supports, key=lambda s: s.segment.end_index, reverse=True)

    for support in sorted_supports:
        end_index = support.segment.end_index
        if support.grounding_chunk_indices:
            # Create citation string like [1](link1)[2](link2)
            citation_links = []
            for i in support.grounding_chunk_indices:
                if i < len(chunks):
                    uri = chunks[i].web.uri
                    citation_links.append(f"[{i + 1}]({uri})")

            citation_string = " " + ", ".join(citation_links) # Add space before citations
            text = text[:end_index] + citation_string + text[end_index:]

    return text

def generate_content(query: str, file_name: str, prompt_file_path: str, char_a_name: str, char_b_name: str) -> bool:
    """
    Generates content using the Gemini API 3.0 Flash Preview with Grounding (Google Search),
    substituting character names dynamically using string.Template.
    """
    client = get_client()
    if client is None:
        return False

    file_path = os.path.join(INPUT_DIR, file_name)

    # 1. Load the System Prompt Template
    try:
        with open(prompt_file_path, 'r', encoding='utf-8') as f:
            prompt_template = f.read()
    except FileNotFoundError:
        print(f"Error: Prompt file not found at {prompt_file_path}")
        return False
        
    # 2. Format the Template
    try:
        template = string.Template(prompt_template)
        system_prompt = template.substitute(
            CHARACTER_A_NAME=char_a_name,
            CHARACTER_B_NAME=char_b_name
        )
    except KeyError as e:
        print(f"Error: Prompt template is missing a required placeholder. Missing key: {e}")
        return False
    
    # 3. Call the API
    try:
        print(f"Generating content for query: '{query}' with Gemini 3.0 Flash Preview & Grounding...")
        
        grounding_tool = types.Tool(
            google_search=types.GoogleSearch()
        )

        config = types.GenerateContentConfig(
            tools=[grounding_tool],
            response_mime_type="application/json",
            system_instruction=system_prompt
        )

        response = client.models.generate_content(
            model="gemini-3-flash-preview",
            contents=query,
            config=config,
        )

        if not response.text:
             print("Error: Model returned no text.")
             return False

        # Apply citations if grounding metadata exists
        text_with_citations = add_citations(response)
        
        # Parse JSON
        try:
            content = json.loads(text_with_citations)
        except json.JSONDecodeError:
            # Fallback: try parsing the original text without citations if the modified one failed
            try:
                content = json.loads(response.text)
                print("Warning: Could not parse JSON with citations, using original text.")
            except json.JSONDecodeError:
                 print("Error: Model returned invalid JSON.")
                 print(f"Raw response: {response.text}")
                 return False

        # Display structured content neatly
        print("Generated Content:")
        print("-" * 80)
        if "conversation" in content:
            for item in content["conversation"]:
                role = item.get("role", "Unknown")
                text = item.get("text", "")
                print(f"{role}: {text.strip()}")
        else:
             print(json.dumps(content, indent=2))
        print("-" * 80)
        
        # Grounding info logging
        if response.candidates and response.candidates[0].grounding_metadata:
             md = response.candidates[0].grounding_metadata
             if md.web_search_queries:
                 print(f"Search Queries Used: {md.web_search_queries}")
        
        # Save JSON output
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(content, f, ensure_ascii=False, indent=4)

        print(f"\n✅ Content saved to: {file_path}")
        return True

    except Exception as e:
        print(f"\n❌ API Error during content generation: {e}")
        return False