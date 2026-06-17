export function extractFiles(aiResponse) {
  const files = {};
  // Regex aprimorado para capturar delimitadores de bloco de código, caso existam
  const regex = /(?:FILE:\s*([a-zA-Z0-9_\-\.\/]+)\n)([\s\S]*?)(?=(?:FILE:\s*[a-zA-Z0-9_\-\.\/]+\n)|$)/g;
  
  let match;
  let hasMatches = false;

  while ((match = regex.exec(aiResponse)) !== null) {
    hasMatches = true;
    const filename = match[1].trim();
    const content = match[2].trim();
    // Limpeza extra para remover blocos Markdown caso a IA os envie
    files[filename] = content.replace(/^```[a-z]*\n/, "").replace(/\n```$/, "");
  }

  if (!hasMatches) {
    // Fallback se a IA retornar apenas o HTML sem formato de arquivo
    let clean = aiResponse.replace(/```html/gi, "").replace(/```/g, "").trim();
    files["index.html"] = clean;
  }

  return files;
}

export function compileToSingleBlob(files) {
  let html = files["index.html"] || "<html><body>Nenhum index.html encontrado</body></html>";
  
  // Injeta o CSS no head
  if (files["style.css"]) {
    const styleTag = `<style id="_omega_injected_styles">\n${files["style.css"]}\n</style>`;
    if (!html.includes('</head>')) {
        html = `${styleTag}\n${html}`;
    } else {
        html = html.replace("</head>", `${styleTag}\n</head>`);
    }
  }
  
  // Injeta o JS no body como MODULE (Corrige o erro de import/export)
  if (files["script.js"]) {
    // type="module" permite que o JS dentro do iframe use import/export nativamente
    const scriptTag = `<script id="_omega_injected_script" type="module">\n${files["script.js"]}\n<\/script>`;
    if (!html.includes('</body>')) {
        html = `${html}\n${scriptTag}`;
    } else {
        html = html.replace("</body>", `${scriptTag}\n</body>`);
    }
  }
  
  return html;
}
