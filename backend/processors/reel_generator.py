# processors/reel_generator.py

import glob
import os
import random
import shutil
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed

import numpy as np

# Required for robust transparent PNG handling and flipping
from PIL import Image, ImageDraw, ImageFont  # Pillow library

# Monkeypatch ANTIALIAS for moviepy compatibility
if not hasattr(Image, "ANTIALIAS"):
    try:
        Image.ANTIALIAS = Image.Resampling.LANCZOS
    except AttributeError:
        pass


from moviepy.editor import (
    AudioClip,
    CompositeVideoClip,
    ImageClip,
    VideoFileClip,
    concatenate_audioclips,
    vfx,
)

try:
    from ..config import (
        AVATAR_DIR,
        AVATAR_WIDTH,
        AVATAR_Y_POS,
        BOUNCE_SCALE_MAX,
        CAPTION_POSITION,
        CHARACTER_MAP,
        FONT,
        FONT_SIZE,
        MIN_CLIP_DURATION,
        OUTPUT_DIR,
        # --- NEW IMPORTS ---
        PIP_DIR,
        PIP_WIDTH,
        PIP_Y_OFFSET,
        STROKE_COLOR,
        STROKE_WIDTH,
        TARGET_H,
        TARGET_W,
        TEMP_DIR,
        TEXT_COLOR,
        VIDEO_CODEC,
        # -------------------
        VIDEO_DIR,
        VIDEO_PADDING_END,
        VIDEO_PADDING_START,
        suppress_output,
    )
    from .audio_generator import (
        filter_word_data,
        generate_multi_role_audio_multiprocess,
        load_input_json,
    )
except ImportError:
    from config import (
        AVATAR_DIR,
        AVATAR_WIDTH,
        AVATAR_Y_POS,
        BOUNCE_SCALE_MAX,
        CAPTION_POSITION,
        CHARACTER_MAP,
        FONT,
        FONT_SIZE,
        MIN_CLIP_DURATION,
        OUTPUT_DIR,
        # --- NEW IMPORTS ---
        PIP_DIR,
        PIP_WIDTH,
        PIP_Y_OFFSET,
        STROKE_COLOR,
        STROKE_WIDTH,
        TARGET_H,
        TARGET_W,
        TEMP_DIR,
        TEXT_COLOR,
        VIDEO_CODEC,
        # -------------------
        VIDEO_DIR,
        VIDEO_PADDING_END,
        VIDEO_PADDING_START,
        suppress_output,
    )
    from processors.audio_generator import (
        filter_word_data,
        generate_multi_role_audio_multiprocess,
        load_input_json,
    )


