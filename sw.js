// 갈증나 서비스 워커
// 파일을 고치면 아래 VERSION 숫자를 하나 올려 주세요. (기록 저장 이름과는 상관없어요)
const VERSION = 'v11';
const CACHE = 'my-app-galjeungna-' + VERSION;

const FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './bg.jpg',
];

self.addEventListener('install', event => {
  self.skipWaiting(); // 기다리지 않고 바로 새 버전 적용
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).catch(() => {}));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(k => k.startsWith('my-app-galjeungna-') && k !== CACHE)
      .map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// 인터넷이 되면 항상 새 파일 먼저(network-first), 안 되면 저장해 둔 파일
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  event.respondWith((async () => {
    try {
      const fresh = await fetch(req, { cache: 'no-store' });
      if (fresh && fresh.ok) {
        const c = await caches.open(CACHE);
        c.put(req, fresh.clone());
      }
      return fresh;
    } catch {
      const cached = await caches.match(req, { ignoreSearch: true });
      if (cached) return cached;
      if (req.mode === 'navigate') return caches.match('./index.html');
      return Response.error();
    }
  })());
});

// 알림을 누르면 앱 열기
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (all.length) return all[0].focus();
    return self.clients.openWindow('./');
  })());
});
