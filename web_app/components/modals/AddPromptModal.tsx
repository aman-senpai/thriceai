"use client";

import React, { useState } from "react";
import { postJson, CLEAN_INPUT, BTN_PRIMARY, BTN_SECONDARY } from "../../lib/constants";

interface AddPromptModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    log: (message: string, type?: "info" | "error" | "warn" | "success") => void;
}

export const AddPromptModal: React.FC<AddPromptModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    log,
}) => {
    const [name, setName] = useState("");
    const [content, setContent] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !content.trim()) return;

        setIsSubmitting(true);
        try {
            await postJson("/api/prompts", {
                name: name.trim(),
                content: content.trim(),
            });
            log(`Prompt ${name} added successfully`, "success");
            onSuccess();
            onClose();
            setName("");
            setContent("");
        } catch (err: any) {
            log(`Failed to add prompt: ${err.message}`, "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-card border border-border w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-border flex justify-between items-center bg-secondary/30">
                    <h2 className="text-xl font-black text-foreground">Add Prompt Template</h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-2">
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Prompt Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className={CLEAN_INPUT}
                            placeholder="e.g. Finance Thrice"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Prompt Content</label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className={`${CLEAN_INPUT} min-h-[300px] font-mono text-sm`}
                            placeholder="Enter your system prompt here..."
                            required
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className={`${BTN_SECONDARY} flex-1`}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !name.trim() || !content.trim()}
                            className={`${BTN_PRIMARY} flex-1`}
                        >
                            {isSubmitting ? <i className="fas fa-spinner fa-spin"></i> : "Save Prompt"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
