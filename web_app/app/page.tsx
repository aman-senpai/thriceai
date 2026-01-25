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
}

const Header = ({ refreshLists, isReelGenerating, isContentGenerating, isReelsLoading, isContentsLoading, isDark, toggleTheme }: HeaderProps) => (
  <header className="flex justify-between items-center mb-2 px-1 shrink-0">
    <div className="flex items-center gap-3">
      <h1 className="text-xl font-black tracking-tight text-zinc-900 dark:text-white">
        Reel Generator
      </h1>
      <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-700"></div>
      <p className="text-xs text-zinc-500 font-medium hidden sm:block">Create engaging conversations in seconds.</p>
    </div>
    <div className="flex items-center gap-2">
      <button
        onClick={toggleTheme}
        className="p-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition shadow-sm"
        title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      >
        <i className={`fas ${isDark ? "fa-sun" : "fa-moon"} text-sm`}></i>
      </button>
      <button
        onClick={refreshLists}
        disabled={isReelGenerating || isContentGenerating}
        className="p-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition shadow-sm"
        title="Refresh Lists"
      >
        <i className={`fas fa-sync text-sm ${isReelsLoading || isContentsLoading ? "animate-spin" : ""}`}></i>
      </button>
    </div>
  </header>
);
interface GenerateContentFormProps {
  config: ConfigData | null;
  charA: string; setCharA: React.Dispatch<React.SetStateAction<string>>;
  charB: string; setCharB: React.Dispatch<React.SetStateAction<string>>;
  audioMode: string; setAudioMode: React.Dispatch<React.SetStateAction<string>>;
  promptPath: string; setPromptPath: React.Dispatch<React.SetStateAction<string>>;
  query: string;
  handleQueryChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileName: string;
  handleFileNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  contentStatus: string;
  isConfigLoading: boolean;
  isContentGenerating: boolean;
  isConfigValid: boolean;
  handleContentGeneration: (e: React.FormEvent) => Promise<void>;
}

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



  // Helper for Character Cards
  const CharacterGrid = ({ label, selected, onSelect, exclude }: { label: string, selected: string, onSelect: (v: string) => void, exclude?: string }) => (
    <div className="space-y-3">
      <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest px-1 flex justify-between">
        {selected && <span className="text-zinc-900 dark:text-white font-black">{selected}</span>}
      </label>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 p-1">
        {config && Object.entries(config.characters).map(([key, char]) => {
          const isSelected = selected === key;
          const isExcluded = exclude === key;
          const styles = isSelected
            ? "ring-2 ring-zinc-900 dark:ring-white scale-[1.02] shadow-lg opacity-100"
            : "opacity-60 hover:opacity-100 hover:scale-[1.02] grayscale hover:grayscale-0";

          if (isExcluded) return null;

          return (
            <div
              key={key}
              onClick={() => (!isExcluded && !isContentGenerating) && onSelect(key)}
              className={`relative cursor-pointer rounded-xl overflow-hidden aspect-square transition-all duration-300 group ${styles} ${isExcluded ? "hidden" : ""}`}
            >
              <img
                src={char.avatar.startsWith('http') ? char.avatar : `${API_BASE_URL}${char.avatar}`}
                alt={key}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                loading="lazy"
                onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${key}&background=random`; }}
              />

              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-3 flex flex-col justify-end">
                <p className="text-white font-bold text-lg leading-none tracking-tight">{key}</p>
                <p className="text-zinc-300 text-[10px] uppercase tracking-wider font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                  {config.characters[key]?.voice_gemini || "AI Voice"}
                </p>
              </div>

              {isSelected && (
                <div className="absolute top-2 right-2 w-6 h-6 bg-white dark:bg-zinc-900 rounded-full flex items-center justify-center shadow-sm">
                  <i className="fas fa-check text-xs text-zinc-900 dark:text-white"></i>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div id="config-section" className={cardClasses + " p-6 flex flex-col h-full"}>
      <div className="flex items-center gap-3 mb-6 shrink-0">
        <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
          <i className="fas fa-feather text-zinc-900 dark:text-white"></i>
        </div>
        <div>
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Studio/Script</h2>
          <p className="text-[10px] text-zinc-500">Choose actors & generate dialogue</p>
        </div>
      </div>

      <form onSubmit={handleContentGeneration} className="space-y-4 flex-1 flex flex-col overflow-hidden">

        {/* Form Inputs & Button (Moved to Top) */}
        <div className="shrink-0 space-y-2">
          <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl p-3 border border-zinc-100 dark:border-zinc-800/50 space-y-2">
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Prompt Template</label>
              <div className="flex flex-wrap gap-1.5">
                {config && Object.entries(config.prompts).map(([path, name]) => {
                  const isSelected = promptPath === path;
                  const displayName = name.replace(/\.[^/.]+$/, ""); // Drop file extension

                  return (
                    <button
                      key={path}
                      type="button"
                      onClick={() => setPromptPath(path)}
                      disabled={isConfigLoading || isContentGenerating}
                      className={`px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold transition-all duration-200 border ${isSelected
                        ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 border-zinc-900 dark:border-white shadow-sm transform scale-105"
                        : "bg-white dark:bg-zinc-950 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-200"
                        }`}
                    >
                      {displayName}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Topic / Query</label>
              <textarea
                value={query}
                onChange={(e) => handleQueryChange(e as any)}
                placeholder="e.g. 'Philosophy of Java vs Python'"
                className={selectOrInputClasses + " resize-none min-h-[60px] text-sm py-2"}
                disabled={isConfigLoading || isContentGenerating}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Filename</label>
                <input type="text" value={fileName} onChange={handleFileNameChange} placeholder="video_topic" className={selectOrInputClasses + " text-sm py-1.5"} disabled={isConfigLoading || isContentGenerating} />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Audio Mode</label>
                <div className="flex flex-wrap gap-1.5">
                  {config && Object.keys(config.audio_modes).map((mode) => {
                    const isSelected = audioMode === mode;
                    const displayName = mode.replace(/_/g, ' ');

                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setAudioMode(mode)}
                        disabled={isConfigLoading || isContentGenerating}
                        className={`px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold transition-all duration-200 border capitalize ${isSelected
                          ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 border-zinc-900 dark:border-white shadow-sm transform scale-105"
                          : "bg-white dark:bg-zinc-950 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-200"
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
            <GenerateButton onClick={() => { }} disabled={!isConfigValid || isContentGenerating || isConfigLoading} isSubmit={true} className={primaryButtonClasses + " w-full py-2 text-xs shadow-sm"}>
              {isContentGenerating ? (<><i className="fas fa-spinner fa-spin mr-2"></i> Generating...</>) : ("Generate Content")}
            </GenerateButton>
            {contentStatus && (
              <div className="mt-2 p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-center text-xs font-medium text-zinc-600 dark:text-zinc-300 animate-fade-in">
                {contentStatus}
              </div>
            )}
          </div>
        </div>

        {/* Character Selection Grid (Moved to Bottom & Scrollable) */}
        <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 pr-1 space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/50">
          <CharacterGrid label="Speaker 1" selected={charA} onSelect={setCharA} exclude={charB} />
          <div className="flex items-center gap-4 opacity-50">
            <div className="h-px bg-zinc-200 dark:bg-zinc-800 flex-1"></div>
            <span className="text-[10px] font-black text-zinc-300 uppercase">VS</span>
            <div className="h-px bg-zinc-200 dark:bg-zinc-800 flex-1"></div>
          </div>
          <CharacterGrid label="Speaker 2" selected={charB} onSelect={setCharB} exclude={charA} />
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
  <div className={cardClasses + " p-4 space-y-4"}>
    <div className="flex items-center justify-between">
      <h2 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
        <i className="fas fa-video text-zinc-400"></i>
        Build Reels
      </h2>
      {reelStatus && (
        <span className="text-[10px] font-medium px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-300">
          {reelStatus}
        </span>
      )}
    </div>

    {/* PIP Asset Upload Section */}
    <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl p-3 border border-zinc-100 dark:border-zinc-800/50">
      <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">PIP Asset (Optional)</label>
      {pipAsset ? (
        <div className="flex items-center justify-between bg-white dark:bg-zinc-900 p-2 rounded-lg border border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2 min-w-0">
            <i className="fas fa-file-image text-zinc-400"></i>
            <span className="text-xs font-medium truncate text-zinc-700 dark:text-zinc-300">{pipAsset}</span>
          </div>
          <button
            onClick={handleClearPipAsset}
            className="text-zinc-400 hover:text-rose-500 p-1"
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
          <div className="border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg p-3 text-center group-hover:border-zinc-300 dark:group-hover:border-zinc-700 transition-colors">
            {isPipUploading ? (
              <i className="fas fa-spinner fa-spin text-zinc-400"></i>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <i className="fas fa-cloud-upload-alt text-zinc-400"></i>
                <span className="text-[10px] font-medium text-zinc-500">Click or drag to upload PIP</span>
              </div>
            )}
          </div>
        </div>
      )}
      <p className="text-[9px] text-zinc-500 mt-1.5 leading-tight italic">
        * PIP will be placed above captions.
      </p>
    </div>

    <div className="flex gap-2">
      <GenerateButton onClick={handleSessionReelGeneration} disabled={isReelGenerating || sessionCount <= 0 || !audioMode} className="flex-1 text-xs py-1.5">
        {isReelGenerating && sessionCount > 0 ? <i className="fas fa-spinner fa-spin mr-2"></i> : null}
        <span id="generate-session-reels-btn">Session ({sessionCount})</span>
      </GenerateButton>
      <GenerateButton onClick={handleAllReelGeneration} disabled={isReelGenerating || !audioMode} className={`flex-1 text-xs py-1.5 ${successButtonClasses}`}>
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
  <div className={cardClasses + " p-3 h-full flex flex-col"}>
    <div className="flex justify-between items-center mb-2 shrink-0">
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
          <i className="fas fa-terminal text-zinc-500 text-xs"></i>
        </div>
        <h2 className="text-xs font-bold text-zinc-900 dark:text-white">Activity Log</h2>
      </div>
      <button onClick={refreshLists} className="p-1 px-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition rounded hover:bg-zinc-100 dark:hover:bg-zinc-800">
        <i className="fas fa-sync text-xs"></i>
      </button>
    </div>
    <div className="flex-1 overflow-y-auto custom-scrollbar font-mono text-[10px] p-2 bg-zinc-50 dark:bg-zinc-950/50 rounded-lg border border-zinc-100 dark:border-zinc-800/50 space-y-1 shadow-inner h-0 min-h-0">
      {logMessages.length === 0 && <span className="text-zinc-400 italic">System ready...</span>}
      {[...logMessages].reverse().map((log, idx) => (
        <div key={idx} className="flex gap-2 leading-tight">
          <span className="text-zinc-300 dark:text-zinc-700 shrink-0 select-none">{log.timestamp}</span>
          <span className={`${log.type === 'error' ? 'text-rose-500 font-bold' :
            log.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' :
              log.type === 'warn' ? 'text-amber-500' : 'text-zinc-600 dark:text-zinc-400'
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
      setPromptPath(promptKeys[0] || "");

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

  const handleQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
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
    } catch (err: any) {
      log(`Failed to save dialogue: ${err.message}`, "error");
      alert(`Failed to save: ${err.message}`);
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
    } catch (err: any) {
      const errorMsg = err.message || 'Network error.';
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
    <div className="transition-colors duration-600 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-200 min-h-screen flex flex-col md:h-screen md:overflow-hidden">
      <div className="flex-1 w-full max-w-[1920px] mx-auto p-2 flex flex-col h-full overflow-hidden">
        <Header
          refreshLists={refreshLists}
          isReelGenerating={isReelGenerating}
          isContentGenerating={isContentGenerating}
          isReelsLoading={isReelsLoading}
          isContentsLoading={isContentsLoading}
          isDark={isDark}
          toggleTheme={toggleTheme}
        />

        <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0 overflow-y-auto md:overflow-hidden">

          <section className="lg:col-span-6 flex flex-col gap-4 min-h-0 md:h-full">
            <div className="flex-1 min-h-0 flex flex-col">
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
            {/* Build Reels (Fixed at Bottom of Left Col) */}
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

          {/* Column 2: Logs & Output (Right) */}
          <section className="lg:col-span-6 flex flex-col gap-4 min-h-0 md:h-full">

            {/* Row 1: Activity Log (Fixed Height) */}
            <div className="h-[120px] shrink-0">
              <LogSection
                logMessages={logMessages}
                refreshLists={refreshLists}
              />
            </div>

            {/* Row 2: Generated Scripts & Ready Reels (Split or Grid, Filling Remaining Height) */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2 min-h-0 h-full overflow-hidden">
              <div className="min-h-0 h-full overflow-hidden flex flex-col">
                <FileList
                  title="Generated Scripts"
                  data={contents}
                  isLoading={isContentsLoading}
                  isContentList={true}
                  showDialogueModal={showDialogueModal}
                  handleCaptionGeneration={handleCaptionGeneration}
                  apiBaseUrl={API_BASE_URL}
                  refreshLists={refreshLists}
                />
              </div>
              <div className="min-h-0 h-full overflow-hidden flex flex-col">
                <FileList
                  title="Ready Reels"
                  data={reels}
                  isLoading={isReelsLoading}
                  isContentList={false}
                  showPreviewModal={showPreviewModal}
                  apiBaseUrl={API_BASE_URL}
                  refreshLists={refreshLists}
                />
              </div>
            </div>
          </section>

        </main>
      </div>

      <VideoModals {...videoModalsProps} />
    </div>
  );
}
