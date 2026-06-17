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

// Captura global de erros para espelhar problemas diretamente no Log da UI
window.onerror = function (msg, url, line) {
  addLog(`❌ Erro interno de Script: ${msg} (Linha: ${line})`);
  return false;
};

// Exposição explícita de escopo para diretivas onclick do HTML (Módulos isolados)
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
    
    if (typeof initializeFullscreenController === "function") {
      initializeFullscreenController();
    } else {
      console.warn("Módulo initializeFullscreenController não exportado corretamente.");
    }
    
    // Proteção estrita contra elementos nulos (Null Guards)
    const genBtn = document.getElementById("generate-btn");
    if (genBtn) genBtn.addEventListener("click", gerarProjeto);

    const stopBtn = document.getElementById("stop-btn");
    if (stopBtn) stopBtn.addEventListener("click", pararGeracao);

    const providerSelect = document.getElementById("api-provider");
    if (providerSelect) providerSelect.addEventListener("change", atualizarModelos);

    const downloadBtn = document.getElementById("download-btn");
    if (downloadBtn) downloadBtn.addEventListener("click", exportarProjetoCompleto);
    
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
  } catch (err) {
    console.error("Erro durante a inicialização do DOM:", err);
    addLog("❌ Falha crítica ao inicializar os componentes da interface.");
  }
});

function atualizarModelos() {
  const providerEl = document.getElementById("api-provider");
  const selectEl = document.getElementById("model-select");
  if (!providerEl || !selectEl) return;

  const provider = providerEl.value;
  const models = provider === "gemini" ? GEMINI_MODELS : GROQ_MODELS;
  selectEl.innerHTML = models.map(x => `<option value="${x}">${x}</option>`).join("");
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
  
  const promptEl = document.getElementById("prompt");
  const apiKeyEl = document.getElementById("api-key");
  const providerEl = document.getElementById("api-provider");
  const modelEl = document.getElementById("model-select");

  if (!promptEl || !apiKeyEl || !providerEl || !modelEl) {
    addLog("❌ Erro estrutural: Elementos de configuração não encontrados no HTML.");
    return;
  }

  const prompt = promptEl.value.trim();
  const apiKey = apiKeyEl.value.trim();
  const provider = providerEl.value;
  const model = modelEl.value;

  if (!prompt || !apiKey) {
    addLog("⚠ Preencha o prompt de engenharia e insira a API Key para autenticação.");
    return;
  }

  state.isGenerating = true;
  state.abortController = new AbortController();
  state.projectName = prompt.slice(0, 30) || "App Gerado";

  const btn = document.getElementById("generate-btn");
  const stopBtn = document.getElementById("stop-btn");
  
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Compilando...';
  }
  if (stopBtn) stopBtn.classList.remove("hidden");
  
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

    let parsedFiles = extractFiles(rawOutput) || {};
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
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>✨</span> Gerar Projeto';
    }
    if (stopBtn) stopBtn.classList.add("hidden");
  }
}

async function runImprovement(improvementPrompt) {
  if (Object.keys(state.currentFiles || {}).length === 0) {
    addLog("⚠ Nenhum projeto carregado no VFS para evolução.");
    return;
  }

  const apiKeyEl = document.getElementById("api-key");
  const providerEl = document.getElementById("api-provider");
  const modelEl = document.getElementById("model-select");
  const promptEl = document.getElementById("prompt");

  if (!apiKeyEl || !providerEl || !modelEl) return;

  const apiKey = apiKeyEl.value.trim();
  const provider = providerEl.value;
  const model = modelEl.value;

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

    let evolvedFiles = extractFiles(rawOutput) || {};
    for (const file in evolvedFiles) {
      evolvedFiles[file] = repairCode(evolvedFiles[file]);
    }

    state.currentFiles = { ...state.currentFiles, ...evolvedFiles };
    
    saveVersionSnapshot(state.currentProjectId, state.currentFiles);
    renderVirtualFiles();
    
    const savedPrompt = promptEl ? promptEl.value : "";
    saveToStorage(savedPrompt);
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
  const downloadBtn = document.getElementById("download-btn");
  const copyBtn = document.getElementById("copy-btn");
  const promptEl = document.getElementById("prompt");

  if (Object.keys(state.currentFiles || {}).length === 0) return;

  const executionBlob = compileToSingleBlob(state.currentFiles);
  
  if (!executionBlob) {
    addLog("❌ Erro ao processar compilação do Virtual File System.");
    return;
  }

  if (iframe) {
    iframe.srcdoc = executionBlob;
    iframe.style.display = "block";
  }
  if (emptyPreview) emptyPreview.style.display = "none";

  let codeViewerBuffer = "";
  for (const [filename, content] of Object.entries(state.currentFiles || {})) {
    codeViewerBuffer += `// 📄 FILE: ${filename}\n${content}\n\n`;
  }

  if (codeOutput) {
    codeOutput.textContent = codeViewerBuffer;
    codeOutput.style.display = "block";
  }
  if (emptyCode) emptyCode.style.display = "none";

  if (downloadBtn) downloadBtn.disabled = false;
  if (copyBtn) copyBtn.disabled = false;

  if (iframe) {
    iframe.onload = () => {
      initStyleEditor(iframe, (updatedHTML) => {
        state.currentFiles["index.html"] = updatedHTML;
        const currentPrompt = promptEl ? promptEl.value : "";
        saveToStorage(currentPrompt);
      });

      if (window.jesusReinaEditModeActive) {
        injectEditModeStyles(iframe);
      }
    };
  }
}

