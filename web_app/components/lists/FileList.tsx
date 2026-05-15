import React from "react";
import { ReelItem, ContentItem } from "@/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  FileText,
  Film,
  RefreshCw,
  LoaderCircle,
  Inbox,
  Subtitles,
  Pencil,
  Trash2,
  Download,
  Play,
  Check,
} from "lucide-react";

interface FileListProps {
  title: string;
  data: ReelItem[] | ContentItem[];
  isLoading: boolean;
  isContentList: boolean;
  showPreviewModal?: (url: string) => void;
  showDialogueModal?: (item: ContentItem) => void;
  handleCaptionGeneration?: (contentFileName: string) => Promise<void>;
  handleSingleReelGeneration?: (contentFileName: string) => Promise<void>;
  handleDeleteScript?: (filename: string) => Promise<void>;
  handleDeleteReel?: (filename: string) => Promise<void>;
  isContentGenerating?: boolean;
  isReelGenerating?: boolean;
  refreshLists: () => Promise<void>;
  apiBaseUrl: string;
}

const formatTimestamp = (ms: number) => {
  if (!ms) return "N/A";
  return new Date(ms).toLocaleString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
};

export const FileList: React.FC<FileListProps> = ({
  title,
  data,
  isLoading,
  isContentList,
  showPreviewModal,
  showDialogueModal,
  handleCaptionGeneration,
  handleSingleReelGeneration,
  handleDeleteScript,
  handleDeleteReel,
  isContentGenerating = false,
  isReelGenerating = false,
  refreshLists,
  apiBaseUrl,
}) => {
  const isGenerating = isContentGenerating || isReelGenerating;

  const removeExtension = (fileName: string) => {
    return fileName.replace(/\.[^/.]+$/, "");
  };

  return (
    <Card className="h-full flex flex-col border-border shadow-sm">
      <CardHeader className="p-5 sm:p-6 pb-0 shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg sm:text-xl font-bold flex items-center gap-2 sm:gap-3">
            <div
              className={cn(
                "w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl shrink-0 shadow-sm border",
                isContentList
                  ? "bg-primary/10 border-primary/20 text-primary"
                  : "bg-secondary border-border text-secondary-foreground",
              )}
            >
              {isContentList ? (
                <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
              ) : (
                <Film className="h-4 w-4 sm:h-5 sm:w-5" />
              )}
            </div>
            {title}
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={refreshLists}
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 p-5 sm:p-6 pt-4">
        <ScrollArea className="h-full pr-1">
          <div className="space-y-2 sm:space-y-3">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <LoaderCircle className="h-6 w-6 animate-spin mb-3" />
                <span className="text-sm font-medium">Loading...</span>
              </div>
            ) : data.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground bg-secondary/30 rounded-2xl border border-dashed border-border">
                <Inbox className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  No {isContentList ? "content" : "reels"} yet.
                </p>
              </div>
            ) : (
              <TooltipProvider delayDuration={300}>
                {data.map((item, index) => (
                  <div
                    key={index}
                    className="group flex justify-between items-center p-3 sm:p-4 rounded-xl bg-background hover:bg-secondary/50 border border-border hover:border-border/80 transition-all shadow-sm hover:shadow-md"
                  >
                    <div className="min-w-0 pr-4">
                      <p className="font-bold text-foreground truncate group-hover:text-primary transition-colors">
                        {removeExtension(item.name)}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                        <Badge
                          variant="secondary"
                          className="px-2 py-0.5 text-[10px] font-bold rounded"
                        >
                          {formatTimestamp(item.modified)}
                        </Badge>
                        {isContentList ? (
                          <Badge
                            variant="outline"
                            className="px-2 py-0.5 text-[10px] font-normal truncate max-w-[150px]"
                          >
                            {(item as ContentItem).query}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="px-2 py-0.5 text-[10px] font-normal"
                          >
                            {(item as ReelItem).size_kb.toFixed(1)} KB
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      {isContentList ? (
                        <>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-warning hover:bg-warning/10"
                                onClick={() =>
                                  handleCaptionGeneration?.(item.name)
                                }
                                disabled={isGenerating}
                              >
                                <Subtitles className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Generate Caption</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-success hover:bg-success/10"
                                onClick={() =>
                                  handleSingleReelGeneration?.(item.name)
                                }
                                disabled={isGenerating}
                              >
                                <Film className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Generate Reel</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10"
                                onClick={() =>
                                  showDialogueModal?.(item as ContentItem)
                                }
                                disabled={isGenerating}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit Dialogue</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteScript?.(item.name)}
                                disabled={isGenerating}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete Script</TooltipContent>
                          </Tooltip>
                        </>
                      ) : (
                        <>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <a
                                href={`${apiBaseUrl}/api/data/reels/${item.name}`}
                                download
                                className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-success hover:bg-success/10 transition"
                              >
                                <Download className="h-4 w-4" />
                              </a>
                            </TooltipTrigger>
                            <TooltipContent>Download Video</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10"
                                onClick={() =>
                                  showPreviewModal?.(
                                    `${apiBaseUrl}/reels/${item.name}`,
                                  )
                                }
                                disabled={isGenerating}
                              >
                                <Play className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Preview Video</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteReel?.(item.name)}
                                disabled={isGenerating}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete Reel</TooltipContent>
                          </Tooltip>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </TooltipProvider>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
