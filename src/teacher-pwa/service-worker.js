const CACHE = 'teacher-pwa-v2';
const urlsToCache = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/idb.js',
  './js/state.js',
  './js/sync.js',
  './js/components.js',
  './js/router.js',
  './js/views/auth.js',
  './js/views/classes.js',
  './js/views/roster.js',
  './js/views/scan_qr.js',
  './js/views/take_attendance.js',
  './js/views/queue.js',
  './js/views/history.js',
  './js/views/settings.js',
  './js/views/help.js',
  './assets/logo.svg',
  './assets/qr_placeholder.svg',
  './assets/success.svg',
  './assets/error.svg',
  './assets/offline.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(cache => cache.addAll(urlsToCache)));
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request)
      .then(r => r || fetch(e.request).then(response => {
        return caches.open(CACHE).then(cache => {
          cache.put(e.request, response.clone());
          return response;
        });
      }))
      .catch(() => caches.match('./index.html'))
  );
});
