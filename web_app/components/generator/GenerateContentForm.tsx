"use client";

import React from "react";
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
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ConfigData } from "@/types";
import { cn } from "@/lib/utils";
import { API_BASE_URL } from "@/lib/constants";
import {
  Sparkles,
  Plus,
  Check,
  LoaderCircle,
  CloudUpload,
  Image as ImageIcon,
  X,
} from "lucide-react";

// --- Props Interface ---
export interface GenerateContentFormProps {
  config: ConfigData | null;
  charA: string;
  setCharA: React.Dispatch<React.SetStateAction<string>>;
  charB: string;
  setCharB: React.Dispatch<React.SetStateAction<string>>;
  audioMode: string;
  setAudioMode: React.Dispatch<React.SetStateAction<string>>;
  llmProvider: string;
  setLlmProvider: React.Dispatch<React.SetStateAction<string>>;
  promptPath: string;
  setPromptPath: React.Dispatch<React.SetStateAction<string>>;
  language: string;
  setLanguage: React.Dispatch<React.SetStateAction<string>>;
  query: string;
  handleQueryChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
  fileName: string;
  handleFileNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  contentStatus: string;
  isConfigLoading: boolean;
  isContentGenerating: boolean;
  isConfigValid: boolean;
  handleContentGeneration: (e: React.FormEvent) => Promise<void>;
  onAddCharacter: () => void;
  onAddPrompt: () => void;
  pipAsset: string | null;
  isPipUploading: boolean;
  handlePipUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleClearPipAsset: () => void;
}

// --- Character Card Scroll Sub-Component ---
const CharacterScroll = ({
  label,
  selected,
  onSelect,
  exclude,
  config,
  isContentGenerating,
}: {
  label: string;
  selected: string;
  onSelect: (v: string) => void;
  exclude?: string;
  config: ConfigData | null;
  isContentGenerating: boolean;
}) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between px-1">
      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
        {label}
      </span>
      {selected && (
        <span className="text-xs text-foreground font-bold">{selected}</span>
      )}
    </div>
    <div className="flex gap-2 overflow-x-auto py-2 custom-scrollbar -mx-1 px-2">
      {config &&
        Object.entries(config.characters).map(([key, char]) => {
          const isSelected = selected === key;
          const isExcluded = exclude === key;

          if (isExcluded) return null;

          return (
            <button
              key={key}
              type="button"
              onClick={() =>
                !isExcluded && !isContentGenerating && onSelect(key)
              }
              className={cn(
                "relative shrink-0 w-16 h-16 rounded-2xl overflow-hidden transition-all duration-300 bg-muted border-2",
                isSelected
                  ? "border-primary shadow-lg shadow-primary/20 scale-105"
                  : "border-transparent opacity-60 hover:opacity-100 hover:scale-105 grayscale hover:grayscale-0",
              )}
            >
              <Avatar className="w-full h-full rounded-none">
                <AvatarImage
                  src={
                    char.avatar.startsWith("http")
                      ? char.avatar
                      : `${API_BASE_URL}${char.avatar}`
                  }
                  alt={key}
                />
                <AvatarFallback className="rounded-none text-[10px] font-bold">
                  {key.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/80 to-transparent py-1 px-1">
                <p className="text-foreground font-bold text-[9px] leading-none truncate text-center">
                  {key}
                </p>
              </div>
              {isSelected && (
                <div className="absolute top-1 right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center shadow">
                  <Check className="w-[8px] h-[8px] text-primary-foreground" />
                </div>
              )}
            </button>
          );
        })}
    </div>
  </div>
);

