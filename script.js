// [Problema 4] Modelos otimizados para produções massivas e complexas
const GEMINI_MODELS=["gemini-2.5-flash","gemini-2.0-flash"];
const GROQ_MODELS=["llama-3.3-70b-versatile","deepseek-r1-distill-llama-70b"];
let isGenerating=false,abortController=null,currentCode="",editMode=false,currentProjectId=null;
const STORAGE_KEY="omega_projects_v2";

// [Problema 5] SYSTEM_PROMPT Expandido de Nível Corporativo
const SYSTEM_PROMPT=`
OMEGA AUTO SOFTWARE FACTORY PRO MODE — MULTI-FILE ARCHITECT
MISSÃO: Transformar qualquer especificação em um ecossistema de software REAL, ROBUSTO, INTEGRAL e 100% OPERACIONAL.

REGRAS DE ESTRUTURAÇÃO (MULTI-ARQUIVOS):
- Você NÃO está limitado a um único arquivo. Crie uma arquitetura modular limpa e profissional.
- Divida o sistema nos arquivos necessários para sua escala (ex: index.html, style.css, app.js, player.js, api.js, manifest.json).
- SEPARE CADA ARQUIVO EXPLICITAMENTE usando a seguinte marcação exata:
=== ARQUIVO: nome_do_arquivo.extensao ===
[Insira o código completo do arquivo aqui sem abreviações]

DIRETRIZES DE COMPLETUDE ABSOLUTA:
- LEIA 100% DO PEDIDO DO USUÁRIO. Desenvolva cada detalhe solicitado com rigor técnico.
- NUNCA use placeholders, reticências (...) ou comentários de omissão como "// código omitido", "/* adicione aqui */", ou "funcionalidade não implementada".
- Escreva TODA a lógica interna de cada função. Se precisar simular APIs ou Banco de Dados, use estruturas complexas em localStorage / sessionStorage dentro dos arquivos JS.
- O design visual deve ser premium, responsivo, moderno, utilizando variáveis organizadas no CSS, flexbox/grid e animações fluidas.
- Entregue engenharia de software real e pronta para uso imediato.
- Não inclua explicações em prosa fora dos blocos de arquivos estruturados.
`;

// ── Storage ──────────────────────────────────────────────────────────────────
function getProjects(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]")}catch{return[]}}
function saveProjects(ps){localStorage.setItem(STORAGE_KEY,JSON.stringify(ps))}
function saveCurrentProject(){
  if(!currentCode)return;
  const ps=getProjects();
  const name=document.getElementById("prompt").value.trim().slice(0,40)||"Projeto sem nome";
  if(currentProjectId){
    const idx=ps.findIndex(p=>p.id===currentProjectId);
    if(idx>=0){ps[idx]={...ps[idx],code:currentCode,prompt:document.getElementById("prompt").value,updatedAt:Date.now()};saveProjects(ps);renderHistory();return;}
  }
  const p={id:Date.now().toString(),name,prompt:document.getElementById("prompt").value,code:currentCode,createdAt:Date.now(),updatedAt:Date.now()};
  ps.unshift(p);saveProjects(ps);currentProjectId=p.id;renderHistory();
}
function renderHistory(){
  const ps=getProjects();
  const el=document.getElementById("history-list");
  if(!ps.length){el.innerHTML='<p style="font-size:11px;color:var(--muted);padding:8px;text-align:center;font-style:italic">Nenhum projeto salvo</p>';return;}
  el.innerHTML=ps.map(p=>`
    <div class="history-item" onclick="loadProject('${p.id}')">
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</div>
        <div style="font-size:10px;color:var(--muted)">${new Date(p.updatedAt).toLocaleDateString("pt-BR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</div>
      </div>
      <button class="del-btn" onclick="event.stopPropagation();delProject('${p.id}')" title="Excluir">🗑</button>
    </div>
  `).join("");
}
function loadProject(id){
  const p=getProjects().find(x=>x.id===id);
  if(!p)return;
  currentCode=p.code;currentProjectId=p.id;
  document.getElementById("prompt").value=p.prompt||"";
  showCode(p.code);addLog("📂 Projeto carregado: "+p.name);
}
function delProject(id){
  const ps=getProjects().filter(p=>p.id!==id);
  saveProjects(ps);
  if(currentProjectId===id){currentProjectId=null;}
  renderHistory();addLog("🗑 Projeto excluído.");
}
function newProject(){
  currentCode="";currentProjectId=null;
  document.getElementById("prompt").value="";
  document.getElementById("output-frame").style.display="none";
  document.getElementById("preview-empty").style.display="flex";
  document.getElementById("code-output").style.display="none";
  document.getElementById("code-empty").style.display="flex";
  document.getElementById("copy-btn").disabled=true;
  document.getElementById("download-btn").disabled=true;
  addLog("✚ Novo projeto iniciado.");
}

// ── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded",()=>{
  const savedProvider = localStorage.getItem("omega_provider");
  if(savedProvider){
    document.getElementById("api-provider").value = savedProvider;
  }

  atualizarModelos();
  configurarResponsivo();
  renderHistory();
  
  const savedKey = localStorage.getItem("omega_api_key");
  if(savedKey){
    document.getElementById("api-key").value = savedKey;
  }

  const promptField = document.getElementById("prompt");
  promptField.value = localStorage.getItem("omega_prompt") || "";

  document.getElementById("generate-btn").addEventListener("click",gerarProjeto);
  document.getElementById("stop-btn").addEventListener("click",pararGeracao);
  
  document.getElementById("api-provider").addEventListener("change", e => {
    localStorage.setItem("omega_provider", e.target.value);
    atualizarModelos();
  });

  document.getElementById("api-key").addEventListener("input", e => {
    localStorage.setItem("omega_api_key", e.target.value);
  });

  promptField.addEventListener("input", () => {
    localStorage.setItem("omega_prompt", promptField.value);
  });

  document.getElementById("eye-btn").addEventListener("click",()=>{const i=document.getElementById("api-key");i.type=i.type==="password"?"text":"password";});
  document.getElementById("prompt").addEventListener("keydown",e=>{if(e.key==="Enter"&&(e.ctrlKey||e.metaKey))gerarProjeto();});
  
  window.addEventListener("message",e=>{
    if(e.data?.type==="omega_text_edit"&&e.data.html){
      currentCode="<!DOCTYPE html>\n"+e.data.html;
      document.getElementById("code-output").textContent=currentCode;
      saveCurrentProject();
    }
  });
});

function atualizarModelos(){
  const p=document.getElementById("api-provider").value;
  const s=document.getElementById("model-select");
  const m=p==="gemini"?GEMINI_MODELS:GROQ_MODELS;
  s.innerHTML=m.map(x=>`<option value="${x}">${x}</option>`).join("");
}
function addLog(txt){
  const log=document.getElementById("status-log");
  const p=document.createElement("p");p.textContent=new Date().toLocaleTimeString()+" — "+txt;
  log.appendChild(p);log.scrollTop=log.scrollHeight;
}
function isCodeCut(c){
  const t=c.trim();
  if(t.includes("=== ARQUIVO:")) return false; // Ignora validação antiga se for arquitetura modular
  if(!t.toLowerCase().endsWith("</html>"))return true;
  if(!t.toLowerCase().includes("</body>"))return true;
  const so=(t.match(/<script/gi)||[]).length,sc=(t.match(/<\/script>/gi)||[]).length;
  if(so>sc)return true;
  return false;
}
function cleanCode(raw){
  let code=raw.replace(/<think>[\s\S]*?<\/think>/gi,"").replace(/```html\s*/gi,"").replace(/```javascript\s*/gi,"").replace(/```css\s*/gi,"").replace(/```\s*/g,"").trim();
  
  // Se for arquitetura modular de arquivos, preserva a estrutura crua intacta
  if(code.includes("=== ARQUIVO:")) return code;

  if(!code.toLowerCase().startsWith("<!doctype")){const idx=code.toLowerCase().indexOf("<html");if(idx>0)code=code.substring(idx);code="<!DOCTYPE html>\n"+code;}
  if(!code.toLowerCase().includes("<html")){code=`<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n<meta charset="UTF-8">\n<style>body{font-family:Arial,sans-serif;padding:20px}</style>\n</head>\n<body>\n${code}\n</body>\n</html>`;}
  if(isCodeCut(code)){const so=(code.match(/<script/gi)||[]).length,sc=(code.match(/<\/script>/gi)||[]).length;let fix=code;for(let i=0;i<so-sc;i++)fix+="\n}catch(e){}\n</script>";if(!fix.toLowerCase().includes("</body>"))fix+="\n</body>";if(!fix.toLowerCase().endsWith("</html>"))fix+="\n</html>";return fix;}
  return code;
}

