const CACHE_NAME = 'ianmusic-v1.0';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/variables.css',
  '/css/icons.css',
  '/css/desktop.css',
  '/css/components.css',
  '/css/mobile.css',
  '/js/config.js',
  '/js/theme.js',
  '/js/api.js',
  '/js/ui.js',
  '/js/player.js',
  '/js/lyrics.js',
  '/js/net-search.js',
  '/js/playlist.js',
  '/js/mobile.js',
  '/js/ai.js',
  '/js/visualizer.js',
  '/js/app.js',
  '/js/lib/jsmediatags.min.js',
  '/js/lib/localforage.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  event.respondWith(
    caches.match(request).then(cached => {
      const fetched = fetch(request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      });
      return cached || fetched;
    })
  );
});
