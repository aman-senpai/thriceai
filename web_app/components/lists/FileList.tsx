import React from 'react';
import { ReelItem, ContentItem } from '../../types';

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
        <div className="bg-card text-card-foreground p-5 sm:p-6 rounded-2xl shadow-sm border border-border h-full flex flex-col">
            <h2 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6 text-foreground flex justify-between items-center">
                <span className="flex items-center gap-2 sm:gap-3">
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl shrink-0 ${isContentList ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'}`}>
                        <i className={`fas ${isContentList ? 'fa-file-lines' : 'fa-film'} text-sm sm:text-base`}></i>
                    </div>
                    {title}
                </span>
                <button onClick={refreshLists} className="p-1.5 sm:p-2 text-muted-foreground hover:text-foreground transition rounded-full hover:bg-secondary">
                    <i className={`fas fa-sync ${isLoading ? "animate-spin" : ""} text-sm sm:text-base`}></i>
                </button>
            </h2>

            <div className="space-y-2 sm:space-y-3 overflow-y-auto custom-scrollbar flex-1 pr-1">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <i className="fas fa-circle-notch fa-spin text-2xl mb-3"></i>
                        <span className="text-sm font-medium">Loading...</span>
                    </div>
                ) : data.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground bg-secondary/30 rounded-2xl border border-dashed border-border">
                        <i className="fas fa-inbox text-3xl mb-2 opacity-50"></i>
                        <p className="text-sm">No {isContentList ? 'content' : 'reels'} yet.</p>
                    </div>
                ) : (
                    data.map((item, index) => (
                        <div key={index} className="group flex justify-between items-center p-3 sm:p-4 rounded-xl bg-background hover:bg-secondary/50 border border-border hover:border-border/80 transition-all shadow-sm hover:shadow-md">
                            <div className="min-w-0 pr-4">
                                <p className="font-semibold text-foreground truncate">{removeExtension(item.name)}</p>
                                <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground font-medium">
                                    <span>{formatTimestamp(item.modified)}</span>
                                    {isContentList ? (
                                        <span className="bg-secondary px-2 py-0.5 rounded-full text-secondary-foreground truncate max-w-[150px]">
                                            {(item as ContentItem).query}
                                        </span>
                                    ) : (
                                        <span className="bg-secondary px-2 py-0.5 rounded-full text-secondary-foreground">
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
                                            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900/20 transition"
                                            title="Generate Caption"
                                            disabled={isGenerating}
                                        >
                                            <i className="fas fa-closed-captioning"></i>
                                        </button>
                                        <button
                                            onClick={() => handleSingleReelGeneration?.(item.name)}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-emerald-500 hover:bg-emerald-100 dark:hover:bg-emerald-900/20 transition"
                                            title="Generate Reel"
                                            disabled={isGenerating}
                                        >
                                            <i className="fas fa-film"></i>
                                        </button>
                                        <button
                                            onClick={() => showDialogueModal?.(item as ContentItem)}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-900/20 transition"
                                            title="Edit Dialogue"
                                            disabled={isGenerating}
                                        >
                                            <i className="fas fa-pencil-alt"></i>
                                        </button>
                                        <button
                                            onClick={() => handleDeleteScript?.(item.name)}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                                            title="Delete Script"
                                            disabled={isGenerating}
                                        >
                                            <i className="fas fa-trash"></i>
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <a
                                            href={`${apiBaseUrl}/api/data/reels/${item.name}`}
                                            download
                                            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-emerald-500 hover:bg-emerald-100 dark:hover:bg-emerald-900/20 transition"
                                            title="Download Video"
                                        >
                                            <i className="fas fa-download"></i>
                                        </a>
                                        <button
                                            onClick={() => showPreviewModal?.(`${apiBaseUrl}/reels/${item.name}`)}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/20 transition"
                                            title="Preview Video"
                                            disabled={isGenerating}
                                        >
                                            <i className="fas fa-play"></i>
                                        </button>
                                        <button
                                            onClick={() => handleDeleteReel?.(item.name)}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
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