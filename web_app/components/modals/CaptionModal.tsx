// src/components/modals/CaptionModal.tsx
import React from 'react';
import { primaryBlue, dangerRed, cardClasses } from '../../lib/constants'; // Adjust path


interface CaptionModalProps {
    isCaptionModalOpen: boolean;
    captionFileName: string;
    captionContent: string;
    hideCaptionModal: () => void;
}

export const CaptionModal: React.FC<CaptionModalProps> = ({
    isCaptionModalOpen,
    captionFileName,
    captionContent,
    hideCaptionModal,
}) => (
    <div id="caption-modal" className={`fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center transition-opacity duration-300 ${isCaptionModalOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className={`${cardClasses} p-8 max-w-xl w-full relative transform transition-all duration-300 ${isCaptionModalOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
            <div className="flex justify-between items-center pb-4 border-b border-zinc-200 dark:border-zinc-800 mb-4">
                <h3 className={`text-2xl font-bold text-zinc-900 dark:text-zinc-200 flex items-center`}>
                    <i className="fas fa-closed-captioning mr-2 text-amber-500"></i> Generated Caption: <span className="ml-2" style={{ color: primaryBlue }}>{captionFileName}</span>
                </h3>
                <button onClick={hideCaptionModal} className="p-2 text-zinc-400 hover:text-rose-500 transition rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800">
                    <i className="fas fa-times fa-xl"></i>
                </button>

            </div>
            <div className="max-h-96 overflow-y-auto custom-scrollbar">
                <textarea
                    readOnly
                    className="w-full p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-800 dark:text-zinc-200 resize-none h-48 font-mono shadow-inner outline-none"
                    value={captionContent}
                />
                <button
                    onClick={() => navigator.clipboard.writeText(captionContent)}
                    className="mt-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 w-full py-3 font-semibold rounded-xl flex items-center justify-center shadow-md transition"
                >
                    <i className="fas fa-copy mr-2"></i> Copy to Clipboard
                </button>

            </div>
        </div>
    </div>
);