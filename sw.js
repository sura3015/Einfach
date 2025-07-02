self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open("vscode-pwa")
      .then((cache) =>
        cache.addAll([
          "./",
          "./index.html",
          "./app.js",
          "./manifest.json",
          "./icon-192.png",
          "./icon-512.png",
        ])
      )
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((res) => res || fetch(event.request))
  );
});
