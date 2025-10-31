// src/components/generator/ReelGenerationSection.tsx
import React from 'react';
// CORRECTED IMPORTS (Assuming path aliases or adjust to relative paths)
import { ConfigData } from '@/types'; 
import { cardClasses, successButtonClasses, primaryButtonClasses, successGreen, dangerRed } from '@/lib/constants'; 

interface ReelGenerationSectionProps {
    sessionCount: number;
    audioMode: string;
    reelStatus: string;
    isReelGenerating: boolean;
    // UPDATED: Use two specific handlers
    handleSessionReelGeneration: () => Promise<void>; 
    handleAllReelGeneration: () => Promise<void>;
    config: ConfigData | null;
}

const PrimaryButton = ({ children, onClick, disabled, className = "" }: { children: React.ReactNode; onClick: () => void; disabled: boolean; className?: string }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={primaryButtonClasses + " " + className}
    >
        {children}
    </button>
);

const SuccessButton = ({ children, onClick, disabled, className = "" }: { children: React.ReactNode; onClick: () => void; disabled: boolean; className?: string }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={successButtonClasses + " " + className}
    >
        {children}
    </button>
);


export const ReelGenerationSection: React.FC<ReelGenerationSectionProps> = ({
    sessionCount,
    audioMode,
    reelStatus,
    isReelGenerating,
    // DESTRUCTURE THE NEW HANDLERS
    handleSessionReelGeneration,
    handleAllReelGeneration,
    config
}) => {
    const isAudioModeValid = !!audioMode;
    const currentModeName = config?.audio_modes[audioMode] || 'None';

    return (
        <div className={cardClasses}>
            <h2 className="text-2xl font-bold mb-6 text-primary-blue border-b border-dark-border/50 pb-3 flex items-center">
                <i className="fas fa-film mr-2"></i>Generate Video Reels
            </h2>
            <div className="flex flex-col space-y-4">
                <PrimaryButton
                    // CORRECTED HANDLER CALL
                    onClick={handleSessionReelGeneration} 
                    disabled={isReelGenerating || sessionCount <= 0 || !isAudioModeValid}
                    className="flex justify-center items-center"
                >
                    {isReelGenerating && sessionCount > 0 ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-bolt mr-2"></i>}
                    <span id="generate-session-reels-btn">Generate Session Reels (<span id="session-count">{sessionCount}</span> Remaining)</span>
                </PrimaryButton>
                <SuccessButton
                    // CORRECTED HANDLER CALL
                    onClick={handleAllReelGeneration}
                    disabled={isReelGenerating || !isAudioModeValid}
                    className="flex justify-center items-center"
                >
                    {isReelGenerating && sessionCount === 0 ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-rocket mr-2"></i>}
                    <span id="generate-all-reels-btn">Generate ALL Reels</span>
                </SuccessButton>
            </div>
            <p id="reel-status" className="mt-4 text-sm text-center font-medium" style={{ color: reelStatus.startsWith('✅') ? successGreen : reelStatus.startsWith('❌') ? dangerRed : 'var(--color-text-gray)' }}>
                {reelStatus || `Current Audio Mode: ${currentModeName}.`}
            </p>
        </div>
    );
};