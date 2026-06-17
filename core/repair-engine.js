export function repairCode(code) {
  if (!code) return "";
  let repaired = code.trim();

  if (!repaired.toLowerCase().includes("</html>")) {
    repaired += "\n</html>";
  }
  if (!repaired.toLowerCase().includes("</body>")) {
    if (repaired.toLowerCase().includes("</html>")) {
      repaired = repaired.replace(/<\/html>/i, "</body>\n</html>");
    } else {
      repaired += "\n</body>";
    }
  }

  const openScripts = (repaired.match(/<script/gi) || []).length;
  const closeScripts = (repaired.match(/<\/script>/gi) || []).length;
  if (openScripts > closeScripts) {
    repaired = repaired.replace(/<\/body>/i, "<\/script>\n</body>");
  }

  return repaired;
}
