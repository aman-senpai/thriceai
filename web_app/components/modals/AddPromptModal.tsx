"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LoaderCircle } from "lucide-react";
import { postJson } from "@/lib/constants";

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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-black">
            Add Prompt Template
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest">
              Prompt Name
            </label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Finance Thrice"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest">
              Prompt Content
            </label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[300px] font-mono text-sm"
              placeholder="Enter your system prompt here..."
              required
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={isSubmitting || !name.trim() || !content.trim()}
            >
              {isSubmitting ? (
                <LoaderCircle className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {isSubmitting ? "Saving..." : "Save Prompt"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