function copyCode() {
  const codeOutput = document.getElementById("code-output");
  if (!codeOutput || !codeOutput.textContent || Object.keys(state.currentFiles || {}).length === 0) {
    addLog("⚠ Nenhum código gerado disponível para cópia.");
    return;
  }

  navigator.clipboard.writeText(codeOutput.textContent)
    .then(() => addLog("📋 Código completo unificado copiado para a área de transferência."))
    .catch(err => addLog(`❌ Erro ao acessar área de transferência: ${err.message}`));
}

function exportarProjetoCompleto() {
  if (!window.JSZip) {
    addLog("❌ Falha de dependência: A biblioteca JSZip não foi carregada pelo CDN.");
    return;
  }
  try {
    const pwaVFS = injectPWAFiles(state.currentFiles, state.projectName);
    downloadProjectAsZip(pwaVFS, state.projectName);
    addLog("⬇ Pacote de distribuição estruturado PWA/ZIP baixado.");
  } catch (err) {
    addLog(`❌ Erro ao exportar ZIP: ${err.message}`);
  }
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
  const inspectorPanel = document.getElementById("style-inspector-panel");
  
  if (btn) {
    btn.style.borderColor = window.jesusReinaEditModeActive ? "var(--primary)" : "var(--border)";
    btn.style.color = window.jesusReinaEditModeActive ? "var(--primary)" : "var(--muted)";
  }
  if (badge) badge.style.display = window.jesusReinaEditModeActive ? "inline-flex" : "none";
  if (inspectorPanel) inspectorPanel.style.display = window.jesusReinaEditModeActive ? "block" : "none";
  
  if (!window.jesusReinaEditModeActive) {
    if (iframe && iframe.contentDocument) {
      const injectedStyle = iframe.contentDocument.getElementById('jesus-reina-edit-mode-style');
      if (injectedStyle) injectedStyle.remove();
    }
  } else {
    if (iframe) injectEditModeStyles(iframe);
  }
  
  addLog(window.jesusReinaEditModeActive ? "✏ Modo Edição Ativado — Painel Inspector aberto e interações de elementos prontas." : "✏ Modo Edição Desativado.");
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
  
  const targetTab = document.getElementById(`tab-${tab}`);
  if (targetTab) targetTab.classList.add("active");
  if (btn) btn.classList.add("active");
}

function toggleAI() {
  const body = document.getElementById("ai-body");
  const ch = document.getElementById("ai-chevron");
  if (!body || !ch) return;
  const open = body.style.display === "none";
  body.style.display = open ? "flex" : "none";
  ch.textContent = open ? "▲" : "▼";
}

function runCustomImprovement() {
  const txtEl = document.getElementById("improve-prompt");
  if (!txtEl) return;
  const txt = txtEl.value.trim();
  if (txt) {
    runImprovement(txt);
    txtEl.value = "";
  }
}

function saveToStorage(promptText) {
  try {
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
  } catch (err) {
    console.error("Erro ao persistir dados no LocalStorage:", err);
    addLog("❌ Armazenamento cheio! Remova softwares antigos do histórico para liberar espaço.");
  }
}

function renderHistory() {
  const container = document.getElementById("history-list");
  if (!container) return;

  let projects = [];
  try {
    projects = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch (e) {
    projects = [];
  }

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
  try {
    const projects = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    const current = projects.find(p => p.id === id);
    if (!current) return;

    state.currentProjectId = current.id;
    state.currentFiles = current.files || {};
    state.projectName = current.name;
    
    const promptEl = document.getElementById("prompt");
    if (promptEl) promptEl.value = current.prompt || "";
    
    renderVirtualFiles();
    addLog(`📂 Projeto restaurado no VFS: ${current.name}`);
  } catch (err) {
    addLog("❌ Falha ao carregar o projeto selecionado.");
  }
}

function delProject(id) {
  try {
    let projects = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    projects = projects.filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    if (state.currentProjectId === id) newProject();
    renderHistory();
  } catch (err) {
    addLog("❌ Falha ao deletar o registro do projeto.");
  }
}

function newProject() {
  state.currentFiles = {};
  state.currentProjectId = null;
  
  const promptEl = document.getElementById("prompt");
  if (promptEl) promptEl.value = "";
  
  const iframe = document.getElementById("output-frame");
  if (iframe) iframe.style.display = "none";

  const emptyPreview = document.getElementById("preview-empty");
  if (emptyPreview) emptyPreview.style.display = "flex";

  const codeOutput = document.getElementById("code-output");
  if (codeOutput) codeOutput.style.display = "none";

  const emptyCode = document.getElementById("code-empty");
  if (emptyCode) emptyCode.style.display = "flex";
  
  addLog("✚ Novo workspace limpo inicializado.");
}

function configurarResponsivo() {
  const labels = { desktop: "100%", tablet: "768px", mobile: "375px" };
  document.querySelectorAll(".resp-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view;
      const wrapper = document.getElementById("iframe-wrapper");
      if (wrapper) wrapper.className = `iframe-wrapper view-${view}`;
      
      document.querySelectorAll(".resp-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      
      const label = document.getElementById("view-label");
      if (label) label.textContent = labels[view];
    });
  });
}
