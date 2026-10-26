/* SWK OS service worker.
   Purpose: make the app installable and show a friendly page when the network is down.
   Rule: it NEVER stores API responses or pages. They hold private business data and are tied to a login,
   so every /api request and every page load goes to the network. Only public, versioned files are cached. */
const BUILD = '__BUILD_ID__'
const SHELL = 'swk-shell-' + BUILD
const ASSETS = 'swk-assets-' + BUILD
const PRECACHE = ['/offline.html', '/manifest.webmanifest', '/app-icon-192.png', '/app-icon-512.png', '/favicon/apple-touch-icon.png']
const CACHEABLE = /^\/(assets|fonts|brand)\//

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL).then(cache => cache.addAll(PRECACHE)))
  // No automatic skipWaiting: the page asks the person to reload so a form is never lost mid-edit.
})

self.addEventListener('message', event => { if (event.data === 'SKIP_WAITING') self.skipWaiting() })

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('swk-') && !key.endsWith(BUILD)) await caches.delete(key)
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', event => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return // never intercept: always live, never stored

  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(async () => (await caches.match('/offline.html')) || new Response('Offline', { status: 503, headers: { 'content-type': 'text/plain' } })))
    return
  }
  if (CACHEABLE.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(ASSETS)
      const hit = await cache.match(req)
      if (hit) return hit
      const res = await fetch(req)
      if (res.ok && res.type === 'basic') cache.put(req, res.clone())
      return res
    })())
  }
})
