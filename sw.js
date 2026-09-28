// Simple service worker for extended font caching
// v3: B612 / B612 Mono self-hosted under /assets/fonts/. Only woff2 files are
// cached (their content never changes); fonts.css is left to the HTTP cache so
// an edited stylesheet is never pinned by the worker. Nothing is precached on
// install, so a first visit does not download fonts the page never uses.
const CACHE_NAME = 'b-log-fonts-v3';

self.addEventListener('install', () => {
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

  // Only cache same-origin font files
  if (url.origin === self.location.origin && url.pathname.startsWith('/assets/fonts/') && url.pathname.endsWith('.woff2')) {
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
