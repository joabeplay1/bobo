export async function downloadProjectAsZip(files, projectName = "OmegaProject") {
  if (!files || Object.keys(files).length === 0) {
    alert("Nenhum arquivo de código disponível para exportação.");
    return;
  }

  const zip = new JSZip();
  const cleanName = projectName.trim().replace(/[^a-zA-Z0-9]/g, "_") || "MeuApp";

  for (const [filename, content] of Object.entries(files)) {
    zip.file(filename, content);
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${cleanName}.zip`;
  anchor.click();
  
  URL.revokeObjectURL(url);
}
