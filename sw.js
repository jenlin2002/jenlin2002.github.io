// B&M 學習 App 的 service worker。
// 只處理 /app/ 底下的入口頁（離線時還能打開入口）；其他網站（english-quiz、daily_life_listening…）的請求完全不經過這裡。
const CACHE = 'bm-app-v2';
const SHELL = ['/app/', '/app/index.html', '/app/manifest.webmanifest', '/app/icon-192.png', '/app/icon-512.png', '/app/apple-touch-icon.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || !u.pathname.startsWith('/app/')) return;
  // 先拿最新的，連不上網路才用快取
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy));
    return r;
  }).catch(() => caches.match(e.request).then(r => r || caches.match('/app/'))));
});
