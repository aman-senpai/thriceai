// src/components/ui/Header.tsx
import React from 'react';

// Assuming these are imported from the main file or a constants file
interface HeaderProps {
    sessionCount: number;
    isReelGenerating: boolean;
    isContentGenerating: boolean;
    isListsLoading: boolean;
    refreshLists: () => Promise<void>;
    toggleTheme: () => void;
    isDark: boolean;
}

export const Header: React.FC<HeaderProps> = ({
    sessionCount,
    isReelGenerating,
    isContentGenerating,
    isListsLoading,
    refreshLists,
    toggleTheme,
    isDark,
}) => (
    <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b-4 border-primary-blue/50 pb-4 mb-10">
        <h1 className="text-4xl font-extrabold text-primary-blue flex items-center">
            <i className="fas fa-film mr-3 text-3xl"></i> AI Reel Generator
        </h1>
        <div className="mt-4 sm:mt-0 flex items-center space-x-3">
            <span className="text-sm font-medium text-gray-400 hidden sm:block">
                Session Count: <span className="font-bold text-primary-blue">{sessionCount}</span>
            </span>
            {/* Refresh Button */}
            <button
                onClick={refreshLists}
                disabled={isReelGenerating || isContentGenerating}
                className="p-3 rounded-full bg-dark-card border border-dark-border/50 hover:bg-dark-border/70 transition text-gray-400 hover:text-primary-blue shadow-md"
                title="Refresh Lists"
            >
                <i className={`fas fa-sync text-lg ${isListsLoading ? "animate-spin" : ""}`}></i>
            </button>
            {/* Theme Toggle Button */}
            <button
                onClick={toggleTheme}
                className="p-3 rounded-full bg-dark-card border border-dark-border/50 hover:bg-dark-border/70 transition shadow-md"
                title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
                <i className={`fas ${isDark ? 'fa-sun text-yellow-400' : 'fa-moon text-gray-500'} text-lg`}></i>
            </button>
        </div>
    </header>
);