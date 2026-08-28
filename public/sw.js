// River City Roofing Solutions - Service Worker
// Version: 2.0.0 — KILL SWITCH (2026-08-28)
//
// WHY: the previous SW (v1.x) pre-cached portal-login HTML and served it in
// place of the open pages (/smithlake, /calls, /trip, /reps). Its per-page
// "bypass" allow-list kept missing newly added pages, so returning visitors got
// bounced to the login screen even though the server serves the correct page.
// Rather than keep patching the allow-list, this version REMOVES the service
// worker entirely: it unregisters itself, deletes every cache, and reloads open
// tabs so all clients fall straight through to the network. (No offline caching
// for now — the broken caching was worse than none.)

self.addEventListener('install', () => {
  // Take over immediately; don't wait for old tabs to close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // 1) Delete every cache this origin holds (purges the stale portal HTML).
    try {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    } catch (_) { /* ignore */ }

    // 2) Unregister this service worker so it stops controlling the origin.
    try { await self.registration.unregister(); } catch (_) { /* ignore */ }

    // 3) Reload any open tabs so they re-fetch fresh from the network.
    try {
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        if ('navigate' in client) client.navigate(client.url);
      }
    } catch (_) { /* ignore */ }
  })());
});

// Never intercept requests — always hit the network directly.
self.addEventListener('fetch', () => { /* no-op: default network fetch */ });
