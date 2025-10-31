// src/components/modals/EditorModal.tsx
import React from 'react';
import { cardClasses, primaryBlue, dangerRed } from '../../lib/constants'; // Adjust path

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
    // Replicating the success button style inline to avoid another constant import, or import successButtonClasses
    const successButtonClasses = "py-3 bg-success-green text-white font-semibold rounded-xl hover:bg-green-600 transition duration-200 disabled:opacity-60 disabled:cursor-not-allowed transform hover:scale-[1.01] active:scale-[0.99] shadow-lg focus:ring-2 focus:ring-success-green/50";

    return (
        <div id="editor-modal" className={`fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center transition-opacity duration-300 ${isDialogueModalOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div className={`bg-dark-card p-8 rounded-xl shadow-2xl max-w-3xl w-full h-[90%] relative flex flex-col transform transition-all duration-300 ${isDialogueModalOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
                <div className="flex justify-between items-center pb-4 border-b border-dark-border mb-4">
                    <h3 id="editor-modal-title" className={`text-2xl font-bold text-gray-200 flex items-center`}>
                        <i className={`fas fa-pen-square mr-2 ${primaryBlue}`}></i> Editing Dialogue: <span id="current-editing-file" className={`${primaryBlue} ml-2`}>{dialogueFileName}</span>
                    </h3>
                    <button id="close-editor-modal" onClick={hideDialogueModal} className="p-2 text-gray-400 hover:text-danger-red transition rounded-full hover:bg-dark-bg">
                        <i className="fas fa-times fa-xl"></i>
                    </button>
                </div>
                <div id="dialogue-editor-container" className="flex-grow space-y-4 flex flex-col">
                    <textarea
                        id="dialogue-editor"
                        className="flex-grow w-full p-4 rounded-xl bg-dark-bg border border-dark-border text-sm font-mono text-gray-200 resize-none shadow-inner"
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