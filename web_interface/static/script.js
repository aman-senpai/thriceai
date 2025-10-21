// web_interface/script.js

// --- Global Variables and DOM Elements ---
const contentForm = document.getElementById("generate-content-form");
const generateContentBtn = document.getElementById("generate-content-btn");
const generateSessionBtn = document.getElementById(
  "generate-session-reels-btn"
);
const generateAllBtn = document.getElementById("generate-all-reels-btn");
const contentStatus = document.getElementById("content-status");
const reelStatus = document.getElementById("reel-status");
const logOutput = document.getElementById("log-output");
const sessionCountSpan = document.getElementById("session-count");
const configSection = document.getElementById("config-section");
const charPreview = document.getElementById("character-preview");
const reelsListDiv = document.getElementById("reels-list");
const themeToggle = document.getElementById("theme-toggle");
const previewModal = document.getElementById("preview-modal");

let CONFIG_DATA = {}; // Global store for config data

// Helper to get dynamically created inputs safely
const getEl = (id) => document.getElementById(id);

// --- Utility Functions ---

function log(message, type = "info") {
  const now = new Date().toLocaleTimeString();
  let colorClass = "text-green-400";
  if (type === "error") colorClass = "text-red-400";
  if (type === "warn") colorClass = "text-yellow-400";
  if (type === "info") colorClass = "text-blue-400";

  logOutput.innerHTML += `<span class="${colorClass}">[${now}] [${type.toUpperCase()}]</span> ${message}\n`;
  logOutput.scrollTop = logOutput.scrollHeight;
}

function checkConfigAndEnableContentButton() {
  const charASelect = getEl("char_a_name");
  const charBSelect = getEl("char_b_name");
  const audioModeSelect = getEl("audio_mode");
  const promptSelect = getEl("selected_prompt_path");
  const queryInput = getEl("query_input");
  const fileNameInput = getEl("file_name_input");

  if (
    !charASelect ||
    !charBSelect ||
    !audioModeSelect ||
    !promptSelect ||
    !queryInput ||
    !fileNameInput
  ) {
    generateContentBtn.disabled = true;
    return;
  }

  const charA = charASelect.value;
  const charB = charBSelect.value;

  const isConfigValid =
    audioModeSelect.value &&
    promptSelect.value &&
    queryInput.value.trim().length > 5 &&
    fileNameInput.value.trim() &&
    charA &&
    charB &&
    charA !== charB;

  generateContentBtn.disabled = !isConfigValid;

  renderCharacterPreview(charA, charB);
}

function updateSessionButton(count) {
  sessionCountSpan.textContent = count;
  generateSessionBtn.disabled = count === 0;
}

// *** FIXED: Avatar rendering with better error handling ***
function renderCharacterPreview(charA, charB) {
  const charPreview = getEl("character-preview");
  if (!charPreview) {
    console.warn("Character preview element not found");
    return;
  }

  charPreview.innerHTML = "";

  // Ensure CONFIG_DATA is available
  if (!CONFIG_DATA || !CONFIG_DATA.characters) {
    charPreview.innerHTML =
      '<p class="text-red-400 text-sm">Configuration not loaded</p>';
    return;
  }

  const charAData = CONFIG_DATA.characters[charA];
  const charBData = CONFIG_DATA.characters[charB];

  if (charA && charAData) {
    charPreview.appendChild(createCharCard(charA, charAData, "A"));
  } else if (charA) {
    charPreview.appendChild(createErrorCard(charA, "A"));
  }

  if (charB && charBData) {
    charPreview.appendChild(createCharCard(charB, charBData, "B"));
  } else if (charB) {
    charPreview.appendChild(createErrorCard(charB, "B"));
  }

  // If no characters selected, show placeholder
  if (charPreview.innerHTML === "") {
    charPreview.innerHTML =
      '<p class="text-gray-500 text-sm">Select characters to preview</p>';
  }
}

