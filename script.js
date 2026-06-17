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

window.switchTab = switchTab;
window.toggleEdit = toggleEdit;
window.toggleAI = toggleAI;
window.runCustomImprovement = runCustomImprovement;
window.runImprovement = runImprovement;
window.newProject = newProject;
window.loadProject = loadProject;
window.delProject = delProject;
window.jesusReinaEditModeActive = false;

document.addEventListener("DOMContentLoaded", () => {
  atualizarModelos();
  renderHistory();
  initializeFullscreenController();
  
  document.getElementById("generate-btn").addEventListener("click", gerarProjeto);
  document.getElementById("stop-btn").addEventListener("click", pararGeracao);
  document.getElementById("api-provider").addEventListener("change", atualizarModelos);
  document.getElementById("download-btn").addEventListener("click", exportarProjetoCompleto);
  
  document.getElementById("eye-btn").addEventListener("click", () => {
    const i = document.getElementById("api-key");
    i.type = i.type === "password" ? "text" : "password";
  });
  
  document.getElementById("prompt").addEventListener("keydown", e => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) gerarProjeto();
  });

  configurarResponsivo();
});

function atualizarModelos() {
  const provider = document.getElementById("api-provider").value;
  const select = document.getElementById("model-select");
  const models = provider === "gemini" ? GEMINI_MODELS : GROQ_MODELS;
  select.innerHTML = models.map(x => `<option value="${x}">${x}</option>`).join("");
}

function addLog(txt) {
  const log = document.getElementById("status-log");
  if (!log) return;
  const p = document.createElement("p");
  p.textContent = `${new Date().toLocaleTimeString()} — ${txt}`;
  log.appendChild(p);
  log.scrollTop = log.scrollHeight;
}

async function gerarProjeto() {
  if (state.isGenerating) return;
  
  const prompt = document.getElementById("prompt").value.trim();
  const apiKey = document.getElementById("api-key").value.trim();
  const provider = document.getElementById("api-provider").value;
  const model = document.getElementById("model-select").value;

  if (!prompt || !apiKey) {
    addLog("⚠ Preencha o prompt de engenharia e insira a API Key para autenticação.");
    return;
  }

  state.isGenerating = true;
  state.abortController = new AbortController();
  state.projectName = prompt.slice(0, 30) || "App Gerado";

  const btn = document.getElementById("generate-btn");
  const stopBtn = document.getElementById("stop-btn");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Compilando...';
  stopBtn.classList.remove("hidden");
  addLog("⏳ Conectando à malha de IA do Jesus Reina AI Studio...");

  try {
    const rawOutput = await callAI({
      promptText: prompt,
      apiKey,
      provider,
      model,
      currentFiles: null, 
      signal: state.abortController.signal
    });

    let parsedFiles = extractFiles(rawOutput);
    for (const file in parsedFiles) {
      parsedFiles[file] = repairCode(parsedFiles[file]);
    }

    state.currentFiles = parsedFiles;
    state.currentProjectId = Date.now().toString();
    
    renderVirtualFiles();
    saveToStorage(prompt);
    addLog("✓ Projeto multi-arquivos gerado e encapsulado com sucesso!");

  } catch (error) {
    if (error.name === "AbortError") addLog("✕ Geração interrompida pelo usuário.");
    else addLog(`❌ Erro crítico: ${error.message}`);
  } finally {
    state.isGenerating = false;
    btn.disabled = false;
    btn.innerHTML = '<span>✨</span> Gerar Projeto';
    stopBtn.classList.add("hidden");
  }
}

