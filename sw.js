/* Copper & Steel HQ — service worker
   Strategy:
   - The PAGE itself is network-first (so when you edit or take the site
     down, an online phone gets the change immediately). Cache is the
     offline fallback only.
   - Static assets (fonts, icons) are cache-first for speed/offline.
   Bump CACHE when you change files to force a refresh. */
const CACHE = 'cs-hq-v1';
const CORE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const isPage = req.mode === 'navigate' ||
                 (req.headers.get('accept') || '').includes('text/html');

  if (isPage) {
    // network-first, fall back to cached page when offline
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.ok) caches.open(CACHE).then(c => c.put('./index.html', res.clone()));
          return res;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // assets: cache-first, then network (and cache what we fetch)
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => cached))
  );
});

/* Lets the page tell us to wipe everything (used by the expiry kill-switch) */
self.addEventListener('message', e => {
  if (e.data === 'CLEAR') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.registration.unregister());
  }
});
