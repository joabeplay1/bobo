export function injectPWAFiles(files, appName = "Omega PWA App") {
  const cleanFiles = { ...files };
  
  const manifest = {
    "name": appName,
    "short_name": appName.slice(0, 12),
    "description": "Aplicativo gerado na plataforma Omega Factory",
    "start_url": "./index.html",
    "display": "standalone",
    "background_color": "#0a0a0f",
    "theme_color": "#7c3aed",
    "icons": [
      {
        "src": "https://cdn-icons-png.flaticon.com/512/3067/3067260.png",
        "sizes": "512x512",
        "type": "image/png",
        "purpose": "any maskable"
      }
    ]
  };

  const serviceWorker = `const CACHE_NAME = 'omega-v1';
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(['./', './index.html', './style.css', './script.js'])));
});
self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then((res) => res || fetch(e.request)));
});`;

  cleanFiles["manifest.json"] = JSON.stringify(manifest, null, 2);
  cleanFiles["service-worker.js"] = serviceWorker;

  if (cleanFiles["index.html"]) {
    let html = cleanFiles["index.html"];
    if (!html.includes("manifest.json")) {
      html = html.replace("</head>", `  <link rel="manifest" href="manifest.json">\n</head>`);
    }
    if (!html.includes("serviceWorker" in navigator)) {
      const registerScript = `\n<script>
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.register('./service-worker.js').catch(err => console.log('SW Error', err));
        }
      </script>\n</body>`;
      html = html.replace("</body>", registerScript);
    }
    cleanFiles["index.html"] = html;
  }

  return cleanFiles;
}
