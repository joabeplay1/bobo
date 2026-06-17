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

// Captura global de erros síncronos
window.onerror = function (msg, url, line) {
  addLog(`❌ Erro interno de Script: ${msg} (Linha: ${line})`);
  return false;
};

// Captura global de erros assíncronos (Promise Rejections / Async Await)
window.addEventListener("unhandledrejection", event => {
  const reason = event.reason?.message || event.reason || "Erro desconhecido";
  addLog(`❌ Erro Assíncrono (Promise): ${reason}`);
});

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

// 3. Auxiliar robusto para leitura segura do LocalStorage prevenindo quebras por JSON danificado
function safeGetProjects() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch (err) {
    console.error("JSON corrompido detectado no LocalStorage. Inicializando array vazio.", err);
    return [];
  }
}

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

    if (!rawOutput || typeof rawOutput !== "string" || rawOutput.trim() === "") {
      throw new Error("A inteligência artificial retornou uma resposta vazia ou inválida.");
    }

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
  // 1. Verificação inicial para evitar concorrência e requisições simultâneas duplicadas
  if (state.isGenerating) return;

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
  
  const btn = document.getElementById("generate-btn");
  const stopBtn = document.getElementById("stop-btn");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Refatorando...';
  }
  if (stopBtn) stopBtn.classList.remove("hidden");

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

    if (!rawOutput || typeof rawOutput !== "string" || rawOutput.trim() === "") {
      throw new Error("A inteligência artificial retornou um payload vazio para a melhoria solicitada.");
    }

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
    if (error.name === "AbortError") addLog("✕ Evolução incremental interrompida.");
    else addLog(`❌ Falha no refinamento: ${error.message}`);
  } finally {
    state.isGenerating = false;
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>✨</span> Gerar Projeto';
    }
    if (stopBtn) stopBtn.classList.add("hidden");
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

  // 4. Encapsulamento de segurança contra exceções críticas lançadas no compilador parser
  let executionBlob;
  try {
    executionBlob = compileToSingleBlob(state.currentFiles);
  } catch (err) {
    console.error("Falha fatal na compilação do código para Blob:", err);
    addLog("❌ Erro interno no compilador do Virtual File System. Operação abortada.");
    return;
  }
  
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
    // Prevenção de vazamento de memória anulando handlers cíclicos prévios
    iframe.onload = null;
    iframe.onload = () => {
      // Encapsulamento protetivo para prevenir travamentos se o Style Editor falhar
      try {
        if (typeof initStyleEditor === "function") {
          initStyleEditor(iframe, (updatedHTML) => {
            state.currentFiles["index.html"] = updatedHTML;
            const currentPrompt = promptEl ? promptEl.value : "";
            saveToStorage(currentPrompt);
          });
        }
      } catch (err) {
        console.error("Falha ao injetar ou iniciar manipuladores do initStyleEditor:", err);
        addLog("⚠ Aviso: Erro não fatal no manipulador de estilo em tempo real.");
      }

      if (window.jesusReinaEditModeActive) {
        injectEditModeStyles(iframe);
      }
    };
  }
}

// Fallback robusto via manipulação síncrona do DOM caso a Clipboard API seja bloqueada
function fallbackCopy(text) {
  const area = document.createElement("textarea");
  area.value = text;
  area.style.position = "fixed"; 
  area.style.top = "0";
  area.style.left = "0";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  area.setSelectionRange(0, 99999);
  
  try {
    const success = document.execCommand("copy");
    if (success) {
      addLog("📋 Código copiado via canal alternativo de transferência.");
    } else {
      throw new Error("Comando alternativo de cópia recusado pelo navegador.");
    }
  } catch (err) {
    addLog(`❌ Falha total de cópia: Bloqueio de segurança do navegador.`);
  } finally {
    document.body.removeChild(area);
  }
}

function copyCode() {
  const codeOutput = document.getElementById("code-output");
  if (!codeOutput || !codeOutput.textContent || Object.keys(state.currentFiles || {}).length === 0) {
    addLog("⚠ Nenhum código gerado disponível para cópia.");
    return;
  }

  // Fluxo principal com Clipboard API e interceptação de rejeição estruturada
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    navigator.clipboard.writeText(codeOutput.textContent)
      .then(() => addLog("📋 Código completo unificado copiado para a área de transferência."))
      .catch(err => {
        console.warn("A API nativa de clipboard falhou. Executando fallback síncrono...", err);
        fallbackCopy(codeOutput.textContent);
      });
  } else {
    fallbackCopy(codeOutput.textContent);
  }
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

// 2. Redefinição imediata da UI dos botões de geração ao disparar a interrupção manual
function pararGeracao() {
  if (state.abortController) {
    state.abortController.abort();
  }
  
  state.isGenerating = false;

  const btn = document.getElementById("generate-btn");
  const stopBtn = document.getElementById("stop-btn");

  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '<span>✨</span> Gerar Projeto';
  }
  if (stopBtn) {
    stopBtn.classList.add("hidden");
  }
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
    // 3. Aplicação do helper seguro contra dados corrompidos
    const projects = safeGetProjects();
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

  // 3. Aplicação do helper seguro contra dados corrompidos
  const projects = safeGetProjects();

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
    // 3. Aplicação do helper seguro contra dados corrompidos
    const projects = safeGetProjects();
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
    // 3. Aplicação do helper seguro contra dados corrompidos
    let projects = safeGetProjects();
    projects = projects.filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    if (state.currentProjectId === id) newProject();
    renderHistory();
  } catch (err) {
    addLog("❌ Falha ao deletar o registro do projeto.");
  }
}

// Reset estrutural completo e desativação de gatilhos inválidos ao reiniciar a área de trabalho
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

  // Desativação segura dos botões de ação para evitar chamadas sem contexto de arquivos ativos
  const copyBtn = document.getElementById("copy-btn");
  if (copyBtn) copyBtn.disabled = true;

  const downloadBtn = document.getElementById("download-btn");
  if (downloadBtn) downloadBtn.disabled = true;
  
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
