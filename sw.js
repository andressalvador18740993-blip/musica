const CACHE_NAME = "salvamusic-offline-v4";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/js/app.js",
  "https://cdn.tailwindcss.com",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css",
  "https://cdn.jsdelivr.net/npm/pocketbase@0.21.1/dist/pocketbase.umd.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clientsClaim();
});

self.addEventListener("fetch", (event) => {
  // Ignoramos peticiones externas que no sean de nuestro dominio o recursos estáticos principales
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        return networkResponse;
      }).catch(() => {
        // Si no hay red y es una solicitud de página, devolvemos el index.html en caché
        if (event.request.mode === 'navigate' || event.request.destination === 'document') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
