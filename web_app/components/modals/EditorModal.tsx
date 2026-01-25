// src/components/modals/EditorModal.tsx
import React from 'react';
import { cardClasses, primaryBlue, dangerRed, successButtonClasses } from '../../lib/constants'; // Adjust path


interface EditorModalProps {
    isDialogueModalOpen: boolean;
    dialogueFileName: string;
    dialogueContent: string;
    setDialogueContent: (content: string) => void;
    handleSaveDialogue: () => Promise<void>;
    hideDialogueModal: () => void;
    isDialogueSaving: boolean;
}

export const EditorModal: React.FC<EditorModalProps> = ({
    isDialogueModalOpen,
    dialogueFileName,
    dialogueContent,
    setDialogueContent,
    handleSaveDialogue,
    hideDialogueModal,
    isDialogueSaving,
}) => {
    // successButtonClasses imported from constants


    return (
        <div id="editor-modal" className={`fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center transition-opacity duration-300 ${isDialogueModalOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div className={`${cardClasses} p-8 max-w-3xl w-full h-[90%] relative flex flex-col transform transition-all duration-300 ${isDialogueModalOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
                <div className="flex justify-between items-center pb-4 border-b border-zinc-200 dark:border-zinc-800 mb-4">
                    <h3 id="editor-modal-title" className={`text-2xl font-bold text-zinc-900 dark:text-zinc-200 flex items-center`}>

                        <i className={`fas fa-pen-square mr-2`} style={{ color: primaryBlue }}></i> Editing Dialogue: <span id="current-editing-file" className="ml-2" style={{ color: primaryBlue }}>{dialogueFileName}</span>
                    </h3>
                    <button id="close-editor-modal" onClick={hideDialogueModal} className="p-2 text-zinc-400 hover:text-rose-500 transition rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800">
                        <i className="fas fa-times fa-xl"></i>
                    </button>
                </div>
                <div id="dialogue-editor-container" className="flex-grow space-y-4 flex flex-col">
                    <textarea
                        id="dialogue-editor"
                        className="flex-grow w-full p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm font-mono text-zinc-800 dark:text-zinc-200 resize-none shadow-inner outline-none focus:ring-2 focus:ring-zinc-500/20"
                        rows={15}
                        value={dialogueContent}
                        onChange={(e) => setDialogueContent(e.target.value)}
                    ></textarea>
                    <button
                        id="save-dialogue-btn"
                        onClick={handleSaveDialogue}
                        disabled={isDialogueSaving}
                        className={successButtonClasses + " w-full"}
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
};