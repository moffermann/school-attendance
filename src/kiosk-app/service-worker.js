// Service Worker for offline caching
const CACHE_NAME = 'kiosk-cache-v3';
const urlsToCache = [
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
  '/data/students.json',
  '/data/tags.json',
  '/data/teachers.json',
  '/data/device.json',
  '/data/queue.json',
  '/data/config.json',
  '/assets/logo.svg',
  '/assets/placeholder_photo.jpg',
  '/assets/qr_placeholder.svg',
  '/assets/nfc_placeholder.svg',
  '/assets/success.svg',
  '/assets/error.svg',
  '/assets/camera-shutter-sound.mp3'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
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
    })
  );
});
