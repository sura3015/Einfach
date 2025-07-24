const CACHE_NAME = "einfach-code-editor-cache-v13";
const OFFLINE_PAGE_NAME = "offline.html";
const getBaseUrlPath = () => {
  const scopePath = self.registration.scope;
  const url = new URL(scopePath);
  return url.pathname;
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("Opened cache:", CACHE_NAME);

        const baseUrlPath = getBaseUrlPath();

        const urlsToCache = [
          baseUrlPath,
          `${baseUrlPath}icon-192.png`,
          `${baseUrlPath}icon-512.png`,
          `${baseUrlPath}icons/refresh.svg`,
          `${baseUrlPath}icons/cloud_off.svg`,
          `${baseUrlPath}icons/wifi_off.svg`,
          `${baseUrlPath}${OFFLINE_PAGE_NAME}`,
        ];

        console.log("Attempting to cache URLs:", urlsToCache);

        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error("Failed to cache during install:", error);
        // console.error('Error details:', error);
      })
  );
});

self.addEventListener("fetch", (event) => {
  // ナビゲーションリクエスト（HTMLページのリクエスト）の場合
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => {
        // ネットワークエラーの場合、オフラインページを返す
        const baseUrlPath = getBaseUrlPath();
        return caches.match(`${baseUrlPath}${OFFLINE_PAGE_NAME}`); // 正しいパスで取得
      })
    );
    return;
  }

  // その他のリクエスト（CSS、JS、画像など）の場合
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }
      return fetch(event.request)
        .then((response) => {
          if (
            !response ||
            response.status !== 200 ||
            response.type !== "basic"
          ) {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return response;
        })
        .catch((error) => {
          console.warn("Fetch failed for:", event.request.url, error);
          return new Response(
            "You are offline and this resource is not cached.",
            { status: 503, statusText: "Service Unavailable" }
          );
        });
    })
  );
});

self.addEventListener("activate", (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log("Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
