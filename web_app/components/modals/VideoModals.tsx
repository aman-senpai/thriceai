// components/modals/VideoModals.tsx
"use client";

import React from "react";
import { ContentItem, LogType } from "@/types";

// --- Design Constants (Copied from page.tsx for local use) ---
const successButtonClasses = "w-full py-3 bg-success-green text-white font-bold rounded-lg hover:bg-green-600 transition disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.01]";
const BaseButton = ({ children, onClick, disabled, className = "" }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; className?: string }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`px-4 py-2 font-semibold rounded-lg transition duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
        {children}
    </button>
);

// --- MODALS PROPS INTERFACE ---
// Defines all the state and handlers required by the modals.
export interface VideoModalsProps {
    // Preview Modal Props
    isPreviewModalOpen: boolean;
    previewUrl: string; // Changed from previewFileName
    hidePreviewModal: () => void;

    // Dialogue Editor Modal Props
    isDialogueModalOpen: boolean;
    dialogueFileName: string;
    dialogueContent: string;
    setDialogueContent: (content: string) => void;
    hideDialogueModal: () => void;
    handleSaveDialogue: () => Promise<void>;
    isDialogueSaving: boolean;

    // Caption Modal Props
    isCaptionModalOpen: boolean;
    captionFileName: string;
    captionContent: string;
    hideCaptionModal: () => void;
    log: (message: string, type?: LogType) => void;
}

// --- VideoModals Component ---
const VideoModals: React.FC<VideoModalsProps> = ({
    isPreviewModalOpen,
    previewUrl, // Changed
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
}) => {
    // Replicates the card/background classes used in page.tsx
    const cardClasses = "bg-dark-card p-6 rounded-xl shadow-2xl relative transform transition-all duration-300";

    const EditorModal = () => (
        <div id="editor-modal" className={`fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center transition-opacity duration-300 ${isDialogueModalOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div className={`${cardClasses} max-w-2xl w-full h-5/6 flex flex-col ${isDialogueModalOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
                <div className="flex justify-between items-center pb-3 border-b border-dark-border mb-4">
                    <h3 id="editor-modal-title" className="text-xl font-bold text-gray-200">Editing Dialogue: <span id="current-editing-file" className="text-primary-blue">{dialogueFileName}</span></h3>
                    <button id="close-editor-modal" onClick={hideDialogueModal} className="p-2 text-gray-400 hover:text-danger-red transition rounded-full hover:bg-dark-bg">
                        <i className="fas fa-times fa-lg"></i>
                    </button>
                </div>
                <div id="dialogue-editor-container" className="flex-grow overflow-y-auto custom-scrollbar space-y-4 flex flex-col">
                    <textarea
                        id="dialogue-editor"
                        className="flex-grow w-full p-4 rounded-lg bg-dark-bg border border-dark-border text-sm font-mono text-gray-200 resize-none"
                        rows={15}
                        value={dialogueContent}
                        onChange={(e) => setDialogueContent(e.target.value)}
                    ></textarea>
                    <button
                        id="save-dialogue-btn"
                        onClick={handleSaveDialogue}
                        disabled={isDialogueSaving}
                        className={successButtonClasses}
                    >
                        {isDialogueSaving ? (
                            <>
                                <i className="fas fa-spinner fa-spin mr-2"></i> Saving...
                            </>
                        ) : (
                            <>
                                <i className="fas fa-save mr-2"></i> Save Changes
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );

    const PreviewModal = () => (
        <div id="preview-modal" className={`fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center transition-opacity duration-300 ${isPreviewModalOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div className={`${cardClasses} max-w-xl w-full ${isPreviewModalOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
                <div className="flex justify-between items-center pb-3 border-b border-dark-border mb-4">
                    <h3 id="modal-title" className="text-xl font-bold text-gray-200">Video Preview</h3>
                    <button id="close-modal" onClick={hidePreviewModal} className="p-2 text-gray-400 hover:text-danger-red transition rounded-full hover:bg-dark-bg">
                        <i className="fas fa-times fa-lg"></i>
                    </button>
                </div>
                <div id="video-container" className="aspect-video w-full">
                    {previewUrl ? (
                        <video controls className="w-full h-full rounded-lg" key={previewUrl}>
                            <source src={previewUrl} type="video/mp4" />
                            Your browser does not support the video tag.
                        </video>
                    ) : (
                        <p className="text-center text-gray-500 py-10">Video will load here.</p>
                    )}
                </div>
            </div>
        </div>
    );

    const CaptionModal = () => (
        <div id="caption-modal" className={`fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center transition-opacity duration-300 ${isCaptionModalOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div className={`${cardClasses} max-w-xl w-full ${isCaptionModalOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
                <div className="flex justify-between items-center pb-3 border-b border-dark-border mb-4">
                    <h3 className="text-xl font-bold text-gray-200">Generated Caption: <span className="text-primary-blue">{captionFileName}</span></h3>
                    <button onClick={hideCaptionModal} className="p-2 text-gray-400 hover:text-danger-red transition rounded-full hover:bg-dark-bg">
                        <i className="fas fa-times fa-lg"></i>
                    </button>
                </div>
                <div className="max-h-96 overflow-y-auto custom-scrollbar">
                    <textarea
                        readOnly
                        className="w-full p-4 rounded-lg bg-dark-bg border border-dark-border text-sm text-gray-200 resize-none h-48"
                        value={captionContent}
                    />
                    <BaseButton
                        onClick={() => {
                            let success = false;
                            
                            // 1. Attempt Modern API (navigator.clipboard)
                            if (typeof navigator !== 'undefined' && navigator.clipboard) {
                                navigator.clipboard.writeText(captionContent)
                                    .then(() => {
                                        log("Caption copied to clipboard using Clipboard API.", "success");
                                        success = true;
                                    })
                                    .catch(() => {
                                        log("Clipboard API failed due to permission or security. Falling back...", "warn");
                                    });
                            }

                            // 2. Fallback to Old API (document.execCommand)
                            if (!success && typeof document !== 'undefined') {
                                const tempTextArea = document.createElement('textarea');
                                tempTextArea.value = captionContent;
                                tempTextArea.style.position = 'fixed';
                                tempTextArea.style.left = '-9999px';
                                document.body.appendChild(tempTextArea);
                                
                                tempTextArea.select();
                                
                                try {
                                    success = document.execCommand('copy');
                                    if (success) {
                                        log("Caption copied to clipboard using execCommand fallback.", "success");
                                    } else {
                                        log("Clipboard copy failed on both modern and legacy APIs.", "error");
                                        alert("Automatic copy failed. Please copy the text manually.");
                                    }
                                } catch (err) {
                                    log(`execCommand failed: ${err}`, "error");
                                    alert("Automatic copy failed. Please copy the text manually.");
                                } finally {
                                    document.body.removeChild(tempTextArea);
                                }
                            }
                        }}
                        className="mt-4 bg-primary-blue text-white hover:bg-blue-600 w-full"
                    >
                        <i className="fas fa-copy mr-2"></i> Copy to Clipboard
                    </BaseButton>
                </div>
            </div>
        </div>
    );

    return (
        <>
            <EditorModal />
            <PreviewModal />
            <CaptionModal />
        </>
    );
};

export default VideoModals;