/**
 * Service Worker - Page inventaire hors ligne
 * Phase 1 : Cache des assets et de la page /caisse/inventaire
 */
const CACHE_NAME = 'coopaz-inventaire-v3';

// Ne jamais mettre en cache les requêtes API
function isApiRequest(url) {
  return new URL(url).pathname.startsWith('/api/');
}

// Page inventaire (HTML)
function isInventairePage(url) {
  const path = new URL(url).pathname;
  return path === '/caisse/inventaire' || path === '/caisse/inventaire/';
}

// Assets à mettre en cache (scripts, styles, dist)
function isCacheableAsset(url) {
  const u = new URL(url);
  const path = u.pathname;
  // Assets locaux
  if (path.startsWith('/dist/') || path.startsWith('/css/')) return true;
  // Bootstrap et Bootstrap Icons (CDN)
  if (u.hostname === 'cdn.jsdelivr.net' && path.includes('bootstrap')) return true;
  return false;
}

// Assets CDN à pré-cacher
const PRECACHE_URLS = [
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all([
        cache.addAll(PRECACHE_URLS).catch(() => {}),
        // Page inventaire (avec credentials pour session)
        fetch(self.location.origin + '/caisse/inventaire', { credentials: 'include' })
          .then((r) => {
            if (r.ok) return cache.put(self.location.origin + '/caisse/inventaire', r.clone()).then(() => r);
            return r;
          })
          .catch(() => {}),
      ])
    ).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  const request = event.request;

  // Ignorer les requêtes non-GET
  if (request.method !== 'GET') return;

  // Ne jamais cache les API
  if (isApiRequest(url)) return;

  // Page inventaire : Network First, fallback cache
  if (isInventairePage(url) && request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request).then((cached) => cached || new Response('Hors ligne', { status: 503, statusText: 'Service Unavailable' })))
    );
    return;
  }

  // Assets : Cache First, fallback network
  // (Les réponses cross-origin/CDN sont souvent "opaque" avec res.ok=false, on les cache quand même)
  if (isCacheableAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          if (res.ok || res.type === 'opaque') {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return res;
        });
      })
    );
  }
});
