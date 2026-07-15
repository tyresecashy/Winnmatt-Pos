/**
 * WinnMatt POS Service Worker
 *
 * Handles:
 * - Brand asset precaching and protection
 * - Versioned cache management
 * - Runtime caching strategies (Cache First, Stale While Revalidate, Network First)
 * - Offline fallback
 * - Background sync for pending transactions
 * - Push notifications
 * - Internal diagnostics (development only)
 *
 * Constitution Reference: §9 (Transaction & Event Rules), §11 (PWA Reliability)
 */

/* eslint-disable no-console */

// ─── Version ─────────────────────────────────────────────────────────────────
// Bump this to invalidate all caches on next deployment.
const CACHE_VERSION = 'v1'

// ─── Cache Names ─────────────────────────────────────────────────────────────
// Only WINNMATT_* caches are managed by this service worker.
const STATIC_CACHE = `WINNMATT_STATIC_${CACHE_VERSION}`
const DYNAMIC_CACHE = `WINNMATT_DYNAMIC_${CACHE_VERSION}`
const OFFLINE_CACHE = `WINNMATT_OFFLINE_${CACHE_VERSION}`

// ─── Install Metadata ────────────────────────────────────────────────────────
let installStats = {
  version: CACHE_VERSION,
  installTimestamp: null,
  cached: 0,
  skipped: 0,
  failed: 0,
  errors: [],
  duration: 0,
}

// ─── Brand Assets (precached on install) ─────────────────────────────────────
// These must survive: browser refresh, hard refresh, dev restart, offline mode,
// service worker update, and cache migration.
const PRECACHE_ASSETS = [
  // App shell
  '/',
  '/offline',
  '/manifest.json',

  // Brand identity — always available
  '/icon.svg',
  '/apple-icon.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',

  // PWA icons
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-384x384.png',

  // Badge icon (push notifications)
  '/icons/badge-72x72.png',

  // Shortcut icons
  '/icons/pos-96x96.png',
  '/icons/inventory-96x96.png',
  '/icons/customers-96x96.png',

  // PWA install screenshots
  '/screenshots/desktop.png',
  '/screenshots/mobile.png',
]

// ─── Image Extension Pattern ─────────────────────────────────────────────────
const IMAGE_EXT_RE = /\.(png|svg|ico|jpg|jpeg|webp|gif|avif)(\?.*)?$/i

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isImageRequest(url) {
  return IMAGE_EXT_RE.test(url.pathname)
}

function isOfflineRequest(url) {
  return url.pathname === '/offline' || url.pathname.startsWith('/offline/')
}

function isDevEnvironment() {
  try {
    const hostname = self.location.hostname
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
  } catch {
    return false
  }
}

// ─── Resilient Per-Asset Cache Installer ─────────────────────────────────────
// Replaces transactional cache.addAll() with individual fetch + cache.put.
// One failed asset NEVER aborts the entire installation.

async function precacheAssets(cache, assets) {
  const stats = { cached: 0, skipped: 0, failed: 0, errors: [] }

  for (const url of assets) {
    try {
      const request = new Request(url, { credentials: 'omit' })
      const response = await fetch(request)

      if (response.ok) {
        await cache.put(request, response)
        stats.cached++
      } else {
        stats.skipped++
        stats.errors.push({ url, status: response.status })
        console.warn(`[SW] Skipped ${url} — HTTP ${response.status}`)
      }
    } catch (err) {
      stats.failed++
      stats.errors.push({ url, error: err.message })
      console.warn(`[SW] Failed to cache ${url} — ${err.message}`)
    }
  }

  return stats
}

// ─── Safe Cache Cleanup ──────────────────────────────────────────────────────
// Only deletes WINNMATT_* caches that don't match the current version.
// Never deletes unrelated browser caches.

async function cleanOldCaches() {
  const keep = new Set([STATIC_CACHE, DYNAMIC_CACHE, OFFLINE_CACHE])
  const allCaches = await caches.keys()
  const deleted = []

  for (const name of allCaches) {
    if (name.startsWith('WINNMATT_') && !keep.has(name)) {
      await caches.delete(name)
      deleted.push(name)
    }
  }

  return deleted
}

// ─── Get Current Cache Names (for diagnostics) ───────────────────────────────

async function getCurrentCacheNames() {
  const allCaches = await caches.keys()
  return allCaches.filter((name) => name.startsWith('WINNMATT_'))
}

// ═══════════════════════════════════════════════════════════════════════════════
// INSTALL EVENT
// ═══════════════════════════════════════════════════════════════════════════════

