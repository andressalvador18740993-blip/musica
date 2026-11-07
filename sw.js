const CACHE_NAME = 'music-pwa-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './js/app.js',
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/pocketbase@0.21.1/dist/pocketbase.umd.js'
];

// Instalación del Service Worker y caché de archivos base
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// Activación y limpieza de cachés antiguos
self.addEventListener('activate', (event) => {
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
    self.clients.claim();
});

// Interceptar peticiones para servir contenido offline (incluyendo archivos de audio cacheados)
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse; // Devuelve el archivo desde la caché si existe
            }
            return fetch(event.request).then((networkResponse) => {
                // Opcional: si es un archivo de audio o recurso de PocketBase que el usuario descargue, podemos cachearlo al vuelo
                return networkResponse;
            }).catch(() => {
                // Si no hay red y el recurso no está en caché, puedes retornar una respuesta de respaldo si es necesario
            });
        })
    );
});
