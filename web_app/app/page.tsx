"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { FileList } from "@/components/lists/FileList";
import VideoModals, { VideoModalsProps } from "@/components/modals/VideoModals";

// Styling constants are now imported from @/lib/constants to ensure consistent theming


// --- 1. Type Definitions (Preserved and Exported) ---
interface CharacterDetails {
  avatar: string;
  voice_gemini?: string;
  voice_eleven?: string;
  voice_mac?: string;
}

interface ConfigData {
  session_count: number;
  characters: Record<string, CharacterDetails>;
  audio_modes: Record<string, string>;
  prompts: Record<string, string>;
  max_query_length: number;
}

interface ReelItem {
  name: string;
  path: string;
  size_kb: number;
  modified: number;
  content_exists: boolean;
}

export interface ContentItem {
  name: string;
  path: string;
  modified: number;
  query: string;
  dialogues: { speaker: string; dialogue: string }[];
}

export type LogType = "info" | "error" | "warn" | "success";

interface LogMessage {
  timestamp: string;
  type: LogType;
  message: string;
}

import { fetchConfig, fetchData, postData, cardClasses, selectOrInputClasses, primaryButtonClasses, successButtonClasses, dangerButtonClasses } from "@/lib/constants";
import { useThemeManager } from "@/hooks/useThemeManager";

// --- Helper for sanitizing filename (Required for handleContentGeneration and display hint) ---
const sanitizeFileName = (name: string) => name.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();

const API_BASE_URL = typeof window === 'undefined'
  ? 'http://localhost:8008'
  : `http://${window.location.hostname}:8008`;

// --- Reusable UI Components ---

const BaseButton = ({ children, onClick, disabled, className = "" }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; className?: string }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`px-4 py-2 font-semibold rounded-lg transition duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
  >
    {children}
  </button>
);

const GenerateButton = ({ children, onClick, disabled, className, isSubmit = false }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; className?: string, isSubmit?: boolean }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    type={isSubmit ? "submit" : "button"}
    className={`${primaryButtonClasses} ${className}`}
  >
    {children}
  </button>
);

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
}

const Header = ({ refreshLists, isReelGenerating, isContentGenerating, isReelsLoading, isContentsLoading, isDark, toggleTheme, activeTab, setActiveTab }: HeaderProps) => (
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
          <p className="text-[10px] md:text-xs text-muted-foreground font-medium hidden sm:block mt-0.5">Create content fast.</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-all active:scale-95"
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          <i className={`fas ${isDark ? "fa-sun" : "fa-moon"} text-sm md:text-base`}></i>
        </button>
        <button
          onClick={refreshLists}
          disabled={isReelGenerating || isContentGenerating}
          className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-all active:scale-95 disabled:opacity-50"
          title="Refresh Lists"
        >
          <i className={`fas fa-sync text-sm md:text-base ${isReelsLoading || isContentsLoading ? "animate-spin" : ""}`}></i>
        </button>
      </div>
    </div>
    {/* Mobile Tab Navigation */}
    <nav className="flex gap-1 mt-3 md:hidden">
      {[
        { id: 'studio', label: 'Studio', icon: 'fa-feather' },
        { id: 'files', label: 'Files', icon: 'fa-folder' },
        { id: 'log', label: 'Log', icon: 'fa-terminal' },
      ].map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === tab.id
            ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
            : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
        >
          <i className={`fas ${tab.icon}`}></i>
          {tab.label}
        </button>
      ))}
    </nav>
  </header>
);
interface GenerateContentFormProps {
  config: ConfigData | null;
  charA: string; setCharA: React.Dispatch<React.SetStateAction<string>>;
  charB: string; setCharB: React.Dispatch<React.SetStateAction<string>>;
  audioMode: string; setAudioMode: React.Dispatch<React.SetStateAction<string>>;
  promptPath: string; setPromptPath: React.Dispatch<React.SetStateAction<string>>;
  query: string;
  handleQueryChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  fileName: string;
  handleFileNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  contentStatus: string;
  isConfigLoading: boolean;
  isContentGenerating: boolean;
  isConfigValid: boolean;
  handleContentGeneration: (e: React.FormEvent) => Promise<void>;
}

// Helper for Character Cards - Compact Horizontal Scroll
const CharacterScroll = ({ label, selected, onSelect, exclude, config, isContentGenerating }: { label: string, selected: string, onSelect: (v: string) => void, exclude?: string, config: ConfigData | null, isContentGenerating: boolean }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between px-1">
      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</label>
      {selected && <span className="text-xs text-foreground font-bold">{selected}</span>}
    </div>
    <div className="flex gap-2 overflow-x-auto py-2 custom-scrollbar -mx-1 px-2">
      {config && Object.entries(config.characters).map(([key, char]) => {
        const isSelected = selected === key;
        const isExcluded = exclude === key;

        if (isExcluded) return null;

        return (
          <button
            key={key}
            type="button"
            onClick={() => (!isExcluded && !isContentGenerating) && onSelect(key)}
            className={`relative shrink-0 w-14 h-14 md:w-16 md:h-16 rounded-xl overflow-hidden transition-all duration-200 bg-muted ${isSelected
              ? "ring-2 ring-primary shadow-lg scale-105"
              : "opacity-70 hover:opacity-100 hover:scale-105 grayscale hover:grayscale-0"
              }`}
          >
            <img
              src={char.avatar.startsWith('http') ? char.avatar : `${API_BASE_URL}${char.avatar}`}
              alt={key}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${key}&background=random`; }}
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent py-1 px-1">
              <p className="text-white font-bold text-[9px] leading-none truncate text-center">{key}</p>
            </div>
            {isSelected && (
              <div className="absolute top-1 right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center shadow">
                <i className="fas fa-check text-[8px] text-primary-foreground"></i>
              </div>
            )}
          </button>
        );
      })}
    </div>
  </div>
);

