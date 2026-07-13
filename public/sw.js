/**
 * WinnMatt POS Service Worker
 * 
 * Handles:
 * - Static asset caching
 * - API response caching
 * - Offline fallback
 * - Background sync for pending transactions
 */

/* eslint-disable no-console */
const CACHE_NAME = 'winnmatt-v1'
const STATIC_CACHE = 'winnmatt-static-v1'
const API_CACHE = 'winnmatt-api-v1'
const OFFLINE_CACHE = 'winnmatt-offline-v1'

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
  '/favicon.ico',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
]

// API routes to cache
const API_ROUTES = [
  '/api/v1/products',
  '/api/v1/customers',
  '/api/v1/search',
]

// ─── Install Event ──────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...')
  
  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(STATIC_CACHE).then((cache) => {
        return cache.addAll(STATIC_ASSETS)
      }),
      // Skip waiting to activate immediately
      self.skipWaiting(),
    ])
  )
})

// ─── Activate Event ─────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...')
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== STATIC_CACHE && name !== API_CACHE && name !== OFFLINE_CACHE)
            .map((name) => caches.delete(name))
        )
      }),
      // Claim all clients
      self.clients.claim(),
    ])
  )
})

// ─── Fetch Event ────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') {
    // Handle POST requests for offline queue
    if (request.method === 'POST' && url.pathname.startsWith('/api/')) {
      event.respondWith(handleOfflinePost(request))
    }
    return
  }

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request))
    return
  }

  // Handle static assets
  event.respondWith(handleStaticRequest(request))
})

// ─── Static Asset Handler ───────────────────────────────────────────────────

async function handleStaticRequest(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request)
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE)
      cache.put(request, networkResponse.clone())
    }
    
    return networkResponse
  } catch (error) {
    // Fall back to cache
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      return cachedResponse
    }

    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/offline')
    }

    return new Response('Offline', { status: 503 })
  }
}

// ─── API Request Handler ────────────────────────────────────────────────────

async function handleApiRequest(request) {
  const url = new URL(request.url)
  
  try {
    // Try network first
    const networkResponse = await fetch(request)
    
    // Cache successful GET responses
    if (networkResponse.ok) {
      const cache = await caches.open(API_CACHE)
      cache.put(request, networkResponse.clone())
    }
    
    return networkResponse
  } catch (error) {
    // Fall back to cache for GET requests
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      // Add header to indicate cached response
      const response = cachedResponse.clone()
      response.headers.set('X-Cached', 'true')
      return response
    }

    // Return offline data structure
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

// ─── Offline POST Handler ───────────────────────────────────────────────────

async function handleOfflinePost(request) {
  try {
    // Try network first
    const response = await fetch(request)
    return response
  } catch (error) {
    // Store request for background sync
    const requestBody = await request.clone().json()
    
    await storeOfflineRequest({
      url: request.url,
      method: request.method,
      body: requestBody,
      timestamp: Date.now(),
    })

    // Notify client about offline queue
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

// ─── Offline Storage ────────────────────────────────────────────────────────

async function storeOfflineRequest(request) {
  const cache = await caches.open(OFFLINE_CACHE)
  const keys = await cache.keys()
  
  // Store as a JSON response
  const response = new Response(JSON.stringify(request))
  await cache.put(
    new Request(`/offline-queue/${Date.now()}`),
    response
  )
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

// ─── Background Sync ────────────────────────────────────────────────────────

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-requests') {
    event.waitUntil(syncOfflineRequests())
  }
})

async function syncOfflineRequests() {
  const requests = await getOfflineRequests()
  
  for (const request of requests) {
    try {
      await fetch(request.url, {
        method: request.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request.body),
      })
      
      console.log('[SW] Synced offline request:', request.url)
    } catch (error) {
      console.error('[SW] Failed to sync request:', error)
    }
  }
  
  // Clear synced requests
  await clearOfflineRequests()
  
  // Notify clients
  const clients = await self.clients.matchAll()
  clients.forEach((client) => {
    client.postMessage({ type: 'SYNC_COMPLETE' })
  })
}

// ─── Push Notifications ─────────────────────────────────────────────────────

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
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url.includes('/') && 'focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_CLICK', action, data })
          return client.focus()
        }
      }

      // Open new window if none available
      return clients.openWindow(data.url || '/')
    })
  )
})

// ─── Message Handler ────────────────────────────────────────────────────────

self.addEventListener('message', (event) => {
  const { type, data } = event.data

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting()
      break
    case 'GET_OFFLINE_REQUESTS':
      getOfflineRequests().then((requests) => {
        event.ports[0].postMessage(requests)
      })
      break
    case 'SYNC_NOW':
      syncOfflineRequests()
      break
  }
})
