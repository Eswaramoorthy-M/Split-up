/* SplitUp service worker
 * --------------------------------------------------------------------
 * Hand-written, no Workbox. Strategy:
 *   - App shell (index.html) + every built JS/CSS chunk are precached
 *     at install, so the app opens instantly and works offline.
 *   - Page navigations: network first, fall back to the cached shell
 *     (it's a single-page app, so the shell can render any route).
 *   - /assets/* (hashed, immutable): cache first.
 *   - Google Fonts: stale-while-revalidate.
 *   - Supabase and every other cross-origin / non-GET request is left
 *     alone: balances and expenses must always be live, never stale.
 *
 * __BUILD_ID__ and __PRECACHE__ are replaced at build time by the
 * `pwa-sw` plugin in vite.config.ts. Each deploy therefore produces a
 * byte-different sw.js, which is what makes the browser pick it up.
 */
const BUILD_ID = '__BUILD_ID__'
const PRECACHE = /* __PRECACHE__ */ []

const SHELL_CACHE = `splitup-shell-${BUILD_ID}`
const ASSET_CACHE = 'splitup-assets'
const FONT_CACHE = 'splitup-fonts'
const KEEP = [SHELL_CACHE, ASSET_CACHE, FONT_CACHE]

const SHELL_URL = '/index.html'
const CORE = [SHELL_URL, '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL_CACHE)
    // cache: 'reload' bypasses the HTTP cache so we never precache a stale shell.
    await shell.addAll(CORE.map(u => new Request(u, { cache: 'reload' })))
    const assets = await caches.open(ASSET_CACHE)
    // Hashed chunks: tolerate individual failures so one bad fetch can't block install.
    await Promise.all(PRECACHE.map(async url => {
      if (await assets.match(url)) return
      try { await assets.add(url) } catch (_) { /* fetched on demand later */ }
    }))
  })())
  // Do NOT skipWaiting here: the page asks first (see src/pwa.ts), so an
  // update never swaps code underneath someone halfway through an expense.
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(names.filter(n => n.startsWith('splitup-') && !KEEP.includes(n)).map(n => caches.delete(n)))
    // Drop hashed chunks that no longer belong to this build.
    if (PRECACHE.length) {
      const wanted = new Set(PRECACHE.map(p => new URL(p, self.location.origin).href))
      const assets = await caches.open(ASSET_CACHE)
      const keys = await assets.keys()
      await Promise.all(keys.filter(r => !wanted.has(r.url)).map(r => assets.delete(r)))
    }
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.enable() } catch (_) {}
    }
    await self.clients.claim()
  })())
})

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', event => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)

  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(req, FONT_CACHE))
    return
  }
  if (url.origin !== self.location.origin) return // Supabase etc: straight to network

  if (req.mode === 'navigate') {
    event.respondWith(networkFirstShell(event))
    return
  }
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(req, ASSET_CACHE))
    return
  }
  if (url.pathname.startsWith('/icons/') || url.pathname === '/favicon.svg' || url.pathname === '/manifest.webmanifest') {
    event.respondWith(staleWhileRevalidate(req, SHELL_CACHE))
  }
})

async function networkFirstShell(event) {
  try {
    const res = (await event.preloadResponse) || (await fetch(event.request))
    // Keep the shell fresh. Any route returns index.html (SPA fallback).
    if (res.ok && (res.headers.get('content-type') || '').includes('text/html')) {
      const copy = res.clone()
      caches.open(SHELL_CACHE).then(c => c.put(SHELL_URL, copy)).catch(() => {})
    }
    return res
  } catch (_) {
    const cached = await caches.match(SHELL_URL)
    return cached || offlinePage()
  }
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(req)
  if (hit) return hit
  const res = await fetch(req)
  if (res.ok) cache.put(req, res.clone()).catch(() => {})
  return res
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(req)
  const network = fetch(req).then(res => {
    if (res.ok || res.type === 'opaque') cache.put(req, res.clone()).catch(() => {})
    return res
  }).catch(() => hit)
  return hit || network
}

function offlinePage() {
  return new Response(
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>SplitUp — offline</title><body style="font-family:system-ui,sans-serif;background:#f3f4f8;color:#161a2e;' +
    'display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:24px">' +
    '<div><h1 style="font-size:22px">You\u2019re offline</h1><p style="color:#5c6280">Connect to the internet and try again.</p>' +
    '<button onclick="location.reload()" style="margin-top:12px;height:44px;padding:0 20px;border:0;border-radius:12px;' +
    'background:#4a3ad0;color:#fff;font:inherit;font-weight:600">Retry</button></div></body>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}

/* ===== Web Push =========================================================
 * The send-push Edge Function posts { title, body, url, tag } here.
 * A visible notification is required whenever a push arrives
 * (userVisibleOnly), otherwise Chrome can drop the subscription.
 */
self.addEventListener('push', event => {
  let payload = {}
  if (event.data) {
    try { payload = event.data.json() } catch (_) { payload = { body: event.data.text() } }
  }
  const title = payload.title || 'SplitUp'
  const target = payload.url || '/notifications'
  event.waitUntil(self.registration.showNotification(title, {
    body: payload.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: payload.tag || undefined,
    renotify: Boolean(payload.tag),
    data: { url: target },
    vibrate: [90, 40, 90]
  }))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '/notifications', self.location.origin).href
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      if ('focus' in client) {
        await client.focus()
        if ('navigate' in client) await client.navigate(target)
        return
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(target)
  })())
})
