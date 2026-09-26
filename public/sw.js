// Service worker: makes the game load instantly and work offline.
// __ASSETS__ and __BUILD__ are filled in by the Vite build (see vite.config.ts).
const VERSION = 'tdhg-__BUILD__'
const PRECACHE = __ASSETS__

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(VERSION)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== location.origin) return
  if (req.mode === 'navigate') {
    // Pages: network first, fall back to the cached shell when offline.
    e.respondWith(
      fetch(req)
        .then((r) => {
          const copy = r.clone()
          caches.open(VERSION).then((c) => c.put(req, copy))
          return r
        })
        .catch(() => caches.match(req).then((r) => r || caches.match(PRECACHE[0]))),
    )
    return
  }
  // Everything else: serve from cache, refresh in the background.
  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((r) => {
          if (r.ok) caches.open(VERSION).then((c) => c.put(req, r.clone()))
          return r
        })
        .catch(() => cached)
      return cached || network
    }),
  )
})
