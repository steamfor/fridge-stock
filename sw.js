// ─────────────────────────────────────────────
// SERVICE WORKER — Cache statique (cache-first)
// ─────────────────────────────────────────────

const CACHE_NAME = 'fridgestock-v2';
const STATIC_ASSETS = [
  './',
  './index.html',
  './css/app.css',
  './js/state.js',
  './js/utils.js',
  './js/auth.js',
  './js/render.js',
  './js/stock.js',
  './js/scanner.js',
  './js/edit.js',
  './js/notifications.js',
  './js/menu.js',
  './js/app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Ne pas intercepter les requêtes externes (Supabase, APIs, CDNs)
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
