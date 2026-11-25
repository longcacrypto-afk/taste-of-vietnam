// =============================================================================
// SERVICE WORKER: Hôm nay ăn gì · Taste of Vietnam v0.1 — hnag-v7
// Strategy: Network First with graceful offline fallback & precache (Never crashes)
// =============================================================================

const CACHE_NAME = 'hnag-v11';
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/assets/tailwindcss.min.js',
  '/assets/avatar_mam_ai.jpg',
  '/assets/hero_pho.jpg',
  '/assets/dish_banhmi.jpg',
  '/assets/mascot_bep.jpg',
  '/assets/mascot_la.jpg',
  '/assets/mascot_mam.jpg',
  '/assets/mascot_miu.jpg',
  '/assets/place_restaurant.jpg'
];

// ---------------------------------------------------------------------------
// INSTALL: Precache critical static shell & skip waiting immediately
// ---------------------------------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Pre-caching partial error (offline safe):', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ---------------------------------------------------------------------------
// ACTIVATE: Purge all old caches and take control
// ---------------------------------------------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ---------------------------------------------------------------------------
// FETCH: Network First (Always fresh, safe offline fallback)
// ---------------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip chrome-extension or non-http
  if (!url.protocol.startsWith('http')) return;

  // Let browser natively handle cross-origin assets (e.g. Google Fonts)
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone).catch(() => {});
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          return new Response('Offline — Không có kết nối mạng', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
        });
      })
  );
});

// ---------------------------------------------------------------------------
// PUSH NOTIFICATIONS
// ---------------------------------------------------------------------------
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Hôm nay ăn gì? 🍜';
  const options = {
    body: data.body || 'Khám phá món ngon hôm nay dành riêng cho bạn!',
    icon: '/assets/icon-192.png',
    badge: '/assets/icon-192.png',
    data: { url: data.url || 'https://taste-of-vietnam.onrender.com/' }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ---------------------------------------------------------------------------
// NOTIFICATION CLICK: Focus or open window
// ---------------------------------------------------------------------------
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : 'https://taste-of-vietnam.onrender.com/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
