// Service worker: makes the game load instantly and work offline.
// The asset list, build id and data hash below are filled in by the Vite build (see vite.config.ts).
// Two caches: the app shell keyed by build, and the map data keyed by the data's content. A deploy that only
// changes code replaces the shell and leaves the (much larger) map data in place.
const SHELL = 'tdhg-shell-__BUILD__'
const DATA = 'tdhg-data-__DATA__'
const PRECACHE = __ASSETS__

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== DATA).map((k) => caches.delete(k))))
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
          caches.open(SHELL).then((c) => c.put(req, copy))
          return r
        })
        .catch(() => caches.match(req).then((r) => r || caches.match(PRECACHE[0]))),
    )
    return
  }
  if (url.pathname.includes('/data/')) {
    // Map data: cache first. The cache name carries the data's hash, so a stale copy cannot survive a data change.
    e.respondWith(
      caches.open(DATA).then((c) =>
        c.match(req).then(
          (cached) =>
            cached ||
            fetch(req).then((r) => {
              if (r.ok) c.put(req, r.clone())
              return r
            }),
        ),
      ),
    )
    return
  }
  // Everything else: serve from cache, refresh in the background.
  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((r) => {
          if (r.ok) caches.open(SHELL).then((c) => c.put(req, r.clone()))
          return r
        })
        .catch(() => cached)
      return cached || network
    }),
  )
})

// Daily reminder (see supabase/functions/remind).
self.addEventListener('push', (e) => {
  let p = { title: 'Wegenkenner', body: '', url: '/#daily' }
  try {
    p = Object.assign(p, e.data ? e.data.json() : {})
  } catch {
    /* plain text or empty payload */
  }
  e.waitUntil(self.registration.showNotification(p.title, { body: p.body, icon: '/icon-192.png', badge: '/icon-64.png', tag: 'daily', data: { url: p.url } }))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || '/#daily'
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) {
          c.navigate(url)
          return c.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
