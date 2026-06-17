let currentTargetElement = null;

export function initStyleEditor(iframeElement, onStyleChangedCallback) {
  if (!iframeElement) return;

  const doc = iframeElement.contentDocument || iframeElement.contentWindow.document;
  
  doc.addEventListener("click", (e) => {
    if (window.omegaEditModeActive) {
      e.preventDefault();
      e.stopPropagation();
      
      currentTargetElement = e.target;
      openInspectorPanel(currentTargetElement);
    }
  }, true);
  
  setupInspectorListeners(onStyleChangedCallback, doc);
}

function openInspectorPanel(el) {
  const panel = document.getElementById("style-inspector-panel");
  if (!panel) return;
  
  panel.style.display = "block";
  
  const computed = window.getComputedStyle(el);
  
  document.getElementById("inspect-bg").value = rgbToHex(computed.backgroundColor) || "#ffffff";
  document.getElementById("inspect-color").value = rgbToHex(computed.color) || "#000000";
  document.getElementById("inspect-font").value = parseInt(computed.fontSize) || 16;
  document.getElementById("inspect-width").value = el.style.width || computed.width;
  document.getElementById("inspect-height").value = el.style.height || computed.height;
  document.getElementById("inspect-border").value = el.style.border || "none";
}

function setupInspectorListeners(onChangeCallback, iframeDoc) {
  const inputs = {
    bg: document.getElementById("inspect-bg"),
    color: document.getElementById("inspect-color"),
    font: document.getElementById("inspect-font"),
    width: document.getElementById("inspect-width"),
    height: document.getElementById("inspect-height"),
    border: document.getElementById("inspect-border")
  };

  if (!inputs.bg) return;

  inputs.bg.addEventListener("input", (e) => { if (currentTargetElement) currentTargetElement.style.backgroundColor = e.target.value; triggerUpdate(); });
  inputs.color.addEventListener("input", (e) => { if (currentTargetElement) currentTargetElement.style.color = e.target.value; triggerUpdate(); });
  inputs.font.addEventListener("input", (e) => { if (currentTargetElement) currentTargetElement.style.fontSize = `${e.target.value}px`; triggerUpdate(); });
  inputs.width.addEventListener("input", (e) => { if (currentTargetElement) currentTargetElement.style.width = e.target.value; triggerUpdate(); });
  inputs.height.addEventListener("input", (e) => { if (currentTargetElement) currentTargetElement.style.height = e.target.value; triggerUpdate(); });
  inputs.border.addEventListener("input", (e) => { if (currentTargetElement) currentTargetElement.style.border = e.target.value; triggerUpdate(); });

  function triggerUpdate() {
    if (onChangeCallback) {
      onChangeCallback(iframeDoc.documentElement.outerHTML);
    }
  }
}

function rgbToHex(rgb) {
  if (!rgb || rgb === "transparent" || rgb.startsWith("rgba(0, 0, 0, 0")) return "#ffffff";
  const rgbValues = rgb.match(/\d+/g);
  if (!rgbValues) return "#ffffff";
  return "#" + rgbValues.slice(0, 3).map(x => {
    const hex = parseInt(x).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }).join("");
}
