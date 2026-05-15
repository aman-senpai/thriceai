"use client";

import React, { useState, useEffect, useCallback } from "react";
import { fetchData } from "@/lib/constants";
import { LogType } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Rss,
  RefreshCw,
  Play,
  Zap,
  Subtitles,
  Check,
  Wand2,
  LoaderCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

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

export const FeedSection: React.FC<FeedSectionProps> = ({
  onSelectTopic,
  log,
}) => {
  const [videos, setVideos] = useState<RSSVideo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "videos" | "shorts">("all");
  const [domainFilter, setDomainFilter] = useState<string>("all");
  const [domains, setDomains] = useState<string[]>([]);
  const [expandedDescriptions, setExpandedDescriptions] = useState<
    Record<string, boolean>
  >({});
  const [transcripts, setTranscripts] = useState<Record<string, string>>({});
  const [isFetchingTranscript, setIsFetchingTranscript] = useState<
    Record<string, boolean>
  >({});

  // Pagination state
  const [visibleCount, setVisibleCount] = useState(12);
  const observerRef = React.useRef<HTMLDivElement>(null);

  const fetchVideos = useCallback(
    async (refresh = false) => {
      setIsLoading(true);
      try {
        const url = refresh
          ? "/api/rss/videos?refresh=true"
          : "/api/rss/videos";
        const data = await fetchData<{ videos: RSSVideo[] }>(url);
        setVideos(data.videos);

        // Extract unique domains
        const uniqueDomains = Array.from(
          new Set(data.videos.map((v) => v.domain)),
        );
        setDomains(uniqueDomains);

        // Reset visible count on refresh
        if (refresh) setVisibleCount(12);
      } catch (err: any) {
        log(`Failed to fetch RSS feed: ${err.message}`, "error");
      } finally {
        setIsLoading(false);
      }
    },
    [log],
  );

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  const fetchTranscript = async (videoId: string) => {
    if (transcripts[videoId]) return;

    setIsFetchingTranscript((prev) => ({ ...prev, [videoId]: true }));
    try {
      const data = await fetchData<{ transcript: string }>(
        `/api/rss/transcript/${videoId}`,
      );
      setTranscripts((prev) => ({ ...prev, [videoId]: data.transcript }));
      log(`Transcript fetched for video: ${videoId}`, "success");
    } catch (err: any) {
      log(`Failed to fetch transcript: ${err.message}`, "error");
    } finally {
      setIsFetchingTranscript((prev) => ({ ...prev, [videoId]: false }));
    }
  };

  const toggleDescription = (videoId: string) => {
    setExpandedDescriptions((prev) => ({
      ...prev,
      [videoId]: !prev[videoId],
    }));
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

  const filteredVideos = videos.filter((v) => {
    const matchesType =
      filter === "all" || (filter === "shorts" ? v.is_short : !v.is_short);
    const matchesDomain = domainFilter === "all" || v.domain === domainFilter;
    return matchesType && matchesDomain;
  });

  const paginatedVideos = filteredVideos.slice(0, visibleCount);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < filteredVideos.length) {
          setVisibleCount((prev) => prev + 12);
        }
      },
      { threshold: 0.1 },
    );

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => observer.disconnect();
  }, [filteredVideos.length, visibleCount]);

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex bg-muted p-1 rounded-xl">
          {(["all", "videos", "shorts"] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "secondary" : "ghost"}
              size="sm"
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-bold",
                filter === f && "bg-background shadow-sm",
              )}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "All" : f === "videos" ? "Videos" : "Shorts"}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
          <Badge
            variant={domainFilter === "all" ? "default" : "outline"}
            className={cn(
              "whitespace-nowrap px-3 py-1 text-[10px] font-bold cursor-pointer",
              domainFilter === "all"
                ? "bg-primary border-primary"
                : "border-border text-muted-foreground hover:border-foreground",
            )}
            onClick={() => setDomainFilter("all")}
          >
            All Domains
          </Badge>
          {domains.map((domain) => (
            <Badge
              key={domain}
              variant={domainFilter === domain ? "default" : "outline"}
              className={cn(
                "whitespace-nowrap px-3 py-1 text-[10px] font-bold cursor-pointer",
                domainFilter === domain
                  ? "bg-primary border-primary"
                  : "border-border text-muted-foreground hover:border-foreground",
              )}
              onClick={() => setDomainFilter(domain)}
            >
              {domain}
            </Badge>
          ))}
        </div>

        <Button
          variant="secondary"
          size="icon"
          className="shrink-0"
          onClick={() => fetchVideos(true)}
          disabled={isLoading}
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
        </Button>
      </div>

      <ScrollArea className="flex-1 pr-1">
        {isLoading && videos.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="overflow-hidden border-border">
                <Skeleton className="aspect-video w-full rounded-none" />
                <CardContent className="p-3 space-y-2">
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-8 w-full mt-4" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredVideos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-border rounded-2xl text-muted-foreground bg-muted/20">
            <Rss className="h-6 w-6 mb-2 opacity-20" />
            <p className="text-sm font-medium">No videos found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paginatedVideos.map((video) => (
              <div
                key={video.video_id}
                className="group bg-card border border-border rounded-2xl overflow-hidden flex flex-col hover:border-primary/50 transition-colors shadow-sm"
              >
                <div className="relative aspect-video overflow-hidden bg-muted">
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  {video.is_short && (
                    <Badge className="absolute top-2 right-2 text-[10px] font-black px-1.5 py-0.5 flex items-center gap-1 shadow-lg">
                      <Zap className="h-3 w-3" /> SHORT
                    </Badge>
                  )}
                  <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-3 backdrop-blur-[2px]">
                    <a
                      href={video.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-12 h-12 bg-primary/20 backdrop-blur-xl border border-primary/30 rounded-full flex items-center justify-center text-primary-foreground hover:bg-primary/40 hover:scale-110 transition-all shadow-xl"
                      title="Open on YouTube"
                    >
                      <Play className="h-5 w-5 ml-0.5" />
                    </a>
                  </div>
                </div>
                <CardContent className="p-3 flex-1 flex flex-col gap-2">
                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant="secondary"
                      className="px-1.5 py-0.5 text-[8px] font-bold rounded uppercase"
                    >
                      {video.domain}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {video.channel_name}
                    </span>
                  </div>
                  <h3 className="text-xs font-bold leading-snug line-clamp-2 min-h-[2.5em]">
                    {video.title}
                  </h3>

                  {/* Description Toggle */}
                  <div className="text-[10px] border-t border-border pt-2 mt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-foreground flex items-center gap-1 font-bold italic h-auto p-0"
                      onClick={() => toggleDescription(video.video_id)}
                    >
                      {expandedDescriptions[video.video_id] ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                      {expandedDescriptions[video.video_id]
                        ? "Hide Description"
                        : "Show Description"}
                    </Button>
                    {expandedDescriptions[video.video_id] && (
                      <p className="mt-1 text-muted-foreground line-clamp-4 animate-in slide-in-from-top-1 duration-200">
                        {video.description || "No description available."}
                      </p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2 mt-auto pt-2">
                    <Button
                      variant={
                        transcripts[video.video_id] ? "secondary" : "ghost"
                      }
                      size="sm"
                      className={cn(
                        "flex-1 min-w-[90px] py-2 rounded-xl text-[9px] font-bold",
                        transcripts[video.video_id] &&
                          "bg-primary/10 text-primary border border-primary/20",
                      )}
                      onClick={() => fetchTranscript(video.video_id)}
                      disabled={isFetchingTranscript[video.video_id]}
                    >
                      {isFetchingTranscript[video.video_id] ? (
                        <LoaderCircle className="h-3 w-3 animate-spin" />
                      ) : transcripts[video.video_id] ? (
                        <>
                          <Check className="h-3 w-3" /> DONE
                        </>
                      ) : (
                        <>
                          <Subtitles className="h-3 w-3" /> TRANSCRIPT
                        </>
                      )}
                    </Button>

                    <Button
                      variant="default"
                      size="sm"
                      className="flex-[1.5] min-w-[110px] py-2 text-[9px] font-black rounded-xl shadow-sm shadow-primary/20 hover:shadow-lg"
                      onClick={() => handleCreateReel(video)}
                    >
                      <Wand2 className="h-3 w-3" /> CREATE REEL
                    </Button>
                  </div>
                </CardContent>
              </div>
            ))}
            {/* Sentinel for infinite scroll */}
            <div
              ref={observerRef}
              className="col-span-full h-10 flex items-center justify-center"
            >
              {visibleCount < filteredVideos.length && (
                <LoaderCircle className="h-4 w-4 animate-spin text-muted-foreground opacity-20" />
              )}
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
