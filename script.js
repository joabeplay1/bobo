import { callAI } from "./core/ai-engine.js";
import { extractFiles, compileToSingleBlob } from "./core/parser.js";
import { repairCode } from "./core/repair-engine.js";
import { initializeFullscreenController } from "./preview/fullscreen.js";
import { initStyleEditor } from "./editor/style-editor.js";
import { downloadProjectAsZip } from "./export/zip-export.js";
import { injectPWAFiles } from "./export/pwa-export.js";
import { saveVersionSnapshot } from "./storage/version-control.js";

const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"];
const GROQ_MODELS = ["llama-3.3-70b-versatile", "deepseek-r1-distill-llama-70b"];
const STORAGE_KEY = "jesus_reina_projects_v2";

const state = {
  isGenerating: false,
  abortController: null,
  currentFiles: {},
  currentProjectId: null,
  projectName: "Projeto Sem Nome"
};

/**
 * Função para garantir que placeholders nunca falhem.
 * Substitui via.placeholder.com por placehold.co (mais estável).
 */
function fixImageUrls(content) {
  if (!content) return content;
  return content.replace(/via\.placeholder\.com/g, "placehold.co");
}

// --- Tratamento Global de Erros ---
window.onerror = (msg, url, line) => {
  addLog(`❌ Erro interno de Script: ${msg} (Linha: ${line})`);
  return false;
};

window.addEventListener("unhandledrejection", event => {
  const reason = event.reason?.message || event.reason || "Erro desconhecido";
  addLog(`❌ Erro Assíncrono (Promise): ${reason}`);
});

// --- Exposição de escopo para diretivas HTML ---
window.switchTab = switchTab;
window.toggleEdit = toggleEdit;
window.toggleAI = toggleAI;
window.runCustomImprovement = runCustomImprovement;
window.runImprovement = runImprovement;
window.newProject = newProject;
window.loadProject = loadProject;
window.delProject = delProject;
window.copyCode = copyCode;
window.jesusReinaEditModeActive = false;

document.addEventListener("DOMContentLoaded", () => {
  try {
    atualizarModelos();
    renderHistory();
    
    if (typeof initializeFullscreenController === "function") initializeFullscreenController();

    const elements = {
      "generate-btn": gerarProjeto,
      "stop-btn": pararGeracao,
      "api-provider": atualizarModelos,
      "download-btn": exportarProjetoCompleto
    };

    Object.entries(elements).forEach(([id, handler]) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener(id === "api-provider" ? "change" : "click", handler);
    });

    const eyeBtn = document.getElementById("eye-btn");
    if (eyeBtn) {
      eyeBtn.addEventListener("click", () => {
        const inputKey = document.getElementById("api-key");
        if (inputKey) inputKey.type = inputKey.type === "password" ? "text" : "password";
      });
    }

    const promptArea = document.getElementById("prompt");
    if (promptArea) {
      promptArea.addEventListener("keydown", e => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) gerarProjeto();
      });
    }

    configurarResponsivo();
    console.log("Jesus Reina AI Studio: Sistema operando corretamente.");
  } catch (err) {
    console.error("Erro na inicialização do DOM:", err);
  }
});

// --- Helpers de Armazenamento e Log ---
function safeGetProjects() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch (err) {
    console.error("JSON corrompido no LocalStorage.", err);
    return [];
  }
}

function addLog(txt) {
  const log = document.getElementById("status-log");
  if (!log) return;
  const p = document.createElement("p");
  p.textContent = `${new Date().toLocaleTimeString()} — ${txt}`;
  log.appendChild(p);
  log.scrollTop = log.scrollHeight;
}

// --- Lógica Principal de Geração e Melhoria ---
async function processarIA(promptText, isImprovement = false) {
  if (state.isGenerating) return;
  
  const apiKey = document.getElementById("api-key")?.value.trim();
  const provider = document.getElementById("api-provider")?.value;
  const model = document.getElementById("model-select")?.value;

  if (!apiKey) {
    addLog("⚠ Insira sua API Key.");
    return;
  }

  state.isGenerating = true;
  state.abortController = new AbortController();
  
  try {
    addLog(isImprovement ? "🪄 Refatorando..." : "⏳ Conectando...");
    
    const rawOutput = await callAI({
      promptText,
      apiKey,
      provider,
      model,
      currentFiles: isImprovement ? state.currentFiles : null,
      signal: state.abortController.signal
    });

    // Aplicação da correção de URLs
    const fixedOutput = fixImageUrls(rawOutput);

    let parsedFiles = extractFiles(fixedOutput) || {};
    for (const file in parsedFiles) parsedFiles[file] = repairCode(parsedFiles[file]);

    state.currentFiles = isImprovement ? { ...state.currentFiles, ...parsedFiles } : parsedFiles;
    state.currentProjectId = isImprovement ? state.currentProjectId : Date.now().toString();
    
    renderVirtualFiles();
    saveToStorage(document.getElementById("prompt").value);
    addLog("✓ Sucesso!");
  } catch (error) {
    if (error.name !== "AbortError") addLog(`❌ Erro: ${error.message}`);
  } finally {
    state.isGenerating = false;
  }
}

function gerarProjeto() { processarIA(document.getElementById("prompt").value); }
function runImprovement(imp) { processarIA(imp, true); }

// --- Renderização e UI ---
function renderVirtualFiles() {
  const iframe = document.getElementById("output-frame");
  const codeOutput = document.getElementById("code-output");
  
  if (Object.keys(state.currentFiles).length === 0) return;

  const executionBlob = compileToSingleBlob(state.currentFiles);
  if (iframe) {
    iframe.srcdoc = executionBlob;
    iframe.style.display = "block";
    iframe.onload = () => {
      if (typeof initStyleEditor === "function") initStyleEditor(iframe, (h) => state.currentFiles["index.html"] = h);
      if (window.jesusReinaEditModeActive) injectEditModeStyles(iframe);
    };
  }
  
  if (codeOutput) codeOutput.textContent = Object.entries(state.currentFiles).map(([n, c]) => `// 📄 ${n}\n${c}`).join("\n\n");
}

// ... (Funções restantes: toggleEdit, injectEditModeStyles, copyCode, exportarProjetoCompleto, etc., mantêm a lógica original de proteção fornecida)
