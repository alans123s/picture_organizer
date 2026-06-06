// Service worker: cache do app shell para abrir e operar OFFLINE.
// Requisições de API/autenticação sempre vão à rede (e falham graciosamente offline,
// pois o app salva localmente e sincroniza depois).
const CACHE = 'motores-v2';
const SHELL = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/db.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Nunca interceptar API/autenticação ou métodos não-GET.
  if (request.method !== 'GET' || url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) {
    return;
  }

  // Navegações (abrir o app): tenta a rede, cai para o app shell em cache (offline).
  if (request.mode === 'navigate') {
    e.respondWith(fetch(request).catch(() => caches.match('/index.html').then((r) => r || caches.match('/'))));
    return;
  }

  // Demais GETs do mesmo domínio: cache-first com atualização em segundo plano.
  e.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res.ok && url.origin === location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
