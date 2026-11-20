const CACHE_NAME = 'nexus-pwa-v5';
const APP_FILES = [
  './',
  './index.html',
  './app.css',
  './app.css',
  './manifest.webmanifest',
  './lib/actions.js',
  './lib/voice.js',
  './lib/web.js',
  './lib/calendar.js',
  './ui/core-backup.js',
  './ui/core.js',
  './ui/settings.js',
  './ui/memory-automation.js',
  './ui/init.js',
  './ui/orb.js',
  './ui/pwa.js',
  './ui/history.js',
  './ui/tasks.js',
  './ui/calendar.js',
  './ui/morning.js',
  './ui/chat.js',
  './ui/voice-input.js',
  './lib/actions.js',
  './lib/voice.js',
  './lib/web.js',
  './lib/calendar.js',
  './ui/core-backup.js',
  './ui/core.js',
  './ui/settings.js',
  './ui/memory-automation.js',
  './ui/init.js',
  './ui/orb.js',
  './ui/pwa.js',
  './ui/history.js',
  './ui/tasks.js',
  './ui/calendar.js',
  './ui/morning.js',
  './ui/chat.js',
  './ui/voice-input.js',
  './assets/nexus_otter_background.jpg',
  './assets/nexus-icon-192.png',
  './assets/nexus-icon-512.png',
  './assets/nexus-icon-maskable-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const copy = response.clone();
      if (response.ok && new URL(event.request.url).origin === self.location.origin) {
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      }
      return response;
    }).catch(() => caches.match('./index.html')))
  );
});
