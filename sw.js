/*
 * Cricket Scorer — Service Worker
 * Enables offline use and instant loading after the first visit.
 *
 * Strategy:
 *   - Precache the app shell on install (HTML, icons, manifest)
 *   - Serve those from cache first, fall back to network
 *   - Use "stale-while-revalidate" for the main HTML so users get
 *     the newest version on refresh but nothing ever fails offline
 */
const CACHE_VERSION = 'cricket-scorer-v11';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// ---- Install: pre-cache the app shell ----
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// ---- Activate: clean up old caches ----
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ---- Fetch: cache-first with network fallback ----
self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Only handle GET requests from same-origin
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // For navigation / HTML requests use stale-while-revalidate so
  // the user always gets the latest deployed version when online,
  // but a cached copy loads instantly when offline.
  if (req.mode === 'navigate' || req.destination === 'document') {
  event.respondWith(
    fetch(req)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_VERSION)
          .then(cache => cache.put(req, copy));
        return response;
      })
      .catch(() => caches.match(req))
  );
  return;
}

  // For everything else (icons, manifest, etc.) use cache-first
  event.respondWith(
    caches.match(req).then((cached) => {
      return cached || fetch(req).then((response) => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, clone));
        }
        return response;
      });
    })
  );
});
