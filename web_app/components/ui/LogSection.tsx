import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Terminal, RefreshCw, X } from "lucide-react";
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
  <Card className="h-full flex flex-col min-h-0 border-border shadow-sm">
    <CardHeader className="p-4 pb-0 shrink-0 flex-row items-center justify-between space-y-0">
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-secondary rounded-lg text-secondary-foreground">
          <Terminal className="h-3 w-3" />
        </div>
        <CardTitle className="text-xs font-bold text-foreground">
          Activity Log
        </CardTitle>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-muted-foreground hover:text-foreground"
          onClick={refreshLists}
          title="Refresh"
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
        {onClose && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-muted-foreground hover:text-destructive"
            onClick={onClose}
            title="Close Panel"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </CardHeader>
    <CardContent className="flex-1 min-h-0 p-4 pt-3">
      <ScrollArea className="h-full">
        <div className="font-mono text-[10px] p-3 bg-secondary/30 rounded-xl border border-border space-y-1.5 shadow-inner">
          {logMessages.length === 0 && (
            <span className="text-muted-foreground italic">
              System ready...
            </span>
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
                  className={cn(
                    "break-words",
                    log.type === "error" && "text-destructive font-bold",
                    log.type === "success" && "text-success",
                    log.type === "warn" && "text-warning",
                    log.type === "info" && "text-foreground/80",
                  )}
                >
                  {log.message}
                </span>
              </div>
            ))}
        </div>
      </ScrollArea>
    </CardContent>
  </Card>
);
