# processors/reel_generator.py

import os
import time
import shutil
import random
import numpy as np
import glob

# Required for robust transparent PNG handling and flipping
from PIL import Image # Pillow library
import io # ADDED for in-memory image handling

from moviepy.editor import (
    VideoFileClip,
    TextClip,
    CompositeVideoClip,
    ImageClip, 
    ColorClip,
    vfx,
    AudioClip,
    concatenate_audioclips,
    VideoClip,
    ImageSequenceClip, # ADDED: For animated WebP handling
)

try:
    from .audio_generator import (
        load_input_json, 
        generate_multi_role_audio_multiprocess, 
        filter_word_data
    )
    from ..config import (
        INPUT_DIR, VIDEO_DIR, OUTPUT_DIR, TEMP_DIR, OUTPUT_FILE, 
        TARGET_W, TARGET_H, FONT, FONT_SIZE, TEXT_COLOR, STROKE_COLOR, 
        STROKE_WIDTH, CAPTION_POSITION, BOUNCE_SCALE_MAX, MIN_CLIP_DURATION,
        CHARACTER_MAP, 
        AVATAR_DIR, AVATAR_WIDTH, AVATAR_Y_POS, 
        VIDEO_PADDING_START, VIDEO_PADDING_END, 
        suppress_output,
        # --- NEW IMPORTS ---
        PIP_DIR,
        PIP_WIDTH,
        PIP_Y_OFFSET,
        VIDEO_CODEC,
        # -------------------
    )
