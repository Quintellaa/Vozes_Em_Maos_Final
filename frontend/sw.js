const CACHE = 'vozes-em-maos-v1';
const STATIC_FILE = /\.(html|css|js|png|json)$/;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  const isOwnStatic = url.origin === self.location.origin &&
    (url.pathname === '/' || STATIC_FILE.test(url.pathname));
  if (request.method !== 'GET' || !isOwnStatic) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
