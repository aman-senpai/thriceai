// components/modals/VideoModals.tsx
"use client";

import React from "react";
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
    // Shared styled classes
    const overlayClasses = "fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-opacity duration-300";
    const modalBase = "bg-card text-card-foreground p-5 sm:p-6 rounded-2xl shadow-2xl relative transform transition-all duration-300 border border-border";

    return (
        <>
            {/* Editor Modal */}
            <div id="editor-modal" className={`${overlayClasses} ${isDialogueModalOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <div className={`${modalBase} max-w-3xl w-full h-[85vh] flex flex-col ${isDialogueModalOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
                    <div className="flex justify-between items-center pb-4 border-b border-border mb-4">
                        <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                            <i className="fas fa-edit text-muted-foreground"></i>
                            Editing: <span className="text-muted-foreground font-mono text-base">{dialogueFileName}</span>
                        </h3>
                        <button onClick={hideDialogueModal} className="w-8 h-8 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition flex items-center justify-center">
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                    <div className="flex-grow flex flex-col mb-4">
                        <textarea
                            className="flex-grow w-full p-4 rounded-xl bg-secondary/30 border border-border text-sm font-mono text-foreground resize-none outline-none focus:ring-2 focus:ring-ring transition-all custom-scrollbar"
                            value={dialogueContent}
                            onChange={(e) => setDialogueContent(e.target.value)}
                        ></textarea>
                    </div>
                    <button
                        onClick={handleSaveDialogue}
                        disabled={isDialogueSaving}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition-colors disabled:opacity-50"
                    >
                        {isDialogueSaving ? <><i className="fas fa-spinner fa-spin mr-2"></i> Saving...</> : <><i className="fas fa-save mr-2"></i> Save Changes</>}
                    </button>
                </div>
            </div>

            {/* Preview Modal */}
            <div id="preview-modal" className={`${overlayClasses} ${isPreviewModalOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <div className={`${modalBase} max-w-2xl w-full p-0 overflow-hidden bg-black ${isPreviewModalOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
                    <div className="absolute top-4 right-4 z-10">
                        <button onClick={hidePreviewModal} className="w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-md transition flex items-center justify-center">
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                    <div className="aspect-[9/16] max-h-[85vh] w-full flex items-center justify-center bg-black">
                        {previewUrl ? (
                            <video controls className="max-w-full max-h-full" key={previewUrl} autoPlay>
                                <source src={previewUrl} type="video/mp4" />
                                Your browser does not support the video tag.
                            </video>
                        ) : (
                            <p className="text-muted-foreground">Video failed to load.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Caption Modal */}
            <div id="caption-modal" className={`${overlayClasses} ${isCaptionModalOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <div className={`${modalBase} max-w-xl w-full ${isCaptionModalOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
                    <div className="flex justify-between items-center pb-4 border-b border-border mb-4">
                        <h3 className="text-xl font-bold text-foreground">Caption Generated</h3>
                        <button onClick={hideCaptionModal} className="w-8 h-8 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition flex items-center justify-center">
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                    <div className="mb-6">
                        <div className="p-4 rounded-xl bg-secondary/30 border border-border max-h-64 overflow-y-auto custom-scrollbar">
                            <p className="whitespace-pre-wrap text-sm text-foreground">{captionContent}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            if (typeof navigator !== 'undefined' && navigator.clipboard) {
                                navigator.clipboard.writeText(captionContent).then(() => log("Copied!", "success"));
                            }
                        }}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg font-bold shadow-sm transition-colors w-full"
                    >
                        <i className="fas fa-copy mr-2"></i> Copy to Clipboard
                    </button>
                </div>
            </div>
        </>
    );
};
export default VideoModals;