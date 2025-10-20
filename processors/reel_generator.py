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
    ImageClip, 
    vfx,
    AudioClip,
    concatenate_audioclips
)

# NOTE: Assuming these imports are present in your local file:
from processors.audio_generator import (
    load_input_json, 
    generate_multi_role_audio_multiprocess, 
    filter_word_data
)

from config import (
    INPUT_DIR, VIDEO_DIR, OUTPUT_DIR, TEMP_DIR, OUTPUT_FILE, 
    TARGET_W, TARGET_H, FONT, FONT_SIZE, TEXT_COLOR, STROKE_COLOR, 
    STROKE_WIDTH, CAPTION_POSITION, BOUNCE_SCALE_MAX, MIN_CLIP_DURATION,
    AVATAR_CONFIG, AVATAR_DIR, AVATAR_WIDTH, AVATAR_Y_POS, 
    VIDEO_PADDING_START, VIDEO_PADDING_END, 
    suppress_output
)

class ReelGenerator:
    """
    A class to manage the end-to-end process of generating an Instagram Reel 
    from a conversation JSON, including TTS, timestamp alignment, 
    video cropping, and caption animation, and avatar animation.
    """
    def __init__(self, input_json_path):
        self.input_json_path = input_json_path
        self.base_name = os.path.basename(input_json_path).replace('.json', '')
        self.final_reel_name = f"{self.base_name}.mp4"
        self.final_output_path = os.path.join(OUTPUT_DIR, self.final_reel_name)
        self.temp_output_file = OUTPUT_FILE
        self.video_file = self._get_random_video_file()
    
    def _get_random_video_file(self):
        """Selects a random video file from the configured video directory."""
        video_extensions = ['*.mp4', '*.mov', '*.avi', '*.mkv'] 
        all_videos = []
        for ext in video_extensions:
            all_videos.extend(glob.glob(os.path.join(VIDEO_DIR, ext)))

        if not all_videos:
            raise FileNotFoundError(f"No video files found in the directory: {VIDEO_DIR}")
        
        return random.choice(all_videos)

    def _apply_bounce_animation(self, clip, word_duration):
        """Optimized bounce animation for a single word/image clip."""
        duration = max(word_duration, MIN_CLIP_DURATION) 
        t_norm = np.linspace(0, 1, int(duration * 30)) 
        scale_values = np.ones_like(t_norm)
        
        mask = t_norm < 0.4 
        t_bounce = t_norm[mask] * 2.5 
        
        scale_values[mask] = 1 + (BOUNCE_SCALE_MAX - 1) * np.sin(t_bounce * np.pi) * 0.8
        
        def scale_func(t):
            idx = min(int(t / word_duration * len(scale_values)), len(scale_values) - 1)
            return scale_values[idx]

        return clip.resize(scale_func)

    def _create_text_clips(self, word_data_list):
        """Create animated text clips for all words."""
        text_clips = []
        
        if not word_data_list:
            print("Error: No word data available to create captions.")
            return []

        # Content must be offset by VIDEO_PADDING_START
        offset = VIDEO_PADDING_START

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
            
            # Apply offset to start time
            animated_txt = animated_txt.set_start(start_time_word + offset).set_pos(CAPTION_POSITION)
            
            text_clips.append(animated_txt)
        
        return text_clips

    def _create_avatar_clips(self, word_data_list):
        """Create animated avatar clips based on the active speaker (role)."""
        avatar_clips = []
        active_role = None
        offset = VIDEO_PADDING_START # Content must be offset

        # 1. Group word data by role/speaker to define segments
        speaker_segments = []
        for word_data in word_data_list:
            role = word_data['role']
            
            if role != active_role:
                if active_role is not None:
                    # Finalize the previous segment's end time
                    speaker_segments[-1]['end'] = word_data['start']
                
                # Start a new segment
                active_role = role
                speaker_segments.append({
                    'role': role,
                    'start': word_data['start'],
                    'end': word_data['end'], 
                })
            else:
                # Continue the current segment
                speaker_segments[-1]['end'] = word_data['end']

        # 2. Create an avatar clip for each speaking segment
        for segment in speaker_segments:
            role = segment['role']
            start = segment['start']
            end = segment['end']
            duration = end - start
            
            config = AVATAR_CONFIG.get(role)
            if not config:
                print(f"Warning: No avatar config for role '{role}'. Skipping.")
                continue

            avatar_path = os.path.join(AVATAR_DIR, config['file'])
            if not os.path.exists(avatar_path):
                print(f"Error: Avatar file not found at {avatar_path}. Skipping.")
                continue

            # Load the image
            avatar_clip = ImageClip(avatar_path, duration=duration)
            
            # 1. Resize the clip to the positive AVATAR_WIDTH (Maintains aspect ratio)
            avatar_clip = avatar_clip.resize(width=AVATAR_WIDTH)
            
            # 2. Apply horizontal flip if required (This logic is disabled via config.py)
            if config['flip']:
                avatar_clip = avatar_clip.fx(vfx.mirror_x)

            # Apply the continuous smoother speaking animation
            animated_avatar = self._apply_avatar_speaking_animation(avatar_clip, duration)

            # Apply offset to start time
            animated_avatar = animated_avatar.set_start(start + offset)

            # Set position: anchor the bottom of the avatar to AVATAR_Y_POS
            animated_avatar = animated_avatar.set_pos(
                (config['pos_x'], AVATAR_Y_POS - animated_avatar.h), 
                relative=False 
            )
            
            avatar_clips.append(animated_avatar)
            
        return avatar_clips

    def _apply_avatar_speaking_animation(self, clip, segment_duration):
        """Creates a continuous, subtle, repeating bounce/scale effect for an avatar."""
        
        # Animation parameters (Smoother settings)
        freq = 4.0 
        max_scale = 1.02 
        
        def scale_func(t):
            # Sinusoidal scaling:
            scale = 1 + (max_scale - 1) * 0.5 * (1 + np.sin(2 * np.pi * freq * t))
            return scale

        return clip.resize(scale_func)


    def _prepare_video(self, required_duration):
        """Loads, loops/subclips, resizes, and crops the background video."""
        
        # Calculate the total duration needed including padding
        total_duration = required_duration + VIDEO_PADDING_START + VIDEO_PADDING_END
        
        print(f"  Using background video: {os.path.basename(self.video_file)}") 
        
        with suppress_output():
            video = VideoFileClip(self.video_file)
        
            if video.duration < total_duration:
                # Loop the video if it's shorter than required
                final_video_clip = video.loop(duration=total_duration)
            else:
                # Otherwise, take a random subclip
                max_start_time = video.duration - total_duration
                start_time = random.uniform(0, max(0, max_start_time))
                final_video_clip = video.subclip(start_time, start_time + total_duration)
            
            final_video_clip = final_video_clip.resize(height=TARGET_H)
            video_w = final_video_clip.w
            x_start = (video_w - TARGET_W) / 2
            final_video_clip = final_video_clip.crop(x1=x_start, width=TARGET_W)
        
        return final_video_clip

    def create_reel(self, audio_mode: str):
        """
        Main method to execute the Reel generation workflow.
        
        Args:
            audio_mode (str): 'elevenlabs' or 'default'.
        """
        total_start_time = time.time()
        
        try:
            # Re-importing locally in case the global imports were missed in previous steps
            from processors.audio_generator import (
                load_input_json, 
                generate_multi_role_audio_multiprocess, 
                filter_word_data
            )
            
            os.makedirs(TEMP_DIR, exist_ok=True)
            os.makedirs(OUTPUT_DIR, exist_ok=True)
            if not os.path.isdir(AVATAR_DIR):
                raise FileNotFoundError(f"Avatar directory not found: {AVATAR_DIR}")
            
            # 1. Load Input JSON
            ordered_turns, language_code = load_input_json(self.input_json_path)
            if not ordered_turns:
                return

            # 2. Generate Custom Audio and get Word Timestamps
            tts_audio_clip, word_data_list = generate_multi_role_audio_multiprocess(
                ordered_turns, language_code, audio_mode # <--- Passed audio_mode
            )

            required_caption_duration = tts_audio_clip.duration
            
            # 3. Filter Word Data
            word_data_list = filter_word_data(word_data_list)
            
            # 4. Prepare Background Video
            final_video_clip = self._prepare_video(required_caption_duration)

            # 5. Create Text Clips
            text_clips = self._create_text_clips(word_data_list)
            
            # 6. Create Avatar Clips
            avatar_clips = self._create_avatar_clips(word_data_list)
            
            # 7. Pad audio with silence at the start
            # Create a silent audio clip of the padding duration (0.5s)
            silence_clip = AudioClip(lambda t: 0, duration=VIDEO_PADDING_START)
            
            # Concatenate silence clip with the main audio clip
            final_audio_clip = concatenate_audioclips([silence_clip, tts_audio_clip])
            
            # Ensure the audio clip has the same duration as the final video clip
            final_audio_clip = final_audio_clip.set_duration(final_video_clip.duration) 

            if not text_clips and not avatar_clips:
                print("Video generation failed: No text or avatar clips were created.")
                return
            
            # 8. Compose Final Clip
            final_clip = CompositeVideoClip(
                [final_video_clip] + text_clips + avatar_clips, 
                size=(TARGET_W, TARGET_H)
            )
            final_clip = final_clip.set_audio(final_audio_clip)

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
            
            # 9. Move to Final Location
            shutil.move(self.temp_output_file, self.final_output_path)
            print(f"Total time: {time.time() - total_start_time:.2f}s")

        except FileNotFoundError as e:
            print(f"\nAn error occurred: {e}")
        except Exception as e:
            print(f"\nAn error occurred during video generation for {self.input_json_path}: {e}")
        
        finally:
            pass