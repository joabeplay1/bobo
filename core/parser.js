export function extractFiles(aiResponse) {
  const files = {};
  const regex = /FILE:\s*([a-zA-Z0-9_\-\.\/]+)\n([\s\S]*?)(?=(?:FILE:\s*[a-zA-Z0-9_\-\.\/]+\n)|$)/g;
  
  let match;
  let hasMatches = false;

  while ((match = regex.exec(aiResponse)) !== null) {
    hasMatches = true;
    const filename = match[1].trim();
    const content = match[2].trim();
    files[filename] = content;
  }

  if (!hasMatches) {
    let clean = aiResponse.replace(/```html/gi, "").replace(/```/g, "").trim();
    files["index.html"] = clean;
  }

  return files;
}

export function compileToSingleBlob(files) {
  let html = files["index.html"] || "<html><body>Nenhum index.html encontrado</body></html>";
  
  if (files["style.css"]) {
    const styleTag = `<style id="_omega_injected_styles">\n${files["style.css"]}\n</style>`;
    html = html.replace("</head>", `${styleTag}\n</head>`);
  }
  
  if (files["script.js"]) {
    const scriptTag = `<script id="_omega_injected_script">\n${files["script.js"]}\n<\/script>`;
    html = html.replace("</body>", `${scriptTag}\n</body>`);
  }
  
  return html;
}
