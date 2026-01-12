// Service Worker for offline caching
const CACHE_NAME = 'kiosk-cache-v20';

// Static assets - cache first, update in background
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/router.js',
  '/js/state.js',
  '/js/sync.js',
  '/js/ui.js',
  '/js/views/home.js',
  '/js/views/scan.js',
  '/js/views/scan_result.js',
  '/js/views/manual_entry.js',
  '/js/views/queue.js',
  '/js/views/device_status.js',
  '/js/views/settings.js',
  '/js/views/help.js',
  '/js/views/admin_panel.js',
  '/assets/logo.svg',
  '/assets/placeholder_photo.jpg',
  '/assets/qr_placeholder.svg',
  '/assets/nfc_placeholder.svg',
  '/assets/success.svg',
  '/assets/error.svg',
  '/assets/camera-shutter-sound.mp3'
];

// Dynamic data - stale-while-revalidate
const DYNAMIC_DATA_PATTERNS = [
  /\/data\/.+\.json$/,
  /\/api\/v1\/kiosk\//
];

function isDynamicData(url) {
  return DYNAMIC_DATA_PATTERNS.some(pattern => pattern.test(url));
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip cross-origin requests (e.g., API calls to different port/host)
  // Let them pass through to the network without SW interception
  if (url.origin !== self.location.origin) {
    return; // Don't call respondWith - let browser handle normally
  }

  // Dynamic data: stale-while-revalidate
  if (isDynamicData(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return cache.match(event.request).then(cachedResponse => {
          const fetchPromise = fetch(event.request)
            .then(networkResponse => {
              // Update cache with fresh data
              if (networkResponse.ok) {
                cache.put(event.request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(() => {
              // Network failed, return cached if available or reject
              if (cachedResponse) {
                return cachedResponse;
              }
              // No cache available - throw to indicate failure
              throw new Error('Network failed and no cache available');
            });

          // Return cached immediately, update in background
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // Static assets: cache-first with network fallback
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request).then(networkResponse => {
          // Cache successful responses for static assets
          if (networkResponse.ok && event.request.method === 'GET') {
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, networkResponse.clone());
            });
          }
          return networkResponse;
        });
      })
      .catch(() => caches.match('/index.html'))
  );
});

self.addEventListener('activate', event => {
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