// ── compilador Dinâmico para o Preview do Iframe ──────────────────────────────
function buildPreviewCode(raw){
  if(!raw.includes("=== ARQUIVO:")) return raw;
  
  const parts = raw.split(/===\s*ARQUIVO:\s*([\w\.\-]+)\s*===/i);
  const files = {};
  for (let i = 1; i < parts.length; i += 2) {
    const filename = parts[i].trim().toLowerCase();
    const content = parts[i+1] ? parts[i+1].trim() : "";
    files[filename] = content;
  }
  
  let html = files["index.html"] || "";
  if(!html){
    const firstKey = Object.keys(files)[0];
    html = files[firstKey] || raw;
  }
  
  // Injeta folha de estilo gerada
  if(files["style.css"]){
    if(html.toLowerCase().includes("</head>")){
      html = html.replace(/<\/head>/i, `<style>${files["style.css"]}</style>\n</head>`);
    } else {
      html += `<style>${files["style.css"]}</style>`;
    }
  }
  
  // Compila e injeta todos os scripts JS gerados de forma sequencial
  let scripts = "";
  Object.keys(files).forEach(name => {
    if(name.endsWith(".js") && files[name]){
      scripts += `\n<script>\n// Módulo Emulado: ${name}\n${files[name]}\n<\/script>\n`;
    }
  });
  
  if(scripts){
    if(html.toLowerCase().includes("</body>")){
      html = html.replace(/<\/body>/i, `${scripts}\n</body>`);
    } else {
      html += scripts;
    }
  }
  return html;
}

async function robustFetch(url,options){
  const response=await fetch(url,options);
  const data=await response.json().catch(()=>null);
  if(!response.ok){const msg=data?.error?.message||data?.error?.code||(typeof data?.error==="string"?data.error:null)||data?.message||`HTTP ${response.status}: ${response.statusText}`;throw new Error(msg);}
  if(data?.error)throw new Error(data.error.message||JSON.stringify(data.error));
  return data;
}

// ── Chamada da API Otimizada ──────────────────────────────────────────────────
async function callAPI(promptText){
  const apiKey=document.getElementById("api-key").value.trim();

  if(!apiKey){
    throw new Error("API Key não informada.");
  }
  if(apiKey.length < 20){
    throw new Error("API Key inválida.");
  }

  const provider=document.getElementById("api-provider").value;
  const model=document.getElementById("model-select").value;
  const isGemini=provider==="gemini";
  const url=isGemini?`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`:"https://api.groq.com/openai/v1/chat/completions";
  
  // [Problema 1] Remoção completa do limitador de tamanho de caracteres
  const safePrompt = promptText;
  
  // [Problema 3] Estruturação agressiva anti-omissões do prompt do usuário
  const userMsg = `
ATENÇÃO:
LEIA 100% DO PEDIDO.
NÃO RESUMA.
NÃO CRIE EXEMPLOS.

NÃO ESCREVA EM HIPÓTESE ALGUMA FRASES COMO:
"este é apenas um exemplo"
"funcionalidade não implementada"
"backend necessário"
"adicione o código aqui"
"código omitido por espaço"
"restante do código..."

NUNCA OMITA CÓDIGO.

OBRIGATÓRIO:
- Implementar todas as funções declaradas.
- Implementar todos os botões e interações visuais.
- Implementar toda a lógica de estado do sistema.
- Entregar a aplicação 100% pronta para uso imediato.
- Gerar milhares de linhas se o projeto demandar.
- Continuar escrevendo até a última tag de fechamento do último arquivo.

PEDIDO DO USUÁRIO:
${safePrompt}
`;

  // [Problema 2] Elevação drástica do max_tokens do Groq para 8192
  const body=isGemini
    ?{contents:[{parts:[{text:SYSTEM_PROMPT+"\n\n"+userMsg}]}],generationConfig:{temperature:0.3,maxOutputTokens:65536}}
    :{model,messages:[{role:"system",content:SYSTEM_PROMPT},{role:"user",content:userMsg}],max_tokens:8192,temperature:0.2};
  
  const headers={"Content-Type":"application/json"};
  if(!isGemini)headers["Authorization"]="Bearer "+apiKey;
  const data=await robustFetch(url,{method:"POST",headers,body:JSON.stringify(body),signal:abortController?.signal});
  const raw=isGemini?data?.candidates?.[0]?.content?.parts?.[0]?.text||"":data?.choices?.[0]?.message?.content||"";
  if(data?.choices?.[0]?.finish_reason==="length")addLog("⚠ Limite de tokens atingido — o código pode ter sido fracionado.");
  const gr=data?.candidates?.[0]?.finishReason;
  if(gr&&gr!=="STOP")addLog("⚠ Status Gemini: "+gr);
  if(!raw||!raw.trim())throw new Error("A IA retornou uma resposta vazia.");
  return cleanCode(raw);
}