async function runImprovement(improvementPrompt) {
  if (Object.keys(state.currentFiles || {}).length === 0) {
    addLog("⚠ Nenhum projeto carregado no VFS para evolução.");
    return;
  }

  const apiKey = document.getElementById("api-key").value.trim();
  const provider = document.getElementById("api-provider").value;
  const model = document.getElementById("model-select").value;

  if (!apiKey) {
    addLog("⚠ Configure sua chave de API antes de solicitar evoluções.");
    return;
  }

  state.isGenerating = true;
  state.abortController = new AbortController();
  addLog("🪄 IA Assistente analisando árvore de arquivos atual para refatoração...");

  try {
    const rawOutput = await callAI({
      promptText: improvementPrompt,
      apiKey,
      provider,
      model,
      currentFiles: state.currentFiles, 
      signal: state.abortController.signal
    });

    let evolvedFiles = extractFiles(rawOutput);
    for (const file in evolvedFiles) {
      evolvedFiles[file] = repairCode(evolvedFiles[file]);
    }

    state.currentFiles = { ...state.currentFiles, ...evolvedFiles };
    
    saveVersionSnapshot(state.currentProjectId, state.currentFiles);
    renderVirtualFiles();
    saveToStorage(document.getElementById("prompt").value);
    addLog("✅ Atualização incremental aplicada sem quebras!");

  } catch (error) {
    addLog(`❌ Falha no refinamento: ${error.message}`);
  } finally {
    state.isGenerating = false;
  }
}

function renderVirtualFiles() {
  const iframe = document.getElementById("output-frame");
  const emptyPreview = document.getElementById("preview-empty");
  const codeOutput = document.getElementById("code-output");
  const emptyCode = document.getElementById("code-empty");

  if (!iframe || Object.keys(state.currentFiles || {}).length === 0) return;

  const executionBlob = compileToSingleBlob(state.currentFiles);
  iframe.srcdoc = executionBlob;
  iframe.style.display = "block";
  emptyPreview.style.display = "none";

  let codeViewerBuffer = "";
  for (const [filename, content] of Object.entries(state.currentFiles || {})) {
    codeViewerBuffer += `// 📄 FILE: ${filename}\n${content}\n\n`;
  }

  codeOutput.textContent = codeViewerBuffer;
  codeOutput.style.display = "block";
  emptyCode.style.display = "none";

  document.getElementById("download-btn").disabled = false;
  document.getElementById("copy-btn").disabled = false;

  iframe.onload = () => {
    initStyleEditor(iframe, (updatedHTML) => {
      state.currentFiles["index.html"] = updatedHTML;
      saveToStorage(document.getElementById("prompt").value);
    });

    if (window.jesusReinaEditModeActive) {
      injectEditModeStyles(iframe);
    }
  };
}

function exportarProjetoCompleto() {
  const pwaVFS = injectPWAFiles(state.currentFiles, state.projectName);
  downloadProjectAsZip(pwaVFS, state.projectName);
  addLog("⬇ Pacote de distribuição estruturado PWA/ZIP baixado.");
}

function pararGeracao() {
  if (state.abortController) state.abortController.abort();
  state.isGenerating = false;
}

function toggleEdit() {
  window.jesusReinaEditModeActive = !window.jesusReinaEditModeActive;
  const btn = document.getElementById("edit-btn");
  const badge = document.getElementById("edit-badge");
  const iframe = document.getElementById("output-frame");
  
  btn.style.borderColor = window.jesusReinaEditModeActive ? "var(--primary)" : "var(--border)";
  btn.style.color = window.jesusReinaEditModeActive ? "var(--primary)" : "var(--muted)";
  badge.style.display = window.jesusReinaEditModeActive ? "inline-flex" : "none";
  
  if (!window.jesusReinaEditModeActive) {
    document.getElementById("style-inspector-panel").style.display = "none";
    if(iframe && iframe.contentDocument) {
      const injectedStyle = iframe.contentDocument.getElementById('jesus-reina-edit-mode-style');
      if(injectedStyle) injectedStyle.remove();
    }
  } else {
    if (iframe) injectEditModeStyles(iframe);
  }
  
  addLog(window.jesusReinaEditModeActive ? "✏ Modo Edição Ativado — Clique em qualquer elemento para interagir." : "✏ Modo Edição Desativado.");
}

