export function detectProjectType(promptText) {
  const normalized = promptText.toLowerCase();
  
  if (normalized.includes("whatsapp") || normalized.includes("zap")) {
    return {
      type: "COMPLEX_MESSENGER",
      suggestedFiles: ["index.html", "style.css", "script.js", "chat.js", "contacts.js"]
    };
  }
  if (normalized.includes("tiktok") || normalized.includes("video")) {
    return {
      type: "MEDIA_SaaS",
      suggestedFiles: ["index.html", "style.css", "script.js", "feed.js", "player.js"]
    };
  }
  return {
    type: "STANDARD_APP",
    suggestedFiles: ["index.html", "style.css", "script.js"]
  };
}
