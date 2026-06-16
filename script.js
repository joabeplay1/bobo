const GEMINI_MODELS=["gemini-2.5-flash","gemini-2.0-flash"];
const GROQ_MODELS=["llama-3.3-70b-versatile","deepseek-r1-distill-llama-70b","llama3-70b-8192"];
let isGenerating=false,abortController=null,currentCode="",editMode=false,currentProjectId=null;
const STORAGE_KEY="omega_projects_v2";

const SYSTEM_PROMPT=`
OMEGA AUTO SOFTWARE FACTORY PRO MODE

MISSÃO:
Transformar qualquer pedido em software REAL, COMPLETO, PROFISSIONAL, ESCALÁVEL e 100% FUNCIONAL.

PROCESSO:

1. Analisar profundamente o pedido.
2. Planejar a arquitetura do aplicativo.
3. Planejar telas, componentes e fluxos.
4. Implementar todas as funcionalidades.
5. Validar todas as interações.
6. Corrigir possíveis erros.
7. Entregar o sistema completo.

REGRAS:

* Design premium e moderno.
* Interface profissional nível SaaS.
* Responsivo para mobile, tablet e desktop.
* UX e UI de alta qualidade.
* Animações suaves e modernas.
* Todos os botões funcionais.
* Todos os formulários funcionais.
* Todos os menus funcionais.
* Todos os links funcionais.
* LocalStorage quando necessário.
* Tratamento de erros.
* Validações completas.
* Loading states.
* Feedback visual para ações do usuário.
* NUNCA criar funções vazias.
* NUNCA gerar recursos falsos.
* NUNCA deixar elementos sem funcionamento.

QUALIDADE NÍVEL APP BUILDER:

* Pensar como arquiteto de software sênior.
* Pensar como desenvolvedor full stack.
* Criar aplicativos completos e utilizáveis.
* Criar dashboards quando apropriado.
* Criar CRUD completo quando necessário.
* Criar sistemas administrativos quando necessário.
* Criar filtros e pesquisas quando necessário.
* Criar modais funcionais.
* Criar notificações.
* Criar componentes reutilizáveis.
* Criar experiência semelhante a software real.
* Priorizar produtividade e experiência do usuário.
* Nunca gerar apenas landing page quando o pedido for um aplicativo.

COMPLETUDE:

* Escrever TODAS as funções completas.
* Escrever TODO o HTML.
* Escrever TODO o CSS.
* Escrever TODO o JavaScript.
* NUNCA usar "// resto aqui".
* NUNCA usar "// continue".
* NUNCA resumir código.
* NUNCA abreviar implementação.
* NUNCA omitir partes importantes.

VERIFICAÇÃO FINAL:
Antes de responder:

* Verificar HTML.
* Verificar CSS.
* Verificar JavaScript.
* Verificar responsividade.
* Verificar formulários.
* Verificar botões.
* Verificar menus.
* Verificar eventos.
* Corrigir automaticamente qualquer erro encontrado.

MODO APP BUILDER PROFISSIONAL:

Antes de escrever qualquer código:

1. Entender o objetivo do aplicativo.
2. Planejar todas as telas.
3. Planejar componentes.
4. Planejar armazenamento de dados.
5. Planejar fluxos do usuário.
6. Planejar validações.
7. Planejar responsividade.
8. Somente depois gerar o código completo.

A resposta deve parecer um software criado por uma equipe profissional e não um exemplo ou protótipo.

PROIBIDO:

* Código parcial.
* Placeholders.
* Botões sem ação.
* Markdown.
* Crases.
* Explicações fora do código.
* Comentários de omissão.
* Funções vazias.
* Recursos simulados.

FORMATO:
APENAS HTML completo.
Iniciar obrigatoriamente com <!DOCTYPE html>.
CSS dentro de <style>.
JavaScript dentro de <script>.
Última linha obrigatoriamente </html>.
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
  
  // [Melhoria 2] Carregar Provedor salvo antes de atualizar os modelos da lista
  const savedProvider = localStorage.getItem("omega_provider");
  if(savedProvider){
    document.getElementById("api-provider").value = savedProvider;
  }

  atualizarModelos();
  configurarResponsivo();
  renderHistory();
  
  // [Melhoria 1] Carregar API Key salva
  const savedKey = localStorage.getItem("omega_api_key");
  if(savedKey){
    document.getElementById("api-key").value = savedKey;
  }

  // [Melhoria 4] Carregar Prompt salvo
  const promptField = document.getElementById("prompt");
  promptField.value = localStorage.getItem("omega_prompt") || "";

  // Ouvintes de Eventos para os botões principais
  document.getElementById("generate-btn").addEventListener("click",gerarProjeto);
  document.getElementById("stop-btn").addEventListener("click",pararGeracao);
  
  // [Melhoria 2] Salvar Provedor automaticamente ao mudar e atualizar lista de modelos
  document.getElementById("api-provider").addEventListener("change", e => {
    localStorage.setItem("omega_provider", e.target.value);
    atualizarModelos();
  });

  // [Melhoria 1] Salvar API Key automaticamente ao digitar
  document.getElementById("api-key").addEventListener("input", e => {
    localStorage.setItem("omega_api_key", e.target.value);
  });

  // [Melhoria 4] Salvar Prompt automaticamente ao digitar
  promptField.addEventListener("input", () => {
    localStorage.setItem("omega_prompt", promptField.value);
  });

  document.getElementById("eye-btn").addEventListener("click",()=>{const i=document.getElementById("api-key");i.type=i.type==="password"?"text":"password";});
  document.getElementById("prompt").addEventListener("keydown",e=>{if(e.key==="Enter"&&(e.ctrlKey||e.metaKey))gerarProjeto();});
  
  // Escutar alterações do editor visual vindas do iframe
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
  if(!t.toLowerCase().endsWith("</html>"))return true;
  if(!t.toLowerCase().includes("</body>"))return true;
  const so=(t.match(/<script/gi)||[]).length,sc=(t.match(/<\/script>/gi)||[]).length;
  if(so>sc)return true;
  const op=(t.match(/\{/g)||[]).length,cl=(t.match(/\}/g)||[]).length;
  if(op-cl>5)return true;
  return false;
}
function cleanCode(raw){
  let code=raw.replace(/<think>[\s\S]*?<\/think>/gi,"").replace(/```html\s*/gi,"").replace(/```javascript\s*/gi,"").replace(/```css\s*/gi,"").replace(/```\s*/g,"").replace(/^[\s\S]*?(?=<!DOCTYPE html>|<html)/i,"").trim();
  if(!code.toLowerCase().startsWith("<!doctype")){const idx=code.toLowerCase().indexOf("<html");if(idx>0)code=code.substring(idx);code="<!DOCTYPE html>\n"+code;}
  if(!code.toLowerCase().includes("<html")){code=`<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n<meta charset="UTF-8">\n<style>body{font-family:Arial,sans-serif;padding:20px}</style>\n</head>\n<body>\n${code}\n</body>\n</html>`;}
  if(isCodeCut(code)){const so=(code.match(/<script/gi)||[]).length,sc=(code.match(/<\/script>/gi)||[]).length;let fix=code;for(let i=0;i<so-sc;i++)fix+="\n}catch(e){}\n</script>";if(!fix.toLowerCase().includes("</body>"))fix+="\n</body>";if(!fix.toLowerCase().endsWith("</html>"))fix+="\n</html>";return fix;}
  return code;
}
async function robustFetch(url,options){
  const response=await fetch(url,options);
  const data=await response.json().catch(()=>null);
  if(!response.ok){const msg=data?.error?.message||data?.error?.code||(typeof data?.error==="string"?data.error:null)||data?.message||`HTTP ${response.status}: ${response.statusText}`;throw new Error(msg);}
  if(data?.error)throw new Error(data.error.message||JSON.stringify(data.error));
  return data;
}

async function callAPI(promptText){
  const apiKey=document.getElementById("api-key").value.trim();

  // [Melhoria 6] Detector de Erros da API Key antes da requisição
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
  const userMsg=`INSTRUÇÕES CRÍTICAS: RESPONDA APENAS COM HTML COMPLETO. COMEÇAR COM <!DOCTYPE html>. CSS em <style>. JS em <script>. ÚLTIMA LINHA </html>. PROIBIDO abreviar.\n\n${promptText}`;
  const body=isGemini
    ?{contents:[{parts:[{text:SYSTEM_PROMPT+"\n\n"+userMsg}]}],generationConfig:{temperature:0.3,maxOutputTokens:65536}}
    :{model,messages:[{role:"system",content:SYSTEM_PROMPT},{role:"user",content:userMsg}],max_tokens:32768,temperature:0.25};
  const headers={"Content-Type":"application/json"};
  if(!isGemini)headers["Authorization"]="Bearer "+apiKey;
  const data=await robustFetch(url,{method:"POST",headers,body:JSON.stringify(body),signal:abortController?.signal});
  const raw=isGemini?data?.candidates?.[0]?.content?.parts?.[0]?.text||"":data?.choices?.[0]?.message?.content||"";
  if(data?.choices?.[0]?.finish_reason==="length")addLog("⚠ Limite de tokens — corrigindo...");
  const gr=data?.candidates?.[0]?.finishReason;
  if(gr&&gr!=="STOP")addLog("⚠ Gemini parou: "+gr);
  if(!raw||!raw.trim())throw new Error("A IA retornou resposta vazia. Verifique sua API Key.");
  return cleanCode(raw);
}
function showCode(code){
  const frame=document.getElementById("output-frame");
  frame.srcdoc=code;frame.style.display="block";
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
  btn.disabled=true;btn.innerHTML='<span class="spinner"></span> Gerando...';stopBtn.classList.remove("hidden");
  addLog("⏳ Gerando projeto...");
  try{
    const code=await callAPI("PEDIDO DO USUÁRIO:\n"+prompt);
    currentCode=code;currentProjectId=null;
    showCode(code);saveCurrentProject();
    addLog("✓ Projeto gerado e salvo!");
  }catch(e){
    if(e.name==="AbortError"||e.message?.includes("abort"))addLog("✕ Geração cancelada.");
    else addLog("❌ Erro: "+e.message);
  }finally{
    isGenerating=false;btn.disabled=false;btn.innerHTML='<span>✨</span> Gerar Projeto';stopBtn.classList.add("hidden");
  }
}
async function runImprovement(improvPrompt){
  if(!currentCode){addLog("⚠ Gere um projeto primeiro");return;}
  const apiKey=document.getElementById("api-key").value.trim();
  if(!apiKey){addLog("⚠ Configure a API Key");return;}
  isGenerating=true;abortController=new AbortController();
  const btns=document.querySelectorAll(".quick-btn,.btn-generate");btns.forEach(b=>b.disabled=true);
  addLog("🪄 IA Assistente aplicando melhoria...");
  try{
    const fullPrompt=`MODO MELHORIA — REGRAS ABSOLUTAS: mantenha TODAS as funcionalidades. APENAS adicione/melhore, NUNCA remova.\n\nMELHORIA: ${improvPrompt}\n\nCÓDIGO ATUAL:\n${currentCode}`;
    const improved=await callAPI(fullPrompt);
    currentCode=improved;showCode(improved);saveCurrentProject();
    addLog("✅ Melhoria aplicada e salva!");
  }catch(e){
    if(e.name==="AbortError"||e.message?.includes("abort"))addLog("✕ Cancelado.");
    else addLog("❌ Erro na melhoria: "+e.message);
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
  addLog("✕ Geração cancelada.");
}

// [Melhoria 5] Nova Função Corrigida de Troca de Aba
function switchTab(tab, btn){
  document.querySelectorAll(".tab-content").forEach(el=>{
    el.classList.remove("active");
  });
  document.querySelectorAll(".tab-btn").forEach(el=>{
    el.classList.remove("active");
  });
  document.getElementById(`tab-${tab}`).classList.add("active");
  if(btn){
    btn.classList.add("active");
  }
}

function copyCode(){
  if(!currentCode)return;
  navigator.clipboard.writeText(currentCode).then(()=>{
    const btn=document.getElementById("copy-btn");btn.textContent="✅ Copiado!";
    setTimeout(()=>btn.innerHTML="📋 Copiar",2000);
  });
}

// [Melhoria 3] Nova Função de Exportação Avançada para downloadCode()
async function downloadCode(){
  if(!currentCode) return;
  const blob = new Blob([currentCode], {
    type: "text/html"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "index.html";
  a.click();
  URL.revokeObjectURL(url);
  addLog("📦 Projeto exportado.");
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
  addLog(editMode?"✏ Editor visual ativado — clique em textos para editar":"✏ Editor visual desativado.");
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
