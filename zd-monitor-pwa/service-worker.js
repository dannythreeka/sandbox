self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install');
  event.waitUntil(
    caches.open('mold-cache-v2').then((cache) => {
      return cache.addAll([
        './',
        './index.html',
        './script.js',
        './style.css',
        'https://docs.opencv.org/4.5.5/opencv.js',
        './manifest.json',
      ]);
    })
  );
});

// 激活新版本的 Service Worker 并清除旧缓存
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activate');
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== 'mold-cache-v2') {
            console.log('[ServiceWorker] Removing old cache', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((resp) => {
      return resp || fetch(event.request);
    })
  );
});
