const DB_NAME = "omega_vfs_history";

export function saveVersionSnapshot(projectId, files) {
  if (!projectId || !files) return;
  const history = JSON.parse(localStorage.getItem(DB_NAME) || "{}");
  if (!history[projectId]) history[projectId] = [];
  
  history[projectId].push({
    timestamp: Date.now(),
    files: files
  });
  
  localStorage.setItem(DB_NAME, JSON.stringify(history));
}

export function getProjectVersions(projectId) {
  const history = JSON.parse(localStorage.getItem(DB_NAME) || "{}");
  return history[projectId] || [];
}
