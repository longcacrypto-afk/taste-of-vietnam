// =============================================================================
// SERVICE WORKER: Hôm nay ăn gì · Taste of Vietnam v0.1 — hnag-v3
// Strategy: Cache First (HTML/CSS/JS) + Network First with fallback (API)
// Features: Stale-While-Revalidate, Push Notifications, Background Sync
// =============================================================================

const CACHE_NAME = 'hnag-v3';
const STATIC_SHELL = ['/', '/manifest.json', '/api/v1/suggestions/today'];

// ---------------------------------------------------------------------------
// INSTALL: Pre-cache static shell
// ---------------------------------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_SHELL).catch(() => {});
    })
  );
  self.skipWaiting();
});

// ---------------------------------------------------------------------------
// ACTIVATE: Delete old caches
// ---------------------------------------------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// ---------------------------------------------------------------------------
// FETCH: Cache First for HTML/CSS/JS; Network First for /api/v1/*
// ---------------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isApi = url.pathname.startsWith('/api/v1/');

  if (isApi) {
    // Network First with cache fallback
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // Cache First (Stale-While-Revalidate)
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cached) => {
          const networkFetch = fetch(event.request).then((response) => {
            if (response && response.status === 200) {
              cache.put(event.request, response.clone());
            }
            return response;
          }).catch(() => null);

          return cached || networkFetch;
        });
      })
    );
  }
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
    data: { url: data.url || 'https://taste-of-vietnam.onrender.com/' },
    actions: [
      { action: 'open', title: 'Xem ngay' },
      { action: 'dismiss', title: 'Để sau' }
    ]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ---------------------------------------------------------------------------
// NOTIFICATION CLICK: Open app URL
// ---------------------------------------------------------------------------
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

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

// ---------------------------------------------------------------------------
// BACKGROUND SYNC: Queue offline poll votes, replay when online
// ---------------------------------------------------------------------------
const SYNC_TAG_POLL = 'sync-poll-votes';

self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG_POLL) {
    event.waitUntil(replayPollVotes());
  }
});

async function replayPollVotes() {
  // Read queued votes from Cache Storage (used as offline queue)
  const cache = await caches.open('hnag-sync-queue');
  const keys = await cache.keys();

  for (const request of keys) {
    try {
      const queued = await cache.match(request);
      const body = await queued.json();
      await fetch('/api/v1/polls/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      await cache.delete(request);
    } catch {
      // Will retry on next sync
    }
  }
}
