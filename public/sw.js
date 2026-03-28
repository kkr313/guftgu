// Guftgu PWA Service Worker
// Cache-first for static assets, network-first for API/dynamic

const CACHE_NAME = 'guftgu-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon.svg',
  '/guftgu_wal_img.jpg',
  '/offline.html',
];

// ── INSTALL: pre-cache shell ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching app shell');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        // Don't fail install if some assets aren't available yet
        console.warn('[SW] Some assets failed to cache:', err);
      });
    })
  );
  // Activate immediately, don't wait for old tabs to close
  self.skipWaiting();
});

// ── ACTIVATE: clean old caches ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log('[SW] Removing old cache:', key);
            return caches.delete(key);
          })
      )
    )
  );
  // Take control of all open tabs immediately
  self.clients.claim();
});

// ── FETCH: smart caching strategy ──
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip Chrome extension requests, Firebase, etc.
  if (!url.protocol.startsWith('http')) return;

  // Firebase / API calls → network-only (don't cache)
  if (
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebase') ||
    url.pathname.startsWith('/api/')
  ) {
    return;
  }

  // Google Fonts → cache-first (they rarely change)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // App assets → stale-while-revalidate
  // Serve from cache immediately, update cache in background
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          // Only cache successful responses
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Network failed — if it's a navigation request, show offline page
          if (request.mode === 'navigate') {
            return caches.match('/offline.html');
          }
          return cached;
        });

      // Return cached version immediately, or wait for network
      return cached || fetchPromise;
    })
  );
});

// ── PUSH NOTIFICATIONS (future) ──
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'Guftgu', {
      body: data.body || 'Someone wants to talk!',
      icon: '/icons/icon.svg',
      badge: '/icons/icon.svg',
      vibrate: [100, 50, 100],
      tag: 'guftgu-notification',
      data: { url: data.url || '/' },
    })
  );
});

// ── NOTIFICATION CLICK ──
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus existing tab if open
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new tab
      return self.clients.openWindow(url);
    })
  );
});