class ReelGenerator:
    """
    A class to manage the end-to-end process of generating an Instagram Reel
    from a conversation JSON, including TTS, timestamp alignment,
    video cropping, and caption animation, and avatar animation.
    """

    def __init__(self, input_json_path, pip_asset_override=None):
        self.input_json_path = input_json_path
        self.pip_asset_override = pip_asset_override
        self.base_name = os.path.basename(input_json_path).replace(".json", "")
        self.final_reel_name = f"{self.base_name}.mp4"
        self.final_output_path = os.path.join(OUTPUT_DIR, self.final_reel_name)
        self.temp_output_file = os.path.join(TEMP_DIR, f"temp_reel_{uuid.uuid4()}.mp4")
        self.video_file = self._get_random_video_file()

        # Pick a random highlight color from the palette
        try:
            from config import HIGHLIGHT_PALETTE
        except ImportError:
            from ..config import HIGHLIGHT_PALETTE
        self.highlight_color = random.choice(HIGHLIGHT_PALETTE)

    def _get_random_video_file(self):
        """Selects a random video file from the configured video directory.
        Includes a fallback to a ColorClip if no video files are found."""
        video_extensions = ["*.mp4", "*.mov", "*.avi", "*.mkv"]
        all_videos = []
        for ext in video_extensions:
            all_videos.extend(glob.glob(os.path.join(VIDEO_DIR, ext)))

        if not all_videos:
            raise FileNotFoundError(
                f"No video files found in the directory: {VIDEO_DIR}"
            )

        return random.choice(all_videos)

    def _generate_single_word_image(self, word_text):
        """Generates a PIL image for a single word."""
        word_text = word_text.upper()

        # Use a safety margin of 20% on each side
        margin = TARGET_W * 0.20
        max_width = TARGET_W - (2 * margin)

        current_font_size = FONT_SIZE

        # Dummy draw for measurement
        temp_img = Image.new("RGBA", (1, 1))
        temp_draw = ImageDraw.Draw(temp_img)

        def measure_text(text, size):
            try:
                font = ImageFont.truetype(FONT, size)
            except:
                font = ImageFont.load_default()

            bbox = temp_draw.textbbox(
                (0, 0), text, font=font, stroke_width=STROKE_WIDTH
            )
            width = bbox[2] - bbox[0]
            height = bbox[3] - bbox[1]
            return font, width, height

        font, w, h = measure_text(word_text, current_font_size)

        # Shrink if too big
        while current_font_size > 20 and w > max_width:
            current_font_size -= 4
            font, w, h = measure_text(word_text, current_font_size)

        # Create canvas (tight fit with padding for stroke)
        padding = STROKE_WIDTH * 2 + 10
        canvas_w = int(w + padding * 2)
        canvas_h = int(h + padding * 2)

        canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)

        # Draw text centered
        draw.text(
            (padding, padding),
            word_text,
            font=font,
            fill=TEXT_COLOR,
            stroke_width=STROKE_WIDTH,
            stroke_fill=STROKE_COLOR,
        )

        return canvas

    def _process_single_text_clip(self, word_data, offset):
        """Helper to create a single text clip (for parallel execution)."""
        word_text = word_data["word"]
        start_time_word = word_data["start"]
        end_time_word = word_data["end"]
        word_duration = end_time_word - start_time_word

        if word_duration < MIN_CLIP_DURATION:
            return None

        try:
            pil_img = self._generate_single_word_image(word_text)
            img_array = np.array(pil_img)

            txt_clip = ImageClip(img_array).set_duration(word_duration)

            if img_array.shape[2] == 4:
                mask_clip = ImageClip(
                    img_array[:, :, 3] / 255.0, ismask=True
                ).set_duration(word_duration)
                txt_clip = txt_clip.set_mask(mask_clip)

            txt_clip = txt_clip.set_start(start_time_word + offset).set_pos(
                ("center", "center")
            )

            return txt_clip
        except Exception as e:
            print(f"Error creating text clip for '{word_text}': {e}")
            return None

    def _create_text_clips(self, word_data_list):
        """Create animated text clips for all words in parallel."""
        text_clips = []

        if not word_data_list:
            print("Error: No word data available to create captions.")
            return []

        offset = VIDEO_PADDING_START

        with ThreadPoolExecutor() as executor:
            futures = [
                executor.submit(self._process_single_text_clip, word_data, offset)
                for word_data in word_data_list
            ]

            for future in as_completed(futures):
                result = future.result()
                if result:
                    text_clips.append(result)

        return text_clips

    def _get_speaker_segments(self, word_data_list):
        """Groups word data into speaker segments (turns)."""
        speaker_segments = []
        active_role = None

        for word_data in word_data_list:
            role = word_data["role"]
            current_start = word_data["start"]
            current_end = word_data["end"]

            if role != active_role:
                if active_role is not None and speaker_segments:
                    speaker_segments[-1]["end"] = current_start

                active_role = role
                speaker_segments.append(
                    {
                        "role": role,
                        "start": current_start,
                        "end": current_end,
                    }
                )
            else:
                speaker_segments[-1]["end"] = current_end
        return speaker_segments

    def _create_pip_asset_clip(self, start_time, end_time):
        """
        Creates a PIP (Picture-in-Picture) clip from an uploaded image or video,
        constrained to the specified start and end times.
        """
        if start_time >= end_time:
            return None

        duration = end_time - start_time

        # Determine asset path
        if self.pip_asset_override:
            if os.path.isabs(self.pip_asset_override):
                asset_path = self.pip_asset_override
            else:
                asset_path = os.path.join(PIP_DIR, self.pip_asset_override)
        else:
            assets = glob.glob(os.path.join(PIP_DIR, "*"))
            if not assets:
                return None
            asset_path = assets[0]

        if not os.path.exists(asset_path):
            print(f"PIP asset not found: {asset_path}")
            return None

        ext = os.path.splitext(asset_path)[1].lower()

        try:
            if ext in [".mp4", ".mov", ".avi", ".mkv", ".webm"]:
                with suppress_output():
                    pip_clip = VideoFileClip(asset_path)
                    if pip_clip.duration < duration:
                        pip_clip = pip_clip.fx(vfx.loop, duration=duration)
                    else:
                        pip_clip = pip_clip.subclip(0, duration)
            else:
                # Use Pillow to load images for better format support (including WebP)
                img = Image.open(asset_path)
                if img.mode != "RGBA":
                    img = img.convert("RGBA")
                pip_clip = ImageClip(np.array(img), duration=duration)

            pip_clip = pip_clip.fx(vfx.resize, width=PIP_WIDTH)

            x_pos = (TARGET_W - pip_clip.w) / 2
            y_pos = (TARGET_H / 2) - pip_clip.h - PIP_Y_OFFSET
            y_pos = max(50, y_pos)

            return pip_clip.set_start(start_time).set_pos((x_pos, y_pos))

        except Exception as e:
            print(f"Error creating PIP asset clip: {e}")
            return None

    def _preprocess_avatar_image(self, source_path, flip, role):
        """Helper to pre-process a single avatar image (resize/flip/save)."""
        temp_file_name = f"avatar_{role}_{'flipped' if flip else 'orig'}_{os.path.basename(source_path)}"
        final_avatar_path = os.path.join(TEMP_DIR, temp_file_name)

        # Check if already exists in temp (persistence across runs if needed, or just this run)
        # For now, we assume we want to ensure it's fresh or strictly managed.
        # But if we parallelize, multiple calls might try to write.
        # We should use a unique key or check existence carefully.

        key = (source_path, flip)

        try:
            # 1. Open
            img = Image.open(source_path)

            # 2. Resize
            original_w, original_h = img.size
            new_h = int((AVATAR_WIDTH / original_w) * original_h)
            img = img.resize((AVATAR_WIDTH, new_h), Image.Resampling.LANCZOS)

            # 3. Flip
            if flip:
                img = img.transpose(Image.Transpose.FLIP_LEFT_RIGHT)

            # 4. Convert
            if img.mode != "RGBA":
                img = img.convert("RGBA")

            img.save(final_avatar_path, "PNG")
            return key, final_avatar_path

        except Exception as e:
            print(f"Error processing avatar image {source_path}: {e}")
            return key, source_path  # Fallback

    def _create_avatar_clips(self, word_data_list):
        """Create animated avatar clips based on the active speaker (role) using Pillow
        for robust transparency and flipping."""
        avatar_clips = []
        offset = VIDEO_PADDING_START

        # --- Dynamic Layout Assignment ---
        X_PADDING = 100
        LEFT_POS_X = X_PADDING
        RIGHT_POS_X = TARGET_W - AVATAR_WIDTH - X_PADDING

        LEFT_LAYOUT = {"pos_x": LEFT_POS_X, "flip": False}
        RIGHT_LAYOUT = {"pos_x": RIGHT_POS_X, "flip": True}

        role_to_layout_map = {}
        for word_data in word_data_list:
            role = word_data["role"]
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

        # 4. Identify Unique Processing Jobs
        processing_jobs = {}  # Key: (source_path, flip) -> role (just for naming)

        for segment in speaker_segments:
            role = segment["role"]
            character_config = CHARACTER_MAP.get(role)
            layout_config = role_to_layout_map.get(role)

            if not character_config or not layout_config:
                continue

            avatar_file = character_config.get("avatar")
            if not avatar_file:
                continue

            source_avatar_path = os.path.join(AVATAR_DIR, avatar_file)
            if not os.path.exists(source_avatar_path):
                continue

            flip = layout_config["flip"]
            key = (source_avatar_path, flip)

            if key not in processing_jobs:
                processing_jobs[key] = role  # Store role for filename generation

        # 5. Execute Processing in Parallel
        processed_avatar_paths = {}

        with ThreadPoolExecutor() as executor:
            futures = [
                executor.submit(self._preprocess_avatar_image, src, flip, role)
                for (src, flip), role in processing_jobs.items()
            ]

            for future in as_completed(futures):
                key, path = future.result()
                processed_avatar_paths[key] = path

        # 6. Create Clips
        for segment in speaker_segments:
            role = segment["role"]
            start = segment["start"]
            end = segment["end"]
            duration = end - start

            character_config = CHARACTER_MAP.get(role)
            layout_config = role_to_layout_map.get(role)

            if not character_config or not layout_config:
                continue

            avatar_file = character_config.get("avatar")
            avatar_pos_x = layout_config["pos_x"]
            flip = layout_config["flip"]

            if not avatar_file:
                continue
            source_path = os.path.join(AVATAR_DIR, avatar_file)

            key = (source_path, flip)
            final_avatar_path = processed_avatar_paths.get(
                key, source_path
            )  # Fallback if missing

            # --- MOVIEPY CLIPPING ---
            try:
                # Load the pre-processed image
                avatar_clip = ImageClip(final_avatar_path, duration=duration)

                # Apply the continuous smoother speaking animation
                animated_avatar = self._apply_avatar_speaking_animation(
                    avatar_clip, duration
                )

                # Apply start time offset
                animated_avatar = animated_avatar.set_start(start + offset)

                # Set position: anchor the bottom of the avatar to AVATAR_Y_POS
                animated_avatar = animated_avatar.set_pos(
                    (avatar_pos_x, AVATAR_Y_POS - animated_avatar.h), relative=False
                )

                avatar_clips.append(animated_avatar)
            except Exception as e:
                print(f"Error creating avatar clip for {role}: {e}")

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

        return clip.fx(vfx.resize, scale_func)

    def _prepare_video(self, required_duration):
        """Loads, loops/subclips, resizes, and crops the background video."""

        # Calculate the total duration needed including padding
        total_duration = required_duration + VIDEO_PADDING_START + VIDEO_PADDING_END

        print(f"  Using background video: {os.path.basename(self.video_file)}")

        with suppress_output():
            video = VideoFileClip(self.video_file)

            if video.duration < total_duration:
                # Loop the video if it's shorter than required
                final_video_clip = video.fx(vfx.loop, duration=total_duration)
            else:
                # Otherwise, take a random subclip
                max_start_time = video.duration - total_duration
                start_time = random.uniform(0, max(0, max_start_time))
                final_video_clip = video.subclip(
                    start_time, start_time + total_duration
                )

            final_video_clip = final_video_clip.fx(vfx.resize, height=TARGET_H)
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
            pass  # Already imported at top

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
                ordered_turns, language_code, audio_mode, reel_name=self.base_name
            )

            if tts_audio_clip is None:
                print("Error: Failed to generate audio.")
                return

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
                pip_start = speaker_segments[0]["end"] + offset
                pip_end = (
                    speaker_segments[-3]["end"] + offset
                )  # End of the segment before the last two segments start speaking

                # Correct logic for "disappear after 2 line before in the end":
                # Line N (last), Line N-1 (second to last).
                # It should disappear before Line N-1 starts.
                pip_end = speaker_segments[-2]["start"] + offset

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
                [final_video_clip]
                + text_clips
                + avatar_clips
                + pip_clips,  # ADDED follow_animation_clips & pip_clips
                size=(TARGET_W, TARGET_H),
            )
            final_clip = final_clip.set_audio(final_audio_clip)

            with suppress_output():
                final_clip.write_videofile(
                    self.temp_output_file,
                    fps=30,
                    codec=VIDEO_CODEC,
                    audio_codec="aac",
                    temp_audiofile=os.path.join(
                        TEMP_DIR, f"temp-audio-{uuid.uuid4()}.m4a"
                    ),
                    remove_temp=True,
                    threads=6,
                    preset="fast",
                    logger=None,
                )

            # 10. Move to Final Location
            shutil.move(self.temp_output_file, self.final_output_path)
            print(
                f"✅ Reel successfully created in {time.time() - total_start_time:.2f}s"
            )
            print(f"Final Path: {self.final_output_path}")

        except FileNotFoundError as e:
            print(f"\n❌ An error occurred: {e}")
        except Exception as e:
            import traceback

            print(
                f"\n❌ An error occurred during video generation for {self.input_json_path}: {e}"
            )
            traceback.print_exc()

        finally:
            # Ensure temporary frames from WebP processing are also cleaned up if needed

            if os.path.exists(self.temp_output_file):
                os.remove(self.temp_output_file)
