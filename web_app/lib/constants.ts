// src/lib/constants.ts
import { ConfigData } from "../types"; // Adjusted import path

// --- Modern Minimal Design Tokens (Zinc Theme) ---
export const GLASS_CARD =
  "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300";
export const CLEAN_INPUT =
  "w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all font-medium text-zinc-800 dark:text-zinc-200 placeholder-zinc-400";
export const ACTION_BUTTON =
  "w-full py-3.5 rounded-xl font-bold tracking-wide transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md flex justify-center items-center gap-2";

export const BTN_PRIMARY = `${ACTION_BUTTON} bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200`;
export const BTN_SECONDARY = `${ACTION_BUTTON} bg-white text-zinc-900 border border-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-800`;
export const BTN_SUCCESS = `${ACTION_BUTTON} bg-emerald-600 text-white hover:bg-emerald-700`;
export const BTN_DANGER = `${ACTION_BUTTON} bg-rose-500 text-white hover:bg-rose-600`;

// --- Legacy mappings for compatibility ---
export const cardClasses = GLASS_CARD;
export const selectOrInputClasses = CLEAN_INPUT;
export const primaryButtonClasses = BTN_PRIMARY;
export const successButtonClasses = BTN_SUCCESS;
export const dangerButtonClasses = BTN_DANGER;
export const primaryBlue = "#18181b"; // zinc-900
export const successGreen = "#10b981";
export const dangerRed = "#f43f5e";

// --- API Functions (moved from page.tsx) ---
const API_BASE_URL =
  typeof window === "undefined"
    ? "http://localhost:8008"
    : `http://${window.location.hostname}:8008`;

export const fetchData = async <T>(endpoint: string): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${endpoint}`);
  if (!response.ok)
    throw new Error(`Failed to fetch ${endpoint}: ${response.statusText}`);
  return response.json() as Promise<T>;
};

export const fetchConfig = async (): Promise<ConfigData> => {
  const response = await fetch(`${API_BASE_URL}/api/data/config`);
  if (!response.ok)
    throw new Error(`Failed to fetch config: ${response.statusText}`);
  const data = await response.json();

  return {
    session_count: data.session_count,
    characters: data.characters,
    audio_modes: Object.fromEntries(
      data.tts_modes.map((mode: string) => [
        mode,
        mode.replace(/_/g, " ").toUpperCase(),
      ]),
    ),
    prompts: Object.fromEntries(
      data.prompt_files.map((p: any) => [p.path, p.name]),
    ),
    max_query_length: 5000,
  };
};

export const postData = async (endpoint: string, payload: any) => {
  const formData = new FormData();
  if (endpoint.includes("generate-content")) {
    formData.append("char_a_name", payload.char_a_name);
    formData.append("char_b_name", payload.char_b_name);
    formData.append("selected_prompt_path", payload.selected_prompt_path);
    formData.append("query", payload.query);
    formData.append("file_name", payload.file_name);
  } else if (endpoint.includes("reels") && payload.audio_mode) {
    formData.append("audio_mode", payload.audio_mode);
  } else if (endpoint.includes("update-content")) {
    formData.append("file_name", payload.file_name);
    formData.append("content", payload.content);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    const errorText = await response.text();
    try {
      const errorJson = JSON.parse(errorText);
      throw new Error(
        errorJson.detail || `POST ${endpoint} failed: ${response.statusText}`,
      );
    } catch {
      throw new Error(`POST ${endpoint} failed: ${errorText}`);
    }
  }
  return response.json();
};
