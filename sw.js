// AJÚA BPM — Service Worker v2.0 — 01/03/2026 20:49 GT
// CACHE BUMP: v1 → v2 para forzar eliminación del caché viejo
const CACHE_NAME = 'ajua-bpm-prod-v2';
const OFFLINE_URL = '/';

const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()) // Activa inmediatamente sin esperar
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      // Elimina TODOS los caches anteriores (v1, v1.1, etc.)
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => {
        console.log('[SW] Eliminando caché viejo:', k);
        return caches.delete(k);
      }))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;
  if (event.request.url.includes('firebase') ||
      event.request.url.includes('gstatic') ||
      event.request.url.includes('googleapis')) return;

  // Para index.html y navegación: SIEMPRE ir a red primero, caché como fallback
  const isNavigation = event.request.mode === 'navigate' ||
                       event.request.url.endsWith('/') ||
                       event.request.url.endsWith('/index.html');

  if (isNavigation) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request)) // Fallback a caché si sin internet
    );
    return;
  }

  // Para iconos y assets: caché primero (cambian poco)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        if (event.request.mode === 'navigate') return caches.match(OFFLINE_URL);
      });
    })
  );
});

self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
