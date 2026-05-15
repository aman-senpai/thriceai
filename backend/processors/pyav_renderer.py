import math
import os
import time
from typing import Any, Dict, List, Optional

import av
import numpy as np
from PIL import Image, ImageDraw, ImageFont

try:
    from ..config import (
        AVATAR_WIDTH,
        AVATAR_Y_POS,
        FONT,
        FONT_SIZE,
        IS_MAC,
        PIP_MARGIN,
        STROKE_COLOR,
        STROKE_WIDTH,
        TARGET_H,
        TARGET_W,
        TEXT_COLOR,
        VIDEO_PADDING_END,
        VIDEO_PADDING_START,
    )
except ImportError:
    from config import (
        AVATAR_WIDTH,
        AVATAR_Y_POS,
        FONT,
        FONT_SIZE,
        IS_MAC,
        PIP_MARGIN,
        STROKE_COLOR,
        STROKE_WIDTH,
        TARGET_H,
        TARGET_W,
        TEXT_COLOR,
        VIDEO_PADDING_END,
        VIDEO_PADDING_START,
    )


class PyAVRenderer:
    """
    Hardware-accelerated video renderer using PyAV and VideoToolbox for Apple Silicon.
    Eliminates MoviePy subprocess overhead and enables zero-copy-like performance.
    """

    def __init__(self, fps=24):
        self.fps = fps
        self.width = TARGET_W
        self.height = TARGET_H
        self._font_cache = {}

    def _get_font(self, size):
        if size not in self._font_cache:
            try:
                self._font_cache[size] = ImageFont.truetype(FONT, size)
            except:
                self._font_cache[size] = ImageFont.load_default()
        return self._font_cache[size]

    def render(
        self,
        output_path: str,
        bg_video_path: str,
        audio_path: str,
        word_data: List[Dict[str, Any]],
        avatar_clips_data: List[Dict[str, Any]],
        pip_clip_data: Optional[Dict[str, Any]] = None,
        bg_start_time: float = 0.0,
        skip_captions: bool = False,
    ):

        start_time = time.time()

        # 1. Open Assets
        bg_container = av.open(bg_video_path)
        bg_stream = bg_container.streams.video[0]
        if IS_MAC:
            bg_stream.thread_type = "AUTO"

        if bg_start_time > 0:
            bg_container.seek(int(bg_start_time * av.time_base))

        audio_container = av.open(audio_path)
        audio_stream = audio_container.streams.audio[0]

        # 2. Setup Output
        output_container = av.open(output_path, mode="w")
        v_codec = "h264_videotoolbox" if IS_MAC else "libx264"
        v_stream = output_container.add_stream(v_codec, rate=self.fps)
        v_stream.width = self.width
        v_stream.height = self.height
        v_stream.pix_fmt = "nv12" if IS_MAC else "yuv420p"
        v_stream.bit_rate = 8000000
        v_stream.options = {"realtime": "1"} if IS_MAC else {}

        a_stream = output_container.add_stream("aac")
        a_stream.rate = audio_stream.rate
        # Use channel_layout instead of channels for better compatibility
        if hasattr(audio_stream, "layout"):
            a_stream.layout = audio_stream.layout

        # 3. Preparation
        # Duration from audio container
        audio_duration = float(
            audio_container.streams.audio[0].duration * audio_stream.time_base
        )
        total_frames = int(audio_duration * self.fps)

        # print(f"  > Pre-rendering {len(word_data)} captions...")
        caption_images = (
            self._pre_render_captions(word_data) if not skip_captions else {}
        )

        # print(f"  > Loading avatars...")
        avatar_images = self._load_avatars(avatar_clips_data)

        # 4. Main Render Loop
        # print(f"  > Rendering {total_frames} frames...")

        bg_decoder = bg_container.decode(video=0)

        graph = av.filter.Graph()
        buffer_in = graph.add_buffer(template=bg_stream)
        crop_filter = graph.add(
            "crop",
            f"min(iw,ih*{self.width}/{self.height}):min(ih,iw*{self.height}/{self.width})",
        )
        scale_filter = graph.add("scale", f"{self.width}:{self.height}")
        buffer_out = graph.add("buffersink")

        buffer_in.link_to(crop_filter)
        crop_filter.link_to(scale_filter)
        scale_filter.link_to(buffer_out)
        graph.configure()

        last_progress_update = -1
        for frame_idx in range(total_frames):
            t = frame_idx / self.fps

            # Emit Progress every 5%
            progress_val = 30 + int((frame_idx / total_frames) * 65)
            if progress_val >= last_progress_update + 5:
                # Need to know the reel name here, but PyAVRenderer doesn't have it.
                # We'll use a generic marker that the server/frontend can map or just use general progress.
                # Better: pass filename to render.
                # For now, just print PROGRESS:val
                print(f"PROGRESS:{progress_val}")
                last_progress_update = progress_val

            # Get Background Frame with Loop Support
            try:
                bg_frame = next(bg_decoder)
            except (StopIteration, av.EOFError):
                bg_container.seek(0)
                bg_decoder = bg_container.decode(video=0)
                bg_frame = next(bg_decoder)

            graph.push(bg_frame)
            processed_frame = graph.pull()
            processed_frame = processed_frame.reformat(format="rgb24")
            pil_bg = processed_frame.to_image().convert("RGBA")

            # Overlay Elements
            self._draw_avatars(pil_bg, t, avatar_clips_data, avatar_images)

            if pip_clip_data:
                self._draw_pip(pil_bg, t, pip_clip_data)

            if not skip_captions:
                self._draw_captions(pil_bg, t, word_data, caption_images)

            # Encode Video Frame
            # Note: converting to RGB here, encoder will handle NV12 conversion
            out_frame = av.VideoFrame.from_image(pil_bg.convert("RGB"))
            out_frame.pts = frame_idx
            for packet in v_stream.encode(out_frame):
                output_container.mux(packet)

        # Flush video encoder
        for packet in v_stream.encode():
            output_container.mux(packet)

        # 5. Mux Audio
        # We need to re-encode or copy. Copy is faster.
        # But we must ensure timestamps align.
        audio_container.seek(0)
        for packet in audio_container.demux(audio_stream):
            if packet.dts is None:
                continue
            packet.stream = a_stream
            output_container.mux(packet)

        output_container.close()
        bg_container.close()
        audio_container.close()

        print(f"✅ Final Reel created in {time.time() - start_time:.2f}s")

    def _pre_render_captions(self, word_data):
        images = {}
        for item in word_data:
            word = item["word"].upper()
            if word in images:
                continue

            font = self._get_font(FONT_SIZE)
            temp_draw = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
            bbox = temp_draw.textbbox(
                (0, 0), word, font=font, stroke_width=STROKE_WIDTH
            )
            w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]

            pad = STROKE_WIDTH * 2 + 10
            img = Image.new("RGBA", (int(w + pad * 2), int(h + pad * 2)), (0, 0, 0, 0))
            draw = ImageDraw.Draw(img)
            draw.text(
                (pad, pad),
                word,
                font=font,
                fill=TEXT_COLOR,
                stroke_width=STROKE_WIDTH,
                stroke_fill=STROKE_COLOR,
            )
            images[word] = img
        return images

    def _load_avatars(self, clips_data):
        images = {}
        for clip in clips_data:
            path = clip["path"]
            if path not in images:
                img = Image.open(path).convert("RGBA")
                images[path] = img
        return images

    def _draw_avatars(self, bg, t, clips_data, images):
        offset = VIDEO_PADDING_START
        for clip in clips_data:
            start = clip["start"] + offset
            end = clip["end"] + offset
            if start <= t <= end:
                img = images[clip["path"]]
                freq = 4.0
                max_scale = 1.02
                scale = 1 + (max_scale - 1) * 0.5 * (
                    1 + math.sin(2 * math.pi * freq * (t - start))
                )

                new_size = (int(img.width * scale), int(img.height * scale))
                scaled_img = img.resize(new_size, Image.Resampling.LANCZOS)

                x = clip["pos_x"] - (scaled_img.width - img.width) // 2
                y = AVATAR_Y_POS - scaled_img.height
                bg.alpha_composite(scaled_img, (x, y))

    def _draw_captions(self, bg, t, word_data, images):
        offset = VIDEO_PADDING_START
        for item in word_data:
            if item["start"] + offset <= t <= item["end"] + offset:
                img = images[item["word"].upper()]
                bg.alpha_composite(
                    img,
                    ((self.width - img.width) // 2, (self.height - img.height) // 2),
                )
                break

    def _draw_pip(self, bg, t, pip_data):
        """Draw Picture-in-Picture overlay."""
        start = pip_data["start"]
        end = pip_data["end"]
        if start <= t <= end:
            path = pip_data["path"]
            # Fast cache for PIP image
            if (
                not hasattr(self, "_pip_image_cache")
                or self._pip_image_cache_path != path
            ):
                try:
                    # If video, extract first frame
                    if path.lower().endswith((".mp4", ".mov", ".avi", ".mkv", ".webm")):
                        container = av.open(path)
                        frame = next(container.decode(video=0))
                        img = frame.to_image().convert("RGBA")
                        container.close()
                    else:
                        img = Image.open(path).convert("RGBA")

                    # New Scaling Logic
                    orig_w, orig_h = img.size
                    max_w = self.width - 2 * PIP_MARGIN
                    max_h = (self.height / 2) - 2 * PIP_MARGIN

                    scale = min(max_w / orig_w, max_h / orig_h)
                    new_w = int(orig_w * scale)
                    new_h = int(orig_h * scale)

                    img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

                    self._pip_image_cache = img
                    self._pip_image_cache_path = path
                except Exception as e:
                    print(f"Error loading PIP asset: {e}")
                    return

            img = self._pip_image_cache
            x = (self.width - img.width) // 2
            y = (self.height / 2) - img.height - PIP_MARGIN
            bg.alpha_composite(img, (int(x), int(y)))
