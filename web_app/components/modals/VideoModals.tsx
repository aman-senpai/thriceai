// components/modals/VideoModals.tsx
"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { X, LoaderCircle, Save, Copy, Pencil, Video } from "lucide-react";
import { LogType } from "@/types";

// --- MODALS PROPS INTERFACE ---
export interface VideoModalsProps {
  isPreviewModalOpen: boolean;
  previewUrl: string;
  hidePreviewModal: () => void;
  isDialogueModalOpen: boolean;
  dialogueFileName: string;
  dialogueContent: string;
  setDialogueContent: (content: string) => void;
  hideDialogueModal: () => void;
  handleSaveDialogue: () => Promise<void>;
  isDialogueSaving: boolean;
  isCaptionModalOpen: boolean;
  captionFileName: string;
  captionContent: string;
  hideCaptionModal: () => void;
  log: (message: string, type?: LogType) => void;
}

const VideoModals: React.FC<VideoModalsProps> = ({
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
  // captionFileName, // Removed unused prop
  captionContent,
  hideCaptionModal,
  log,
}) => {
  const handleCopyCaption = () => {
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard &&
      navigator.clipboard.writeText
    ) {
      navigator.clipboard
        .writeText(captionContent)
        .then(() => log("Copied!", "success"))
        .catch(() => {
          // Fallback for failed clipboard API
          const textArea = document.createElement("textarea");
          textArea.value = captionContent;
          document.body.appendChild(textArea);
          textArea.select();
          try {
            document.execCommand("copy");
            log("Copied (fallback)!", "success");
          } catch (err) {
            log("Failed to copy", "error");
          }
          document.body.removeChild(textArea);
        });
    } else {
      // Direct fallback for missing clipboard API
      const textArea = document.createElement("textarea");
      textArea.value = captionContent;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        log("Copied (fallback)!", "success");
      } catch (err) {
        log("Failed to copy", "error");
      }
      document.body.removeChild(textArea);
    }
  };

  return (
    <>
      {/* Editor / Dialogue Modal */}
      <Dialog
        open={isDialogueModalOpen}
        onOpenChange={(open) => !open && hideDialogueModal()}
      >
        <DialogContent className="sm:max-w-3xl h-[85vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-muted-foreground" />
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                Editing:{" "}
                <span className="text-muted-foreground font-mono text-base font-normal">
                  {dialogueFileName}
                </span>
              </DialogTitle>
            </div>
          </DialogHeader>
          <div className="flex-1 flex flex-col gap-4 min-h-0">
            <Textarea
              className="flex-1 min-h-0 w-full p-4 rounded-xl bg-secondary/30 border-border font-mono resize-none"
              value={dialogueContent}
              onChange={(e) => setDialogueContent(e.target.value)}
            />
            <Button
              onClick={handleSaveDialogue}
              disabled={isDialogueSaving}
              className="bg-success hover:bg-success/90 text-success-foreground font-bold shadow-sm"
            >
              {isDialogueSaving ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Modal - fullscreen video */}
      <Dialog
        open={isPreviewModalOpen}
        onOpenChange={(open) => !open && hidePreviewModal()}
      >
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden bg-black border-none">
          <DialogHeader className="sr-only">
            <DialogTitle>Video Preview</DialogTitle>
          </DialogHeader>
          <div className="absolute top-4 right-4 z-10">
            <Button
              variant="ghost"
              size="icon"
              className="w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-md"
              onClick={hidePreviewModal}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="aspect-[9/16] max-h-[85vh] w-full flex items-center justify-center bg-black">
            {previewUrl ? (
              <video
                controls
                className="max-w-full max-h-full"
                key={previewUrl}
                autoPlay
              >
                <source src={previewUrl} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            ) : (
              <p className="text-muted-foreground">Video failed to load.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Caption Modal */}
      <Dialog
        open={isCaptionModalOpen}
        onOpenChange={(open) => !open && hideCaptionModal()}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Video className="h-5 w-5 text-muted-foreground" />
              Caption Generated
            </DialogTitle>
          </DialogHeader>
          <div className="mb-6">
            <div className="p-4 rounded-xl bg-secondary/30 border-border max-h-64 overflow-y-auto custom-scrollbar">
              <pre className="whitespace-pre-wrap text-sm text-foreground font-sans">
                {captionContent}
              </pre>
            </div>
          </div>
          <Button
            onClick={handleCopyCaption}
            className="w-full font-bold shadow-sm"
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy to Clipboard
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
};
export default VideoModals;
