"use client";

import React, { useState } from "react";
import { postJson, BTN_PRIMARY, BTN_SUCCESS, BTN_DANGER, CLEAN_INPUT } from "../../lib/constants";

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
    const [jsonInput, setJsonInput] = useState("");
    const [isJsonInputVisible, setIsJsonInputVisible] = useState(false);

    // Initialize audio mode from config
    React.useEffect(() => {
        if (config?.audio_modes && !audioMode) {
            setAudioMode(Object.keys(config.audio_modes)[0] || "");
        }
    }, [config, audioMode]);

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
                        ([_, name]) => name === promptPath
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

    const handlePipUpload = async (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
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
        <div className="bg-card text-card-foreground p-6 rounded-2xl shadow-sm border border-border space-y-4 h-full flex flex-col">
            <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-600/10 rounded-xl text-emerald-600 flex items-center justify-center shrink-0">
                        <i className="fas fa-layer-group"></i>
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-foreground">Batch Generator</h2>
                        <p className="text-[10px] text-muted-foreground">End-to-end video production</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsJsonInputVisible(!isJsonInputVisible)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 border ${isJsonInputVisible ? 'bg-emerald-600/10 border-emerald-600/50 text-emerald-600 font-black' : 'bg-secondary text-muted-foreground border-border hover:border-primary/50'}`}
                        title="Bulk Add via JSON"
                    >
                        <i className={`fas ${isJsonInputVisible ? 'fa-keyboard' : 'fa-code'}`}></i>
                        {isJsonInputVisible ? 'Paste Mode' : 'Bulk Input'}
                    </button>
                    <button
                        onClick={addJob}
                        className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold hover:bg-primary/90 transition-all flex items-center gap-2 shadow-sm"
                    >
                        <i className="fas fa-plus"></i>
                        Add Video
                    </button>
                </div>
            </div>

            {/* JSON Input Area */}
            {isJsonInputVisible && (
                <div className="bg-secondary/30 p-4 rounded-xl border border-border/50 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                            <i className="fas fa-paste mr-1.5"></i> Paste JSON Array
                        </label>
                        <a
                            href="#"
                            onClick={(e) => {
                                e.preventDefault();
                                const firstChar = Object.keys(config?.characters || {})[0] || "Character A";
                                const secondChar = Object.keys(config?.characters || {})[1] || "Character B";
                                const firstPromptName = Object.values(config?.prompts || {})[0] as string || "template.txt";
                                const example = [
                                    {
                                        topic: "Benefits of TypeScript",
                                        file_name: "typescript_benefits",
                                        character_a: firstChar,
                                        character_b: secondChar,
                                        prompt_filename: firstPromptName,
                                        pip_asset: null
                                    }
                                ];
                                setJsonInput(JSON.stringify(example, null, 2));
                            }}
                            className="text-[10px] text-primary hover:underline font-bold"
                        >
                            Load Example
                        </a>
                    </div>
                    <textarea
                        value={jsonInput}
                        onChange={(e) => setJsonInput(e.target.value)}
                        placeholder='[ { "topic": "Video 1" }, { "topic": "Video 2" } ]'
                        className="w-full h-32 bg-background border border-border rounded-lg p-3 text-xs font-mono focus:ring-2 focus:ring-primary/50 outline-none resize-none custom-scrollbar"
                    />
                    <div className="flex gap-2">
                        <button
                            onClick={handleAddFromJson}
                            disabled={!jsonInput.trim()}
                            className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-[10px] font-bold hover:bg-emerald-700 transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            <i className="fas fa-magic"></i> Process & Add to Queue
                        </button>
                    </div>
                </div>
            )}

            {/* Audio Mode Selection */}
            <div className="bg-secondary/20 p-4 rounded-xl border border-border/50 shrink-0">
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
                    <i className="fas fa-volume-up mr-1.5"></i> Global Audio Provider
                </label>
                <div className="flex flex-wrap gap-2">
                    {config && Object.keys(config.audio_modes).map((mode) => {
                        const isSelected = audioMode === mode;
                        const displayName = mode.replace(/_/g, ' ');

                        return (
                            <button
                                key={mode}
                                type="button"
                                onClick={() => setAudioMode(mode)}
                                disabled={isGenerating}
                                className={`px-4 py-2 rounded-full text-[10px] sm:text-xs font-bold transition-all duration-200 border capitalize shadow-sm ${isSelected
                                    ? "bg-primary text-primary-foreground border-primary scale-105"
                                    : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                                    }`}
                            >
                                {displayName}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                {jobs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground opacity-50">
                        <i className="fas fa-film text-4xl mb-3"></i>
                        <p className="text-xs font-medium">No videos added to batch yet.</p>
                    </div>
                ) : (
                    jobs.map((job) => (
                        <div key={job.id} className="bg-secondary/30 border border-border rounded-xl p-4 space-y-3 relative group">
                            <button
                                onClick={() => removeJob(job.id)}
                                className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-all z-10"
                                title="Remove Job"
                            >
                                <i className="fas fa-times text-xs"></i>
                            </button>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Topic</label>
                                    <input
                                        type="text"
                                        value={job.topic}
                                        onChange={(e) => updateJob(job.id, { topic: e.target.value })}
                                        className={`${CLEAN_INPUT} !py-2 !text-xs`}
                                        placeholder="e.g. History of Rome"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Filename (Optional)</label>
                                    <input
                                        type="text"
                                        value={job.file_name}
                                        onChange={(e) => updateJob(job.id, { file_name: e.target.value })}
                                        className={`${CLEAN_INPUT} !py-2 !text-xs`}
                                        placeholder="video_filename"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Prompt Template</label>
                                    <select
                                        value={job.prompt_filename}
                                        onChange={(e) => updateJob(job.id, { prompt_filename: e.target.value })}
                                        className={`${CLEAN_INPUT} !py-2 !text-xs appearance-none`}
                                    >
                                        {config && Object.entries(config.prompts).map(([path, name]) => (
                                            <option key={path} value={path}>{name as string}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4 items-end">
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Characters</label>
                                    <div className="flex gap-2">
                                        <select
                                            value={job.character_a}
                                            onChange={(e) => updateJob(job.id, { character_a: e.target.value })}
                                            className={`${CLEAN_INPUT} !py-2 !text-[10px] appearance-none`}
                                        >
                                            {config && Object.keys(config.characters).map((name) => (
                                                <option key={name} value={name}>{name}</option>
                                            ))}
                                        </select>
                                        <select
                                            value={job.character_b}
                                            onChange={(e) => updateJob(job.id, { character_b: e.target.value })}
                                            className={`${CLEAN_INPUT} !py-2 !text-[10px] appearance-none`}
                                        >
                                            {config && Object.keys(config.characters).map((name) => (
                                                <option key={name} value={name}>{name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="col-span-2 flex items-center gap-3">
                                    <div className="flex-1">
                                        <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">PIP Asset</label>
                                        <div className="relative">
                                            <input
                                                type="file"
                                                onChange={(e) => handlePipUpload(job.id, e)}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            />
                                            <div className="border border-border bg-background rounded-lg px-3 py-2 text-[10px] truncate flex items-center gap-2">
                                                <i className="fas fa-upload text-muted-foreground"></i>
                                                {job.pip_asset || "Upload PIP video/image"}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="pt-4 border-t border-border shrink-0">
                <button
                    onClick={generateAll}
                    disabled={isGenerating || jobs.length === 0 || jobs.some(j => !j.topic)}
                    className={`${BTN_SUCCESS} w-full`}
                >
                    {isGenerating ? (
                        <><i className="fas fa-spinner fa-spin mr-2"></i> Generating Batch...</>
                    ) : (
                        <><i className="fas fa-magic mr-2"></i> Generate All ({jobs.length})</>
                    )}
                </button>
            </div>
        </div>
    );
};