// *** FIXED: Better avatar card creation with fallbacks ***
function createCharCard(name, data, label) {
  const div = document.createElement("div");
  div.className =
    "text-center p-3 rounded-lg bg-gray-900/50 flex-1 border border-gray-700 min-w-[120px]";

  let avatarFilename;
  let voiceInfo;

  // Handle different data structures
  if (typeof data === "string") {
    avatarFilename = data;
    voiceInfo = "Default Voice";
  } else if (typeof data === "object" && data !== null) {
    avatarFilename = data.avatar || data.image || data.filename;
    voiceInfo = data.voice || data.tts_voice || "No Voice";
  } else {
    avatarFilename = null;
    voiceInfo = "Invalid Data";
  }

  // Final safety check with multiple fallbacks
  if (!avatarFilename) {
    return createErrorCard(name, label, "No avatar file");
  }

  // Construct avatar path - try multiple possible locations
  const avatarPath = `/assets/avatars/${avatarFilename}`;
  const fallbackPath = "/static/placeholder.png";

  div.innerHTML = `
        <div class="relative">
            <img src="${avatarPath}" alt="${name}" 
                 class="w-16 h-16 mx-auto rounded-full object-cover border-2 border-blue-400 shadow-md bg-gray-800"
                 onerror="this.onerror=null; this.src='${fallbackPath}'; this.classList.add('opacity-50');"
                 onload="this.classList.remove('opacity-50');"
            >
            <div class="absolute -top-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold">
                ${label}
            </div>
        </div>
        <p class="text-sm font-semibold mt-2 text-gray-200 truncate">${name}</p>
        <p class="text-xs text-gray-500 truncate" title="${voiceInfo}">${voiceInfo}</p>
    `;

  return div;
}

function createErrorCard(name, label, error = "Not found") {
  const div = document.createElement("div");
  div.className =
    "text-center p-3 rounded-lg bg-red-900/20 flex-1 border border-red-700 min-w-[120px]";
  div.innerHTML = `
        <div class="w-16 h-16 mx-auto rounded-full bg-red-900/50 border-2 border-red-500 flex items-center justify-center">
            <i class="fas fa-exclamation-triangle text-red-400"></i>
        </div>
        <p class="text-sm font-semibold mt-2 text-gray-200">${name} (${label})</p>
        <p class="text-xs text-red-400">${error}</p>
    `;
  return div;
}

// *** FIXED FUNCTION ***
// This function also now handles both data structures for the dropdown list.
function renderConfigElements(data) {
  configSection.innerHTML = `
        <h2 class="text-xl font-bold mb-4 text-gray-300">Reel Configuration</h2>

        <div class="space-y-4 mb-6">
            <label for="audio_mode" class="block text-sm font-medium text-gray-400">TTS Audio Mode</label>
            <select id="audio_mode" name="audio_mode" class="w-full bg-gray-700 border border-gray-600 text-gray-200 p-3 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150">
                ${data.tts_modes
                  .map(
                    (m) => `<option value="${m}">${m.toUpperCase()}</option>`
                  )
                  .join("")}
            </select>
        </div>

        <div class="space-y-4 mb-6">
            <label for="selected_prompt_path" class="block text-sm font-medium text-gray-400">Select Prompt File</label>
            <select id="selected_prompt_path" name="selected_prompt_path" class="w-full bg-gray-700 border border-gray-600 text-gray-200 p-3 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150">
                <option value="">-- Select a Prompt --</option>
                ${data.prompt_files
                  .map((p) => `<option value="${p.path}">${p.name}</option>`)
                  .join("")}
            </select>
        </div>

        <div class="grid grid-cols-2 gap-4">
            <div>
                <label for="char_a_name" class="block text-sm font-medium text-gray-400">Character A</label>
                <select id="char_a_name" name="char_a_name" class="w-full bg-gray-700 border border-gray-600 text-gray-200 p-3 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150">
                    <option value="">-- Select Character --</option>
${Object.keys(data.characters)
  .map((name) => {
    const char = data.characters[name];
    // Get the voice name - try different voice fields
    const voiceDisplay =
      typeof char === "object" && char !== null
        ? char.voice_gemini ||
          char.voice_eleven ||
          char.voice_mac ||
          char.voice ||
          "No Voice"
        : "N/A";
    return `<option value="${name}">${name} (${voiceDisplay})</option>`;
  })
  .join("")}
                </select>
            </div>
            <div>
                <label for="char_b_name" class="block text-sm font-medium text-gray-400">Character B</label>
                <select id="char_b_name" name="char_b_name" class="w-full bg-gray-700 border border-gray-600 text-gray-200 p-3 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150">
                    <option value="">-- Select Character --</option>
${Object.keys(data.characters)
  .map((name) => {
    const char = data.characters[name];
    // Get the voice name - try different voice fields
    const voiceDisplay =
      typeof char === "object" && char !== null
        ? char.voice_gemini ||
          char.voice_eleven ||
          char.voice_mac ||
          char.voice ||
          "No Voice"
        : "N/A";
    return `<option value="${name}">${name} (${voiceDisplay})</option>`;
  })
  .join("")}
                </select>
            </div>
        </div>
        <div id="character-preview" class="mt-4 flex justify-around space-x-4"></div>
    `;

  // 2. Render elements into #generate-content-form (Query, File Name)
  const button = getEl("generate-content-btn");
  if (button) {
    button.insertAdjacentHTML(
      "beforebegin",
      `
            <div class="space-y-4">
                <label for="query_input" class="block text-sm font-medium text-gray-400">Content Query (Topic)</label>
                <textarea id="query_input" name="query" rows="3" placeholder="e.g., The top 5 benefits of daily meditation for high performers" class="w-full bg-gray-700 border border-gray-600 text-gray-200 p-3 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150"></textarea>
            </div>
            <div class="space-y-4">
                <label for="file_name_input" class="block text-sm font-medium text-gray-400">Output File Name (e.g., meditation_benefits)</label>
                <input type="text" id="file_name_input" name="file_name" placeholder="file_name" class="w-full bg-gray-700 border border-gray-600 text-gray-200 p-3 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150">
            </div>
        `
    );
  }
}

