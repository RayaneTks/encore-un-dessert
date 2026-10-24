// Service Worker — Encore1Dessert
// Handles push notifications (iOS 16.4+ PWA)

// Cache de l'app (ouverture instantanée et hors connexion pour l'interface ; les données viennent toujours du réseau)
const CACHE = 'e1d-shell-v1';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['/', '/logo.webp'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);
  // Jamais de cache pour Supabase ou toute autre origine : les données restent fraîches.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Page : réseau d'abord, copie en cache si hors connexion.
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put('/', copy)); } return res; })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // Fichiers versionnés (/assets/…) : cache d'abord. Le reste : cache puis mise à jour en arrière-plan.
  const immutable = url.pathname.startsWith('/assets/');
  const fromNetwork = () => fetch(request).then(res => {
    if (res.status === 200) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(request, copy)); }
    return res;
  });
  e.respondWith(
    caches.match(request).then(hit => {
      if (!hit) return fromNetwork();
      if (!immutable) fromNetwork().catch(() => {});
      return hit;
    })
  );
});

// Push event from server (future VAPID setup)
self.addEventListener('push', e => {
  const data = e.data?.json?.() ?? {};
  e.waitUntil(
    self.registration.showNotification(data.title || 'Encore1Dessert', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/badge-96.png',
      tag: data.tag || 'e1d-notif',
      data: data,
    })
  );
});

// Focus app on notification click
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (const client of clients) {
        if ('focus' in client) { client.focus(); return; }
      }
      self.clients.openWindow('/');
    })
  );
});
