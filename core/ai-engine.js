import { SYSTEM_PROMPT } from "./prompt-engine.js";

export async function callAI({ promptText, apiKey, provider, model, currentFiles = null, signal }) {
  const isGemini = provider === "gemini";
  const url = isGemini 
    ? `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
    : "https://api.groq.com/openai/v1/chat/completions";

  let finalPrompt = "";
  
  if (currentFiles && Object.keys(currentFiles).length > 0) {
    let formattedContext = "";
    for (const [filename, content] of Object.entries(currentFiles)) {
      formattedContext += `\nFILE: ${filename}\n${content}\n`;
    }
    
    finalPrompt = `MODO DE EVOLUÇÃO NÃO-DESTRUTIVA.
    Você deve analisar o código existente, manter TODAS as funções e regras de negócio atuais e apenas adicionar ou modificar as linhas necessárias para cumprir a nova especificação. É terminantemente proibido remover funcionalidades pré-existentes.
    
    CÓDIGO ATUAL DO APP:
    ${formattedContext}
    
    SOLICITAÇÃO DE ADIÇÃO/MELHORIA:
    ${promptText}`;
  } else {
    finalPrompt = `SOLICITAÇÃO DE CRIAÇÃO DO ZERO:\n${promptText}`;
  }

  const payload = isGemini ? {
    contents: [{ parts: [{ text: SYSTEM_PROMPT + "\n\n" + finalPrompt }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 65536 }
  } : {
    model: model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: finalPrompt }
    ],
    max_tokens: 32768,
    temperature: 0.2
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(!isGemini && { "Authorization": `Bearer ${apiKey}` })
    },
    body: JSON.stringify(payload),
    signal
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `Erro HTTP ${response.status}`);
  }

  const data = await response.json();
  const rawOutput = isGemini 
    ? data?.candidates?.[0]?.content?.parts?.[0]?.text 
    : data?.choices?.[0]?.message?.content;

  if (!rawOutput || !rawOutput.trim()) {
    throw new Error("A IA retornou uma resposta em branco. Tente ajustar o prompt.");
  }

  return rawOutput;
}
