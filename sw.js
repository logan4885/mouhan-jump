// Service Worker：让游戏可以装到手机主屏幕，并在断网时也能打开。
// 原则：同源文件“有网先用网络（保证永远是最新版），断网才用缓存”；排行榜/同步等 API 请求（别的域名）完全不碰，所以服务器同步不受影响。
const CACHE = 'jump3d-shell-v1';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'favicon-32.png'];
const CDN = 'https://cdn.jsdelivr.net/';   // Three.js

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !req.url.startsWith(CDN)) return;          // 后端 API 等：不拦截
  if (sameOrigin && url.pathname.endsWith('/sw.js')) return;
  const cdn = !sameOrigin;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (cdn) {                                                    // Three.js 带版本号，缓存优先
      const hit = await cache.match(req); if (hit) return hit;
    }
    try {
      const res = await fetch(req, req.mode === 'navigate' ? { cache: 'no-cache' } : undefined);
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    } catch (err) {
      const hit = (await cache.match(req)) || (req.mode === 'navigate' && ((await cache.match('index.html')) || (await cache.match('./'))));
      if (hit) return hit;
      throw err;
    }
  })());
});
