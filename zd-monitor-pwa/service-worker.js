self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install');
  event.waitUntil(
    caches.open('mold-cache-v1').then((cache) => {
      return cache.addAll([
        './',
        './index.html',
        './script.js',
        './style.css',
        './lib/opencv.js',
        './manifest.json',
      ]);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((resp) => {
      return resp || fetch(event.request);
    })
  );
});
