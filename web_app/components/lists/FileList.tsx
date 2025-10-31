// src/components/lists/FileList.tsx
import React from 'react';
import { ReelItem, ContentItem } from '../../types'; // Adjust path
import { cardClasses } from '../../lib/constants'; // Adjust path

interface FileListProps {
    title: string;
    data: ReelItem[] | ContentItem[];
    isLoading: boolean;
    isContentList: boolean;
    showPreviewModal?: (url: string) => void; // Changed to accept URL
    showDialogueModal?: (item: ContentItem) => void;
    handleCaptionGeneration?: (contentFileName: string) => Promise<void>;
    isContentGenerating: boolean;
    isReelGenerating: boolean;
    refreshLists: () => Promise<void>;
    apiBaseUrl: string; // New prop
}

const formatTimestamp = (ms: number) => {
    if (!ms) return 'N/A';
    return new Date(ms).toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
};

export const FileList: React.FC<FileListProps> = ({
    title, data, isLoading, isContentList,
    showPreviewModal, showDialogueModal, handleCaptionGeneration,
    isContentGenerating, isReelGenerating, refreshLists, apiBaseUrl
}) => {
    const isGenerating = isContentGenerating || isReelGenerating;

    // Helper function to remove the file extension
    const removeExtension = (fileName: string) => {
        // Regex to match the last dot followed by characters (the extension)
        return fileName.replace(/\.[^/.]+$/, "");
    }

    return (
        <div className={cardClasses}>
            <h2 className="text-2xl font-bold mb-4 text-primary-blue flex justify-between items-center border-b border-dark-border/50 pb-3">
                <i className={`fas ${isContentList ? 'fa-file-code' : 'fa-video-camera'} mr-2`}></i> {title}
                <button onClick={refreshLists} className="text-gray-400 hover:text-primary-blue transition text-lg p-1 rounded-full hover:bg-dark-bg">
                    <i className={`fas fa-sync ${isLoading ? "animate-spin" : ""}`}></i>
                </button>
            </h2>
            <div className="space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar">
                {isLoading ? (
                    <p className="text-center text-gray-500 py-6">
                        <i className="fas fa-spinner fa-spin mx-auto mb-2 text-2xl"></i>
                        <span className="block">Loading {isContentList ? 'content' : 'reels'}...</span>
                    </p>
                ) : data.length === 0 ? (
                    <p className="text-center text-gray-500 py-6">No {isContentList ? 'content' : 'reels'} found. Generate one above!</p>
                ) : (
                    data.map((item, index) => (
                        <div key={index} className="flex justify-between items-center p-4 rounded-xl bg-dark-bg hover:bg-dark-bg/80 border border-dark-border/70 transition duration-150 shadow-md">
                            <div className="truncate pr-4">
                                {/* APPLY removeExtension HERE */}
                                <p className="font-semibold text-gray-200">{removeExtension(item.name)}</p>
                                <p className="text-xs text-gray-400 mt-1">
                                    {isContentList ? `Query: ${(item as ContentItem).query}` : `${(item as ReelItem).size_kb.toFixed(1)} KB`}
                                    <span className="mx-2 text-gray-600">|</span>
                                    <i className="fas fa-clock mr-1"></i> {formatTimestamp(item.modified)}
                                </p>
                            </div>
                            <div className="flex space-x-2 flex-shrink-0">
                                {isContentList ? (
                                    <>
                                        {/* Generate Caption Button */}
                                        <button
                                            onClick={() => handleCaptionGeneration?.(item.name)}
                                            className="p-3 rounded-full text-warning-yellow hover:bg-dark-border transition shadow-sm"
                                            title="Generate Caption"
                                            disabled={isGenerating}
                                        >
                                            <i className="fas fa-closed-captioning"></i>
                                        </button>
                                        {/* Edit Button */}
                                        <button
                                            onClick={() => showDialogueModal?.(item as ContentItem)}
                                            className="p-3 rounded-full text-primary-blue hover:bg-dark-border transition shadow-sm"
                                            title="Edit Dialogue"
                                            disabled={isGenerating}
                                        >
                                            <i className="fas fa-edit"></i>
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        {/* Download Button (FIXED URL) */}
                                        <a
                                            href={`${apiBaseUrl}/reels/${item.name}`}
                                            download
                                            className="p-3 rounded-full text-success-green hover:bg-dark-border transition shadow-sm"
                                            title="Download Video"
                                        >
                                            <i className="fas fa-download"></i>
                                        </a>
                                        {/* Preview Button (FIXED onClick handler) */}
                                        <button
                                            onClick={() => showPreviewModal?.(`${apiBaseUrl}/reels/${item.name}`)}
                                            className="p-3 rounded-full text-primary-blue hover:bg-dark-border transition shadow-sm"
                                            title="Preview Video"
                                            disabled={isGenerating}
                                        >
                                            <i className="fas fa-eye"></i>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};