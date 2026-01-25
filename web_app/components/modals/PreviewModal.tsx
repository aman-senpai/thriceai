// src/components/modals/PreviewModal.tsx
import React from 'react';
import { primaryBlue, dangerRed, cardClasses } from '../../lib/constants'; // Adjust path


interface PreviewModalProps {
    isPreviewModalOpen: boolean;
    previewFileName: string;
    hidePreviewModal: () => void;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({
    isPreviewModalOpen,
    previewFileName,
    hidePreviewModal,
}) => (
    <div id="preview-modal" className={`fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center transition-opacity duration-300 ${isPreviewModalOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className={`${cardClasses} p-8 max-w-2xl w-full relative transform transition-all duration-300 ${isPreviewModalOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
            <div className="flex justify-between items-center pb-4 border-b border-zinc-200 dark:border-zinc-800 mb-4">
                <h3 id="modal-title" className={`text-2xl font-bold text-zinc-900 dark:text-zinc-200 flex items-center`}>
                    <i className={`fas fa-eye mr-2`} style={{ color: primaryBlue }}></i> Video Preview: <span className="ml-2" style={{ color: primaryBlue }}>{previewFileName}</span>
                </h3>
                <button id="close-modal" onClick={hidePreviewModal} className="p-2 text-zinc-400 hover:text-rose-500 transition rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800">
                    <i className="fas fa-times fa-xl"></i>
                </button>

            </div>
            <div id="video-container" className="aspect-video w-full">
                {previewFileName ? (
                    <video controls className="w-full h-full rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-800" key={previewFileName}>
                        {/* FIXED VIDEO SOURCE URL */}
                        <source src={`http://localhost:8008/api/data/reels/${previewFileName}`} type="video/mp4" />
                        Your browser does not support the video tag.
                    </video>

                ) : (
                    <p className="text-center text-gray-500 py-10">Video will load here.</p>
                )}
            </div>
        </div>
    </div>
);