function injectEditModeStyles(iframe) {
  if (!iframe || !iframe.contentDocument) return;
  const doc = iframe.contentDocument;
  
  if (doc.getElementById('jesus-reina-edit-mode-style')) return;

  const style = doc.createElement('style');
  style.id = 'jesus-reina-edit-mode-style';
  style.innerHTML = `
    *:hover {
      outline: 2px solid rgba(0, 255, 255, 0.8) !important;
      outline-offset: -2px !important;
      box-shadow: 0 0 10px rgba(0, 255, 255, 0.5), inset 0 0 15px rgba(255, 255, 0, 0.2) !important;
      background: rgba(255, 255, 255, 0.05) !important;
      backdrop-filter: blur(4px) !important;
      cursor: crosshair !important;
      transition: all 0.2s ease-in-out;
    }
  `;
  doc.head.appendChild(style);
}

function switchTab(tab, btn) {
  document.querySelectorAll(".tab-content").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.getElementById(`tab-${tab}`).classList.add("active");
  btn.classList.add("active");
}

function toggleAI() {
  const body = document.getElementById("ai-body");
  const ch = document.getElementById("ai-chevron");
  const open = body.style.display === "none";
  body.style.display = open ? "flex" : "none";
  ch.textContent = open ? "▲" : "▼";
}

function runCustomImprovement() {
  const txt = document.getElementById("improve-prompt").value.trim();
  if (txt) {
    runImprovement(txt);
    document.getElementById("improve-prompt").value = "";
  }
}

function saveToStorage(promptText) {
  const projects = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  const projectIndex = projects.findIndex(p => p.id === state.currentProjectId);

  const payload = {
    id: state.currentProjectId,
    name: state.projectName,
    prompt: promptText,
    files: state.currentFiles,
    updatedAt: Date.now()
  };

  if (projectIndex >= 0) {
    projects[projectIndex] = payload;
  } else {
    projects.unshift(payload);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  renderHistory();
}

function renderHistory() {
  const projects = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  const container = document.getElementById("history-list");
  if (!container) return;

  if (projects.length === 0) {
    container.innerHTML = '<p style="font-size:11px;color:var(--muted);padding:8px;text-align:center;">Nenhum software na fábrica</p>';
    return;
  }

  container.innerHTML = projects.map(p => `
    <div class="history-item" onclick="loadProject('${p.id}')">
      <div style="flex:1; min-width:0;">
        <div style="font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</div>
        <div style="font-size:10px;color:var(--muted)">${new Date(p.updatedAt).toLocaleDateString()}</div>
      </div>
      <button class="del-btn" onclick="event.stopPropagation(); delProject('${p.id}')">🗑</button>
    </div>
  `).join("");
}

function loadProject(id) {
  const projects = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  const current = projects.find(p => p.id === id);
  if (!current) return;

  state.currentProjectId = current.id;
  state.currentFiles = current.files;
  state.projectName = current.name;
  
  document.getElementById("prompt").value = current.prompt || "";
  renderVirtualFiles();
  addLog(`📂 Projeto restaurado no VFS: ${current.name}`);
}

function delProject(id) {
  let projects = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  projects = projects.filter(p => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  if (state.currentProjectId === id) newProject();
  renderHistory();
}

function newProject() {
  state.currentFiles = {};
  state.currentProjectId = null;
  document.getElementById("prompt").value = "";
  document.getElementById("output-frame").style.display = "none";
  document.getElementById("preview-empty").style.display = "flex";
  document.getElementById("code-output").style.display = "none";
  document.getElementById("code-empty").style.display = "flex";
  addLog("✚ Novo workspace limpo inicializado.");
}

function configurarResponsivo() {
  const labels = { desktop: "100%", tablet: "768px", mobile: "375px" };
  document.querySelectorAll(".resp-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view;
      document.getElementById("iframe-wrapper").className = `iframe-wrapper view-${view}`;
      document.querySelectorAll(".resp-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("view-label").textContent = labels[view];
    });
  });
}
