// src/lib/constants.ts
import { ConfigData } from "../types"; // Adjusted import path

// --- Modern Minimal Design Tokens (Semantic Theme) ---
export const GLASS_CARD =
  "bg-card text-card-foreground border border-border rounded-xl shadow-sm hover:shadow-md transition-all duration-300";
export const CLEAN_INPUT =
  "w-full bg-background border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-ring transition-all font-medium text-foreground placeholder-muted-foreground";
export const ACTION_BUTTON =
  "w-full py-3.5 rounded-xl font-bold tracking-wide transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md flex justify-center items-center gap-2";

export const BTN_PRIMARY = `${ACTION_BUTTON} bg-primary text-primary-foreground hover:bg-primary/90`;
export const BTN_SECONDARY = `${ACTION_BUTTON} bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border`;
export const BTN_SUCCESS = `${ACTION_BUTTON} bg-emerald-600 text-white hover:bg-emerald-700`;
export const BTN_DANGER = `${ACTION_BUTTON} bg-destructive text-destructive-foreground hover:bg-destructive/90`;

// --- Legacy mappings for compatibility ---
export const cardClasses = GLASS_CARD;
export const selectOrInputClasses = CLEAN_INPUT;
export const primaryButtonClasses = BTN_PRIMARY;
export const successButtonClasses = BTN_SUCCESS;
export const dangerButtonClasses = BTN_DANGER;
export const primaryBlue = "hsl(var(--primary))";
export const successGreen = "#10b981";
export const dangerRed = "hsl(var(--destructive))";

// --- API Functions (moved from page.tsx) ---
export const API_BASE_URL =
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
      data.prompt_files.map((p: { path: string; name: string }) => [
        p.path,
        p.name,
      ]),
    ),
    max_query_length: 5000,
  };
};

export const postData = async (
  endpoint: string,
  payload: Record<string, any>,
) => {
  const formData = new FormData();
  if (endpoint.includes("generate-content")) {
    formData.append("char_a_name", payload.char_a_name);
    formData.append("char_b_name", payload.char_b_name);
    formData.append("selected_prompt_path", payload.selected_prompt_path);
    formData.append("query", payload.query);
    formData.append("file_name", payload.file_name);
  } else if (endpoint.includes("reel") && payload.audio_mode) {
    formData.append("audio_mode", payload.audio_mode);
    if (payload.filename) {
      formData.append("filename", payload.filename);
    }
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

export const postJson = async (endpoint: string, payload: any) => {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
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
