// Service worker: offline app shell via stale-while-revalidate. Live API data is
// never cached (always fetched fresh). Bump CACHE to force a shell refresh.
const CACHE = 'nav-shell-v1';
const SHELL = ['/', '/index.html', '/styles.css', '/tokens.css', '/app.js', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin !== location.origin) return;        // fonts/CDN: let the browser handle
  if (url.pathname.startsWith('/api/')) return;       // live data: network only, never cache

  e.respondWith(
    caches.open(CACHE).then(async (c) => {
      const cached = await c.match(e.request);
      const network = fetch(e.request)
        .then((r) => { if (r && r.status === 200) c.put(e.request, r.clone()); return r; })
        .catch(() => cached);
      return cached || network;
    })
  );
});
