"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { FileList } from "@/components/lists/FileList";
import VideoModals, { VideoModalsProps } from "@/components/modals/VideoModals";
import ConfirmationModal from "@/components/modals/ConfirmationModal";
import { AddCharacterModal } from "@/components/modals/AddCharacterModal";
import { AddPromptModal } from "@/components/modals/AddPromptModal";
import { BatchGenerator } from "@/components/generator/BatchGenerator";
import {
  FeedSection,
  RSSVideo,
  FeedSectionProps,
} from "@/components/generator/FeedSection";
import { EditChannelsModal } from "@/components/modals/EditChannelsModal";
import { GenerateContentForm } from "@/components/generator/GenerateContentForm";
import { ReelGenerationSection } from "@/components/generator/ReelGenerationSection";
import { useLogStream } from "@/hooks/useLogStream";
import { Header } from "@/components/ui/Header";
import { LogSection } from "@/components/ui/LogSection";
import {
  fetchConfig,
  fetchData,
  postData,
  API_BASE_URL,
} from "@/lib/constants";
import { useThemeManager } from "@/hooks/useThemeManager";
import { ConfigData, ContentItem, ReelItem, LogType } from "@/types";
import { Edit } from "lucide-react";

// --- Types (exported for use by other components) ---
export type { LogType, ContentItem };

// --- Helper for sanitizing filename ---
const sanitizeFileName = (name: string) =>
  name.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();