// --- Data Fetching and Rendering ---

async function fetchData(endpoint) {
  try {
    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch ${endpoint}. Status: ${response.status}`
      );
    }
    return await response.json();
  } catch (error) {
    log(`API Error (${endpoint}): ${error.message}`, "error");
    return null;
  }
}

// *** FIXED: Enhanced config initialization with debugging ***
async function initializeConfig() {
  log("Fetching configuration data...", "info");
  const data = await fetchData("/api/data/config");
  if (!data) {
    log("Failed to load configuration data", "error");
    return;
  }

  CONFIG_DATA = data;

  // Debug: Log what we received
  console.log("Config data loaded:", {
    characters: data.characters,
    tts_modes: data.tts_modes,
    prompt_files: data.prompt_files,
  });

  renderConfigElements(data);

  updateSessionButton(data.session_count);

  // Add event listeners after rendering
  const configSection = getEl("config-section");
  if (configSection) {
    configSection.addEventListener("change", checkConfigAndEnableContentButton);
  }

  if (contentForm) {
    contentForm.addEventListener("input", checkConfigAndEnableContentButton);
  }

  checkConfigAndEnableContentButton();
  log("Configuration loaded successfully.", "success");
}

async function renderReelList() {
  const reelsListDiv = getEl("reels-list");
  if (!reelsListDiv) return;

  reelsListDiv.innerHTML = "";
  reelsListDiv.classList.add("loading");
  getEl("reels-empty-msg").style.display = "block";

  const data = await fetchData("/api/data/reels");
  reelsListDiv.classList.remove("loading");

  if (!data || data.reels.length === 0) {
    getEl("reels-empty-msg").textContent =
      "No finished reels found in the videos/ directory.";
    return;
  }

  getEl("reels-empty-msg").style.display = "none";

  data.reels
    .sort((a, b) => b.modified - a.modified)
    .forEach((reel) => {
      const date = new Date(reel.modified).toLocaleString();
      const reelCard = document.createElement("div");
      reelCard.className =
        "p-3 bg-gray-900/50 rounded-lg flex justify-between items-center border border-gray-700/50 hover:border-blue-500 transition-all duration-200";
      reelCard.innerHTML = `
            <div class="flex-grow">
                <p class="font-semibold text-sm text-yellow-200">${
                  reel.name
                }</p>
                <p class="text-xs text-gray-500 mt-1">
                    ${date} &middot; ${reel.size_kb} KB 
                    ${
                      reel.content_exists
                        ? '<i class="fas fa-check-circle text-green-500 ml-2" title="Content JSON exists"></i>'
                        : '<i class="fas fa-exclamation-triangle text-red-500 ml-2" title="Content JSON missing"></i>'
                    }
                </p>
            </div>
            <div class="space-x-2 flex-shrink-0">
                <button data-filename="${
                  reel.name
                }" class="reel-preview-btn p-2 rounded-full text-blue-400 hover:bg-blue-900/50 transition" title="Preview Reel">
                    <i class="fas fa-eye"></i>
                </button>
                <a href="/api/download/reel/${
                  reel.name
                }" class="p-2 rounded-full text-green-400 hover:bg-green-900/50 transition" title="Download Reel">
                    <i class="fas fa-download"></i>
                </a>
            </div>
        `;
      reelsListDiv.appendChild(reelCard);
    });
}

async function renderContentList() {
  const contentsListDiv = getEl("contents-list");
  if (!contentsListDiv) {
    log("Warning: #contents-list element is missing from the HTML.", "warn");
    return;
  }

  contentsListDiv.innerHTML = "";
  contentsListDiv.classList.add("loading");
  getEl("contents-empty-msg").style.display = "block";

  const data = await fetchData("/api/data/contents");
  contentsListDiv.classList.remove("loading");

  if (!data || data.contents.length === 0) {
    getEl("contents-empty-msg").textContent =
      "No content files found in the contents/ directory.";
    return;
  }

  getEl("contents-empty-msg").style.display = "none";

  data.contents
    .sort((a, b) => b.modified - a.modified)
    .forEach((content) => {
      const date = new Date(content.modified).toLocaleString();
      const contentCard = document.createElement("div");
      contentCard.className =
        "p-4 bg-gray-900/50 rounded-lg border border-gray-700/50 shadow-md";

      let dialogueHTML = content.dialogues
        .map((d, index) => {
          const color = index % 2 === 0 ? "text-blue-300" : "text-purple-300";
          return `<p class="text-xs mt-1 ${color}"><span class="font-bold">${
            d.speaker
          }:</span> ${d.dialogue.substring(0, 100)}...</p>`;
        })
        .join("");

      contentCard.innerHTML = `
            <p class="font-semibold text-sm text-purple-200">${content.name}</p>
            <p class="text-xs text-gray-500 mb-2">Query: ${
              content.query
            } &middot; ${date}</p>
            <div class="max-h-24 overflow-y-auto custom-scrollbar p-1 border-t border-gray-700 mt-2">
                ${
                  dialogueHTML ||
                  '<p class="text-xs text-red-400">Error or no dialogue data.</p>'
                }
            </div>
        `;
      contentsListDiv.appendChild(contentCard);
    });
}

// *** ADD: Debug function to check avatar paths ***
async function debugAvatarPaths() {
  if (!CONFIG_DATA.characters) return;

  console.group("Avatar Debug Information");
  Object.entries(CONFIG_DATA.characters).forEach(([name, data]) => {
    let avatarFile;
    if (typeof data === "string") {
      avatarFile = data;
    } else if (typeof data === "object") {
      avatarFile = data.avatar || data.image || data.filename;
    }

    console.log(`Character: ${name}`, {
      dataStructure: typeof data,
      avatarFile: avatarFile,
      fullPath: avatarFile ? `/assets/avatars/${avatarFile}` : "MISSING",
      fileExists: avatarFile ? "Check DevTools Network tab" : "NO FILE",
    });
  });
  console.groupEnd();
}

// --- Theme Toggle Logic ---
function initTheme() {
  const isDarkMode =
    localStorage.getItem("theme") === "dark" ||
    (!localStorage.getItem("theme") &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  if (isDarkMode) {
    document.documentElement.classList.add("dark");
    document.documentElement.classList.remove("light");
    themeToggle.innerHTML = '<i class="fas fa-sun text-lg"></i>';
    localStorage.setItem("theme", "dark");
  } else {
    document.documentElement.classList.add("light");
    document.documentElement.classList.remove("dark");
    themeToggle.innerHTML = '<i class="fas fa-moon text-lg"></i>';
    localStorage.setItem("theme", "light");
  }
}

function toggleTheme() {
  const isDark = document.documentElement.classList.contains("dark");
  if (isDark) {
    document.documentElement.classList.remove("dark");
    document.documentElement.classList.add("light");
    themeToggle.innerHTML = '<i class="fas fa-moon text-lg"></i>';
    localStorage.setItem("theme", "light");
  } else {
    document.documentElement.classList.remove("light");
    document.documentElement.classList.add("dark");
    themeToggle.innerHTML = '<i class="fas fa-sun text-lg"></i>';
    localStorage.setItem("theme", "dark");
  }
}

// --- Modal and Preview Logic ---
function showPreviewModal(filename) {
  const videoContainer = getEl("video-container");
  if (!videoContainer) {
    log(
      "Error: Video container element (#video-container) is missing.",
      "error"
    );
    return;
  }

  const videoUrl = `/api/preview/reel/${filename}`;
  videoContainer.innerHTML = `
        <video controls autoplay class="w-full h-full rounded-lg" preload="metadata">
            <source src="${videoUrl}" type="video/mp4">
            Your browser does not support the video tag.
        </video>
    `;
  const modalTitle = getEl("modal-title");
  if (modalTitle) modalTitle.textContent = `Preview: ${filename}`;
  previewModal.classList.remove("hidden");
}

function hidePreviewModal() {
  const videoContainer = getEl("video-container");
  if (videoContainer) videoContainer.innerHTML = "";
  previewModal.classList.add("hidden");
}

// --- Event Listeners ---

window.addEventListener("load", () => {
  initTheme();
  initializeConfig();
  renderReelList();
  renderContentList();
});

themeToggle.addEventListener("click", toggleTheme);

reelsListDiv.addEventListener("click", (e) => {
  const button = e.target.closest(".reel-preview-btn");
  if (button) {
    const filename = button.getAttribute("data-filename");
    showPreviewModal(filename);
  }
});

const closeModalBtn = getEl("close-modal");
if (closeModalBtn) closeModalBtn.addEventListener("click", hidePreviewModal);

previewModal.addEventListener("click", (e) => {
  if (e.target === previewModal) {
    hidePreviewModal();
  }
});

document
  .getElementById("refresh-reels")
  .addEventListener("click", renderReelList);
const refreshContentsBtn = getEl("refresh-contents");
if (refreshContentsBtn)
  refreshContentsBtn.addEventListener("click", renderContentList);

// 2. Generate Content Listener
contentForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const queryInput = getEl("query_input");
  const fileNameInput = getEl("file_name_input");
  const promptSelect = getEl("selected_prompt_path");
  const charASelect = getEl("char_a_name");
  const charBSelect = getEl("char_b_name");

  if (
    !queryInput ||
    !fileNameInput ||
    !promptSelect ||
    !charASelect ||
    !charBSelect
  ) {
    log("Error: Configuration elements are not yet rendered.", "error");
    return;
  }

  const data = {
    query: queryInput.value,
    file_name: fileNameInput.value,
    selected_prompt_path: promptSelect.value,
    char_a_name: charASelect.value,
    char_b_name: charBSelect.value,
  };

  log(`Starting content generation for query: "${data.query}"...`, "info");
  contentStatus.textContent = "Generating content... please wait.";
  contentStatus.className = "mt-4 text-sm text-center text-yellow-400";
  generateContentBtn.disabled = true;

  try {
    const response = await fetch("/api/generate-content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (response.ok) {
      contentStatus.textContent = `✅ Content saved to ${result.file_name}.`;
      contentStatus.className = "mt-4 text-sm text-center text-green-400";
      updateSessionButton(result.session_count);
      log(`Content generated successfully: ${result.file_name}`, "success");
      renderContentList();
    } else {
      contentStatus.textContent = `❌ Error: ${
        result.detail || "Unknown error"
      }`;
      contentStatus.className = "mt-4 text-sm text-center text-red-400";
      log(
        `Content generation failed: ${result.detail || "Unknown error"}`,
        "error"
      );
    }
  } catch (error) {
    contentStatus.textContent = "❌ Network Error or Server Unreachable.";
    contentStatus.className = "mt-4 text-sm text-center text-red-400";
    log(`Network error: ${error.message}`, "error");
  } finally {
    generateContentBtn.disabled = false;
  }
});

// 3. Generate Session Reels Listener
generateSessionBtn.addEventListener("click", async () => {
  const audioModeSelect = getEl("audio_mode");
  if (!audioModeSelect) {
    log("Error: Audio mode selector is missing.", "error");
    return;
  }
  const audioMode = audioModeSelect.value;

  log(
    `Starting reel generation for current session files (Mode: ${audioMode.toUpperCase()})...`,
    "info"
  );
  reelStatus.textContent = "Starting session reel generation... check logs.";
  reelStatus.className = "mt-4 text-sm text-center text-yellow-400";
  generateSessionBtn.disabled = true;
  generateAllBtn.disabled = true;

  const requestBody = new FormData();
  requestBody.append("audio_mode", audioMode);

  try {
    const response = await fetch("/api/generate-reels/session", {
      method: "POST",
      body: requestBody,
    });

    const result = await response.json();

    if (response.ok) {
      reelStatus.textContent = `✅ Session Reel Generation Complete.`;
      reelStatus.className = "mt-4 text-sm text-center text-green-400";
      log(`Reel generation results:`, "success");
      result.results.forEach((res) =>
        log(
          `- ${res.file}: ${res.status} ${res.error || ""}`,
          res.status === "Failed" ? "error" : "success"
        )
      );
      updateSessionButton(result.session_count);
      renderReelList();
    } else {
      reelStatus.textContent = `❌ Error: ${result.detail || "Unknown error"}`;
      reelStatus.className = "mt-4 text-sm text-center text-red-400";
      log(
        `Session reel generation failed: ${result.detail || "Unknown error"}`,
        "error"
      );
    }
  } catch (error) {
    reelStatus.textContent = "❌ Reel Generation Failed. Check logs.";
    reelStatus.className = "mt-4 text-sm text-center text-red-400";
    log(`Network error: ${error.message}`, "error");
  } finally {
    generateSessionBtn.disabled = false;
    generateAllBtn.disabled = false;
  }
});

// 4. Generate ALL Reels Listener
generateAllBtn.addEventListener("click", async () => {
  if (
    !confirm(
      "Are you sure you want to process ALL existing JSON files in the contents/ directory? This may take a long time."
    )
  ) {
    return;
  }

  const audioModeSelect = getEl("audio_mode");
  if (!audioModeSelect) {
    log("Error: Audio mode selector is missing.", "error");
    return;
  }
  const audioMode = audioModeSelect.value;

  log(
    `Starting reel generation for ALL files (Mode: ${audioMode.toUpperCase()})...`,
    "info"
  );
  reelStatus.textContent = "Starting ALL reel generation... check logs.";
  reelStatus.className = "mt-4 text-sm text-center text-yellow-400";
  generateSessionBtn.disabled = true;
  generateAllBtn.disabled = true;

  const requestBody = new FormData();
  requestBody.append("audio_mode", audioMode);

  try {
    const response = await fetch("/api/generate-reels/all", {
      method: "POST",
      body: requestBody,
    });

    const result = await response.json();

    if (response.ok) {
      reelStatus.textContent = `✅ ALL Reel Generation Complete.`;
      reelStatus.className = "mt-4 text-sm text-center text-green-400";
      log(`Reel generation results:`, "success");
      result.results.forEach((res) =>
        log(
          `- ${res.file}: ${res.status} ${res.error || ""}`,
          res.status === "Failed" ? "error" : "success"
        )
      );
      renderReelList();
    } else {
      reelStatus.textContent = `❌ Error: ${result.detail || "Unknown error"}`;
      reelStatus.className = "mt-4 text-sm text-center text-red-400";
      log(
        `All reel generation failed: ${result.detail || "Unknown error"}`,
        "error"
      );
    }
  } catch (error) {
    reelStatus.textContent = "❌ ALL Reel Generation Failed. Check logs.";
    reelStatus.className = "mt-4 text-sm text-center text-red-400";
    log(`Network error: ${error.message}`, "error");
  } finally {
    generateSessionBtn.disabled = false;
    generateAllBtn.disabled = false;
  }
});
