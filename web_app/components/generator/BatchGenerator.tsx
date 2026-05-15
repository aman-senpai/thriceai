"use client";

import React, { useState } from "react";
import { postJson } from "@/lib/constants";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Clapperboard,
  Plus,
  Code,
  Keyboard,
  Sparkles,
  Volume2,
  Feather,
  Film,
  Trash2,
  Paperclip,
  ChevronDown,
  User,
  LoaderCircle,
  Wand2,
} from "lucide-react";

interface BatchJob {
  id: string;
  topic: string;
  file_name: string;
  character_a: string;
  character_b: string;
  prompt_filename: string;
  pip_asset: string | null;
  status: "idle" | "processing" | "success" | "failed";
  error?: string;
}

interface BatchGeneratorProps {
  config: any;
  log: (message: string, type?: "info" | "error" | "warn" | "success") => void;
  refreshLists: () => void;
  API_BASE_URL: string;
}

export const BatchGenerator: React.FC<BatchGeneratorProps> = ({
  config,
  log,
  refreshLists,
  API_BASE_URL,
}) => {
  const [jobs, setJobs] = useState<BatchJob[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioMode, setAudioMode] = useState("");
  const [llmProvider, setLlmProvider] = useState("");
  const [jsonInput, setJsonInput] = useState("");
  const [isJsonInputVisible, setIsJsonInputVisible] = useState(false);

  // Initialize audio mode and llm provider from config
  React.useEffect(() => {
    if (config?.audio_modes && !audioMode) {
      setAudioMode(Object.keys(config.audio_modes)[0] || "");
    }
    if (config?.llm_providers && !llmProvider) {
      setLlmProvider(
        config.current_llm_provider ||
          Object.keys(config.llm_providers)[0] ||
          "",
      );
    }
  }, [config, audioMode, llmProvider]);

  const addJob = () => {
    const charKeys = Object.keys(config?.characters || {});
    const promptKeys = Object.keys(config?.prompts || {});

    const newJob: BatchJob = {
      id: Math.random().toString(36).substr(2, 9),
      topic: "",
      file_name: "",
      character_a: charKeys[0] || "",
      character_b: charKeys[1] || "",
      prompt_filename: promptKeys[0] || "",
      pip_asset: null,
      status: "idle",
    };
    setJobs([...jobs, newJob]);
  };

  const handleAddFromJson = () => {
    if (!jsonInput.trim()) return;

    try {
      const json = JSON.parse(jsonInput);
      if (!Array.isArray(json)) {
        throw new Error("JSON must be an array of jobs.");
      }

      const charKeys = Object.keys(config?.characters || {});
      const promptKeys = Object.keys(config?.prompts || {});

      const newJobs = json.map((item: any) => {
        // Map filename to path if necessary
        let promptPath = item.prompt_filename || "";
        if (promptPath && config?.prompts && !config.prompts[promptPath]) {
          // Try to find by filename (value) instead of path (key)
          const foundPath = Object.entries(config.prompts).find(
            ([_, name]) => name === promptPath,
          )?.[0];
          if (foundPath) promptPath = foundPath;
        }

        return {
          id: Math.random().toString(36).substr(2, 9),
          topic: item.topic || "",
          file_name: item.file_name || "",
          character_a: item.character_a || charKeys[0] || "",
          character_b: item.character_b || charKeys[1] || "",
          prompt_filename: promptPath || promptKeys[0] || "",
          pip_asset: item.pip_asset || null,
          status: "idle" as "idle",
        };
      });

      setJobs([...jobs, ...newJobs]);
      log(`Successfully loaded ${newJobs.length} jobs from JSON`, "success");
      setJsonInput("");
      setIsJsonInputVisible(false);
    } catch (err: any) {
      log(`Failed to parse JSON: ${err.message}`, "error");
    }
  };

  const removeJob = (id: string) => {
    setJobs(jobs.filter((j) => j.id !== id));
  };

  const updateJob = (id: string, updates: Partial<BatchJob>) => {
    setJobs(jobs.map((j) => (j.id === id ? { ...j, ...updates } : j)));
  };

  const handlePipUpload = async (
    id: string,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`${API_BASE_URL}/api/upload-asset`, {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (response.ok) {
        updateJob(id, { pip_asset: result.filename });
        log(`Asset ${file.name} uploaded for job`, "success");
      } else {
        throw new Error(result.detail || "Upload failed");
      }
    } catch (err: any) {
      log(`Upload failed: ${err.message}`, "error");
    }
  };

  const generateAll = async () => {
    if (jobs.length === 0 || isGenerating) return;

    setIsGenerating(true);
    log(`Starting batch generation for ${jobs.length} jobs...`, "info");

    try {
      const payload = {
        jobs: jobs.map((j) => ({
          topic: j.topic,
          file_name: j.file_name,
          character_a: j.character_a,
          character_b: j.character_b,
          prompt_filename: j.prompt_filename,
          pip_asset: j.pip_asset,
        })),
        audio_mode: audioMode || "default",
        llm_provider: llmProvider || "gemini",
      };

      const result = await postJson("/api/generate-reel/batch", payload);
      log(result.message, "success");

      // Update job statuses based on results if possible
      // For now, just refresh lists
      refreshLists();
    } catch (err: any) {
      log(`Batch generation failed: ${err.message}`, "error");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="border-border shadow-sm h-full flex flex-col">
      <CardHeader className="p-6 pb-0 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl text-primary flex items-center justify-center shrink-0">
              <Clapperboard className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold">
                Batch Generator
              </CardTitle>
              <p className="text-[10px] text-muted-foreground">
                End-to-end video production
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={isJsonInputVisible ? "secondary" : "outline"}
              size="sm"
              className={cn(
                "text-xs font-bold",
                isJsonInputVisible &&
                  "bg-primary/10 border-primary/50 text-primary font-black",
              )}
              onClick={() => setIsJsonInputVisible(!isJsonInputVisible)}
            >
              {isJsonInputVisible ? (
                <>
                  <Keyboard className="h-3.5 w-3.5" /> Paste Mode
                </>
              ) : (
                <>
                  <Code className="h-3.5 w-3.5" /> Bulk Input
                </>
              )}
            </Button>
            <Button size="sm" onClick={addJob}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Video
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col min-h-0 p-6 pt-4 gap-4">
        {/* JSON Input Area */}
        {isJsonInputVisible && (
          <div className="bg-secondary/30 p-4 rounded-xl border border-border/50 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300 shrink-0">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                <Code className="h-3 w-3 inline mr-1.5" />
                Paste JSON Array
              </label>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  const firstChar =
                    Object.keys(config?.characters || {})[0] || "Character A";
                  const secondChar =
                    Object.keys(config?.characters || {})[1] || "Character B";
                  const firstPromptName =
                    (Object.values(config?.prompts || {})[0] as string) ||
                    "template.txt";
                  const example = [
                    {
                      topic: "Benefits of TypeScript",
                      file_name: "typescript_benefits",
                      character_a: firstChar,
                      character_b: secondChar,
                      prompt_filename: firstPromptName,
                      pip_asset: null,
                    },
                  ];
                  setJsonInput(JSON.stringify(example, null, 2));
                }}
                className="text-[10px] text-primary hover:underline font-bold"
              >
                Load Example
              </a>
            </div>
            <Textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder='[ { "topic": "Video 1" }, { "topic": "Video 2" } ]'
              className="h-32 text-xs font-mono"
            />
            <Button
              onClick={handleAddFromJson}
              disabled={!jsonInput.trim()}
              className="w-full text-[10px] font-bold shadow-sm shadow-primary/20"
              size="sm"
            >
              <Sparkles className="h-3 w-3 mr-1.5" />
              Process & Add to Queue
            </Button>
          </div>
        )}

        {/* Audio Mode Selection */}
        <div className="bg-secondary/20 p-4 rounded-xl border border-border/50 shrink-0">
          <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
            <Volume2 className="h-3 w-3 inline mr-1.5" />
            Global Audio Provider
          </label>
          <div className="flex flex-wrap gap-2">
            {config &&
              Object.keys(config.audio_modes).map((mode) => {
                const isSelected = audioMode === mode;
                const displayName = mode.replace(/_/g, " ");

                return (
                  <Button
                    key={mode}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "rounded-full text-[10px] sm:text-xs font-bold capitalize shadow-sm",
                      isSelected && "scale-105",
                    )}
                    onClick={() => setAudioMode(mode)}
                    disabled={isGenerating}
                  >
                    {displayName}
                  </Button>
                );
              })}
          </div>
        </div>

        {/* Script Writer Provider Selection */}
        <div className="bg-secondary/20 p-4 rounded-xl border border-border/50 shrink-0">
          <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
            <Feather className="h-3 w-3 inline mr-1.5" />
            Script Writer Provider
          </label>
          <div className="flex flex-wrap gap-2">
            {config &&
              Object.entries(
                config.llm_providers as Record<string, string>,
              ).map(([key, label]) => {
                const isSelected = llmProvider === key;

                return (
                  <Button
                    key={key}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "rounded-full text-[10px] sm:text-xs font-bold capitalize shadow-sm",
                      isSelected && "scale-105",
                    )}
                    onClick={() => setLlmProvider(key)}
                    disabled={isGenerating}
                  >
                    {label}
                  </Button>
                );
              })}
          </div>
        </div>

        {/* Job List */}
        <ScrollArea className="flex-1 pr-2">
          <div className="space-y-4">
            {jobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-muted/10 rounded-2xl border-2 border-dashed border-border/50">
                <div className="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center mb-4">
                  <Film className="h-6 w-6 opacity-40" />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest opacity-60">
                  No videos in queue
                </p>
              </div>
            ) : (
              jobs.map((job) => (
                <div
                  key={job.id}
                  className="bg-card border border-border rounded-2xl p-5 space-y-4 relative group hover:border-primary/40 transition-all shadow-sm"
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-3 right-3 h-8 w-8 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive hover:text-white opacity-0 group-hover:opacity-100 transition-all z-10"
                    onClick={() => removeJob(job.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">
                        Video Topic
                      </label>
                      <Input
                        type="text"
                        value={job.topic}
                        onChange={(e) =>
                          updateJob(job.id, { topic: e.target.value })
                        }
                        className="!py-2.5 !text-xs !rounded-lg bg-secondary/30"
                        placeholder="What is this video about?"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">
                        Template
                      </label>
                      <Select
                        value={job.prompt_filename}
                        onValueChange={(v) =>
                          updateJob(job.id, { prompt_filename: v })
                        }
                      >
                        <SelectTrigger className="!py-2.5 !text-xs !rounded-lg bg-secondary/30">
                          <SelectValue placeholder="Select template" />
                        </SelectTrigger>
                        <SelectContent>
                          {config &&
                            Object.entries(config.prompts).map(
                              ([path, name]) => (
                                <SelectItem key={path} value={path}>
                                  {name as string}
                                </SelectItem>
                              ),
                            )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <div className="space-y-1.5">
                      <label className="block text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">
                        Actors
                      </label>
                      <div className="flex gap-2 items-center">
                        <Select
                          value={job.character_a}
                          onValueChange={(v) =>
                            updateJob(job.id, { character_a: v })
                          }
                        >
                          <SelectTrigger className="!py-2 !text-[11px] !rounded-lg bg-secondary/30">
                            <SelectValue placeholder="Character A" />
                          </SelectTrigger>
                          <SelectContent>
                            {config &&
                              Object.keys(config.characters).map((name) => (
                                <SelectItem key={name} value={name}>
                                  {name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <span className="text-[10px] font-black text-muted-foreground shrink-0">
                          VS
                        </span>
                        <Select
                          value={job.character_b}
                          onValueChange={(v) =>
                            updateJob(job.id, { character_b: v })
                          }
                        >
                          <SelectTrigger className="!py-2 !text-[11px] !rounded-lg bg-secondary/30">
                            <SelectValue placeholder="Character B" />
                          </SelectTrigger>
                          <SelectContent>
                            {config &&
                              Object.keys(config.characters).map((name) => (
                                <SelectItem key={name} value={name}>
                                  {name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">
                        Overlay Asset (Optional)
                      </label>
                      <div className="relative group/pip">
                        <input
                          type="file"
                          onChange={(e) => handlePipUpload(job.id, e)}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                        />
                        <div className="border border-border bg-secondary/30 rounded-lg px-4 py-2.5 text-[11px] font-bold text-foreground truncate flex items-center gap-2 group-hover/pip:border-primary/50 transition-colors">
                          <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          {job.pip_asset ? (
                            <span className="text-primary">
                              {job.pip_asset}
                            </span>
                          ) : (
                            "Attach media..."
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <Separator className="shrink-0" />

        <Button
          variant="default"
          size="lg"
          className="w-full font-bold"
          onClick={generateAll}
          disabled={
            isGenerating || jobs.length === 0 || jobs.some((j) => !j.topic)
          }
        >
          {isGenerating ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin mr-2" />
              Generating Batch...
            </>
          ) : (
            <>
              <Wand2 className="h-4 w-4 mr-2" />
              Generate All ({jobs.length})
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
