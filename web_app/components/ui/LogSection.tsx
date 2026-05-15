import React from "react";
import { LogMessage } from "@/types";

interface LogSectionProps {
  logMessages: LogMessage[];
  refreshLists: () => void;
  onClose?: () => void;
}

export const LogSection = ({
  logMessages,
  refreshLists,
  onClose,
}: LogSectionProps) => (
  <div className="bg-card text-card-foreground p-4 rounded-2xl shadow-sm border border-border h-full flex flex-col min-h-0">
    <div className="flex justify-between items-center mb-3 shrink-0">
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-secondary rounded-lg text-secondary-foreground">
          <i className="fas fa-terminal text-xs"></i>
        </div>
        <h2 className="text-xs font-bold text-foreground">Activity Log</h2>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={refreshLists}
          className="p-1 px-2 text-muted-foreground hover:text-foreground transition rounded hover:bg-secondary"
          title="Refresh"
        >
          <i className="fas fa-sync text-xs"></i>
        </button>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 px-2 text-muted-foreground hover:text-destructive transition rounded hover:bg-secondary"
            title="Close Panel"
          >
            <i className="fas fa-times text-xs"></i>
          </button>
        )}
      </div>
    </div>
    <div className="flex-1 overflow-y-auto custom-scrollbar font-mono text-[10px] p-3 bg-secondary/30 rounded-xl border border-border space-y-1.5 shadow-inner min-h-0 h-full max-h-full">
      {logMessages.length === 0 && (
        <span className="text-muted-foreground italic">System ready...</span>
      )}
      {[...logMessages]
        .reverse()
        .filter((log) => !log.message.startsWith("PROGRESS:"))
        .map((log, idx) => (
        <div key={idx} className="flex gap-2 leading-tight">
          <span className="text-muted-foreground shrink-0 select-none opacity-50">
            {log.timestamp}
          </span>
          <span
            className={`${log.type === "error"
              ? "text-destructive font-bold"
              : log.type === "success"
                ? "text-emerald-600 dark:text-emerald-400"
                : log.type === "warn"
                  ? "text-amber-500"
                  : "text-foreground/80"
              } break-words`}
          >
            {log.message}
          </span>
        </div>
      ))}
    </div>
  </div>
);