import { ConfigData } from "@/types";

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
    llm_providers: data.llm_providers || {
      gemini: "Gemini (Google)",
      deepseek: "DeepSeek",
    },
    current_llm_provider: data.current_llm_provider || "gemini",
    max_query_length: 5000,
    kokoro_voices: data.kokoro_voices || {},
    languages: data.languages || [{ code: "en", name: "English" }],
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
    formData.append("language", payload.language || "en");
    if (payload.llm_provider) {
      formData.append("llm_provider", payload.llm_provider);
    }
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
    headers: { "Content-Type": "application/json" },
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
