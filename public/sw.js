// Minimal service worker for PWA installability (iOS requires a SW)
// Strategy: network-first, no pre-caching — zero storage overhead
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', (e) => {
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)))
})
