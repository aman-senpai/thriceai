import feedparser
import requests
import os
import json
from typing import List, Dict, Any

class RSSService:
    def __init__(self, channels_file: str):
        self.channels_file = channels_file
        self.base_url = "https://www.youtube.com/feeds/videos.xml?channel_id="
        
    def _load_channels(self) -> List[Dict[str, str]]:
        if not os.path.exists(self.channels_file):
            return []
        with open(self.channels_file, 'r') as f:
            return json.load(f)

    def fetch_all_videos(self) -> List[Dict[str, Any]]:
        channels = self._load_channels()
        all_videos = []
        
        for channel in channels:
            channel_id = channel.get('channel_id')
            if not channel_id:
                continue
                
            try:
                videos = self.fetch_channel_videos(channel_id, channel.get('name'), channel.get('domain'))
                all_videos.extend(videos)
            except Exception as e:
                print(f"Error fetching RSS for {channel.get('name')}: {e}")
                
        # Sort by published date
        all_videos.sort(key=lambda x: x.get('published', ''), reverse=True)
        return all_videos

    def fetch_channel_videos(self, channel_id: str, channel_name: str, domain: str) -> List[Dict[str, Any]]:
        url = f"{self.base_url}{channel_id}"
        feed = feedparser.parse(url)
        
        videos = []
        for entry in feed.entries:
            video_id = entry.get('yt_videoid')
            if not video_id:
                # Fallback if yt_videoid is missing
                video_id = entry.link.split('=')[-1] if 'watch?v=' in entry.link else entry.link.split('/')[-1]

            title = entry.title
            published = entry.published
            link = entry.link
            
            # Extract description
            description = entry.get('summary', '') or entry.get('description', '')
            
            # YouTube RSS doesn't explicitly flag shorts, but we can check the title/duration if needed
            is_short = "/shorts/" in link or "#shorts" in title.lower()
            
            # Use maxresdefault for higher quality if available, fallback to hqdefault
            thumbnail_url = f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg"
            
            videos.append({
                "video_id": video_id,
                "title": title,
                "description": description,
                "published": published,
                "link": link,
                "thumbnail": thumbnail_url,
                "channel_name": channel_name,
                "channel_id": channel_id,
                "domain": domain,
                "is_short": is_short
            })
            
        return videos

    def get_transcript(self, video_id: str) -> str:
        """Fetches the transcript for a given YouTube video ID using the verified fetch() method."""
        try:
            from youtube_transcript_api import YouTubeTranscriptApi
            api = YouTubeTranscriptApi()
            transcript_obj = api.fetch(video_id)
            return " ".join([snippet.text for snippet in transcript_obj])
        except Exception as e:
            print(f"Transcript Error for {video_id}: {e}")
            return ""

def get_rss_service():
    from backend.config import DATA_DIR
    channels_file = os.path.join(DATA_DIR, "rss_channels.json")
    return RSSService(channels_file)
