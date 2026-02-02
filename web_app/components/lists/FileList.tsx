import React from 'react';
import { ReelItem, ContentItem } from '../../types';
import { cardClasses } from '../../lib/constants';

interface FileListProps {
    title: string;
    data: ReelItem[] | ContentItem[];
    isLoading: boolean;
    isContentList: boolean;
    showPreviewModal?: (url: string) => void;
    showDialogueModal?: (item: ContentItem) => void;
    handleCaptionGeneration?: (contentFileName: string) => Promise<void>;
    handleSingleReelGeneration?: (contentFileName: string) => Promise<void>;
    handleDeleteScript?: (filename: string) => Promise<void>;
    handleDeleteReel?: (filename: string) => Promise<void>;
    isContentGenerating?: boolean;
    isReelGenerating?: boolean;
    refreshLists: () => Promise<void>;
    apiBaseUrl: string;
}

const formatTimestamp = (ms: number) => {
    if (!ms) return 'N/A';
    return new Date(ms).toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
};

export const FileList: React.FC<FileListProps> = ({
    title, data, isLoading, isContentList,
    showPreviewModal, showDialogueModal, handleCaptionGeneration, handleSingleReelGeneration,
    handleDeleteScript, handleDeleteReel,
    isContentGenerating = false, isReelGenerating = false, refreshLists, apiBaseUrl
}) => {
    const isGenerating = isContentGenerating || isReelGenerating;

    const removeExtension = (fileName: string) => {
        return fileName.replace(/\.[^/.]+$/, "");
    }

    return (
        <div className={cardClasses + " p-4 sm:p-6 h-full flex flex-col"}>
            <h2 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6 text-zinc-900 dark:text-white flex justify-between items-center">
                <span className="flex items-center gap-2 sm:gap-3">
                    <div className={`p-1.5 sm:p-2 rounded-lg ${isContentList ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'} dark:bg-zinc-800`}>
                        <i className={`fas ${isContentList ? 'fa-file-lines' : 'fa-film'} text-sm sm:text-base`}></i>
                    </div>
                    {title}
                </span>
                <button onClick={refreshLists} className="p-1.5 sm:p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800">
                    <i className={`fas fa-sync ${isLoading ? "animate-spin" : ""} text-sm sm:text-base`}></i>
                </button>
            </h2>

            <div className="space-y-2 sm:space-y-3 overflow-y-auto custom-scrollbar flex-1 pr-1">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-zinc-400">
                        <i className="fas fa-circle-notch fa-spin text-xl sm:text-2xl mb-2 sm:mb-3"></i>
                        <span className="text-xs sm:text-sm font-medium">Loading...</span>
                    </div>
                ) : data.length === 0 ? (
                    <div className="text-center py-8 sm:py-12 text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
                        <i className="fas fa-inbox text-2xl sm:text-3xl mb-2 opacity-50"></i>
                        <p className="text-xs sm:text-sm">No {isContentList ? 'content' : 'reels'} yet.</p>
                    </div>
                ) : (
                    data.map((item, index) => (
                        <div key={index} className="group flex justify-between items-center p-3 sm:p-4 rounded-xl bg-zinc-50 hover:bg-white border border-zinc-100 hover:border-zinc-200 dark:bg-zinc-900/30 dark:hover:bg-zinc-800 dark:border-zinc-800 transition-all shadow-sm hover:shadow-md">
                            <div className="min-w-0 pr-4">
                                <p className="font-semibold text-zinc-700 dark:text-zinc-200 truncate">{removeExtension(item.name)}</p>
                                <div className="flex items-center gap-2 mt-1 text-xs text-zinc-400 font-medium">
                                    <span>{formatTimestamp(item.modified)}</span>
                                    {isContentList ? (
                                        <span className="bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-[10px] truncate max-w-[150px]">
                                            {(item as ContentItem).query}
                                        </span>
                                    ) : (
                                        <span className="bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-[10px]">
                                            {(item as ReelItem).size_kb.toFixed(1)} KB
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                {isContentList ? (
                                    <>
                                        <button
                                            onClick={() => handleCaptionGeneration?.(item.name)}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition"
                                            title="Generate Caption"
                                            disabled={isGenerating}
                                        >
                                            <i className="fas fa-closed-captioning"></i>
                                        </button>
                                        <button
                                            onClick={() => handleSingleReelGeneration?.(item.name)}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition"
                                            title="Generate Reel"
                                            disabled={isGenerating}
                                        >
                                            <i className="fas fa-film"></i>
                                        </button>
                                        <button
                                            onClick={() => showDialogueModal?.(item as ContentItem)}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition"
                                            title="Edit Dialogue"
                                            disabled={isGenerating}
                                        >
                                            <i className="fas fa-pencil-alt"></i>
                                        </button>
                                        <button
                                            onClick={() => handleDeleteScript?.(item.name)}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition"
                                            title="Delete Script"
                                            disabled={isGenerating}
                                        >
                                            <i className="fas fa-trash"></i>
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <a
                                            href={`${apiBaseUrl}/reels/${item.name}`}
                                            download
                                            className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition"
                                            title="Download Video"
                                        >
                                            <i className="fas fa-download"></i>
                                        </a>
                                        <button
                                            onClick={() => showPreviewModal?.(`${apiBaseUrl}/reels/${item.name}`)}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"
                                            title="Preview Video"
                                            disabled={isGenerating}
                                        >
                                            <i className="fas fa-play"></i>
                                        </button>
                                        <button
                                            onClick={() => handleDeleteReel?.(item.name)}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition"
                                            title="Delete Reel"
                                            disabled={isGenerating}
                                        >
                                            <i className="fas fa-trash"></i>
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