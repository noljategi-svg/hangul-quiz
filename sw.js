// 오늘의 한국어 — Service Worker
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

var CACHE_NAME = 'hangul-quiz-v4';
var STATIC_CACHE = 'hangul-quiz-static-v4';

var PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// 메시지 핸들러 (OneSignal 경고 제거)
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(function(cache) {
      return cache.addAll(PRECACHE_URLS).catch(function(err) {
        console.log('[SW] 사전 캐시 일부 실패:', err);
      });
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) {
          return key !== CACHE_NAME && key !== STATIC_CACHE;
        }).map(function(key) {
          return caches.delete(key);
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;

  event.respondWith(
    fetch(req).then(function(networkRes) {
      if (networkRes && networkRes.status === 200) {
        var resClone = networkRes.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(req, resClone);
        });
      }
      return networkRes;
    }).catch(function() {
      return caches.match(req).then(function(cached) {
        if (cached) return cached;
        if (req.headers.get('accept') && req.headers.get('accept').includes('text/html')) {
          return caches.match('/index.html');
        }
      });
    })
  );
});

self.addEventListener('push', function(event) {
  var data = {};
  try { data = event.data ? event.data.json() : {}; } catch(e) {}
  var title = data.title || '오늘의 한국어';
  var options = {
    body: data.body || '오늘의 퀴즈가 준비됐어요! 📚',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'daily-quiz',
    data: { url: data.url || '/' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        if (clientList[i].url === targetUrl && 'focus' in clientList[i]) {
          return clientList[i].focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
