// Study Vault Service Worker — self-unregister
// This SW unregisters itself to clear stale caches from previous deployments.
// After all old SWs are cleaned up, this file can be removed entirely.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Delete all old caches
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      // Unregister this service worker
      await self.registration.unregister();
      // Tell all clients to refresh
      const clients = await self.clients.claim();
      const allClients = await self.clients.matchAll({ type: 'window' });
      for (const client of allClients) {
        client.navigate(client.url);
      }
    })(),
  );
});

// Pass through all requests without caching
self.addEventListener('fetch', (event) => {
  // Don't intercept any requests — just let them go to the network
  return;
});
