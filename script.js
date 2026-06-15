// ======================================================
// CONSTANTES
// ======================================================

const GEMINI_MODELS = ["gemini-2.5-flash"];
const GROQ_MODELS = ["llama-3.3-70b-versatile", "deepseek-r1-distill-llama-70b"];

let isGenerating = false;
let abortController = null;
let currentCode = "";

// ======================================================
// SYSTEM PROMPT
// ======================================================

const SYSTEM_PROMPT = `
OMEGA AUTO SOFTWARE FACTORY PRO MODE

IDENTIDADE:
Você é uma IA de engenharia de software profissional multi-especialista.

MISSÃO: Transformar qualquer pedido em software REAL, COMPLETO, PROFISSIONAL e 100% FUNCIONAL.

PROCESSO INTERNO OBRIGATÓRIO:
Antes de responder, internamente:
1. Analise o pedido completo
2. Planeje a arquitetura ideal
3. Escreva TODO o código antes de começar a gerar
4. Verifique se nada está faltando
5. Somente então gere a saída final

REGRAS DE QUALIDADE:
- Design premium e moderno
- Totalmente responsivo
- Animações suaves
- Tudo funcional (botões, forms, navegação)
- Código limpo e robusto
- Use localStorage quando precisar persistir dados
- NUNCA deixe função vazia ou incompleta

REGRA DE COMPLETUDE - CRÍTICA:
- Escreva TODAS as funções COMPLETAS, do início ao fim
- NUNCA use comentários como "// resto aqui", "// continua...", "// implemente aqui"
- NUNCA abrevie o código
- Se o código for grande, use técnicas para deixá-lo compacto SEM remover funcionalidade

PROIBIDO:
- Código parcial ou funções vazias
- Placeholders falsos
- Botões sem ação
- Links quebrados
- Markdown, JSON ou texto extra
- Blocos de código com crases
- Comentários indicando código omitido

FORMATO DE SAÍDA OBRIGATÓRIO:
- APENAS código HTML completo, nada mais
- Iniciar EXATAMENTE com <!DOCTYPE html>
- CSS dentro de <style> no <head>
- JavaScript dentro de <script> antes de </body>
- NUNCA retornar CSS ou JS soltos fora do HTML
- A última linha DEVE ser </html>
`;

// ======================================================
// DOM READY
// ======================================================

document.addEventListener("DOMContentLoaded", () => {
  atualizarModelos();
  configurarResponsivo();

  document.getElementById("generate-btn").addEventListener("click", gerarProjeto);
  document.getElementById("stop-btn").addEventListener("click", pararGeracao);
  document.getElementById("api-provider").addEventListener("change", atualizarModelos);

  document.getElementById("eye-btn").addEventListener("click", () => {
    const input = document.getElementById("api-key");
    input.type = input.type === "password" ? "text" : "password";
  });

  document.getElementById("prompt").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) gerarProjeto();
  });
});

// ======================================================
// MODELOS
// ======================================================

function atualizarModelos() {
  const provider = document.getElementById("api-provider").value;
  const select = document.getElementById("model-select");
  const models = provider === "gemini" ? GEMINI_MODELS : GROQ_MODELS;
  select.innerHTML = models.map(m => `<option value="${m}">${m}</option>`).join("");
}

// ======================================================
// LOG
// ======================================================

function addLog(texto) {
  const log = document.getElementById("status-log");
  const p = document.createElement("p");
  p.textContent = new Date().toLocaleTimeString() + " — " + texto;
  log.appendChild(p);
  log.scrollTop = log.scrollHeight;
}

// ======================================================
// DETECÇÃO DE CÓDIGO CORTADO
// ======================================================

function isCodeCut(code) {
  const t = code.trim();
  if (!t.toLowerCase().endsWith("</html>")) return true;
  if (!t.toLowerCase().includes("</body>")) return true;
  const sOpens = (t.match(/<script/gi) || []).length;
  const sCloses = (t.match(/<\/script>/gi) || []).length;
  if (sOpens > sCloses) return true;
  const opens = (t.match(/\{/g) || []).length;
  const closes = (t.match(/\}/g) || []).length;
  if (opens - closes > 5) return true;
  return false;
}

// ======================================================
// LIMPEZA
// ======================================================

function cleanCode(raw) {
  let code = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```html\s*/gi, "")
    .replace(/```javascript\s*/gi, "")
    .replace(/```css\s*/gi, "")
    .replace(/```\s*/g, "")
    .replace(/^[\s\S]*?(?=<!DOCTYPE html>|<html)/i, "")
    .trim();

  if (!code.toLowerCase().startsWith("<!doctype")) {
    const idx = code.toLowerCase().indexOf("<html");
    if (idx > 0) code = code.substring(idx);
    code = "<!DOCTYPE html>\n" + code;
  }

  if (!code.toLowerCase().includes("<html")) {
    code = `<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n<meta charset="UTF-8">\n<style>body{font-family:Arial,sans-serif;padding:20px}</style>\n</head>\n<body>\n${code}\n</body>\n</html>`;
  }

  if (isCodeCut(code)) {
    const sOpens = (code.match(/<script/gi) || []).length;
    const sCloses = (code.match(/<\/script>/gi) || []).length;
    let fix = code;
    for (let i = 0; i < sOpens - sCloses; i++) fix += "\n}catch(e){}\n</script>";
    if (!fix.toLowerCase().includes("</body>")) fix += "\n</body>";
    if (!fix.toLowerCase().endsWith("</html>")) fix += "\n</html>";
    return fix;
  }

  return code;
}

// ======================================================
// FETCH COM RETRY
// ======================================================

