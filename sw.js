// 오늘의 한국어 — Service Worker
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

var CACHE_NAME = 'hangul-quiz-v3';
var STATIC_CACHE = 'hangul-quiz-static-v3';

// 캐시할 핵심 파일
var PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// ── 설치: 핵심 파일 사전 캐시 ──
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(function(cache) {
      return cache.addAll(PRECACHE_URLS).catch(function(err) {
        console.log('[SW] 사전 캐시 일부 실패 (무시):', err);
      });
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// ── 활성화: 오래된 캐시 정리 ──
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) {
          return key !== CACHE_NAME && key !== STATIC_CACHE;
        }).map(function(key) {
          console.log('[SW] 오래된 캐시 삭제:', key);
          return caches.delete(key);
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// ── fetch: 네트워크 우선, 실패 시 캐시 ──
self.addEventListener('fetch', function(event) {
  var req = event.request;

  // GET 요청만 캐시
  if (req.method !== 'GET') return;

  // 외부 도메인 (Firebase, OneSignal, Google Fonts 등)은 그냥 통과
  var url = new URL(req.url);
  if (url.origin !== location.origin) {
    return;
  }

  event.respondWith(
    // 네트워크 우선 전략
    fetch(req).then(function(networkRes) {
      // 성공하면 캐시에도 저장
      if (networkRes && networkRes.status === 200) {
        var resClone = networkRes.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(req, resClone);
        });
      }
      return networkRes;
    }).catch(function() {
      // 네트워크 실패 시 캐시에서
      return caches.match(req).then(function(cached) {
        if (cached) return cached;
        // 캐시도 없으면 오프라인 폴백 (index.html)
        if (req.headers.get('accept') && req.headers.get('accept').includes('text/html')) {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// ── 푸시 알림 수신 ──
self.addEventListener('push', function(event) {
  var data = {};
  try { data = event.data ? event.data.json() : {}; } catch(e) {}

  var title = data.title || '오늘의 한국어';
  var options = {
    body: data.body || '오늘의 퀴즈가 준비됐어요! 지금 도전해보세요 📚',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'daily-quiz',
    requireInteraction: false,
    data: { url: data.url || '/' }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ── 알림 클릭 ──
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // 이미 열린 탭이 있으면 포커스
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      // 없으면 새 탭
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
