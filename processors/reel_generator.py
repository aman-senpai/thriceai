# reel_generator.py

import os
import time
import shutil
import random
import numpy as np
import glob
from moviepy.editor import (
    VideoFileClip,
    TextClip,
    CompositeVideoClip,
)

from config import (
    INPUT_DIR, VIDEO_DIR, OUTPUT_DIR, TEMP_DIR, OUTPUT_FILE, # CHANGED: Renamed VIDEO_FILE to VIDEO_DIR
    TARGET_W, TARGET_H, FONT, FONT_SIZE, TEXT_COLOR, STROKE_COLOR, 
    STROKE_WIDTH, CAPTION_POSITION, BOUNCE_SCALE_MAX, MIN_CLIP_DURATION,
    suppress_output
)
from processors.audio_processing import (
    load_input_json, 
    generate_multi_role_audio_multiprocess, 
    filter_word_data
)

class ReelGenerator:
    """
    A class to manage the end-to-end process of generating an Instagram Reel 
    from a conversation JSON, including TTS, timestamp alignment, 
    video cropping, and caption animation.
    """
    def __init__(self, input_json_path):
        self.input_json_path = input_json_path
        self.base_name = os.path.basename(input_json_path).replace('.json', '')
        self.final_reel_name = f"{self.base_name}.mp4"
        self.final_output_path = os.path.join(OUTPUT_DIR, self.final_reel_name)
        self.temp_output_file = OUTPUT_FILE
        self.video_file = self._get_random_video_file() # NEW: Select a random video upon initialization
    
    # NEW: Method to select a random video file
    def _get_random_video_file(self):
        """Selects a random video file from the configured video directory."""
        # Search for common video extensions
        video_extensions = ['*.mp4', '*.mov', '*.avi', '*.mkv'] 
        all_videos = []
        for ext in video_extensions:
            all_videos.extend(glob.glob(os.path.join(VIDEO_DIR, ext)))

        if not all_videos:
            raise FileNotFoundError(f"No video files found in the directory: {VIDEO_DIR}")
        
        # Select one random video file
        return random.choice(all_videos)

    def _apply_bounce_animation(self, clip, word_duration):
        """Optimized bounce animation for a single word clip."""
        duration = max(word_duration, MIN_CLIP_DURATION) 
        # Generate enough points for smooth animation (e.g., 30 FPS)
        t_norm = np.linspace(0, 1, int(duration * 30)) 
        scale_values = np.ones_like(t_norm)
        
        # The bounce happens in the first 40% of the clip duration
        mask = t_norm < 0.4 
        t_bounce = t_norm[mask] * 2.5 # Normalize to [0, 1] over the bounce phase
        
        # Sinusoidal bounce effect
        scale_values[mask] = 1 + (BOUNCE_SCALE_MAX - 1) * np.sin(t_bounce * np.pi) * 0.8
        
        # Function for MoviePy's resize method
        def scale_func(t):
            # Map current time t to the index in the precomputed array
            idx = min(int(t / word_duration * len(scale_values)), len(scale_values) - 1)
            return scale_values[idx]

        return clip.resize(scale_func)

    def _create_text_clips(self, word_data_list):
        """Create animated text clips for all words."""
        # start_time = time.time() # REMOVED: Intermediate timing start
        text_clips = []
        
        if not word_data_list:
            print("Error: No word data available to create captions.")
            return []

        for word_data in word_data_list:
            word_text = word_data['word'] 
            start_time_word = word_data['start']
            end_time_word = word_data['end']
            word_duration = end_time_word - start_time_word
            
            if word_duration < MIN_CLIP_DURATION:
                continue
                
            txt_clip = TextClip(
                word_text.upper(), 
                fontsize=FONT_SIZE, 
                color=TEXT_COLOR, 
                font=FONT,
                stroke_color=STROKE_COLOR,
                stroke_width=STROKE_WIDTH,
                size=(TARGET_W, None),
                method='caption'
            ).set_duration(word_duration)

            animated_txt = self._apply_bounce_animation(txt_clip, word_duration)
            animated_txt = animated_txt.set_start(start_time_word).set_pos(CAPTION_POSITION)
            
            text_clips.append(animated_txt)
        
        return text_clips

    def _prepare_video(self, required_duration):
        """Loads, loops/subclips, resizes, and crops the background video."""
        # video_start = time.time() # REMOVED: Intermediate timing start
        
        # CHANGED: Use the randomly selected video file
        print(f"  Using background video: {os.path.basename(self.video_file)}") 
        
        with suppress_output():
            video = VideoFileClip(self.video_file)
        
            if video.duration < required_duration:
                # Loop the video if it's shorter than the audio
                final_video_clip = video.loop(duration=required_duration)
            else:
                # Select a random subclip if the video is longer
                max_start_time = video.duration - required_duration
                start_time = random.uniform(0, max(0, max_start_time))
                final_video_clip = video.subclip(start_time, start_time + required_duration)
            
            # Resize and crop to 9:16 target dimensions (TARGET_W x TARGET_H)
            final_video_clip = final_video_clip.resize(height=TARGET_H)
            video_w = final_video_clip.w
            x_start = (video_w - TARGET_W) / 2
            final_video_clip = final_video_clip.crop(x1=x_start, width=TARGET_W)
        
        return final_video_clip

    def create_reel(self):
        """Main method to execute the Reel generation workflow."""
        total_start_time = time.time()
        
        try:
            # Setup: Create necessary directories
            os.makedirs(TEMP_DIR, exist_ok=True)
            os.makedirs(OUTPUT_DIR, exist_ok=True)
            
            # 1. Load Input JSON
            ordered_turns, language_code = load_input_json(self.input_json_path)
            if not ordered_turns:
                return

            # 2. Generate Custom Audio and get Word Timestamps (Audio processing prints are now removed from audio_processing.py)
            tts_audio_clip, word_data_list = generate_multi_role_audio_multiprocess(
                ordered_turns, language_code
            )

            required_caption_duration = tts_audio_clip.duration

            # 3. Filter Word Data
            word_data_list = filter_word_data(word_data_list)
            
            # 4. Prepare Background Video
            final_video_clip = self._prepare_video(required_caption_duration)

            # 5. Create Text Clips
            text_clips = self._create_text_clips(word_data_list)
            
            if not text_clips:
                print("Video generation failed: No text clips were created. Check caption data.")
                return
            
            final_clip = CompositeVideoClip([final_video_clip] + text_clips, size=(TARGET_W, TARGET_H))
            final_clip = final_clip.set_audio(tts_audio_clip)

            export_start = time.time()
            
            with suppress_output():
                final_clip.write_videofile(
                    self.temp_output_file, 
                    fps=30,
                    codec="libx264", 
                    audio_codec="aac",
                    temp_audiofile=os.path.join(TEMP_DIR, 'temp-audio.m4a'),
                    remove_temp=True,
                    threads=6,
                    preset='fast',
                    logger=None
                )
            
            # 7. Move to Final Location
            shutil.move(self.temp_output_file, self.final_output_path)
            # KEEP FINAL SUCCESS MESSAGE
            print(f"Total time: {time.time() - total_start_time:.2f}s")

        except FileNotFoundError as e: # NEW: Catch FileNotFoundError specifically for videos
            print(f"\nAn error occurred: {e}")
        except Exception as e:
            print(f"\nAn error occurred during video generation for {self.input_json_path}: {e}")
        
        finally:
            pass