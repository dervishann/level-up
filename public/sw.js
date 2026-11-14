// Einfacher Service Worker: App funktioniert offline, sobald sie einmal geladen wurde.
const CACHE = 'levelup-v1'

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './manifest.webmanifest'])).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

// Die Seite schickt nach dem Laden die Liste ihrer Dateien, damit auch der allererste Besuch offline-fähig macht.
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'CACHE_URLS') {
    e.waitUntil(caches.open(CACHE).then((c) => c.addAll(e.data.urls).catch(() => {})))
  }
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return
  // Netz zuerst (damit Updates sofort ankommen), Cache als Rückfall für offline.
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy))
        }
        return res
      })
      .catch(() => caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('./') : Response.error()))),
  )
})
