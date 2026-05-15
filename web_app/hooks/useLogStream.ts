import { useState, useEffect } from "react";
import type { LogType } from "@/types";

export interface LogMessage {
  timestamp: string;
  type: LogType;
  message: string;
}

export const useLogStream = (apiBaseUrl: string) => {
  const [logMessages, setLogMessages] = useState<LogMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Initial fetch of recent logs
    const fetchRecentLogs = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/logs/recent`);
        if (response.ok) {
          const data = await response.json();
          setLogMessages(data.logs || []);
        }
      } catch (err) {
        console.error("Failed to fetch recent logs:", err);
      }
    };

    fetchRecentLogs();

    // Setup SSE connection
    const eventSource = new EventSource(`${apiBaseUrl}/api/logs/stream`);

    eventSource.onopen = () => {
      setIsConnected(true);
      console.log("Log stream connected");
    };

    eventSource.onmessage = (event) => {
      try {
        const newLog = JSON.parse(event.data);
        setLogMessages((prev) => [...prev, newLog].slice(-500));
      } catch (err) {
        // Skip non-json (keepalives)
      }
    };

    eventSource.onerror = (err) => {
      setIsConnected(false);
      console.error("Log stream error:", err);
      // EventSource will automatically attempt to reconnect
    };

    return () => {
      eventSource.close();
    };
  }, [apiBaseUrl]);

  return { logMessages, isConnected };
};
