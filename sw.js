// Service Worker (sw.js)
// Network-first strategy with no-cache for same-origin GETs.

const CACHE_VERSION = 'v0.0.1';
const CACHE_NAME = `ephone-cache-${CACHE_VERSION}`;

const URLS_TO_CACHE = [
  './index.html',
  './style.css',
  './script.js',
  'https://unpkg.com/dexie/dist/dexie.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://phoebeboo.github.io/mewoooo/pp.js',
  'https://cdn.jsdelivr.net/npm/streamsaver@2.0.6/StreamSaver.min.js',
  'https://s3plus.meituan.net/opapisdk/op_ticket_885190757_1758510900942_qdqqd_djw0z2.jpeg',
  'https://s3plus.meituan.net/opapisdk/op_ticket_885190757_1756312261242_qdqqd_g0eriz.jpeg'
];

self.addEventListener('install', event => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(URLS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  const noCacheRequest = new Request(event.request, { cache: 'no-store' });

  event.respondWith(
    fetch(noCacheRequest, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
      .then(response => response)
      .catch(() => caches.match(event.request))
  );
});

self.addEventListener('push', event => {
  console.log('[SW] Push received', event);

  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { body: event.data.text() };
    }
  }

  const title = data.title || 'EPhone';
  const options = {
    body: data.body || 'You have a new message',
    icon: data.icon || 'https://s3plus.meituan.net/opapisdk/op_ticket_885190757_1758510900942_qdqqd_djw0z2.jpeg',
    badge: data.badge || 'https://s3plus.meituan.net/opapisdk/op_ticket_885190757_1758510900942_qdqqd_djw0z2.jpeg',
    tag: data.tag || 'default',
    data: data.data || {},
    requireInteraction: true,
    vibrate: [200, 100, 200],
    timestamp: Date.now()
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('message', event => {
  console.log('[SW] Message received:', event.data);

  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    event.waitUntil(self.registration.showNotification(title, options));
  }
});

self.addEventListener('notificationclick', event => {
  console.log('[SW] Notification click', event);

  event.notification.close();

  const chatId = event.notification.data?.chatId;
  const urlToOpen = chatId ? `/?openChat=${chatId}` : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus().then(focused => {
              if (chatId) {
                focused.postMessage({ type: 'OPEN_CHAT', chatId });
              }
              return focused;
            });
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});
