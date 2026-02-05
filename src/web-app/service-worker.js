/**
 * Service Worker for Parent Portal PWA
 * - Cache-first strategy for static assets
 * - Network-first for API calls
 * - Push notification handling
 * - Offline fallback to index.html
 */

const CACHE_NAME = 'parent-pwa-v7';

// Static assets to cache on install
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  // Core modules
  './js/idb.js',
  './js/api.js',
  './js/state.js',
  './js/sync.js',
  './js/components.js',
  './js/router.js',
  './js/webauthn.js',
  // Auth views (shared)
  './js/views/auth.js',
  // Parent views
  './js/views/parent_home.js',
  './js/views/parent_history.js',
  './js/views/parent_prefs.js',
  './js/views/parent_absences.js',
  './js/views/parent_pickups.js',
  // Assets
  './assets/logo.svg',
  './assets/badge.svg',
  // Shared library
  '/lib/api-base.js'
];

// Install: Pre-cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate: Clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name.startsWith('parent-pwa-') && name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Cache-first for static, network-first for API
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip API calls - let them go to network (offline handled by sync queue)
  if (url.pathname.startsWith('/api/')) return;

  // For same-origin requests, use cache-first strategy
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request)
        .then(cachedResponse => {
          if (cachedResponse) {
            // Return cached, but also update cache in background
            fetch(request).then(response => {
              if (response.ok) {
                caches.open(CACHE_NAME).then(cache => {
                  cache.put(request, response);
                });
              }
            }).catch(() => {});
            return cachedResponse;
          }

          // Not in cache, fetch from network
          return fetch(request)
            .then(response => {
              // Cache successful responses
              if (response.ok) {
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                  cache.put(request, responseClone);
                });
              }
              return response;
            })
            .catch(() => {
              // Offline: return index.html for navigation requests
              if (request.mode === 'navigate') {
                return caches.match('./index.html');
              }
              return new Response('Offline', { status: 503 });
            });
        })
    );
  }
});

// Push: Handle incoming push notifications
self.addEventListener('push', event => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    data = {
      title: 'Notificación',
      body: event.data.text(),
    };
  }

  const options = {
    body: data.body || '',
    icon: '/app/assets/logo.svg',
    badge: '/app/assets/badge.svg',
    tag: data.tag || 'default',
    data: {
      url: data.url || '/app/#/parent/home',
    },
    actions: [
      { action: 'open', title: 'Ver detalles' },
      { action: 'dismiss', title: 'Cerrar' }
    ],
    vibrate: [100, 50, 100],
    requireInteraction: data.requireInteraction || false,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Asistencia Escolar', options)
  );
});

// Notification click: Open app or focus existing window
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const urlToOpen = event.notification.data?.url || '/app/#/parent/home';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        // Check if app is already open
        for (const client of windowClients) {
          if (client.url.includes('/app/') && 'focus' in client) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        // Open new window
        return clients.openWindow(urlToOpen);
      })
  );
});

// Background sync (for queued offline actions)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-queue') {
    event.waitUntil(
      // Notify all clients to process their sync queues
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'SYNC_QUEUE' });
        });
      })
    );
  }
});

console.log('[SW] Service Worker loaded');
