// src/components/ui/LogSection.tsx
import React from 'react';
import { LogMessage, LogType } from '../../types'; // Adjust path
import { cardClasses, primaryBlue, dangerRed } from '../../lib/constants'; // Adjust path

interface LogSectionProps {
    logMessages: LogMessage[];
    setLogMessages: (messages: LogMessage[]) => void;
}

const logColorClasses: Record<LogType, string> = {
    info: "text-primary-blue",
    error: "text-danger-red",
    warn: "text-warning-yellow",
    success: "text-success-green",
};

export const LogSection: React.FC<LogSectionProps> = ({ logMessages, setLogMessages }) => (
    <div className={cardClasses}>
        <h2 className={`text-2xl font-bold mb-4 ${primaryBlue} flex justify-between items-center border-b border-dark-border/50 pb-3`}>
            <i className="fas fa-terminal mr-2"></i> Terminal Log
            <button onClick={() => setLogMessages([])} className="text-gray-400 hover:text-danger-red transition text-base font-normal flex items-center">
                 <i className="fas fa-trash-alt mr-1"></i> Clear Log
            </button>
        </h2>
        <pre id="log-output" className="h-64 overflow-y-auto font-mono text-xs bg-dark-bg/50 p-3 rounded-xl border border-dark-border/70 custom-scrollbar">
            {logMessages.map((log, idx) => (
                <div key={idx} className={`${logColorClasses[log.type]} whitespace-pre-wrap leading-relaxed`}>
                    <span className="text-gray-500">[{log.timestamp}]</span> {log.message}
                </div>
            ))}
        </pre>
    </div>
);