function showCode(code){
  const frame=document.getElementById("output-frame");
  // Compila o ecossistema de arquivos para rodar de forma unificada no preview
  frame.srcdoc=buildPreviewCode(code);
  frame.style.display="block";
  document.getElementById("preview-empty").style.display="none";
  const co=document.getElementById("code-output");co.textContent=code;co.style.display="block";
  document.getElementById("code-empty").style.display="none";
  document.getElementById("copy-btn").disabled=false;
  document.getElementById("download-btn").disabled=false;
  if(editMode)injectEditor();
}
async function gerarProjeto(){
  if(isGenerating)return;
  const prompt=document.getElementById("prompt").value.trim();
  const apiKey=document.getElementById("api-key").value.trim();
  if(!prompt||!apiKey){addLog("⚠ Preencha o prompt e a API Key");return;}
  isGenerating=true;abortController=new AbortController();
  const btn=document.getElementById("generate-btn"),stopBtn=document.getElementById("stop-btn");
  btn.disabled=true;btn.innerHTML='<span class="spinner"></span> Construindo Fábrica...';stopBtn.classList.remove("hidden");
  addLog("⏳ Analisando arquitetura e gerando arquivos do ecossistema...");
  try{
    const code=await callAPI(prompt);
    currentCode=code;currentProjectId=null;
    showCode(code);saveCurrentProject();
    addLog("✓ Projeto modular gerado com sucesso!");
  }catch(e){
    if(e.name==="AbortError"||e.message?.includes("abort"))addLog("✕ Processo interrompido.");
    else addLog("❌ Falha na Construção: "+e.message);
  }finally{
    isGenerating=false;btn.disabled=false;btn.innerHTML='<span>✨</span> Gerar Projeto';stopBtn.classList.add("hidden");
  }
}
async function runImprovement(improvPrompt){
  if(!currentCode){addLog("⚠ Nenhum ecossistema ativo para aplicar melhorias.");return;}
  const apiKey=document.getElementById("api-key").value.trim();
  if(!apiKey){addLog("⚠ Configure a API Key");return;}
  isGenerating=true;abortController=new AbortController();
  const btns=document.querySelectorAll(".quick-btn,.btn-generate");btns.forEach(b=>b.disabled=true);
  addLog("🪄 Redirecionando engenharia para aplicar melhorias...");
  try{
    const fullPrompt=`MODO REFATORAÇÃO DE ESCOPO — REGRAS: Mantenha todos os módulos existentes intactos. Adicione/modifique estritamente o necessário dentro dos delimitadores de arquivo.\n\nMELHORIA ESPECÍFICA: ${improvPrompt}\n\nCÓDIGO DA ARQUITETURA ATUAL:\n${currentCode}`;
    const improved=await callAPI(fullPrompt);
    currentCode=improved;showCode(improved);saveCurrentProject();
    addLog("✅ Arquitetura atualizada e salva com sucesso!");
  }catch(e){
    if(e.name==="AbortError"||e.message?.includes("abort"))addLog("✕ Cancelado.");
    else addLog("❌ Erro na refatoração: "+e.message);
  }finally{
    isGenerating=false;btns.forEach(b=>b.disabled=false);
  }
}
function runCustomImprovement(){
  const p=document.getElementById("improve-prompt").value.trim();
  if(!p){addLog("⚠ Descreva a melhoria");return;}
  runImprovement(p);document.getElementById("improve-prompt").value="";
}
function pararGeracao(){
  abortController?.abort();isGenerating=false;
  document.getElementById("generate-btn").disabled=false;
  document.getElementById("generate-btn").innerHTML='<span>✨</span> Gerar Projeto';
  document.getElementById("stop-btn").classList.add("hidden");
  document.querySelectorAll(".quick-btn").forEach(b=>b.disabled=false);
  addLog("✕ Operação cancelada pelo usuário.");
}