self.addEventListener('install', (event) => {
  const startTime = Date.now()
  installStats.installTimestamp = new Date().toISOString()

  console.log(`[SW] ───────────────────────────────────────────────`)
  console.log(`[SW] Install started`)
  console.log(`[SW] Version: ${CACHE_VERSION}`)
  console.log(`[SW] Cache: ${STATIC_CACHE}`)
  console.log(`[SW] Assets: ${PRECACHE_ASSETS.length}`)

  event.waitUntil(
    (async () => {
      // Open the static cache
      const cache = await caches.open(STATIC_CACHE)

      // Precache each asset individually — one failure never aborts install
      const stats = await precacheAssets(cache, PRECACHE_ASSETS)

      installStats.cached = stats.cached
      installStats.skipped = stats.skipped
      installStats.failed = stats.failed
      installStats.errors = stats.errors
      installStats.duration = Date.now() - startTime

      console.log(`[SW] ───────────────────────────────────────────────`)
      console.log(`[SW] Install complete`)
      console.log(`[SW] Cached:  ${stats.cached}`)
      console.log(`[SW] Skipped: ${stats.skipped}`)
      console.log(`[SW] Failed:  ${stats.failed}`)
      console.log(`[SW] Duration: ${installStats.duration}ms`)
      if (stats.errors.length > 0) {
        console.log(`[SW] Errors:`, stats.errors)
      }

      // Activate immediately
      await self.skipWaiting()
    })()
  )
})

// ═══════════════════════════════════════════════════════════════════════════════
// ACTIVATE EVENT
// ═══════════════════════════════════════════════════════════════════════════════

self.addEventListener('activate', (event) => {
  console.log(`[SW] ───────────────────────────────────────────────`)
  console.log(`[SW] Activating...`)

  event.waitUntil(
    (async () => {
      // Clean up obsolete WINNMATT_* caches only
      const deleted = await cleanOldCaches()

      console.log(`[SW] Deleted caches: ${deleted.length > 0 ? deleted.join(', ') : 'none'}`)
      console.log(`[SW] Current cache: ${STATIC_CACHE}`)
      console.log(`[SW] Migration complete`)

      // Take control of all clients immediately
      await self.clients.claim()
    })()
  )
})

// ═══════════════════════════════════════════════════════════════════════════════
// RUNTIME STRATEGIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Cache First — Static assets, icons, manifest.
 * Serve from cache immediately. Fall back to network if not cached.
 */
async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached

  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE)
      cache.put(request, response.clone())
    }
    return response
  } catch (error) {
    // For navigation requests, show the offline page
    if (request.mode === 'navigate') {
      const offline = await caches.match('/offline')
      if (offline) return offline
    }
    return new Response('Offline', { status: 503 })
  }
}

/**
 * Cache Only — Offline page only.
 * Never attempt network. Must be precached.
 */
async function cacheOnly(request) {
  const cached = await caches.match(request)
  if (cached) return cached

  // Fallback: serve the offline page for any uncached route
  const offline = await caches.match('/offline')
  if (offline) return offline

  return new Response('Offline', { status: 503 })
}

/**
 * Stale While Revalidate — Images, screenshots.
 * Return cached immediately, update cache in background.
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE)
  const cached = await cache.match(request)

  // Revalidate in background (never blocks the response)
  const revalidate = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone())
      }
      return response
    })
    .catch(() => null)

  // Return cached immediately, or wait for network
  return cached || revalidate
}

/**
 * Network First — API routes.
 * Try network. Cache on success. Fall back to cache on failure.
 */
async function networkFirst(request) {
  try {
    const response = await fetch(request)

    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE)
      cache.put(request, response.clone())
    }

    return response
  } catch (error) {
    const cached = await caches.match(request)
    if (cached) {
      return cached
    }

    // Return structured JSON for API requests
    return new Response(
      JSON.stringify({
        error: 'Offline',
        message: 'You are currently offline. Data may be stale.',
        cached: false,
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FETCH EVENT
// ═══════════════════════════════════════════════════════════════════════════════

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return

  // Skip non-GET requests (except POST to API for offline queue)
  if (request.method !== 'GET') {
    if (request.method === 'POST' && url.pathname.startsWith('/api/')) {
      event.respondWith(handleOfflinePost(request))
    }
    return
  }

  // ─── Route by content type ─────────────────────────────────────────────

  // API routes → Network First
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request))
    return
  }

  // Offline page → Cache Only
  if (isOfflineRequest(url)) {
    event.respondWith(cacheOnly(request))
    return
  }

  // Images → Stale While Revalidate
  if (isImageRequest(url)) {
    event.respondWith(staleWhileRevalidate(request))
    return
  }

  // Everything else (HTML, JS, CSS, manifest) → Cache First
  event.respondWith(cacheFirst(request))
})