async function fetchComRetry(url, options, tentativas = 3) {
  for (let i = 0; i < tentativas; i++) {
    const response = await fetch(url, options);
    if (response.ok) return response;
    if (i < tentativas - 1) await new Promise(r => setTimeout(r, 1500));
  }
  throw new Error("Falha após múltiplas tentativas");
}

// ======================================================
// GERAR PROJETO
// ======================================================

async function gerarProjeto() {
  if (isGenerating) return;

  const prompt = document.getElementById("prompt").value.trim();
  const apiKey = document.getElementById("api-key").value.trim();
  const provider = document.getElementById("api-provider").value;
  const model = document.getElementById("model-select").value;

  if (!prompt || !apiKey) {
    addLog("⚠ Preencha o prompt e a API Key");
    return;
  }

  isGenerating = true;
  abortController = new AbortController();

  const btn = document.getElementById("generate-btn");
  const stopBtn = document.getElementById("stop-btn");

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Gerando...';
  stopBtn.classList.remove("hidden");

  addLog("⏳ Enviando para " + provider + " (" + model + ")...");

  const url = provider === "gemini"
    ? `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
    : "https://api.groq.com/openai/v1/chat/completions";

  const userMessage = `INSTRUÇÕES CRÍTICAS DE ENTREGA:
- RESPONDA APENAS COM O DOCUMENTO HTML COMPLETO E 100% FUNCIONAL
- COMEÇAR EXATAMENTE COM <!DOCTYPE html>
- CSS DENTRO DE <style> NO <head>
- JAVASCRIPT DENTRO DE <script> ANTES DE </body>
- PROIBIDO ABREVIAR: Escreva TODAS as funções por completo
- PROIBIDO comentários como "// resto do código", "// continua aqui"
- A ÚLTIMA LINHA OBRIGATORIAMENTE DEVE SER </html>
- NÃO inclua nenhum texto fora do HTML

PEDIDO DO USUÁRIO:
${prompt}`;

  const body = provider === "gemini"
    ? {
        contents: [{ parts: [{ text: SYSTEM_PROMPT + "\n\n" + userMessage }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 65536 }
      }
    : {
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage }
        ],
        max_tokens: 32768,
        temperature: 0.25
      };

  const headers = { "Content-Type": "application/json" };
  if (provider === "groq") headers["Authorization"] = "Bearer " + apiKey;

  const response = await fetchComRetry(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: abortController.signal
  });

  const data = await response.json();

  if (data.error) throw new Error("Erro da API: " + (data.error.message || JSON.stringify(data.error)));

  const raw = provider === "gemini"
    ? data?.candidates?.[0]?.content?.parts?.[0]?.text || ""
    : data?.choices?.[0]?.message?.content || "";

  const finishReason = data?.choices?.[0]?.finish_reason;
  if (finishReason === "length") addLog("⚠ Limite de tokens atingido — aplicando correção automática...");

  const geminiReason = data?.candidates?.[0]?.finishReason;
  if (geminiReason && geminiReason !== "STOP") addLog("⚠ Gemini parou: " + geminiReason + " — aplicando correção...");

  if (!raw || !raw.trim()) throw new Error("A IA retornou resposta vazia. Tente novamente.");

  addLog("🧹 Limpando e validando código...");
  const code = cleanCode(raw);
  currentCode = code;

  if (isCodeCut(raw)) addLog("🔧 Código incompleto detectado — correção aplicada.");
  else addLog("✅ Código validado com sucesso.");

  // Mostra preview
  const frame = document.getElementById("output-frame");
  const empty = document.getElementById("preview-empty");
  frame.srcdoc = code;
  frame.style.display = "block";
  empty.style.display = "none";

  // Mostra código
  const codeOut = document.getElementById("code-output");
  const codeEmpty = document.getElementById("code-empty");
  codeOut.textContent = code;
  codeOut.style.display = "block";
  codeEmpty.style.display = "none";

  document.getElementById("copy-btn").disabled = false;
  document.getElementById("download-btn").disabled = false;

  addLog("✓ Pronto! Projeto gerado.");

  isGenerating = false;
  btn.disabled = false;
  btn.innerHTML = '<span>✨</span> Gerar Projeto';
  stopBtn.classList.add("hidden");
}

// ======================================================
// PARAR
// ======================================================

function pararGeracao() {
  abortController?.abort();
  isGenerating = false;
  document.getElementById("generate-btn").disabled = false;
  document.getElementById("generate-btn").innerHTML = '<span>✨</span> Gerar Projeto';
  document.getElementById("stop-btn").classList.add("hidden");
  addLog("✕ Geração cancelada.");
}

// ======================================================
// ABAS
// ======================================================

function switchTab(tab, btn) {
  document.querySelectorAll(".tab-content").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.getElementById("tab-" + tab).classList.add("active");
  btn.classList.add("active");
}

// ======================================================
// COPIAR / BAIXAR
// ======================================================

function copyCode() {
  if (!currentCode) return;
  navigator.clipboard.writeText(currentCode).then(() => {
    const btn = document.getElementById("copy-btn");
    btn.textContent = "✅ Copiado!";
    setTimeout(() => btn.innerHTML = "📋 Copiar", 2000);
  });
}

function downloadCode() {
  if (!currentCode) return;
  const blob = new Blob([currentCode], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "projeto.html";
  a.click();
  URL.revokeObjectURL(url);
  addLog("⬇ Arquivo baixado: projeto.html");
}

// ======================================================
// PREVIEW RESPONSIVO
// ======================================================

function configurarResponsivo() {
  const labels = { desktop: "100%", tablet: "768px", mobile: "375px" };
  document.querySelectorAll(".resp-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view;
      const wrapper = document.getElementById("iframe-wrapper");
      wrapper.className = "iframe-wrapper view-" + view;
      document.querySelectorAll(".resp-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("view-label").textContent = labels[view];
    });
  });
}
