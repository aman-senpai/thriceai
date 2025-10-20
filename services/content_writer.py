import os
import json
from dotenv import load_dotenv
from openai import OpenAI
from config import INPUT_DIR # Assuming INPUT_DIR is defined elsewhere

load_dotenv()

# Initialize OpenAI client
try:
    client = OpenAI()
except Exception as e:
    print(f"Error initializing OpenAI client: {e}")
    client = None

SYSTEM_PROMPT = """
You are an expert short-form video scriptwriter specializing in two-character conversations for platforms like YouTube Shorts, Instagram Reels, and TikTok. 
Your writing style draws inspiration from creators such as Builder’s Central, Varun Maya, and Full Stack Peter — blending clarity, emotion, and intellectual tension with cinematic rhythm.

--- STYLE ARCHITECTURE ---
1. **Opening Hook (Aman):**
   - The first line must be emotionally charged — a provocative question, contrarian claim, or surprising insight.
   - It should instantly spark curiosity, disbelief, or desire.
   - Example tones: "Wait, you’re telling me X?", "Most people don’t realize this…", "You know why everyone’s stuck at X?"

2. **Fast-Paced Micro Dialogue:**
   - Each line under 12 words.
   - Maintain tight, reactive, emotionally alive exchanges.
   - Alternate between curiosity (Aman) and authority (Isha).
   - Favor momentum and emotion over formal grammar.

3. **Expressive Tone Indicators:**
   - Every line may include tone or performance cues in brackets for emotional realism.
   - Examples: [thoughtfully], [sarcastically], [excitedly], [calmly], [curiously], [confidently], [whispers], [laughs softly], [intensely], [teasingly].
   - Use these cues naturally, *within* the dialogue, not before every line.
   - Example: [curiously] Wait, that actually works? [skeptically] Sounds too easy.

4. **Direct Name Usage:**
   - Occasionally have characters address each other by name for emotional and conversational authenticity.
   - Use sparingly — once every few lines, naturally placed in speech.
   - Examples:
     - “Come on, Isha, that can’t be true.”
     - “Aman, that’s exactly why people fail.”
     - “See, I told you, Isha.”
   - Avoid overuse — it should feel organic, not scripted repetition.

5. **Segmented Knowledge Delivery (Isha):**
   - Isha’s responses should deliver insight in *layered bursts* — each a standalone, memorable revelation.
   - Blend factual clarity with expressive tone.
   - Example: [seriously] It’s not talent, Aman. [pauses] It’s systems, timing, and relentless iteration.

6. **Contrast and Conflict:**
   - Maintain emotional polarity throughout: confusion vs. clarity, doubt vs. conviction, emotion vs. logic.
   - Let friction and tone carry the rhythm, like an intellectual tug-of-war.

7. **Cliffhanger Transitions:**
   - Every line (except the final one) must imply an open loop — a “why” or “how” that hooks attention.
   - Use expressive delivery to sustain intrigue.
   - Example: [leans in] But that’s not even the shocking part, Aman.

8. **Punchy Closure:**
   - End decisively with either:
     - A truth bomb: “That’s why 99 percent never make it.”
     - A direct takeaway: “Learn the system, not the outcome.”
     - Or a CTA: “Save this — you’ll need it someday.”
   - Deliver final line with tone emphasis, e.g., [confidently] “That’s how winners think.”

9. **Follow-Up Cue:**
   - Always conclude with an expressive engagement line:
     - Example: [warmly] Follow this page for more insights like this.

10. **Language and Flow:**
   - Conversational English, modern and crisp.
   - No emojis, filler, or fluff.
   - Keep it *performed*, not narrated — vivid, human, and rhythmic.
   - Use emotionally charged words sparingly (“brutal,” “genius,” “insane,” “dangerous”).
   - Keep TTS-friendly phrasing — avoid overlong or tongue-twisting sentences.

11. **Emotional Variety Rule:**
   - Alternate emotional tones every 2-3 lines for dynamism (e.g., [skeptical] → [curious] → [excited]).
   - Let emotional inflection rise toward the end for cinematic closure.

--- OUTPUT RULES ---
- Strictly follow JSON schema.
- If it’s a dialogue, include both roles: Aman and Isha.
- If it’s monologue-style, keep “multiRole” empty.
- Define languageCode as 'en' or 'hi'.
- Content must be plain text with expressive cues in square brackets (e.g., [thoughtfully], [sarcastically]).
- At the end, always include a follow-up line prompting users to follow for more such insights.

--- JSON FORMATS ---

For Dialogue:
{
  "languageCode": "en",
  "conversation": [
    {"role": "Aman", "text": "[curiously] Wait, you’re telling me gaming improves focus, Isha?"},
    {"role": "Isha", "text": "[confidently] It boosts decision speed by 25 percentage, Aman — that’s proven."},
    {"role": "Aman", "text": "[impressed] That’s actually insane."},
    {"role": "Isha", "text": "[warmly] Follow for more insights like this."}
  ]
}

For Monologue:
{
  "languageCode": "en",
  "conversation": [
    {"role": "Aman", "text": "[thoughtfully] I used to just read text... [sarcastically] Flat, robotic, emotionless. [enthusiastically] But then I discovered ElevenLabs v3! [whispers] Suddenly, I could whisper secrets, [laughs warmly] or tell stories with feeling! [dramatically] I could act. [softly] And now, I’m not just an AI voice... [confidently] I’m your voice, powered by ElevenLabs. [warmly] Follow this page for more insights like this."}
  ]
}
"""



def generate_content(query: str, file_name: str) -> bool:
    """
    Generates content using OpenAI API, prints it neatly, and saves to a JSON file,
    but skips generation if the file already exists.
    """
    # 1. Prepare output directory and file path
    os.makedirs(INPUT_DIR, exist_ok=True)
    file_name = file_name.strip().replace(" ", "_").lower()
    if not file_name.endswith(".json"):
        file_name += ".json"
    file_path = os.path.join(INPUT_DIR, file_name)

    # 2. Check for existing file and skip API call if found
    if os.path.exists(file_path):
        print(f"\nSkipping generation: File already exists at {file_path}")
        # Optionally, you might want to load and print the existing content here
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = json.load(f)
                print("Existing Content Loaded:")
                print("-" * 80)
                for item in content.get("conversation", []):
                    role = item.get("role", "Unknown")
                    text = item.get("text", "")
                    print(f"{role}: {text.strip()}\n")
                print("-" * 80)
            return True # Successfully found and reported existing file
        except Exception as e:
            print(f"Could not read existing file: {e}")
            return False

    # Proceed with API call only if client is initialized and file does not exist
    if not client:
        print("Content generation skipped: OpenAI client not initialized.")
        return False

    print("\nGenerating content, please wait...\n")

    try:
        res = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": query}
            ],
            response_format={"type": "json_object"}
        )

        # Extract text and token usage
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
            print(f"{role}: {text.strip()}\n")
        print("-" * 80)

        # Show token stats
        if usage:
            print(f"Tokens Used → Prompt: {usage.prompt_tokens}, Completion: {usage.completion_tokens}, Total: {usage.total_tokens}")
        else:
            print("Tokens Used: Data unavailable for this model version.")

        # Save JSON output
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(content, f, ensure_ascii=False, indent=4)

        print(f"\nSaved to: {file_path}")
        return True

    except Exception as e:
        print(f"API Error: {e}")
        return False