// Simple service worker for extended font caching
const CACHE_NAME = 'b-log-fonts-v1';
const FONT_CACHE_DAYS = 365;

const FONT_URLS = [
  '/assets/fonts/inter-latin-400.woff2',
  '/assets/fonts/inter-latin-700.woff2',
  '/assets/css/fonts.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FONT_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only cache fonts and font CSS
  if (url.pathname.startsWith('/assets/fonts/') || url.pathname.startsWith('/assets/css/fonts.css')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        });
      })
    );
  }
});
