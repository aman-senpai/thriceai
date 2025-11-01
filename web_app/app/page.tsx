"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { FileList } from "@/components/lists/FileList";
import VideoModals, { VideoModalsProps } from "@/components/modals/VideoModals";

const cardClasses = "bg-dark-card p-6 rounded-2xl shadow-xl border border-dark-border/50";
const selectOrInputClasses = "w-full p-3 rounded-lg bg-dark-bg border border-dark-border focus:ring-primary-blue focus:border-primary-blue transition text-gray-200";
const primaryButtonClasses = "w-full py-3 bg-primary-blue text-white font-bold rounded-lg hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.01]";
const successButtonClasses = "w-full py-3 bg-success-green text-white font-bold rounded-lg hover:bg-green-600 transition disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.01]";
const dangerButtonClasses = "py-2 px-4 bg-danger-red text-white font-bold rounded-lg hover:bg-red-600 transition disabled:opacity-50 disabled:cursor-not-allowed";

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

import { fetchConfig, fetchData, postData } from "@/lib/constants";
import { useThemeManager } from "@/hooks/useThemeManager";

// --- Helper for sanitizing filename (Required for handleContentGeneration and display hint) ---
const sanitizeFileName = (name: string) => name.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();

const API_BASE_URL = typeof window === 'undefined' 
  ? 'http://localhost:8000' 
  : `http://${window.location.hostname}:8000`;

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

const GenerateButton = ({ children, onClick, disabled, className, isSubmit=false }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; className?: string, isSubmit?: boolean }) => (
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
}

const Header = ({ refreshLists, isReelGenerating, isContentGenerating, isReelsLoading, isContentsLoading }: HeaderProps) => (
    <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b-2 border-primary-blue/30 pb-4 mb-8">
        <h1 className="text-3xl font-extrabold text-primary-blue">
            <i className="fas fa-film mr-3"></i> Reel Generator
        </h1>
        <div className="mt-4 sm:mt-0 flex items-center space-x-3">
            <button
                onClick={refreshLists}
                disabled={isReelGenerating || isContentGenerating}
                className="p-3 rounded-full bg-dark-card hover:bg-dark-border transition text-gray-400 hover:text-primary-blue"
                title="Refresh Lists"
            >
                <i className={`fas fa-sync text-lg ${isReelsLoading || isContentsLoading ? "animate-spin" : ""}`}></i>
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
  
  const handleCharAChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => setCharA(e.target.value), [setCharA]);
  const handleCharBChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => setCharB(e.target.value), [setCharB]);
  const handleAudioModeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => setAudioMode(e.target.value), [setAudioMode]);
  const handlePromptPathChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => setPromptPath(e.target.value), [setPromptPath]);

  return (
      <div id="config-section" className={cardClasses}>
          <h2 className="text-2xl font-bold mb-6 text-primary-blue"><i className="fas fa-solid fa-feather"></i> Generate Dialogue Content</h2>
          <form onSubmit={handleContentGeneration} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                      <label className="block text-sm font-medium mb-1">Character A</label>
                      <select value={charA} onChange={handleCharAChange} className={selectOrInputClasses} disabled={isConfigLoading || isContentGenerating} id="char_a_name">
                          {config && Object.entries(config.characters).map(([key, obj]) => (
                              <option key={key} value={key}>{`${key.toUpperCase()} — ${obj.voice_gemini || obj.voice_eleven || obj.voice_mac || 'N/A'}`}</option>
                          ))}
                      </select>
                  </div>
                  <div>
                      <label className="block text-sm font-medium mb-1">Character B</label>
                      <select value={charB} onChange={handleCharBChange} className={selectOrInputClasses} disabled={isConfigLoading || isContentGenerating} id="char_b_name">
                          {config && Object.entries(config.characters).map(([key, obj]) => (
                              <option key={key} value={key}>{`${key.toUpperCase()} — ${obj.voice_gemini || obj.voice_eleven || obj.voice_mac || 'N/A'}`}</option>
                          ))}
                      </select>
                      {charA === charB && charA && <p className="text-danger-red text-xs mt-1">Characters must be different.</p>}
                  </div>
              </div>
              <div>
                  <label className="block text-sm font-medium mb-1">Audio Mode</label>
                  <select value={audioMode} onChange={handleAudioModeChange} className={selectOrInputClasses} disabled={isConfigLoading || isContentGenerating} id="audio_mode">
                       {config && Object.entries(config.audio_modes).map(([key, name]) => (<option key={key} value={key}>{name}</option>))}
                  </select>
              </div>
              <div>
                  <label className="block text-sm font-medium mb-1">Prompt Template</label>
                  <select value={promptPath} onChange={handlePromptPathChange} className={selectOrInputClasses} disabled={isConfigLoading || isContentGenerating} id="selected_prompt_path">
                      {config && Object.entries(config.prompts).map(([path, name]) => (<option key={path} value={path}>{name}</option>))}
                  </select>
              </div>
              <div>
                  <label className="block text-sm font-medium mb-1">Query/Topic for Content</label>
                  <input type="text" value={query} onChange={handleQueryChange} maxLength={config?.max_query_length || 200} placeholder="e.g., 'A funny debate about pineapples on pizza'" className={selectOrInputClasses} disabled={isConfigLoading || isContentGenerating} id="query_input" />
              </div>
              <div>
                  <label className="block text-sm font-medium mb-1">Output Filename (e.g., debate_pizza)</label>
                  <input type="text" value={fileName} onChange={handleFileNameChange} placeholder="file_name (omit extension)" className={selectOrInputClasses} disabled={isConfigLoading || isContentGenerating} id="file_name_input" />
                  {fileName && sanitizeFileName(fileName) !== fileName.toLowerCase() && (
                      <p className="text-warning-yellow text-xs mt-1">Filename will be sanitized to: <strong>{sanitizeFileName(fileName)}</strong></p>
                  )}
              </div>
              <GenerateButton onClick={() => {}} disabled={!isConfigValid || isContentGenerating || isConfigLoading} isSubmit={true} className="flex justify-center items-center">
                  {isContentGenerating ? (<><i className="fas fa-spinner fa-spin mr-2"></i> Generating...</>) : (<span id="generate-content-btn">Generate Content</span>)}
              </GenerateButton>
              <p id="content-status" className="mt-4 text-sm text-center text-gray-400">{contentStatus}</p>
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
}

