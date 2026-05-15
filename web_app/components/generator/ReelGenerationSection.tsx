"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfigData } from "@/types";
import { Video, LoaderCircle } from "lucide-react";

// --- Props Interface ---
export interface ReelGenerationSectionProps {
  handleSessionReelGeneration: () => void;
  handleAllReelGeneration: () => void;
  isReelGenerating: boolean;
  sessionCount: number;
  audioMode: string;
  reelStatus: string;
  config: ConfigData | null;
}

// --- Component ---
const ReelGenerationSection = ({
  handleSessionReelGeneration,
  handleAllReelGeneration,
  isReelGenerating,
  sessionCount,
  audioMode,
  reelStatus,
  config,
}: ReelGenerationSectionProps) => (
  <Card className="border-border shadow-sm">
    <CardContent className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Video className="w-4 h-4 text-muted-foreground" />
          Build Reels
        </h2>
        {reelStatus && (
          <span
            className="text-[10px] font-medium px-2 py-1 bg-secondary text-secondary-foreground rounded-lg max-w-[200px] truncate"
            title={reelStatus}
          >
            {reelStatus}
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          onClick={handleSessionReelGeneration}
          disabled={isReelGenerating || sessionCount <= 0 || !audioMode}
          variant="default"
          size="sm"
          className="gap-1.5"
        >
          {isReelGenerating && sessionCount > 0 && (
            <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
          )}
          <span id="generate-session-reels-btn">Session ({sessionCount})</span>
        </Button>
        <Button
          onClick={handleAllReelGeneration}
          disabled={isReelGenerating || !audioMode}
          variant="default"
          size="sm"
          className="gap-1.5 bg-success hover:bg-success/90 text-success-foreground shadow-sm"
        >
          {isReelGenerating && sessionCount === 0 && (
            <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
          )}
          <span id="generate-all-reels-btn">All Files</span>
        </Button>
      </div>
    </CardContent>
  </Card>
);

export { ReelGenerationSection };
