
import sys
import os

# Add project root to sys.path
sys.path.insert(0, os.path.abspath("/home/senpai/Dev/thriceai"))

from backend.processors.reel_generator import ReelGenerator

def test_generation():
    json_path = "/home/senpai/Dev/thriceai/contents/test_numbers.json"
    print(f"Testing generation for {json_path}")
    generator = ReelGenerator(json_path)
    # Using 'kokoro' to test the specific failure reported
    generator.create_reel(audio_mode='kokoro')

if __name__ == "__main__":
    test_generation()