const ReelGenerationSection = ({ handleSessionReelGeneration, handleAllReelGeneration, isReelGenerating, sessionCount, audioMode, reelStatus, config }: ReelGenerationSectionProps) => (
    <div className={cardClasses}>
        <h2 className="text-2xl font-bold mb-6 text-primary-blue"><i className="fas fa-regular fa-video"></i> Generate Video Reels</h2>
        <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
            <GenerateButton onClick={handleSessionReelGeneration} disabled={isReelGenerating || sessionCount <= 0 || !audioMode} className="flex-1">
                {isReelGenerating && sessionCount > 0 ? <i className="fas fa-spinner fa-spin mr-2"></i> : null}
                <span id="generate-session-reels-btn">Generate Session Reels (<span id="session-count">{sessionCount}</span>)</span>
            </GenerateButton>
            <GenerateButton onClick={handleAllReelGeneration} disabled={isReelGenerating || !audioMode} className={`flex-1 ${successButtonClasses}`}>
                {isReelGenerating && sessionCount === 0 ? <i className="fas fa-spinner fa-spin mr-2"></i> : null}
                <span id="generate-all-reels-btn">Generate ALL Reels</span>
            </GenerateButton>
        </div>
        <p id="reel-status" className="mt-4 text-sm text-center text-gray-400">
            {reelStatus || `Remaining files in current session: ${sessionCount}. Selected audio mode: ${config?.audio_modes[audioMode] || 'None'}`}
        </p>
    </div>
);

const logColorClasses: Record<LogType, string> = {
  info: "text-primary-blue",
  error: "text-danger-red",
  warn: "text-warning-yellow",
  success: "text-success-green",
};

interface LogSectionProps {
  logMessages: LogMessage[];
  refreshLists: () => void;
}

const LogSection = ({ logMessages, refreshLists }: LogSectionProps) => (
    <div className={cardClasses}>
        <h2 className="text-2xl font-bold mb-4 text-primary-blue flex justify-between items-center">
            <i className="fas fa-solid fa-terminal"></i>
            <button onClick={refreshLists} id="refresh-all-btn" className="text-gray-400 hover:text-primary-blue transition">
                 <i className="fas fa-sync"></i>
            </button>
        </h2>
        <pre id="log-output" className="h-64 overflow-y-auto font-mono text-sm bg-dark-bg/50 p-3 rounded-lg border border-dark-border custom-scrollbar">
            {logMessages.map((log, idx) => (
                <div key={idx} className={`${logColorClasses[log.type]} whitespace-pre-wrap`}>
                    <span className="text-gray-500">[{log.timestamp}]</span> {log.message}
                </div>
            ))}
        </pre>
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

  useEffect(() => {
    loadConfig();
    setMounted(true);
    refreshLists();
  }, [loadConfig, refreshLists]);

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
      <div className="transition-colors duration-600 bg-gray-950 text-green-200 min-h-screen"> 
          <div className="max-w-7xl mx-auto p-4 md:p-10">
              <Header 
                refreshLists={refreshLists}
                isReelGenerating={isReelGenerating}
                isContentGenerating={isContentGenerating}
                isReelsLoading={isReelsLoading}
                isContentsLoading={isContentsLoading}
              />

              <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                  <section className="lg:col-span-2 space-y-8">
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
                      />
                      <LogSection 
                        logMessages={logMessages}
                        refreshLists={refreshLists}
                      />
                  </section>

                  <section className="lg:col-span-1 space-y-8">
                      <FileList
                          title="Generated Reels"
                          data={reels}
                          isLoading={isReelsLoading}
                          isContentList={false}
                          showPreviewModal={showPreviewModal}
                          apiBaseUrl={API_BASE_URL}
                          refreshLists={refreshLists}
                      />
                      <FileList
                          title="Generated Content"
                          data={contents}
                          isLoading={isContentsLoading}
                          isContentList={true}
                          showDialogueModal={showDialogueModal}
                          handleCaptionGeneration={handleCaptionGeneration}
                          apiBaseUrl={API_BASE_URL}
                          refreshLists={refreshLists}
                      />
                  </section>
              </main>
          </div>

          <VideoModals {...videoModalsProps} />
      </div>
  );
}
