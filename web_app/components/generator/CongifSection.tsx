// src/components/generator/ConfigSection.tsx
import React from 'react';
import { ConfigData } from '@/types';
import { primaryButtonClasses, selectOrInputClasses, cardClasses, successGreen, dangerRed } from '@/lib/constants'; // Adjust path if using separate types file

interface ConfigSectionProps {
    config: ConfigData | null;
    charA: string; setCharA: (v: string) => void;
    charB: string; setCharB: (v: string) => void;
    audioMode: string; setAudioMode: (v: string) => void;
    promptPath: string; setPromptPath: (v: string) => void;
    query: string; setQuery: (v: string) => void;
    fileName: string; setFileName: (v: string) => void;
    isConfigLoading: boolean;
    isContentGenerating: boolean;
    isConfigValid: boolean;
    contentStatus: string;
    handleContentGeneration: (e: React.FormEvent) => Promise<void>;
}

const GenerateButton = ({ children, disabled, className = "", isSubmit = false }: { children: React.ReactNode; disabled: boolean; className?: string, isSubmit?: boolean }) => (
    <button
        disabled={disabled}
        type={isSubmit ? "submit" : "button"}
        className={primaryButtonClasses + " " + className}
    >
        {children}
    </button>
);


export const ConfigSection: React.FC<ConfigSectionProps> = ({
    config, charA, setCharA, charB, setCharB, audioMode, setAudioMode, promptPath, setPromptPath, query, setQuery, fileName, setFileName,
    isConfigLoading, isContentGenerating, isConfigValid, contentStatus, handleContentGeneration
}) => {
    return (
        <div id="config-section" className={cardClasses}>
            <h2 className="text-2xl font-bold mb-6 text-primary-blue border-b border-dark-border/50 pb-3 flex items-center">
                <i className="fas fa-magic mr-2"></i>Generate Dialogue Content
            </h2>
            <form onSubmit={handleContentGeneration} className="space-y-6">

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Character A */}
                    <div>
                        <label className="block text-sm font-medium mb-1 text-gray-400">Character A</label>
                        <select
                            value={charA}
                            onChange={(e) => setCharA(e.target.value)}
                            className={selectOrInputClasses}
                            disabled={isConfigLoading || isContentGenerating}
                            id="char_a_name"
                        >
                            {config && Object.entries(config.characters).map(([key, obj]) => (
                                <option key={key} value={key}>
                                    {`${key.toUpperCase()} — ${obj.voice_gemini || obj.voice_eleven || obj.voice_mac || 'N/A'}`}
                                </option>
                            ))}
                        </select>
                    </div>
                    {/* Character B */}
                    <div>
                        <label className="block text-sm font-medium mb-1 text-gray-400">Character B</label>
                        <select
                            value={charB}
                            onChange={(e) => setCharB(e.target.value)}
                            className={selectOrInputClasses}
                            disabled={isConfigLoading || isContentGenerating}
                            id="char_b_name"
                        >
                            {config && Object.entries(config.characters).map(([key, obj]) => (
                                <option key={key} value={key}>
                                    {`${key.toUpperCase()} — ${obj.voice_gemini || obj.voice_eleven || obj.voice_mac || 'N/A'}`}
                                </option>
                            ))}
                        </select>
                        {charA === charB && charA && <p className="text-danger-red text-xs mt-1 flex items-center"><i className="fas fa-exclamation-triangle mr-1"></i> Characters must be different.</p>}
                    </div>
                </div>

                {/* Audio Mode and Prompt */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium mb-1 text-gray-400">Audio Mode</label>
                        <select
                            value={audioMode}
                            onChange={(e) => setAudioMode(e.target.value)}
                            className={selectOrInputClasses}
                            disabled={isConfigLoading || isContentGenerating}
                            id="audio_mode"
                        >
                            {config && Object.entries(config.audio_modes).map(([key, name]) => (
                                <option key={key} value={key}>{name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1 text-gray-400">Prompt Template</label>
                        <select
                            value={promptPath}
                            onChange={(e) => setPromptPath(e.target.value)}
                            className={selectOrInputClasses}
                            disabled={isConfigLoading || isContentGenerating}
                            id="selected_prompt_path"
                        >
                            {config && Object.entries(config.prompts).map(([path, name]) => (
                                <option key={path} value={path}>{name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Query/Topic */}
                <div>
                    <label className="block text-sm font-medium mb-1 text-gray-400">Query/Topic for Content</label>
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        maxLength={config?.max_query_length || 200}
                        placeholder="e.g., 'A funny debate about pineapples on pizza'"
                        className={selectOrInputClasses}
                        disabled={isConfigLoading || isContentGenerating}
                        id="query_input"
                    />
                    <p className="text-xs text-gray-500 mt-1 text-right">{query.length} / {config?.max_query_length || 200}</p>
                </div>

                {/* Output Filename */}
                <div>
                    <label className="block text-sm font-medium mb-1 text-gray-400">Output Filename (e.g., debate_pizza)</label>
                    <div className="relative">
                        <input
                            type="text"
                            value={fileName}
                            onChange={(e) => setFileName(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())} // Sanitize
                            placeholder="file_name (omit extension)"
                            className={selectOrInputClasses}
                            disabled={isConfigLoading || isContentGenerating}
                            id="file_name_input"
                        />
                        <i className="fas fa-file-alt absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500"></i>
                    </div>
                </div>

                <GenerateButton
                    disabled={!isConfigValid || isContentGenerating || isConfigLoading}
                    isSubmit={true}
                    className="flex justify-center items-center mt-6"
                >
                    {isContentGenerating ? (
                        <>
                            <i className="fas fa-spinner fa-spin mr-2"></i> Generating Dialogue...
                        </>
                    ) : (
                        <>
                            <i className="fas fa-play-circle mr-2"></i>
                            <span id="generate-content-btn">Generate Content</span>
                        </>
                    )}
                </GenerateButton>
                <p id="content-status" className="mt-4 text-sm text-center font-medium" style={{ color: contentStatus.startsWith('✅') ? successGreen : contentStatus.startsWith('❌') ? dangerRed : 'var(--color-text-gray)' }}>{contentStatus}</p>
            </form>
        </div>
    );
};