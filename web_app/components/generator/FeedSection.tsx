"use client";

import React, { useState, useEffect, useCallback } from "react";
import { fetchData, postData, API_BASE_URL, cardClasses, primaryButtonClasses, BTN_SECONDARY } from "@/lib/constants";
import { LogType } from "@/app/page";

export interface RSSVideo {
    video_id: string;
    title: string;
    description: string;
    published: string;
    link: string;
    thumbnail: string;
    channel_name: string;
    channel_id: string;
    domain: string;
    is_short: boolean;
}

export interface FeedSectionProps {
    onSelectTopic: (video: RSSVideo, context: string) => void;
    log: (message: string, type?: LogType) => void;
}

export const FeedSection: React.FC<FeedSectionProps> = ({ onSelectTopic, log }) => {
    const [videos, setVideos] = useState<RSSVideo[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [filter, setFilter] = useState<"all" | "videos" | "shorts">("all");
    const [domainFilter, setDomainFilter] = useState<string>("all");
    const [domains, setDomains] = useState<string[]>([]);
    const [expandedDescriptions, setExpandedDescriptions] = useState<Record<string, boolean>>({});
    const [transcripts, setTranscripts] = useState<Record<string, string>>({});
    const [isFetchingTranscript, setIsFetchingTranscript] = useState<Record<string, boolean>>({});

    const fetchVideos = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await fetchData<{ videos: RSSVideo[] }>("/api/rss/videos");
            setVideos(data.videos);

            // Extract unique domains
            const uniqueDomains = Array.from(new Set(data.videos.map(v => v.domain)));
            setDomains(uniqueDomains);
        } catch (err: any) {
            log(`Failed to fetch RSS feed: ${err.message}`, "error");
        } finally {
            setIsLoading(false);
        }
    }, [log]);

    useEffect(() => {
        fetchVideos();
    }, [fetchVideos]);

    const fetchTranscript = async (videoId: string) => {
        if (transcripts[videoId]) return;

        setIsFetchingTranscript(prev => ({ ...prev, [videoId]: true }));
        try {
            const data = await fetchData<{ transcript: string }>(`/api/rss/transcript/${videoId}`);
            setTranscripts(prev => ({ ...prev, [videoId]: data.transcript }));
            log(`Transcript fetched for video: ${videoId}`, "success");
        } catch (err: any) {
            log(`Failed to fetch transcript: ${err.message}`, "error");
        } finally {
            setIsFetchingTranscript(prev => ({ ...prev, [videoId]: false }));
        }
    };

    const toggleDescription = (videoId: string) => {
        setExpandedDescriptions(prev => ({ ...prev, [videoId]: !prev[videoId] }));
    };

    const handleCreateReel = (video: RSSVideo) => {
        const transcript = transcripts[video.video_id];
        let topic = video.title;

        if (transcript) {
            topic = `Video Title: ${video.title}\n\nTranscript: ${transcript.substring(0, 3000)}`;
        } else if (video.description) {
            topic = `Video Title: ${video.title}\n\nDescription: ${video.description.substring(0, 500)}`;
        }

        onSelectTopic(video, topic);
    };

    const filteredVideos = videos.filter(v => {
        const matchesType = filter === "all" || (filter === "shorts" ? v.is_short : !v.is_short);
        const matchesDomain = domainFilter === "all" || v.domain === domainFilter;
        return matchesType && matchesDomain;
    });

    return (
        <div className="flex flex-col h-full gap-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex bg-muted p-1 rounded-xl">
                    <button
                        onClick={() => setFilter("all")}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${filter === "all" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setFilter("videos")}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${filter === "videos" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >
                        Videos
                    </button>
                    <button
                        onClick={() => setFilter("shorts")}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${filter === "shorts" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >
                        Shorts
                    </button>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
                    <button
                        onClick={() => setDomainFilter("all")}
                        className={`whitespace-nowrap px-3 py-1 rounded-full text-[10px] font-bold border transition-all ${domainFilter === "all" ? "bg-primary border-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-foreground"}`}
                    >
                        All Domains
                    </button>
                    {domains.map(domain => (
                        <button
                            key={domain}
                            onClick={() => setDomainFilter(domain)}
                            className={`whitespace-nowrap px-3 py-1 rounded-full text-[10px] font-bold border transition-all ${domainFilter === domain ? "bg-primary border-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-foreground"}`}
                        >
                            {domain}
                        </button>
                    ))}
                </div>

                <button
                    onClick={fetchVideos}
                    disabled={isLoading}
                    className="p-2 bg-secondary rounded-xl text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
                >
                    <i className={`fas fa-sync text-xs ${isLoading ? "animate-spin" : ""}`}></i>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
                {isLoading && videos.length === 0 ? (
                    <div className="flex items-center justify-center h-40">
                        <i className="fas fa-spinner fa-spin text-2xl text-primary/50"></i>
                    </div>
                ) : filteredVideos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-border rounded-2xl text-muted-foreground">
                        <i className="fas fa-rss text-2xl mb-2 opacity-20"></i>
                        <p className="text-sm font-medium">No videos found</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredVideos.map((video) => (
                            <div key={video.video_id} className="group bg-card border border-border rounded-2xl overflow-hidden flex flex-col hover:border-primary/50 transition-colors shadow-sm">
                                <div className="relative aspect-video overflow-hidden bg-muted">
                                    <img
                                        src={video.thumbnail}
                                        alt={video.title}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                    />
                                    {video.is_short && (
                                        <div className="absolute top-2 right-2 bg-red-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded flex items-center gap-1 shadow-lg">
                                            <i className="fas fa-bolt"></i> SHORT
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                        <a
                                            href={video.link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white/40 transition-colors"
                                        >
                                            <i className="fas fa-external-link-alt text-sm"></i>
                                        </a>
                                    </div>
                                </div>
                                <div className="p-3 flex-1 flex flex-col gap-2">
                                    <div className="flex items-center gap-1.5">
                                        <span className="px-1.5 py-0.5 bg-secondary text-secondary-foreground text-[8px] font-bold rounded uppercase">
                                            {video.domain}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground font-medium">
                                            {video.channel_name}
                                        </span>
                                    </div>
                                    <h3 className="text-xs font-bold leading-snug line-clamp-2 min-h-[2.5em]">
                                        {video.title}
                                    </h3>

                                    {/* Description Toggle */}
                                    <div className="text-[10px] border-t border-border pt-2 mt-1">
                                        <button
                                            onClick={() => toggleDescription(video.video_id)}
                                            className="text-muted-foreground hover:text-foreground flex items-center gap-1 font-bold italic"
                                        >
                                            <i className={`fas fa-chevron-${expandedDescriptions[video.video_id] ? 'up' : 'down'}`}></i>
                                            {expandedDescriptions[video.video_id] ? 'Hide Description' : 'Show Description'}
                                        </button>
                                        {expandedDescriptions[video.video_id] && (
                                            <p className="mt-1 text-muted-foreground line-clamp-4 animate-in slide-in-from-top-1 duration-200">
                                                {video.description || "No description available."}
                                            </p>
                                        )}
                                    </div>

                                    {/* Transcript Button */}
                                    <div className="flex gap-2 mt-2">
                                        <button
                                            onClick={() => fetchTranscript(video.video_id)}
                                            disabled={isFetchingTranscript[video.video_id]}
                                            className={`flex-1 py-1.5 rounded-lg text-[9px] font-bold transition-all flex items-center justify-center gap-1.5 border ${transcripts[video.video_id] ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' : 'bg-muted border-transparent text-muted-foreground hover:border-border'}`}
                                        >
                                            {isFetchingTranscript[video.video_id] ? (
                                                <i className="fas fa-spinner fa-spin"></i>
                                            ) : transcripts[video.video_id] ? (
                                                <><i className="fas fa-check"></i> TRANSCRIBED</>
                                            ) : (
                                                <><i className="fas fa-closed-captioning"></i> GET TRANSCRIPT</>
                                            )}
                                        </button>

                                        <button
                                            onClick={() => handleCreateReel(video)}
                                            className="flex-[1.5] py-1.5 bg-primary text-primary-foreground text-[9px] font-black rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-primary/20 hover:scale-[1.02] active:scale-[0.98]"
                                        >
                                            <i className="fas fa-play"></i> CREATE REEL
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