// --- Main Component ---
const GenerateContentForm = React.memo(function GenerateContentForm({
  config,
  charA,
  setCharA,
  charB,
  setCharB,
  audioMode,
  setAudioMode,
  llmProvider,
  setLlmProvider,
  promptPath,
  setPromptPath,
  language,
  setLanguage,
  query,
  handleQueryChange,
  fileName,
  handleFileNameChange,
  contentStatus,
  isConfigLoading,
  isContentGenerating,
  isConfigValid,
  handleContentGeneration,
  onAddCharacter,
  onAddPrompt,
  pipAsset,
  isPipUploading,
  handlePipUpload,
  handleClearPipAsset,
}: GenerateContentFormProps) {
  return (
    <div
      id="config-section"
      className="bg-card text-card-foreground p-6 rounded-2xl shadow-sm border border-border flex flex-col h-full"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 shrink-0">
        <div className="w-10 h-10 bg-secondary rounded-xl text-secondary-foreground flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-foreground">Studio/Script</h2>
          <p className="text-[10px] text-muted-foreground">
            Choose actors & generate dialogue
          </p>
        </div>
      </div>

      <form
        onSubmit={handleContentGeneration}
        className="space-y-4 flex-1 flex flex-col overflow-hidden"
      >
        {/* Form Inputs */}
        <div className="shrink-0 space-y-3">
          <div className="bg-secondary/30 rounded-xl p-4 border border-border space-y-3">
            {/* Dropdowns Row */}
            <div className="flex flex-col md:flex-row gap-4">
              {/* Template */}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1.5 px-1">
                  <span className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                    Template
                  </span>
                </div>
                <div className="flex gap-2">
                  <Select
                    value={promptPath}
                    onValueChange={setPromptPath}
                    disabled={isConfigLoading || isContentGenerating}
                  >
                    <SelectTrigger className="w-full bg-background border-border text-xs font-bold h-9">
                      <SelectValue placeholder="Select template" />
                    </SelectTrigger>
                    <SelectContent>
                      {config &&
                        Object.entries(config.prompts).map(([path, name]) => (
                          <SelectItem
                            key={path}
                            value={path}
                            className="text-xs font-bold"
                          >
                            {name.replace(/\.[^/.]+$/, "")}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="shrink-0 w-8 h-8"
                    onClick={onAddPrompt}
                    title="Add New Prompt"
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              {/* Audio Mode */}
              <div className="flex-1">
                <span className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5 px-1">
                  Audio Mode
                </span>
                <Select
                  value={audioMode}
                  onValueChange={setAudioMode}
                  disabled={isConfigLoading || isContentGenerating}
                >
                  <SelectTrigger className="w-full bg-background border-border text-xs font-bold h-9 capitalize">
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent>
                    {config &&
                      Object.keys(config.audio_modes).map((mode) => (
                        <SelectItem
                          key={mode}
                          value={mode}
                          className="text-xs font-bold capitalize"
                        >
                          {mode.replace(/_/g, " ")}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Script Writer (LLM Provider) */}
              <div className="flex-1">
                <span className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5 px-1">
                  Script Writer
                </span>
                <Select
                  value={llmProvider}
                  onValueChange={setLlmProvider}
                  disabled={isConfigLoading || isContentGenerating}
                >
                  <SelectTrigger className="w-full bg-background border-border text-xs font-bold h-9">
                    <SelectValue placeholder="Select writer" />
                  </SelectTrigger>
                  <SelectContent>
                    {config &&
                      Object.entries(config.llm_providers).map(
                        ([key, label]) => (
                          <SelectItem
                            key={key}
                            value={key}
                            className="text-xs font-bold"
                          >
                            {label}
                          </SelectItem>
                        ),
                      )}
                  </SelectContent>
                </Select>
              </div>

              {/* Language */}
              <div className="flex-1">
                <span className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5 px-1">
                  Language
                </span>
                <Select
                  value={language}
                  onValueChange={setLanguage}
                  disabled={isConfigLoading || isContentGenerating}
                >
                  <SelectTrigger className="w-full bg-background border-border text-xs font-bold h-9 uppercase">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {config &&
                      config.languages.map((lang) => (
                        <SelectItem
                          key={lang.code}
                          value={lang.code}
                          className="text-xs font-bold uppercase"
                        >
                          {lang.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Query / Topic */}
            <div>
              <span className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">
                Topic / Query
              </span>
              <Textarea
                value={query}
                onChange={handleQueryChange}
                placeholder="e.g. 'Philosophy of Java vs Python'"
                className="min-h-[120px] max-h-[300px] bg-background border-border custom-scrollbar"
                disabled={isConfigLoading || isContentGenerating}
              />
            </div>

            {/* Filename + Generate Button */}
            <div className="flex flex-col md:flex-row items-end gap-4">
              <div className="flex-1 w-full">
                <span className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5 px-1">
                  Filename
                </span>
                <Input
                  type="text"
                  value={fileName}
                  onChange={handleFileNameChange}
                  placeholder="video_topic"
                  className="bg-background border-border text-xs font-bold h-9"
                  disabled={isConfigLoading || isContentGenerating}
                />
              </div>
              <div className="w-full md:w-auto">
                <Button
                  type="submit"
                  disabled={
                    !isConfigValid || isContentGenerating || isConfigLoading
                  }
                  className="w-full md:w-auto h-9 !py-2 !text-xs md:px-10 gap-1.5"
                >
                  {isContentGenerating ? (
                    <>
                      <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      Generate
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Content Status */}
          {contentStatus && (
            <div className="mt-3 p-2.5 rounded-lg bg-secondary text-center text-xs font-medium text-secondary-foreground animate-fade-in border border-border max-h-32 overflow-y-auto custom-scrollbar">
              {contentStatus}
            </div>
          )}
        </div>

        {/* Bottom Section: Characters and PIP Asset */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-border mt-auto items-start">
          {/* Column 1: Character Selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">
                Characters
              </h3>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="w-6 h-6"
                onClick={onAddCharacter}
                title="Add New Character"
              >
                <Plus className="w-3 h-3" />
              </Button>
            </div>
            <CharacterScroll
              label="Speaker 1"
              selected={charA}
              onSelect={setCharA}
              exclude={charB}
              config={config}
              isContentGenerating={isContentGenerating}
            />
            <div className="flex items-center gap-3 px-1">
              <div className="h-px bg-border flex-1" />
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                vs
              </span>
              <div className="h-px bg-border flex-1" />
            </div>
            <CharacterScroll
              label="Speaker 2"
              selected={charB}
              onSelect={setCharB}
              exclude={charA}
              config={config}
              isContentGenerating={isContentGenerating}
            />
          </div>

          {/* Column 2: PIP Asset Upload */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">
              PIP Asset (Optional)
            </h3>
            <div className="bg-secondary/30 rounded-xl p-4 border border-border h-[calc(100%-2rem)] flex flex-col justify-center">
              {pipAsset ? (
                <div className="flex items-center justify-between bg-background p-3 rounded-lg border border-border">
                  <div className="flex items-center gap-2 min-w-0">
                    <ImageIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-xs font-medium truncate text-foreground">
                      {pipAsset}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive h-7 w-7"
                    onClick={handleClearPipAsset}
                    title="Clear Asset"
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="relative group h-32">
                  <Input
                    type="file"
                    accept="image/*,video/*"
                    onChange={handlePipUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    disabled={isPipUploading}
                  />
                  <div className="border-2 border-dashed border-border rounded-lg h-full flex flex-col items-center justify-center gap-2 group-hover:border-primary/50 transition-colors pointer-events-none">
                    {isPipUploading ? (
                      <LoaderCircle className="w-5 h-5 text-muted-foreground animate-spin" />
                    ) : (
                      <>
                        <CloudUpload className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                        <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                          Click or drag upload
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground mt-3 leading-tight italic opacity-70">
                * PIP (Picture-in-Picture) will be placed above captions in the
                final reel.
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
});

export { GenerateContentForm };