const GenerateContentForm = React.memo(function GenerateContentForm({
  config,
  charA, setCharA,
  charB, setCharB,
  audioMode, setAudioMode,
  promptPath, setPromptPath,
  query,
  handleQueryChange,
  fileName,
  handleFileNameChange,
  contentStatus,
  isConfigLoading,
  isContentGenerating,
  isConfigValid,
  handleContentGeneration,
}: GenerateContentFormProps) {

  return (
    <div id="config-section" className="bg-card text-card-foreground p-6 rounded-2xl shadow-sm border border-border flex flex-col h-full">
      <div className="flex items-center gap-3 mb-6 shrink-0">
        <div className="p-3 bg-secondary rounded-xl text-secondary-foreground">
          <i className="fas fa-feather"></i>
        </div>
        <div>
          <h2 className="text-sm font-bold text-foreground">Studio/Script</h2>
          <p className="text-[10px] text-muted-foreground">Choose actors & generate dialogue</p>
        </div>
      </div>

      <form onSubmit={handleContentGeneration} className="space-y-4 flex-1 flex flex-col overflow-hidden">

        {/* Form Inputs & Button (Moved to Top) */}
        <div className="shrink-0 space-y-3">
          <div className="bg-secondary/30 rounded-xl p-4 border border-border space-y-3">
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Prompt Template</label>
              <div className="flex flex-wrap gap-2">
                {config && Object.entries(config.prompts).map(([path, name]) => {
                  const isSelected = promptPath === path;
                  const displayName = name.replace(/\.[^/.]+$/, ""); // Drop file extension

                  return (
                    <button
                      key={path}
                      type="button"
                      onClick={() => setPromptPath(path)}
                      disabled={isConfigLoading || isContentGenerating}
                      className={`px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-bold transition-all duration-200 border ${isSelected
                        ? "bg-primary text-primary-foreground border-primary shadow-sm transform scale-105"
                        : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                        }`}
                    >
                      {displayName}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Topic / Query</label>
              <textarea
                value={query}
                onChange={(e) => handleQueryChange(e)}
                placeholder="e.g. 'Philosophy of Java vs Python'"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none min-h-[80px]"
                disabled={isConfigLoading || isContentGenerating}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Filename</label>
                <input
                  type="text"
                  value={fileName}
                  onChange={handleFileNameChange}
                  placeholder="video_topic"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  disabled={isConfigLoading || isContentGenerating}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Audio Mode</label>
                <div className="flex flex-wrap gap-2">
                  {config && Object.keys(config.audio_modes).map((mode) => {
                    const isSelected = audioMode === mode;
                    const displayName = mode.replace(/_/g, ' ');

                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setAudioMode(mode)}
                        disabled={isConfigLoading || isContentGenerating}
                        className={`px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-bold transition-all duration-200 border capitalize ${isSelected
                          ? "bg-primary text-primary-foreground border-primary shadow-sm transform scale-105"
                          : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                          }`}
                      >
                        {displayName}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="pb-1">
            <GenerateButton onClick={() => { }} disabled={!isConfigValid || isContentGenerating || isConfigLoading} isSubmit={true} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 py-2.5 rounded-xl font-bold text-xs shadow-sm disabled:opacity-50 transition-colors">
              {isContentGenerating ? (<><i className="fas fa-spinner fa-spin mr-2"></i> Generating...</>) : ("Generate Content")}
            </GenerateButton>
            {contentStatus && (
              <div className="mt-3 p-2.5 rounded-lg bg-secondary text-center text-xs font-medium text-secondary-foreground animate-fade-in border border-border">
                {contentStatus}
              </div>
            )}
          </div>
        </div>

        {/* Character Selection - Compact Horizontal Scroll */}
        <div className="space-y-4 pt-4 border-t border-border">
          <CharacterScroll label="Speaker 1" selected={charA} onSelect={setCharA} exclude={charB} config={config} isContentGenerating={isContentGenerating} />
          <div className="flex items-center gap-3 px-1">
            <div className="h-px bg-border flex-1"></div>
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">vs</span>
            <div className="h-px bg-border flex-1"></div>
          </div>
          <CharacterScroll label="Speaker 2" selected={charB} onSelect={setCharB} exclude={charA} config={config} isContentGenerating={isContentGenerating} />
        </div>

      </form>
    </div>
  );
});

interface ReelGenerationSectionProps {
  handleSessionReelGeneration: () => void;
  handleAllReelGeneration: () => void;
  isReelGenerating: boolean;
  sessionCount: number;
  audioMode: string;
  reelStatus: string;
  config: ConfigData | null;
  pipAsset: string | null;
  isPipUploading: boolean;
  handlePipUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleClearPipAsset: () => void;
}

const ReelGenerationSection = ({
  handleSessionReelGeneration,
  handleAllReelGeneration,
  isReelGenerating,
  sessionCount,
  audioMode,
  reelStatus,
  config,
  pipAsset,
  isPipUploading,
  handlePipUpload,
  handleClearPipAsset
}: ReelGenerationSectionProps) => (
  <div className="bg-card text-card-foreground p-5 rounded-2xl shadow-sm border border-border space-y-4">
    <div className="flex items-center justify-between">
      <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
        <i className="fas fa-video text-muted-foreground"></i>
        Build Reels
      </h2>
      {reelStatus && (
        <span className="text-[10px] font-medium px-2 py-1 bg-secondary text-secondary-foreground rounded-lg">
          {reelStatus}
        </span>
      )}
    </div>

    {/* PIP Asset Upload Section */}
    <div className="bg-secondary/30 rounded-xl p-3 border border-border">
      <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">PIP Asset (Optional)</label>
      {pipAsset ? (
        <div className="flex items-center justify-between bg-background p-2 rounded-lg border border-border">
          <div className="flex items-center gap-2 min-w-0">
            <i className="fas fa-file-image text-muted-foreground"></i>
            <span className="text-xs font-medium truncate text-foreground">{pipAsset}</span>
          </div>
          <button
            onClick={handleClearPipAsset}
            className="text-muted-foreground hover:text-destructive p-1 transition-colors"
            title="Clear Asset"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
      ) : (
        <div className="relative group">
          <input
            type="file"
            accept="image/*,video/*"
            onChange={handlePipUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            disabled={isPipUploading}
          />
          <div className="border-2 border-dashed border-border rounded-lg p-3 text-center group-hover:border-primary/50 transition-colors">
            {isPipUploading ? (
              <i className="fas fa-spinner fa-spin text-muted-foreground"></i>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <i className="fas fa-cloud-upload-alt text-muted-foreground group-hover:text-primary transition-colors"></i>
                <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">Click or drag</span>
              </div>
            )}
          </div>
        </div>
      )}
      <p className="text-[9px] text-muted-foreground mt-2 leading-tight italic opacity-70">
        * PIP will be placed above captions.
      </p>
    </div>

    <div className="flex gap-2">
      <GenerateButton onClick={handleSessionReelGeneration} disabled={isReelGenerating || sessionCount <= 0 || !audioMode} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 text-xs py-2 rounded-xl shadow-sm transition-all disabled:opacity-50">
        {isReelGenerating && sessionCount > 0 ? <i className="fas fa-spinner fa-spin mr-2"></i> : null}
        <span id="generate-session-reels-btn">Session ({sessionCount})</span>
      </GenerateButton>
      <GenerateButton onClick={handleAllReelGeneration} disabled={isReelGenerating || !audioMode} className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700 text-xs py-2 rounded-xl shadow-sm transition-all disabled:opacity-50">
        {isReelGenerating && sessionCount === 0 ? <i className="fas fa-spinner fa-spin mr-2"></i> : null}
        <span id="generate-all-reels-btn">All Files</span>
      </GenerateButton>
    </div>
  </div>
);

interface LogSectionProps {
  logMessages: LogMessage[];
  refreshLists: () => void;
}

const LogSection = ({ logMessages, refreshLists }: LogSectionProps) => (
  <div className="bg-card text-card-foreground p-4 rounded-2xl shadow-sm border border-border h-full flex flex-col">
    <div className="flex justify-between items-center mb-3 shrink-0">
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-secondary rounded-lg text-secondary-foreground">
          <i className="fas fa-terminal text-xs"></i>
        </div>
        <h2 className="text-xs font-bold text-foreground">Activity Log</h2>
      </div>
      <button onClick={refreshLists} className="p-1 px-2 text-muted-foreground hover:text-foreground transition rounded hover:bg-secondary">
        <i className="fas fa-sync text-xs"></i>
      </button>
    </div>
    <div className="flex-1 overflow-y-auto custom-scrollbar font-mono text-[10px] p-3 bg-secondary/30 rounded-xl border border-border space-y-1.5 shadow-inner h-0 min-h-0">
      {logMessages.length === 0 && <span className="text-muted-foreground italic">System ready...</span>}
      {[...logMessages].reverse().map((log, idx) => (
        <div key={idx} className="flex gap-2 leading-tight">
          <span className="text-muted-foreground shrink-0 select-none opacity-50">{log.timestamp}</span>
          <span className={`${log.type === 'error' ? 'text-destructive font-bold' :
            log.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' :
              log.type === 'warn' ? 'text-amber-500' : 'text-foreground/80'
            } break-words`}>
            {log.message}
          </span>
        </div>
      ))}
    </div>
  </div>
);

// --- 4. Main Component ---
export default function Page() {
  const { isDark, toggleTheme } = useThemeManager();

  // State initialization
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [reels, setReels] = useState<ReelItem[]>([]);
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [logMessages, setLogMessages] = useState<LogMessage[]>([]);

  const [charA, setCharA] = useState("");
  const [charB, setCharB] = useState("");
  const [audioMode, setAudioMode] = useState("");
  const [promptPath, setPromptPath] = useState("");
  const [query, setQuery] = useState("");
  const [fileName, setFileName] = useState("");
  const [sessionCount, setSessionCount] = useState(0);
  const [contentStatus, setContentStatus] = useState("");
  const [reelStatus, setReelStatus] = useState("");
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState('studio'); // Mobile tab navigation

  const [isConfigLoading, setIsConfigLoading] = useState(false);
  const [isReelsLoading, setIsReelsLoading] = useState(false);
  const [isContentsLoading, setIsContentsLoading] = useState(false);
  const [isContentGenerating, setIsContentGenerating] = useState(false);
  const [isReelGenerating, setIsReelGenerating] = useState(false);
  const [isDialogueSaving, setIsDialogueSaving] = useState(false);
  const [pipAsset, setPipAsset] = useState<string | null>(null);
  const [isPipUploading, setIsPipUploading] = useState(false);

  // Modal State
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [isDialogueModalOpen, setIsDialogueModalOpen] = useState(false);
  const [dialogueContent, setDialogueContent] = useState('');
  const [dialogueFileName, setDialogueFileName] = useState('');
  const [isCaptionModalOpen, setIsCaptionModalOpen] = useState(false);
  const [captionContent, setCaptionContent] = useState('');
  const [captionFileName, setCaptionFileName] = useState('');


  const log = useCallback((message: string, type: LogType = "info") => {
    const now = new Date().toLocaleTimeString("en-US", { hour12: false });
    setLogMessages((prev) => [...prev.slice(-500), { timestamp: now, type, message }]);
  }, []);

  // --- Data Fetching and Initialization ---
  const loadConfig = useCallback(async () => {
    setIsConfigLoading(true);
    try {
      log("Fetching configuration data...", "info");
      const data = await fetchConfig();
      setConfig(data);
      setSessionCount(data.session_count);

      const charKeys = Object.keys(data.characters);
      const modeKeys = Object.keys(data.audio_modes);
      const promptKeys = Object.keys(data.prompts);

      setCharA(charKeys[0] || "");
      setCharB(charKeys[1] || "");
      setAudioMode(modeKeys[0] || "");

      // Default to blinked_thrice.txt if available, otherwise first prompt
      const defaultPrompt = promptKeys.find(key => key.includes("blinked_thrice.txt")) || promptKeys[0] || "";
      setPromptPath(defaultPrompt);

      log("Configuration loaded successfully.", "success");
    } catch (err: any) {
      log(`Failed to load config: ${err.message}`, "error");
    } finally {
      setIsConfigLoading(false);
    }
  }, [log]);

  const refreshLists = useCallback(async () => {
    try {
      setIsReelsLoading(true);
      const reelsData = await fetchData<{ reels: ReelItem[] }>("/api/data/reels");
      setReels(reelsData.reels);
      setIsReelsLoading(false);

      setIsContentsLoading(true);
      const contentData = await fetchData<{ contents: ContentItem[] }>("/api/data/contents");
      setContents(contentData.contents);
      setIsContentsLoading(false);

      log("Reel and Content lists refreshed.", "success");
    } catch (err: any) {
      log(`Failed to refresh lists: ${err.message}`, "error");
    }
  }, [log]);

  const fetchPipAsset = useCallback(async () => {
    try {
      const data = await fetchData<{ filename: string | null; exists: boolean }>("/api/data/pip-asset");
      setPipAsset(data.filename);
    } catch (err) {
      console.error("Failed to fetch PIP asset", err);
    }
  }, []);

  useEffect(() => {
    loadConfig();
    setMounted(true);
    refreshLists();
    fetchPipAsset();
  }, [loadConfig, refreshLists, fetchPipAsset]);

  // --- SSE Connection for Terminal Logs ---
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connectToLogStream = () => {
      eventSource = new EventSource(`${API_BASE_URL}/api/logs/stream`);

      eventSource.onmessage = (event) => {
        try {
          const logEntry = JSON.parse(event.data) as LogMessage;
          setLogMessages((prev) => {
            // Avoid duplicates by checking if message already exists
            const isDuplicate = prev.some(
              (l) => l.timestamp === logEntry.timestamp && l.message === logEntry.message
            );
            if (isDuplicate) return prev;
            return [...prev.slice(-500), logEntry];
          });
        } catch (err) {
          console.error("Failed to parse log message:", err);
        }
      };

      eventSource.onerror = () => {
        eventSource?.close();
        // Attempt to reconnect after 5 seconds
        reconnectTimeout = setTimeout(connectToLogStream, 5000);
      };
    };

    // Start connection after a short delay to let the server start
    const initialTimeout = setTimeout(connectToLogStream, 1000);

    return () => {
      clearTimeout(initialTimeout);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      eventSource?.close();
    };
  }, []);

  const isConfigValid = useMemo(
    () =>
      !!charA &&
      !!charB &&
      !!audioMode &&
      !!promptPath &&
      query.trim().length > 0 &&
      !!fileName.trim() &&
      charA !== charB,
    [charA, charB, audioMode, promptPath, query, fileName]
  );

  const handleQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setQuery(e.target.value);
  }, []);

  const handleFileNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFileName(e.target.value);
  }, []);

  // --- Handlers ---
  const handleContentGeneration = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfigValid) return;

    setIsContentGenerating(true);
    setContentStatus("Processing...");
    log("Generating content...", "info");

    try {
      const sanitizedFileName = sanitizeFileName(fileName);

      const payload = {
        char_a_name: charA,
        char_b_name: charB,
        selected_prompt_path: promptPath,
        query,
        file_name: sanitizedFileName
      };

      const result = await postData("/api/generate-content", payload);
      setContentStatus("✅ " + result.message);
      log(result.message, "success");
      setSessionCount(result.session_count);
      setQuery("");
      setFileName("");
      refreshLists();
    } catch (err: any) {
      setContentStatus("❌ " + err.message);
      log(err.message, "error");
    } finally {
      setIsContentGenerating(false);
    }
  }, [charA, charB, promptPath, query, fileName, log, isConfigValid, refreshLists]);

  const handleSessionReelGeneration = async () => {
    const endpoint = "/api/generate-reels/session";

    if (isReelGenerating || !audioMode) return;
    setIsReelGenerating(true);
    setReelStatus("Processing Session...");
    log("Generating reels for current session...", "info");
    try {
      const result = await postData(endpoint, { audio_mode: audioMode });
      setReelStatus("✅ " + result.message);
      log(result.message, "success");
      refreshLists();
      setSessionCount(result.session_count || 0);
    } catch (err: any) {
      const errorMsg = err.message || 'API call failed.';
      setReelStatus("❌ " + errorMsg);
      log(errorMsg, "error");
    } finally {
      setIsReelGenerating(false);
    }
  };

  const handleAllReelGeneration = async () => {
    const endpoint = "/api/generate-reels/all";

    if (isReelGenerating || !audioMode) return;
    setIsReelGenerating(true);
    setReelStatus("Processing All...");
    log("Generating reels for all content files...", "info");
    try {
      const result = await postData(endpoint, { audio_mode: audioMode });
      setReelStatus("✅ " + result.message);
      log(result.message, "success");
      refreshLists();
    } catch (err: any) {
      const errorMsg = err.message || 'API call failed.';
      setReelStatus("❌ " + errorMsg);
      log(errorMsg, "error");
    } finally {
      setIsReelGenerating(false);
    }
  };

  const handleSingleReelGeneration = async (filename: string) => {
    const endpoint = "/api/generate-reel/single";

    if (isReelGenerating || !audioMode) {
      log("Cannot generate: either already generating or no audio mode selected.", "warn");
      return;
    }
    setIsReelGenerating(true);
    setReelStatus(`Processing ${filename}...`);
    log(`Generating reel for ${filename}...`, "info");
    try {
      const result = await postData(endpoint, { filename, audio_mode: audioMode });
      setReelStatus("✅ " + result.message);
      log(result.message, "success");
      refreshLists();
    } catch (err: any) {
      const errorMsg = err.message || 'API call failed.';
      setReelStatus("❌ " + errorMsg);
      log(errorMsg, "error");
    } finally {
      setIsReelGenerating(false);
    }
  };

  const handlePipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsPipUploading(true);
    log(`Uploading asset: ${file.name}...`, "info");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`${API_BASE_URL}/api/upload-asset`, {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (response.ok) {
        setPipAsset(result.filename);
        log(result.message, "success");
      } else {
        throw new Error(result.detail || "Upload failed");
      }
    } catch (err: any) {
      log(`Upload failed: ${err.message}`, "error");
    } finally {
      setIsPipUploading(false);
    }
  };

  const handleClearPipAsset = async () => {
    log("Clearing PIP asset...", "info");
    try {
      await fetch(`${API_BASE_URL}/api/clear-pip-asset`, { method: "POST" });
      setPipAsset(null);
      log("PIP asset cleared.", "success");
    } catch (err: any) {
      log(`Failed to clear asset: ${err.message}`, "error");
    }
  };

  const handleDeleteScript = async (filename: string) => {
    if (!confirm(`Delete script "${filename}"? This cannot be undone.`)) return;

    log(`Deleting script: ${filename}...`, "info");
    try {
      const response = await fetch(`${API_BASE_URL}/api/delete-script/${filename}`, { method: "DELETE" });
      const result = await response.json();
      if (response.ok) {
        log(result.message, "success");
        setSessionCount(result.session_count ?? sessionCount);
        refreshLists();
      } else {
        throw new Error(result.detail || "Delete failed");
      }
    } catch (err: any) {
      log(`Failed to delete script: ${err.message}`, "error");
    }
  };

  const handleDeleteReel = async (filename: string) => {
    if (!confirm(`Delete reel "${filename}"? This cannot be undone.`)) return;

    log(`Deleting reel: ${filename}...`, "info");
    try {
      const response = await fetch(`${API_BASE_URL}/api/delete-reel/${filename}`, { method: "DELETE" });
      const result = await response.json();
      if (response.ok) {
        log(result.message, "success");
        refreshLists();
      } else {
        throw new Error(result.detail || "Delete failed");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log(`Failed to delete reel: ${message}`, "error");
    }
  };

  const handleSaveDialogue = async () => {
    if (!dialogueFileName || isDialogueSaving) return;

    setIsDialogueSaving(true);
    log(`Saving changes to ${dialogueFileName}...`, "info");

    try {
      const payload = {
        file_name: dialogueFileName,
        content: dialogueContent,
      };

      const result = await postData("/api/update-content", payload);
      log(`Successfully saved changes to ${dialogueFileName}: ${result.message}`, "success");
      refreshLists();
      hideDialogueModal();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log(`Failed to save dialogue: ${message}`, "error");
      alert(`Failed to save: ${message}`);
    } finally {
      setIsDialogueSaving(false);
    }
  };

  const handleCaptionGeneration = async (contentFileName: string) => {
    log(`Requesting caption for ${contentFileName}...`, "info");
    setCaptionFileName(contentFileName);
    setCaptionContent('Generating caption...');
    setIsCaptionModalOpen(true);

    try {
      const result = await postData(`/api/generate-caption/${contentFileName}`, {});

      if (result && result.caption) {
        setCaptionContent(result.caption);
        log(`Caption successfully generated for ${contentFileName}.`, "success");
      } else {
        const errorMsg = result.error || 'API failed to generate caption.';
        setCaptionContent(`Error: ${errorMsg}`);
        log(`Caption generation failed for ${contentFileName}: ${errorMsg}`, "error");
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Network error.';
      setCaptionContent(`Error: ${errorMsg}`);
      log(`Caption generation failed for ${contentFileName}: ${errorMsg}`, "error");
    }
  };

  // --- Modal Handlers ---
  const showPreviewModal = (url: string) => {
    setPreviewUrl(url);
    setIsPreviewModalOpen(true);
  };

  const hidePreviewModal = () => {
    setIsPreviewModalOpen(false);
    setPreviewUrl('');
  };

  const showDialogueModal = (item: ContentItem) => {
    setDialogueFileName(item.name);
    const formattedDialogue = item.dialogues.map(d => `${d.speaker.toUpperCase()}: ${d.dialogue}`).join('\n\n');
    const content = `// Content Query: ${item.query}\n// File Path: ${item.path}\n// ----------------------------------\n\n${formattedDialogue}`;
    setDialogueContent(content);
    setIsDialogueModalOpen(true);
  };

  const hideDialogueModal = () => {
    setIsDialogueModalOpen(false);
    setDialogueContent('');
    setDialogueFileName('');
  };

  const hideCaptionModal = () => {
    setIsCaptionModalOpen(false);
    setCaptionContent('');
    setCaptionFileName('');
  }

  const videoModalsProps: VideoModalsProps = {
    isPreviewModalOpen,
    previewUrl,
    hidePreviewModal,
    isDialogueModalOpen,
    dialogueFileName,
    dialogueContent,
    setDialogueContent,
    hideDialogueModal,
    handleSaveDialogue,
    isDialogueSaving,
    isCaptionModalOpen,
    captionFileName,
    captionContent,
    hideCaptionModal,
    log,
  };

  if (!mounted) return null;

  return (
    <div className="transition-colors duration-300 bg-zinc-100 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-200 min-h-screen flex flex-col">
      <Header
        refreshLists={refreshLists}
        isReelGenerating={isReelGenerating}
        isContentGenerating={isContentGenerating}
        isReelsLoading={isReelsLoading}
        isContentsLoading={isContentsLoading}
        isDark={isDark}
        toggleTheme={toggleTheme}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Mobile Layout - Tab Content */}
      <main className="flex-1 p-2 md:hidden overflow-y-auto">
        {activeTab === 'studio' && (
          <div className="space-y-3 animate-fade-in">
            <GenerateContentForm
              config={config}
              charA={charA} setCharA={setCharA}
              charB={charB} setCharB={setCharB}
              audioMode={audioMode} setAudioMode={setAudioMode}
              promptPath={promptPath} setPromptPath={setPromptPath}
              query={query}
              handleQueryChange={handleQueryChange}
              fileName={fileName}
              handleFileNameChange={handleFileNameChange}
              contentStatus={contentStatus}
              isConfigLoading={isConfigLoading}
              isContentGenerating={isContentGenerating}
              isConfigValid={isConfigValid}
              handleContentGeneration={handleContentGeneration}
            />
            <ReelGenerationSection
              handleSessionReelGeneration={handleSessionReelGeneration}
              handleAllReelGeneration={handleAllReelGeneration}
              isReelGenerating={isReelGenerating}
              sessionCount={sessionCount}
              audioMode={audioMode}
              reelStatus={reelStatus}
              config={config}
              pipAsset={pipAsset}
              isPipUploading={isPipUploading}
              handlePipUpload={handlePipUpload}
              handleClearPipAsset={handleClearPipAsset}
            />
          </div>
        )}
        {activeTab === 'files' && (
          <div className="space-y-3 animate-fade-in">
            <FileList
              title="Generated Scripts"
              data={contents}
              isLoading={isContentsLoading}
              isContentList={true}
              showDialogueModal={showDialogueModal}
              handleCaptionGeneration={handleCaptionGeneration}
              handleSingleReelGeneration={handleSingleReelGeneration}
              handleDeleteScript={handleDeleteScript}
              isReelGenerating={isReelGenerating}
              apiBaseUrl={API_BASE_URL}
              refreshLists={refreshLists}
            />
            <FileList
              title="Ready Reels"
              data={reels}
              isLoading={isReelsLoading}
              isContentList={false}
              showPreviewModal={showPreviewModal}
              handleDeleteReel={handleDeleteReel}
              isReelGenerating={isReelGenerating}
              apiBaseUrl={API_BASE_URL}
              refreshLists={refreshLists}
            />
          </div>
        )}
        {activeTab === 'log' && (
          <div className="h-full animate-fade-in">
            <LogSection
              logMessages={logMessages}
              refreshLists={refreshLists}
            />
          </div>
        )}
      </main>

      {/* Desktop Layout - 3 Column Grid */}
      <main className="hidden md:flex flex-1 p-3 lg:p-4 gap-3 lg:gap-4 min-h-0 overflow-hidden max-w-[1920px] mx-auto w-full">

        {/* Column 1: Studio/Script (Left) */}
        <section className="w-[38%] lg:w-[35%] flex flex-col gap-3 min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-hidden">
            <GenerateContentForm
              config={config}
              charA={charA} setCharA={setCharA}
              charB={charB} setCharB={setCharB}
              audioMode={audioMode} setAudioMode={setAudioMode}
              promptPath={promptPath} setPromptPath={setPromptPath}
              query={query}
              handleQueryChange={handleQueryChange}
              fileName={fileName}
              handleFileNameChange={handleFileNameChange}
              contentStatus={contentStatus}
              isConfigLoading={isConfigLoading}
              isContentGenerating={isContentGenerating}
              isConfigValid={isConfigValid}
              handleContentGeneration={handleContentGeneration}
            />
          </div>
          <div className="shrink-0">
            <ReelGenerationSection
              handleSessionReelGeneration={handleSessionReelGeneration}
              handleAllReelGeneration={handleAllReelGeneration}
              isReelGenerating={isReelGenerating}
              sessionCount={sessionCount}
              audioMode={audioMode}
              reelStatus={reelStatus}
              config={config}
              pipAsset={pipAsset}
              isPipUploading={isPipUploading}
              handlePipUpload={handlePipUpload}
              handleClearPipAsset={handleClearPipAsset}
            />
          </div>
        </section>

        {/* Column 2: File Lists (Center) */}
        <section className="w-[32%] lg:w-[35%] flex flex-col gap-3 min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-hidden">
            <FileList
              title="Generated Scripts"
              data={contents}
              isLoading={isContentsLoading}
              isContentList={true}
              showDialogueModal={showDialogueModal}
              handleCaptionGeneration={handleCaptionGeneration}
              handleSingleReelGeneration={handleSingleReelGeneration}
              handleDeleteScript={handleDeleteScript}
              isReelGenerating={isReelGenerating}
              apiBaseUrl={API_BASE_URL}
              refreshLists={refreshLists}
            />
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <FileList
              title="Ready Reels"
              data={reels}
              isLoading={isReelsLoading}
              isContentList={false}
              showPreviewModal={showPreviewModal}
              handleDeleteReel={handleDeleteReel}
              isReelGenerating={isReelGenerating}
              apiBaseUrl={API_BASE_URL}
              refreshLists={refreshLists}
            />
          </div>
        </section>

        {/* Column 3: Activity Log (Right) */}
        <section className="w-[30%] flex flex-col min-h-0 overflow-hidden">
          <LogSection
            logMessages={logMessages}
            refreshLists={refreshLists}
          />
        </section>
      </main>

      <VideoModals {...videoModalsProps} />
    </div>
  );
}
