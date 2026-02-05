
import sys
import os

# Add project root to sys.path
sys.path.insert(0, os.path.abspath("/home/senpai/Dev/thriceai"))

from backend.processors.reel_generator import ReelGenerator

def test_generation():
    json_path = "/home/senpai/Dev/thriceai/contents/ai.json"
    print(f"Testing generation for {json_path}")
    generator = ReelGenerator(json_path)
    # Using 'default' which maps to Gemini
    generator.create_reel(audio_mode='default')

if __name__ == "__main__":
    test_generation()
