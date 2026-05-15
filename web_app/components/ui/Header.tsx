import React from "react";

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
          <i className="fas fa-layer-group text-primary-foreground text-sm md:text-base"></i>
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
        <div className="hidden md:flex bg-muted p-1 rounded-xl mr-4">
          <button
            onClick={() => setActiveTab("studio")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "studio"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Studio
          </button>
          <button
            onClick={() => setActiveTab("feed")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "feed"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Feed
          </button>
          <button
            onClick={() => setActiveTab("batch")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "batch"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-emerald-600"
            }`}
          >
            Batch
          </button>
        </div>

        <button
          onClick={() => setActiveTab("log")}
          className="w-9 h-9 md:w-10 md:h-10 flex md:hidden items-center justify-center rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-all active:scale-95"
          title="Terminal"
        >
          <i className="fas fa-terminal text-sm md:text-base"></i>
        </button>
        <button
          onClick={toggleLog}
          className={`hidden md:flex w-9 h-9 md:w-10 md:h-10 items-center justify-center rounded-xl transition-all active:scale-95 ${
            isLogVisible
              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          }`}
          title="Toggle Terminal"
        >
          <i className="fas fa-terminal text-sm md:text-base"></i>
        </button>
        <button
          onClick={toggleTheme}
          className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-all active:scale-95"
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          <i
            className={`fas ${
              isDark ? "fa-sun text-amber-400" : "fa-moon"
            } text-sm md:text-base`}
          ></i>
        </button>
        <button
          onClick={refreshLists}
          disabled={isReelGenerating || isContentGenerating}
          className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-all active:scale-95 disabled:opacity-50"
          title="Refresh Lists"
        >
          <i
            className={`fas fa-sync text-sm md:text-base ${
              isReelsLoading || isContentsLoading ? "animate-spin" : ""
            }`}
          ></i>
        </button>
      </div>
    </div>
    {/* Mobile Tab Navigation */}
    <nav className="flex gap-1 mt-3 md:hidden">
      {[
        { id: "studio", label: "Studio", icon: "fa-feather" },
        { id: "feed", label: "Feed", icon: "fa-rss" },
        { id: "files", label: "Files", icon: "fa-folder" },
        { id: "log", label: "Log", icon: "fa-terminal" },
      ].map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === tab.id
              ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          <i className={`fas ${tab.icon}`}></i>
          {tab.label}
        </button>
      ))}
      <button
        onClick={() => setActiveTab("batch")}
        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
          activeTab === "batch"
            ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
            : "bg-muted text-muted-foreground hover:text-foreground"
        }`}
      >
        <i className="fas fa-magic"></i>
        Batch
      </button>
    </nav>
    {(isReelGenerating || isContentGenerating) && (
      <div className="absolute bottom-0 left-0 w-full h-1 bg-muted overflow-hidden">
        <div 
          className="h-full bg-primary transition-all duration-500 ease-out shadow-[0_0_8px_rgba(var(--primary),0.5)]"
          style={{ width: `${generationProgress}%` }}
        />
        {currentJob && (
          <div className="absolute top-[-20px] right-4 bg-background/90 backdrop-blur-sm border border-border px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter text-primary animate-pulse">
            {currentJob} • {generationProgress}%
          </div>
        )}
      </div>
    )}
  </header>
);