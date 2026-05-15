// src/types/index.ts

export interface CharacterDetails {
  avatar: string;
  voice_gemini?: string;
  voice_eleven?: string;
  voice_mac?: string;
  voice_kokoro?: string;
  voice_kokoro_mlx?: string;
}

export interface ConfigData {
  session_count: number;
  characters: Record<string, CharacterDetails>;
  audio_modes: Record<string, string>;
  prompts: Record<string, string>;
  llm_providers: Record<string, string>;
  current_llm_provider: string;
  max_query_length: number;
  kokoro_voices: Record<string, string[]>;
  languages: { code: string; name: string }[];
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
