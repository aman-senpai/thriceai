import React from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  Clapperboard,
  Terminal,
  Sun,
  Moon,
  RefreshCw,
  Feather,
  Rss,
  Folder,
  Wand2,
} from "lucide-react";

interface HeaderProps {
  refreshLists: () => void;
  isReelGenerating: boolean;
  isContentGenerating: boolean;
  isReelsLoading: boolean;
  isContentsLoading: boolean;
  isDark: boolean;
  toggleTheme: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isLogVisible: boolean;
  toggleLog: () => void;
  generationProgress?: number;
  currentJob?: string;
}

export const Header = ({
  refreshLists,
  isReelGenerating,
  isContentGenerating,
  isReelsLoading,
  isContentsLoading,
  isDark,
  toggleTheme,
  activeTab,
  setActiveTab,
  isLogVisible,
  toggleLog,
  generationProgress = 0,
  currentJob,
}: HeaderProps) => (
  <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border px-3 py-3 md:px-6 md:py-4 shrink-0 transition-all duration-300">
    <div className="flex justify-between items-center max-w-[1920px] mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 md:w-10 md:h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
          <Clapperboard className="text-primary-foreground h-4 w-4 md:h-5 md:w-5" />
        </div>
        <div>
          <h1 className="text-lg md:text-xl font-black tracking-tight text-foreground leading-none">
            Reel Gen
          </h1>
          <p className="text-[10px] md:text-xs text-muted-foreground font-medium hidden sm:block mt-0.5">
            Create content fast.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {/* Desktop Tab Navigation */}
        <div className="hidden md:block mr-4">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v)}
            className="bg-muted p-1 rounded-xl"
          >
            <TabsList className="bg-transparent p-0 gap-0">
              <TabsTrigger
                value="studio"
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-bold transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
                  "text-muted-foreground hover:text-foreground",
                )}
              >
                Studio
              </TabsTrigger>
              <TabsTrigger
                value="feed"
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-bold transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
                  "text-muted-foreground hover:text-foreground",
                )}
              >
                Feed
              </TabsTrigger>
              <TabsTrigger
                value="batch"
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-bold transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm",
                  "text-muted-foreground hover:text-primary",
                )}
              >
                Batch
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <TooltipProvider delayDuration={300}>
          {/* Mobile: Terminal button (shows log tab) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className="w-9 h-9 md:w-10 md:h-10 flex md:hidden rounded-xl"
                onClick={() => setActiveTab("log")}
              >
                <Terminal className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Terminal</TooltipContent>
          </Tooltip>

          {/* Desktop: Toggle log panel */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className={cn(
                  "w-9 h-9 md:w-10 md:h-10 hidden md:flex rounded-xl transition-all",
                  isLogVisible &&
                    "bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90",
                )}
                onClick={toggleLog}
              >
                <Terminal className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle Terminal</TooltipContent>
          </Tooltip>

          {/* Theme toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className="w-9 h-9 md:w-10 md:h-10 rounded-xl"
                onClick={toggleTheme}
              >
                {isDark ? (
                  <Sun className="h-4 w-4 text-warning" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            </TooltipContent>
          </Tooltip>

          {/* Refresh */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className="w-9 h-9 md:w-10 md:h-10 rounded-xl"
                onClick={refreshLists}
                disabled={isReelGenerating || isContentGenerating}
              >
                <RefreshCw
                  className={cn(
                    "h-4 w-4",
                    (isReelsLoading || isContentsLoading) && "animate-spin",
                  )}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh Lists</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>

    {/* Mobile Tab Navigation */}
    <nav className="flex gap-1 mt-3 md:hidden">
      {[
        { id: "studio", label: "Studio", icon: Feather },
        { id: "feed", label: "Feed", icon: Rss },
        { id: "files", label: "Files", icon: Folder },
        { id: "log", label: "Log", icon: Terminal },
      ].map((tab) => {
        const Icon = tab.icon;
        return (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? "default" : "ghost"}
            size="sm"
            className={cn(
              "flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5",
              activeTab === tab.id && "shadow-md shadow-primary/20",
            )}
            onClick={() => setActiveTab(tab.id)}
          >
            <Icon className="h-3.5 w-3.5" />
            {tab.label}
          </Button>
        );
      })}
      <Button
        variant={activeTab === "batch" ? "default" : "ghost"}
        size="sm"
        className={cn(
          "flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5",
          activeTab === "batch" &&
            "bg-primary hover:bg-primary/90 shadow-md shadow-primary/20",
        )}
        onClick={() => setActiveTab("batch")}
      >
        <Wand2 className="h-3.5 w-3.5" />
        Batch
      </Button>
    </nav>

    {(isReelGenerating || isContentGenerating) && (
      <div className="absolute bottom-0 left-0 w-full h-1 bg-muted overflow-hidden">
        <Progress
          value={generationProgress}
          className="h-full bg-muted rounded-none [&>div]:bg-primary [&>div]:shadow-[0_0_8px_rgba(var(--primary),0.5)]"
        />
        {currentJob && (
          <div className="absolute top-[-20px] right-4 bg-background/90 backdrop-blur-sm border border-border px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter text-primary animate-pulse">
            {currentJob}
            {" • "}
            {generationProgress}%
          </div>
        )}
      </div>
    )}
  </header>
);
