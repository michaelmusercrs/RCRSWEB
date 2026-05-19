// River City Roofing Solutions - Service Worker
// Version: 1.0.2 (ram bypass — renamed from ram2 on 2026-05-19)

const CACHE_NAME = 'rcrs-cache-v5';
const OFFLINE_URL = '/offline';

// Paths the SW must NEVER intercept — always go direct to network.
// /ram/* is a public diagnostic page; the SW was incorrectly serving
// stale cached portal-login HTML for these requests.
const BYPASS_PREFIXES = ['/ram'];

// Static assets to pre-cache on install
const PRECACHE_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
  '/manifest-portal.json',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// ============================================
// INSTALL - Pre-cache critical assets
// ============================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching critical assets');
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  // Activate immediately without waiting for existing clients to close
  self.skipWaiting();
});

// ============================================
// ACTIVATE - Clean up old caches
// ============================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Removing old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  // Take control of all pages immediately
  self.clients.claim();
});

// ============================================
// FETCH - Routing strategies
// ============================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Hard bypass: paths that must always hit the network directly with no SW
  // interception or cache fallback (avoids stale-login bug on /ram).
  if (BYPASS_PREFIXES.some((p) => url.pathname === p || url.pathname.startsWith(p + '/'))) {
    return; // let the browser fetch normally
  }

  // API routes and dynamic data: Network-first strategy
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Next.js static assets (_next/static): Cache-first strategy
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Next.js data routes (_next/data): Network-first strategy
  if (url.pathname.startsWith('/_next/data/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Images, fonts, and other static files: Cache-first strategy
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // All other requests (HTML pages): Network-first with offline fallback
  event.respondWith(networkFirstWithOfflineFallback(request));
});

// ============================================
// PUSH NOTIFICATIONS (future use)
// ============================================
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    data = {
      title: 'River City Roofing Solutions',
      body: event.data.text(),
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
    };
  }

  const options = {
    body: data.body || '',
    icon: data.icon || '/icons/icon-192x192.png',
    badge: data.badge || '/icons/icon-96x96.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
      dateOfArrival: Date.now(),
    },
    actions: data.actions || [],
    tag: data.tag || 'rcrs-notification',
    renotify: data.renotify || false,
  };

  event.waitUntil(
    self.registration.showNotification(
      data.title || 'River City Roofing Solutions',
      options
    )
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

// ============================================
// BACKGROUND SYNC (future use)
// ============================================
self.addEventListener('sync', (event) => {
  if (event.tag === 'rcrs-form-sync') {
    event.waitUntil(syncPendingForms());
  }
  if (event.tag === 'rcrs-offline-actions') {
    event.waitUntil(syncOfflineActions());
  }
});

// Sync pending form submissions that were saved offline
async function syncPendingForms() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const pendingRequests = await cache.match('pending-forms');
    if (!pendingRequests) return;

    const forms = await pendingRequests.json();
    for (const formData of forms) {
      try {
        await fetch(formData.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData.data),
        });
      } catch (err) {
        console.error('[SW] Failed to sync form:', err);
      }
    }
    // Clear pending forms after successful sync
    await cache.delete('pending-forms');
  } catch (err) {
    console.error('[SW] Background sync failed:', err);
  }
}

// Sync offline actions (portal actions queued while offline)
async function syncOfflineActions() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const pendingActions = await cache.match('offline-actions');
    if (!pendingActions) return;

    const actions = await pendingActions.json();
    for (const action of actions) {
      try {
        await fetch(action.url, {
          method: action.method || 'POST',
          headers: action.headers || { 'Content-Type': 'application/json' },
          body: action.body ? JSON.stringify(action.body) : undefined,
        });
      } catch (err) {
        console.error('[SW] Failed to sync action:', err);
      }
    }
    await cache.delete('offline-actions');
  } catch (err) {
    console.error('[SW] Offline action sync failed:', err);
  }
}

// ============================================
// CACHING STRATEGIES
// ============================================

// Cache-first: Try cache, fall back to network (and cache the response)
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // If both cache and network fail, return a basic error
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

// Network-first: Try network, fall back to cache
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Network-first with offline fallback page for navigation requests
async function networkFirstWithOfflineFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    // For navigation requests, show the offline page
    if (request.mode === 'navigate') {
      const offlinePage = await caches.match(OFFLINE_URL);
      if (offlinePage) {
        return offlinePage;
      }
    }
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

// ============================================
// HELPERS
// ============================================

// Check if a pathname points to a static asset
function isStaticAsset(pathname) {
  const staticExtensions = [
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.avif',
    '.woff', '.woff2', '.ttf', '.eot', '.otf',
    '.css', '.js',
    '.mp4', '.webm', '.ogg',
    '.pdf', '.zip',
  ];
  return staticExtensions.some((ext) => pathname.endsWith(ext));
}
