// Study Vault Service Worker
// - Cache-first for static assets (JS/CSS/fonts/icons)
// - Network-first for HTML documents (with offline fallback)
// - NEVER cache /api/* requests — they always go to the network

const VERSION = 'sv-v0.1.0';
const STATIC_CACHE = `${VERSION}-static`;
const DYNAMIC_CACHE = `${VERSION}-dynamic`;

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.startsWith(VERSION))
          .map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // HTML documents — network first
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(DYNAMIC_CACHE);
          cache.put('/', fresh.clone()).catch(() => null);
          return fresh;
        } catch {
          const cached = await caches.match('/');
          if (cached) return cached;
          return new Response(
            '<h1>Offline</h1><p>Study Vault needs a network connection for this page.</p>',
            { status: 503, headers: { 'content-type': 'text/html' } },
          );
        }
      })(),
    );
    return;
  }

  // Static assets — cache first
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      try {
        const fresh = await fetch(request);
        const cache = await caches.open(DYNAMIC_CACHE);
        cache.put(request, fresh.clone()).catch(() => null);
        return fresh;
      } catch {
        return new Response('', { status: 504 });
      }
    })(),
  );
});