function switchTab(tab, btn){
  document.querySelectorAll(".tab-content").forEach(el=>{el.classList.remove("active");});
  document.querySelectorAll(".tab-btn").forEach(el=>{el.classList.remove("active");});
  document.getElementById(`tab-${tab}`).classList.add("active");
  if(btn){btn.classList.add("active");}
}

function copyCode(){
  if(!currentCode)return;
  navigator.clipboard.writeText(currentCode).then(()=>{
    const btn=document.getElementById("copy-btn");btn.textContent="✅ Copiado!";
    setTimeout(()=>btn.innerHTML="📋 Copiar Código",2000);
  });
}

// Exportador inteligente adaptado para lidar com pacotes de arquivos estruturados
async function downloadCode(){
  if(!currentCode) return;
  const isMulti = currentCode.includes("=== ARQUIVO:");
  const blob = new Blob([currentCode], {
    type: isMulti ? "text/plain" : "text/html"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = isMulti ? "pacote_projeto_completo.txt" : "index.html";
  a.click();
  URL.revokeObjectURL(url);
  addLog("📦 Ecossistema exportado.");
}

function configurarResponsivo(){
  const labels={desktop:"100%",tablet:"768px",mobile:"375px"};
  document.querySelectorAll(".resp-btn").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const v=btn.dataset.view;
      document.getElementById("iframe-wrapper").className="iframe-wrapper view-"+v;
      document.querySelectorAll(".resp-btn").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");document.getElementById("view-label").textContent=labels[v];
    });
  });
}
function toggleAI(){
  const body=document.getElementById("ai-body"),ch=document.getElementById("ai-chevron");
  const open=body.style.display==="none";
  body.style.display=open?"flex":"none";ch.textContent=open?"▲":"▼";
}
// ── Visual Editor ────────────────────────────────────────────────────────────
function toggleEdit(){
  editMode=!editMode;
  const btn=document.getElementById("edit-btn"),badge=document.getElementById("edit-badge");
  btn.style.borderColor=editMode?"var(--primary)":"var(--border)";
  btn.style.color=editMode?"var(--primary)":"var(--muted)";
  badge.style.display=editMode?"inline-flex":"none";
  if(editMode)injectEditor();else removeEditor();
  addLog(editMode?"✏ Editor visual ativo — clique nos blocos de texto do preview para alterar":"✏ Editor visual desativado.");
}
function injectEditor(){
  const iframe=document.getElementById("output-frame");
  if(!iframe||!iframe.contentDocument)return;
  const doc=iframe.contentDocument;
  let style=doc.getElementById("__omega_editor_style__");
  if(!style){style=doc.createElement("style");style.id="__omega_editor_style__";doc.head.appendChild(style);}
  style.textContent=`[data-omega-editable]:hover{outline:2px solid #7c3aed!important;outline-offset:2px;cursor:text!important}[data-omega-editable]:focus{outline:2px solid #22c55e!important;outline-offset:2px}`;
  const walker=doc.createTreeWalker(doc.body,NodeFilter.SHOW_ELEMENT);
  let node=walker.nextNode();
  while(node){
    const tag=node.tagName?.toLowerCase();
    const isText=["p","h1","h2","h3","h4","h5","h6","span","a","button","label","li","td","th","strong","em"].includes(tag);
    if(isText&&!node.getAttribute("data-omega-editable")){
      node.setAttribute("contenteditable","true");
      node.setAttribute("data-omega-editable","true");
      node.addEventListener("blur",e=>{
        const newT=e.target.innerText,oldT=e.target.getAttribute("data-orig")||"";
        if(newT!==oldT){window.parent.postMessage({type:"omega_text_edit",html:doc.documentElement.outerHTML},"*");}
      });
      node.addEventListener("focus",e=>{e.target.setAttribute("data-orig",e.target.innerText);});
    }
    node=walker.nextNode();
  }
}
function removeEditor(){
  const iframe=document.getElementById("output-frame");
  if(!iframe||!iframe.contentDocument)return;
  const doc=iframe.contentDocument;
  const style=doc.getElementById("__omega_editor_style__");if(style)style.remove();
  const els=doc.querySelectorAll("[data-omega-editable]");
  els.forEach(el=>{el.removeAttribute("contenteditable");el.removeAttribute("data-omega-editable");el.removeAttribute("data-orig");});
}