except ImportError:
    from processors.audio_generator import (
        load_input_json, 
        generate_multi_role_audio_multiprocess, 
        filter_word_data
    )
    from config import (
        INPUT_DIR, VIDEO_DIR, OUTPUT_DIR, TEMP_DIR, OUTPUT_FILE, 
        TARGET_W, TARGET_H, FONT, FONT_SIZE, TEXT_COLOR, STROKE_COLOR, 
        STROKE_WIDTH, CAPTION_POSITION, BOUNCE_SCALE_MAX, MIN_CLIP_DURATION,
        CHARACTER_MAP, 
        AVATAR_DIR, AVATAR_WIDTH, AVATAR_Y_POS, 
        VIDEO_PADDING_START, VIDEO_PADDING_END, 
        suppress_output,
        # --- NEW IMPORTS ---
        PIP_DIR,
        PIP_WIDTH,
        PIP_Y_OFFSET,
        VIDEO_CODEC,
        # -------------------
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
        """Selects a random video file from the configured video directory.
        Includes a fallback to a ColorClip if no video files are found."""
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



    def _get_speaker_segments(self, word_data_list):
        """Groups word data into speaker segments (turns)."""
        speaker_segments = []
        active_role = None
        
        for word_data in word_data_list:
            role = word_data['role']
            current_start = word_data['start']
            current_end = word_data['end']
            
            if role != active_role:
                if active_role is not None and speaker_segments:
                    speaker_segments[-1]['end'] = current_start
                
                active_role = role
                speaker_segments.append({
                    'role': role,
                    'start': current_start,
                    'end': current_end, 
                })
            else:
                speaker_segments[-1]['end'] = current_end
        return speaker_segments

    def _create_pip_asset_clip(self, start_time, end_time):
        """
        Creates a PIP (Picture-in-Picture) clip from an uploaded image or video,
        constrained to the specified start and end times.
        """
        if start_time >= end_time:
            return None

        duration = end_time - start_time
        assets = glob.glob(os.path.join(PIP_DIR, "*"))
        if not assets:
            return None
            
        asset_path = assets[0]
        ext = os.path.splitext(asset_path)[1].lower()
        
        try:
            if ext in ['.mp4', '.mov', '.avi', '.mkv', '.webm']:
                with suppress_output():
                    pip_clip = VideoFileClip(asset_path)
                    if pip_clip.duration < duration:
                        pip_clip = pip_clip.loop(duration=duration)
                    else:
                        pip_clip = pip_clip.subclip(0, duration)
            else:
                pip_clip = ImageClip(asset_path, duration=duration)
            
            pip_clip = pip_clip.resize(width=PIP_WIDTH)
            
            x_pos = (TARGET_W - pip_clip.w) / 2
            y_pos = (TARGET_H / 2) - pip_clip.h - PIP_Y_OFFSET
            y_pos = max(50, y_pos)
            
            return pip_clip.set_start(start_time).set_pos((x_pos, y_pos))
            
        except Exception as e:
            print(f"Error creating PIP asset clip: {e}")
            return None

    def _create_avatar_clips(self, word_data_list):
        """Create animated avatar clips based on the active speaker (role) using Pillow 
        for robust transparency and flipping."""
        avatar_clips = []
        offset = VIDEO_PADDING_START 
        
        # --- Dynamic Layout Assignment ---
        X_PADDING = 100
        LEFT_POS_X = X_PADDING
        RIGHT_POS_X = TARGET_W - AVATAR_WIDTH - X_PADDING 
        
        LEFT_LAYOUT = {'pos_x': LEFT_POS_X, 'flip': False}
        RIGHT_LAYOUT = {'pos_x': RIGHT_POS_X, 'flip': True}
        
        role_to_layout_map = {}
        for word_data in word_data_list:
            role = word_data['role']
            if role not in role_to_layout_map:
                if len(role_to_layout_map) == 0:
                    role_to_layout_map[role] = LEFT_LAYOUT
                elif len(role_to_layout_map) == 1:
                    role_to_layout_map[role] = RIGHT_LAYOUT
                else:
                    break 
        # ---------------------------------

        # 3. Get speaker segments
        speaker_segments = self._get_speaker_segments(word_data_list)
        
        # 4. Process and create avatar clip for each speaking segment
        processed_avatar_paths = {} # Cache processed paths to reuse them

        for segment in speaker_segments:
            role = segment['role']
            start = segment['start']
            end = segment['end']
            duration = end - start
            
            character_config = CHARACTER_MAP.get(role) 
            layout_config = role_to_layout_map.get(role)

            if not character_config or not layout_config: continue

            avatar_file = character_config.get('avatar')
            avatar_flip = layout_config['flip']
            avatar_pos_x = layout_config['pos_x']
            
            if not avatar_file or avatar_pos_x is None: continue
                
            source_avatar_path = os.path.join(AVATAR_DIR, avatar_file) 
            
            if not os.path.exists(source_avatar_path):
                print(f"Error: Avatar file not found at {source_avatar_path}. Skipping.")
                continue

            # --- PILLOW PRE-PROCESSING FOR TRANSPARENCY AND FLIP ---
            
            # Create a unique key for the pre-processed image
            key = (avatar_file, avatar_flip) 
            
            if key in processed_avatar_paths:
                # Reuse the already processed image path
                final_avatar_path = processed_avatar_paths[key]
            else:
                # Path to save the new pre-processed image in the temporary directory
                temp_file_name = f"avatar_{role}_{'flipped' if avatar_flip else 'orig'}_{os.path.basename(avatar_file)}"
                final_avatar_path = os.path.join(TEMP_DIR, temp_file_name)
                
                try:
                    # 1. Open the original image
                    img = Image.open(source_avatar_path)
                    
                    # 2. Resize to the target width (Pillow handles aspect ratio)
                    original_w, original_h = img.size
                    new_h = int((AVATAR_WIDTH / original_w) * original_h)
                    
                    # Use Image.LANCZOS for high-quality resizing
                    img = img.resize((AVATAR_WIDTH, new_h), Image.Resampling.LANCZOS)
                    
                    # 3. Apply horizontal flip if required
                    if avatar_flip:
                        img = img.transpose(Image.FLIP_LEFT_RIGHT)
                        
                    # 4. Ensure it is RGBA (with Alpha) for transparency and save it
                    if img.mode != 'RGBA':
                        img = img.convert('RGBA')

                    img.save(final_avatar_path, 'PNG')
                    
                    # Cache the path for reuse
                    processed_avatar_paths[key] = final_avatar_path
                    
                except Exception as e:
                    print(f"Error processing avatar image {avatar_file} with Pillow. Falling back to original path. Error: {e}")
                    # Fallback to original image path
                    final_avatar_path = source_avatar_path 

            # --- MOVIEPY CLIPPING (loads the clean, pre-processed PNG) ---

            # Load the pre-processed image 
            avatar_clip = ImageClip(final_avatar_path, duration=duration)
            
            # Apply the continuous smoother speaking animation
            animated_avatar = self._apply_avatar_speaking_animation(avatar_clip, duration)

            # Apply start time offset
            animated_avatar = animated_avatar.set_start(start + offset)

            # Set position: anchor the bottom of the avatar to AVATAR_Y_POS
            animated_avatar = animated_avatar.set_pos(
                (avatar_pos_x, AVATAR_Y_POS - animated_avatar.h), 
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
            # Re-importing locally in case the global imports were missed in previous steps
            # Using same strategy as global
            pass # Already imported at top

            
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
                ordered_turns, language_code, audio_mode 
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
            
            
            # 7.5 Create PIP Asset Clip (Optional)
            offset = VIDEO_PADDING_START
            speaker_segments = self._get_speaker_segments(word_data_list)
            pip_clips = []
            if len(speaker_segments) >= 3:
                # Start after first line finishes (end of first segment)
                # Disappear after 2 line before (start of the segment 2 turns before end)
                # If total segments = N, we want it to end when segment N-2 starts (0-indexed)
                pip_start = speaker_segments[0]['end'] + offset
                pip_end = speaker_segments[-3]['end'] + offset # End of the segment before the last two segments start speaking
                
                # Correct logic for "disappear after 2 line before in the end":
                # Line N (last), Line N-1 (second to last).
                # It should disappear before Line N-1 starts.
                pip_end = speaker_segments[-2]['start'] + offset

                pip_asset_clip = self._create_pip_asset_clip(pip_start, pip_end)
                if pip_asset_clip:
                    pip_clips.append(pip_asset_clip)
            elif len(speaker_segments) > 1:
                 # Minimal case: if only 2 or 3 lines exist, maybe we don't show or adapt
                 # Task says "after first line" and "2 line before in the end"
                 # If total lines = 3: after Line 1, before Line 2 starts? That's just during Line 1's gap?
                 # If total lines = 4: after Line 1, before Line 3 starts (disappears before last 2 lines).
                 pass
            
            # 8. Pad audio with silence at the start
            # Create a silent audio clip of the padding duration (0.5s)
            silence_clip = AudioClip(lambda t: 0, duration=VIDEO_PADDING_START)
            
            # Concatenate silence clip with the main audio clip
            final_audio_clip = concatenate_audioclips([silence_clip, tts_audio_clip])
            
            # Ensure the audio clip has the same duration as the final video clip
            final_audio_clip = final_audio_clip.set_duration(final_video_clip.duration) 

            # NOTE: Avatar clips being empty is fine if the user is testing the fix.
            if not text_clips and not avatar_clips:
                print("Video generation failed: No text or avatar clips were created.")
                return
            
            # 9. Compose Final Clip
            final_clip = CompositeVideoClip(
                [final_video_clip] + text_clips + avatar_clips + pip_clips, # ADDED follow_animation_clips & pip_clips
                size=(TARGET_W, TARGET_H)
            )
            final_clip = final_clip.set_audio(final_audio_clip)

            export_start = time.time()
            
            with suppress_output():
                final_clip.write_videofile(
                    self.temp_output_file, 
                    fps=30,
                    codec=VIDEO_CODEC, 
                    audio_codec="aac",
                    temp_audiofile=os.path.join(TEMP_DIR, 'temp-audio.m4a'),
                    remove_temp=True,
                    threads=6,
                    preset='fast',
                    logger=None
                )
            
            # 10. Move to Final Location
            shutil.move(self.temp_output_file, self.final_output_path)
            print(f"✅ Reel successfully created in {time.time() - total_start_time:.2f}s")
            print(f"Final Path: {self.final_output_path}")

        except FileNotFoundError as e:
            print(f"\n❌ An error occurred: {e}")
        except Exception as e:
            print(f"\n❌ An error occurred during video generation for {self.input_json_path}: {e}")
        
        finally:
             # Ensure temporary frames from WebP processing are also cleaned up if needed

             
             if os.path.exists(self.temp_output_file):
                 os.remove(self.temp_output_file)