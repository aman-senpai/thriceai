// src/components/modals/CaptionModal.tsx
import React from 'react';
import { primaryBlue, dangerRed } from '../../lib/constants'; // Adjust path

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
        <div className={`bg-dark-card p-8 rounded-xl shadow-2xl max-w-xl w-full relative transform transition-all duration-300 ${isCaptionModalOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
            <div className="flex justify-between items-center pb-4 border-b border-dark-border mb-4">
                <h3 className={`text-2xl font-bold text-gray-200 flex items-center`}>
                    <i className="fas fa-closed-captioning mr-2 text-warning-yellow"></i> Generated Caption: <span className={`${primaryBlue} ml-2`}>{captionFileName}</span>
                </h3>
                <button onClick={hideCaptionModal} className="p-2 text-gray-400 hover:text-danger-red transition rounded-full hover:bg-dark-bg">
                    <i className="fas fa-times fa-xl"></i>
                </button>
            </div>
            <div className="max-h-96 overflow-y-auto custom-scrollbar">
                <textarea
                    readOnly
                    className="w-full p-4 rounded-xl bg-dark-bg border border-dark-border text-sm text-gray-200 resize-none h-48 font-mono shadow-inner"
                    value={captionContent}
                />
                <button
                  onClick={() => navigator.clipboard.writeText(captionContent)}
                  className="mt-4 bg-primary-blue text-white hover:bg-blue-600 w-full py-3 font-semibold rounded-xl flex items-center justify-center shadow-md transition"
                >
                  <i className="fas fa-copy mr-2"></i> Copy to Clipboard
                </button>
            </div>
        </div>
    </div>
);