// --- Main Component ---
export default function Page() {
  const { isDark, toggleTheme } = useThemeManager();

  // State initialization
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [reels, setReels] = useState<ReelItem[]>([]);
  const [contents, setContents] = useState<ContentItem[]>([]);
  const { logMessages } = useLogStream(API_BASE_URL);

  const [charA, setCharA] = useState("");
  const [charB, setCharB] = useState("");
  const [audioMode, setAudioMode] = useState("");
  const [llmProvider, setLlmProvider] = useState("");
  const [promptPath, setPromptPath] = useState("");
  const [query, setQuery] = useState("");
  const [fileName, setFileName] = useState("");
  const [language, setLanguage] = useState("en");
  const [sessionCount, setSessionCount] = useState(0);
  const [contentStatus, setContentStatus] = useState("");
  const [reelStatus, setReelStatus] = useState("");
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState("studio"); // Mobile tab navigation

  const [isConfigLoading, setIsConfigLoading] = useState(false);
  const [isReelsLoading, setIsReelsLoading] = useState(false);
  const [isContentsLoading, setIsContentsLoading] = useState(false);
  const [isContentGenerating, setIsContentGenerating] = useState(false);
  const [isReelGenerating, setIsReelGenerating] = useState(false);
  const [isDialogueSaving, setIsDialogueSaving] = useState(false);
  const [pipAsset, setPipAsset] = useState<string | null>(null);
  const [isPipUploading, setIsPipUploading] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [currentJob, setCurrentJob] = useState<string | undefined>();

  // Modal State
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [isDialogueModalOpen, setIsDialogueModalOpen] = useState(false);
  const [dialogueContent, setDialogueContent] = useState("");
  const [dialogueFileName, setDialogueFileName] = useState("");
  const [isCaptionModalOpen, setIsCaptionModalOpen] = useState(false);
  const [captionContent, setCaptionContent] = useState("");
  const [captionFileName, setCaptionFileName] = useState("");

  // New Feature Modals
  const [isAddCharacterModalOpen, setIsAddCharacterModalOpen] = useState(false);
  const [isAddPromptModalOpen, setIsAddPromptModalOpen] = useState(false);
  const [isEditChannelsModalOpen, setIsEditChannelsModalOpen] = useState(false);
  const [isLogVisible, setIsLogVisible] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDanger?: boolean;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
    isDanger: false,
  });

  const log = useCallback((message: string, type: LogType = "info") => {
    console.log(`[${type}] ${message}`);
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
      setLlmProvider(
        data.current_llm_provider || Object.keys(data.llm_providers)[0] || "",
      );

      // Default to blinked_thrice.txt if available, otherwise first prompt
      const defaultPrompt =
        promptKeys.find((key) => key.includes("blinked_thrice.txt")) ||
        promptKeys[0] ||
        "";
      setPromptPath(defaultPrompt);

      // Set default language from config
      if (data.languages && data.languages.length > 0) {
        setLanguage(data.languages[0].code);
      }

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
      const reelsData = await fetchData<{ reels: ReelItem[] }>(
        "/api/data/reels",
      );
      setReels(reelsData.reels);
      setIsReelsLoading(false);

      setIsContentsLoading(true);
      const contentData = await fetchData<{ contents: ContentItem[] }>(
        "/api/data/contents",
      );
      setContents(contentData.contents);
      setIsContentsLoading(false);

      log("Reel and Content lists refreshed.", "success");
    } catch (err: any) {
      log(`Failed to refresh lists: ${err.message}`, "error");
    }
  }, [log]);

  const fetchPipAsset = useCallback(async () => {
    try {
      const data = await fetchData<{
        filename: string | null;
        exists: boolean;
      }>("/api/data/pip-asset");
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

  // Handle Progress Parsing from Logs
  useEffect(() => {
    if (logMessages.length === 0) return;
    const lastLog = logMessages[logMessages.length - 1].message;
    if (lastLog.startsWith("PROGRESS:")) {
      const parts = lastLog.split(":");
      const progress = parseInt(parts[1]);
      const filename = parts[2];

      if (!isNaN(progress)) {
        setGenerationProgress(progress);
        if (filename) setCurrentJob(filename);
      }
    }
  }, [logMessages]);

  useEffect(() => {
    if (!isReelGenerating && !isContentGenerating) {
      setTimeout(() => {
        setGenerationProgress(0);
        setCurrentJob(undefined);
      }, 2000);
    }
  }, [isReelGenerating, isContentGenerating]);

  // SSE Logs are now handled by useLogStream hook

  const isConfigValid = useMemo(
    () =>
      !!charA &&
      !!charB &&
      !!audioMode &&
      !!promptPath &&
      query.trim().length > 0 &&
      !!fileName.trim() &&
      charA !== charB,
    [charA, charB, audioMode, promptPath, query, fileName],
  );

  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setQuery(e.target.value);
    },
    [],
  );

  const handleFileNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFileName(e.target.value);
    },
    [],
  );

  // --- Handlers ---
  const handleContentGeneration = useCallback(
    async (e: React.FormEvent) => {
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
          file_name: sanitizedFileName,
          llm_provider: llmProvider,
          language,
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
    },
    [
      charA,
      charB,
      promptPath,
      query,
      fileName,
      llmProvider,
      log,
      isConfigValid,
      refreshLists,
    ],
  );

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
      const errorMsg = err.message || "API call failed.";
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
      const errorMsg = err.message || "API call failed.";
      setReelStatus("❌ " + errorMsg);
      log(errorMsg, "error");
    } finally {
      setIsReelGenerating(false);
    }
  };

  const handleSingleReelGeneration = async (filename: string) => {
    const endpoint = "/api/generate-reel/single";

    if (isReelGenerating || !audioMode) {
      log(
        "Cannot generate: either already generating or no audio mode selected.",
        "warn",
      );
      return;
    }
    setIsReelGenerating(true);
    setReelStatus(`Processing ${filename}...`);
    log(`Generating reel for ${filename}...`, "info");
    try {
      const result = await postData(endpoint, {
        filename,
        audio_mode: audioMode,
      });
      setReelStatus("✅ " + result.message);
      log(result.message, "success");
      refreshLists();
    } catch (err: any) {
      const errorMsg = err.message || "API call failed.";
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
    setConfirmModal({
      isOpen: true,
      title: "Delete Script",
      message: `Are you sure you want to delete script "${filename}"? This cannot be undone.`,
      isDanger: true,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        log(`Deleting script: ${filename}...`, "info");
        try {
          const response = await fetch(
            `${API_BASE_URL}/api/delete-script/${filename}`,
            { method: "DELETE" },
          );
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
      },
    });
  };

  const handleDeleteReel = async (filename: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Reel",
      message: `Are you sure you want to delete reel "${filename}"? This cannot be undone.`,
      isDanger: true,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        log(`Deleting reel: ${filename}...`, "info");
        try {
          const response = await fetch(
            `${API_BASE_URL}/api/delete-reel/${filename}`,
            { method: "DELETE" },
          );
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
      },
    });
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
      log(
        `Successfully saved changes to ${dialogueFileName}: ${result.message}`,
        "success",
      );
      refreshLists();
      hideDialogueModal();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log(`Failed to save dialogue: ${message}`, "error");
    } finally {
      setIsDialogueSaving(false);
    }
  };

  const handleCaptionGeneration = async (contentFileName: string) => {
    log(`Requesting caption for ${contentFileName}...`, "info");
    setCaptionFileName(contentFileName);
    setCaptionContent("Generating caption...");
    setIsCaptionModalOpen(true);

    try {
      const result = await postData(
        `/api/generate-caption/${contentFileName}`,
        {},
      );

      if (result && result.caption) {
        setCaptionContent(result.caption);
        log(
          `Caption successfully generated for ${contentFileName}.`,
          "success",
        );
      } else {
        const errorMsg = result.error || "API failed to generate caption.";
        setCaptionContent(`Error: ${errorMsg}`);
        log(
          `Caption generation failed for ${contentFileName}: ${errorMsg}`,
          "error",
        );
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Network error.";
      setCaptionContent(`Error: ${errorMsg}`);
      log(
        `Caption generation failed for ${contentFileName}: ${errorMsg}`,
        "error",
      );
    }
  };

  // --- Modal Handlers ---
  const showPreviewModal = (url: string) => {
    setPreviewUrl(url);
    setIsPreviewModalOpen(true);
  };

  const hidePreviewModal = () => {
    setIsPreviewModalOpen(false);
    setPreviewUrl("");
  };

  const showDialogueModal = (item: ContentItem) => {
    setDialogueFileName(item.name);
    const formattedDialogue = item.dialogues
      .map((d) => `${d.speaker.toUpperCase()}: ${d.dialogue}`)
      .join("\n\n");
    const content = `// Content Query: ${item.query}\n// File Path: ${item.path}\n// ----------------------------------\n\n${formattedDialogue}`;
    setDialogueContent(content);
    setIsDialogueModalOpen(true);
  };

  const hideDialogueModal = () => {
    setIsDialogueModalOpen(false);
    setDialogueContent("");
    setDialogueFileName("");
  };

  const hideCaptionModal = () => {
    setIsCaptionModalOpen(false);
    setCaptionContent("");
    setCaptionFileName("");
  };

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
    <div className="transition-colors duration-300 bg-background text-foreground h-screen flex flex-col overflow-hidden">
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
        isLogVisible={isLogVisible}
        toggleLog={() => setIsLogVisible(!isLogVisible)}
        generationProgress={generationProgress}
        currentJob={currentJob}
      />

      {/* Mobile Layout - Tab Content */}
      <main
        className={`flex-1 p-2 md:hidden ${activeTab === "log" ? "overflow-hidden flex flex-col" : "overflow-y-auto"}`}
      >
        {activeTab === "batch" && (
          <div className="animate-fade-in h-[calc(100vh-180px)]">
            <BatchGenerator
              config={config}
              log={log}
              refreshLists={refreshLists}
              API_BASE_URL={API_BASE_URL}
            />
          </div>
        )}
        {activeTab === "feed" && (
          <div className="animate-fade-in h-[calc(100vh-180px)] flex flex-col">
            <div className="flex justify-between items-center mb-2 px-1">
              <h2 className="text-xs font-black uppercase text-muted-foreground tracking-widest">
                Inspiration Feed
              </h2>
              <button
                onClick={() => setIsEditChannelsModalOpen(true)}
                className="text-[10px] font-bold text-primary hover:underline"
              >
                Edit Channels
              </button>
            </div>
            <FeedSection
              onSelectTopic={(video, context) => {
                setQuery(context);
                setFileName(sanitizeFileName(video.title));
                setActiveTab("studio");
                log(`Selected topic from feed: ${video.title}`, "info");
              }}
              log={log}
            />
          </div>
        )}
        {activeTab === "studio" && (
          <div className="space-y-3 animate-fade-in">
            <GenerateContentForm
              config={config}
              charA={charA}
              setCharA={setCharA}
              charB={charB}
              setCharB={setCharB}
              audioMode={audioMode}
              setAudioMode={setAudioMode}
              llmProvider={llmProvider}
              setLlmProvider={setLlmProvider}
              promptPath={promptPath}
              setPromptPath={setPromptPath}
              language={language}
              setLanguage={setLanguage}
              query={query}
              handleQueryChange={handleQueryChange}
              fileName={fileName}
              handleFileNameChange={handleFileNameChange}
              contentStatus={contentStatus}
              isConfigLoading={isConfigLoading}
              isContentGenerating={isContentGenerating}
              isConfigValid={isConfigValid}
              handleContentGeneration={handleContentGeneration}
              onAddCharacter={() => setIsAddCharacterModalOpen(true)}
              onAddPrompt={() => setIsAddPromptModalOpen(true)}
              pipAsset={pipAsset}
              isPipUploading={isPipUploading}
              handlePipUpload={handlePipUpload}
              handleClearPipAsset={handleClearPipAsset}
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
          </div>
        )}
        {activeTab === "files" && (
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
        {activeTab === "log" && (
          <div className="h-full animate-fade-in">
            <LogSection logMessages={logMessages} refreshLists={refreshLists} />
          </div>
        )}
      </main>

      {/* Desktop Layout - 2 Column Grid with Right Sidebar Terminal */}
      <main className="hidden md:flex flex-1 p-3 lg:p-4 gap-3 lg:gap-4 min-h-0 overflow-hidden max-w-[1920px] mx-auto w-full flex-row">
        <div className="flex-1 flex gap-3 lg:gap-4 min-h-0 overflow-hidden">
          {/* Column 1: Studio/Script (Left) */}
          <section className="w-1/2 flex-1 flex flex-col gap-3 min-h-0 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-hidden">
              {activeTab === "batch" ? (
                <BatchGenerator
                  config={config}
                  log={log}
                  refreshLists={refreshLists}
                  API_BASE_URL={API_BASE_URL}
                />
              ) : activeTab === "feed" ? (
                <div className="h-full flex flex-col animate-fade-in">
                  <div className="flex justify-between items-center mb-3">
                    <h2 className="text-sm font-black uppercase text-muted-foreground tracking-widest">
                      Inspiration Feed
                    </h2>
                    <button
                      onClick={() => setIsEditChannelsModalOpen(true)}
                      className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <Edit className="w-3 h-3" />
                      Edit Channels
                    </button>
                  </div>
                  <div className="flex-1 min-h-0 bg-card border border-border rounded-2xl p-4 shadow-sm overflow-hidden">
                    <FeedSection
                      onSelectTopic={(video, context) => {
                        setQuery(context);
                        setFileName(sanitizeFileName(video.title));
                        setActiveTab("studio");
                        log(`Selected topic from feed: ${video.title}`, "info");
                      }}
                      log={log}
                    />
                  </div>
                </div>
              ) : (
                <GenerateContentForm
                  config={config}
                  charA={charA}
                  setCharA={setCharA}
                  charB={charB}
                  setCharB={setCharB}
                  audioMode={audioMode}
                  setAudioMode={setAudioMode}
                  llmProvider={llmProvider}
                  setLlmProvider={setLlmProvider}
                  promptPath={promptPath}
                  setPromptPath={setPromptPath}
                  language={language}
                  setLanguage={setLanguage}
                  query={query}
                  handleQueryChange={handleQueryChange}
                  fileName={fileName}
                  handleFileNameChange={handleFileNameChange}
                  contentStatus={contentStatus}
                  isConfigLoading={isConfigLoading}
                  isContentGenerating={isContentGenerating}
                  isConfigValid={isConfigValid}
                  handleContentGeneration={handleContentGeneration}
                  onAddCharacter={() => setIsAddCharacterModalOpen(true)}
                  onAddPrompt={() => setIsAddPromptModalOpen(true)}
                  pipAsset={pipAsset}
                  isPipUploading={isPipUploading}
                  handlePipUpload={handlePipUpload}
                  handleClearPipAsset={handleClearPipAsset}
                />
              )}
            </div>
            {activeTab !== "batch" && (
              <div className="shrink-0">
                <ReelGenerationSection
                  handleSessionReelGeneration={handleSessionReelGeneration}
                  handleAllReelGeneration={handleAllReelGeneration}
                  isReelGenerating={isReelGenerating}
                  sessionCount={sessionCount}
                  audioMode={audioMode}
                  reelStatus={reelStatus}
                  config={config}
                />
              </div>
            )}
          </section>

          {/* Column 2: File Lists (Right) */}
          <section className="w-1/2 flex-1 flex flex-col gap-3 min-h-0 overflow-hidden">
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
        </div>

        {/* Collapsible Right Sidebar Terminal Section */}
        {isLogVisible && (
          <section className="w-80 lg:w-96 h-full shrink-0 bg-card border border-border rounded-2xl shadow-lg animate-in slide-in-from-right-5 duration-300 overflow-hidden">
            <LogSection
              logMessages={logMessages}
              refreshLists={refreshLists}
              onClose={() => setIsLogVisible(false)}
            />
          </section>
        )}
      </main>

      <VideoModals {...videoModalsProps} />

      <AddCharacterModal
        isOpen={isAddCharacterModalOpen}
        onClose={() => setIsAddCharacterModalOpen(false)}
        onSuccess={loadConfig}
        log={log}
      />
      <AddPromptModal
        isOpen={isAddPromptModalOpen}
        onClose={() => setIsAddPromptModalOpen(false)}
        onSuccess={loadConfig}
        log={log}
      />
      <EditChannelsModal
        isOpen={isEditChannelsModalOpen}
        onClose={() => setIsEditChannelsModalOpen(false)}
        log={log}
      />
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        isDanger={confirmModal.isDanger}
        confirmText="Delete"
      />
    </div>
  );
}
