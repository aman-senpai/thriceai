// src/lib/constants.ts
import { ConfigData } from "../types"; // Adjusted import path

// --- Design Constants ---
export const primaryBlue = "#3b82f6";
export const successGreen = "#10b981";
export const dangerRed = "#ef4444";

export const cardClasses = "bg-dark-card p-6 rounded-3xl shadow-2xl border border-dark-border/50 transition-colors duration-300";
export const selectOrInputClasses = "w-full p-3 rounded-xl bg-dark-bg border border-dark-border focus:ring-primary-blue focus:border-primary-blue transition text-gray-200 shadow-inner";
export const primaryButtonClasses = "w-full py-3 bg-primary-blue text-white font-semibold rounded-xl hover:bg-blue-600 transition duration-200 disabled:opacity-60 disabled:cursor-not-allowed transform hover:scale-[1.01] active:scale-[0.99] shadow-lg focus:ring-2 focus:ring-primary-blue/50";
export const successButtonClasses = "py-3 bg-success-green text-white font-semibold rounded-xl hover:bg-green-600 transition duration-200 disabled:opacity-60 disabled:cursor-not-allowed transform hover:scale-[1.01] active:scale-[0.99] shadow-lg focus:ring-2 focus:ring-success-green/50";
export const dangerButtonClasses = "py-2 px-4 bg-danger-red text-white font-semibold rounded-lg hover:bg-red-600 transition duration-200 disabled:opacity-60 disabled:cursor-not-allowed";

// --- API Functions (moved from page.tsx) ---
const API_BASE_URL = typeof window === 'undefined' 
  ? 'http://localhost:8000' 
  : `http://${window.location.hostname}:8000`;

export const fetchData = async <T,>(endpoint: string): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${endpoint}`);
  if (!response.ok) throw new Error(`Failed to fetch ${endpoint}: ${response.statusText}`);
  return response.json() as Promise<T>;
};

export const fetchConfig = async (): Promise<ConfigData> => {
  const response = await fetch(`${API_BASE_URL}/api/data/config`);
  if (!response.ok) throw new Error(`Failed to fetch config: ${response.statusText}`);
  const data = await response.json();

  return {
    session_count: data.session_count,
    characters: data.characters,
    audio_modes: Object.fromEntries(
      data.tts_modes.map((mode: string) => [mode, mode.replace(/_/g, ' ').toUpperCase()])
    ),
    prompts: Object.fromEntries(
      data.prompt_files.map((p: any) => [p.path, p.name])
    ),
    max_query_length: 200,
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
        throw new Error(errorJson.detail || `POST ${endpoint} failed: ${response.statusText}`);
    } catch {
        throw new Error(`POST ${endpoint} failed: ${errorText}`);
    }
  }
  return response.json();
};