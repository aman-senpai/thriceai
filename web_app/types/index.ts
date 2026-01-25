// src/types/index.ts

export interface CharacterDetails {
  avatar: string;
  voice_gemini?: string;
  voice_eleven?: string;
  voice_mac?: string;
}

export interface ConfigData {
  session_count: number;
  characters: Record<string, CharacterDetails>;
  audio_modes: Record<string, string>;
  prompts: Record<string, string>;
  max_query_length: number;
}

export interface ReelItem {
  name: string;
  path: string;
  size_kb: number;
  modified: number;
  content_exists: boolean;
}

export interface ContentItem {
  name: string;
  path: string;
  modified: number;
  query: string;
  dialogues: { speaker: string; dialogue: string }[];
}

export type LogType = "info" | "error" | "warn" | "success";

export interface LogMessage {
  timestamp: string;
  type: LogType;
  message: string;
}