// ═══════════════════════════════════════════════════════════════════════════════
// OFFLINE POST HANDLER
// ── Preserved from original implementation ────────────────────────────────────

async function handleOfflinePost(request) {
  try {
    const response = await fetch(request)
    return response
  } catch (error) {
    const requestBody = await request.clone().json()

    await storeOfflineRequest({
      url: request.url,
      method: request.method,
      body: requestBody,
      timestamp: Date.now(),
    })

    const clients = await self.clients.matchAll()
    clients.forEach((client) => {
      client.postMessage({
        type: 'OFFLINE_QUEUED',
        data: { url: request.url, timestamp: Date.now() },
      })
    })

    return new Response(
      JSON.stringify({
        success: true,
        offline: true,
        message: 'Request queued for sync when online',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// OFFLINE STORAGE
// ── Preserved from original implementation ────────────────────────────────────

async function storeOfflineRequest(request) {
  const cache = await caches.open(OFFLINE_CACHE)
  const response = new Response(JSON.stringify(request))
  await cache.put(new Request(`/offline-queue/${Date.now()}`), response)
}

async function getOfflineRequests() {
  const cache = await caches.open(OFFLINE_CACHE)
  const keys = await cache.keys()
  const requests = []

  for (const key of keys) {
    const response = await cache.match(key)
    if (response) {
      const data = await response.json()
      requests.push(data)
    }
  }

  return requests
}

async function clearOfflineRequests() {
  const cache = await caches.open(OFFLINE_CACHE)
  await cache.keys().then((keys) => {
    keys.forEach((key) => cache.delete(key))
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// BACKGROUND SYNC
// ── Preserved from original implementation ────────────────────────────────────

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-requests') {
    event.waitUntil(syncOfflineRequests())
  }
})

async function syncOfflineRequests() {
  const requests = await getOfflineRequests()

  for (const req of requests) {
    try {
      await fetch(req.url, {
        method: req.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
      })
      console.log('[SW] Synced offline request:', req.url)
    } catch (error) {
      console.error('[SW] Failed to sync request:', error)
    }
  }

  await clearOfflineRequests()

  const clients = await self.clients.matchAll()
  clients.forEach((client) => {
    client.postMessage({ type: 'SYNC_COMPLETE' })
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUSH NOTIFICATIONS
// ── Preserved from original implementation ────────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return

  const data = event.data.json()

  const options = {
    body: data.body || 'New notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: data.data || {},
    actions: data.actions || [],
    tag: data.tag || 'default',
    renotify: true,
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'WinnMatt', options)
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const action = event.action
  const data = event.notification.data

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/') && 'focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_CLICK', action, data })
          return client.focus()
        }
      }
      return clients.openWindow(data.url || '/')
    })
  )
})

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE HANDLER
// ── Preserved: SKIP_WAITING, GET_OFFLINE_REQUESTS, SYNC_NOW
// ── Added: DIAGNOSTICS (development only)
// ═══════════════════════════════════════════════════════════════════════════════

self.addEventListener('message', async (event) => {
  const { type, data } = event.data

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting()
      break

    case 'GET_OFFLINE_REQUESTS':
      getOfflineRequests().then((requests) => {
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage(requests)
        }
      })
      break

    case 'SYNC_NOW':
      syncOfflineRequests()
      break

    case 'DIAGNOSTICS':
      // Only respond in development
      if (!isDevEnvironment()) {
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ error: 'Diagnostics unavailable in production' })
        }
        return
      }

      try {
        const cacheNames = await getCurrentCacheNames()
        const staticCache = await caches.open(STATIC_CACHE)
        const staticKeys = await staticCache.keys()
        const dynamicCache = await caches.open(DYNAMIC_CACHE)
        const dynamicKeys = await dynamicCache.keys()

        const diagnostics = {
          version: CACHE_VERSION,
          installTimestamp: installStats.installTimestamp,
          swState: self.serviceWorker?.state || 'unknown',
          cacheNames,
          assetCounts: {
            precached: staticKeys.length,
            dynamic: dynamicKeys.length,
            total: staticKeys.length + dynamicKeys.length,
          },
          installStats: {
            cached: installStats.cached,
            skipped: installStats.skipped,
            failed: installStats.failed,
            duration: installStats.duration,
          },
          offlineReady: installStats.cached > 0,
        }

        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage(diagnostics)
        }
      } catch (err) {
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ error: err.message })
        }
      }
      break
  }
})
