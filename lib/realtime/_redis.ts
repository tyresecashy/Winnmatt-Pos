/**
 * Redis-backed event bus for multi-instance production deployments.
 *
 * Uses Redis Pub/Sub on a single channel (`pos:events`).
 * Falls back to in-memory if Redis is unreachable or disconnects.
 *
 * Interface matches the in-memory event bus exactly:
 *   publish(event), subscribe(type, cb), subscribeAll(cb), matchEvents(types)
 */

import Redis from 'ioredis'
import type { RealtimeEvent } from './types'
import { logger } from '@/lib/logger'

type EventCallback = (event: RealtimeEvent) => void

// ─── Configuration ───────────────────────────────

const REDIS_URL = process.env.REDIS_URL || ''
const CHANNEL = 'pos:events'
const RECONNECT_DELAY = 3000 // ms between reconnect attempts

// ─── State ───────────────────────────────────────

/** Active Redis connection (lazily created) */
let redis: Redis | null = null
let subscriber: Redis | null = null

/** In-memory failover subscribers (used when Redis is down) */
const localSubscribers = new Map<string, Set<EventCallback>>()
const localWildcard = new Set<EventCallback>()

/** Tracks whether Redis is currently connected */
let redisAvailable = false
let connecting = false
let connectPromise: Promise<void> | null = null

// ─── Connection Management ───────────────────────

async function ensureConnected(): Promise<boolean> {
  if (redisAvailable) return true
  if (connectPromise) return connectPromise.then(() => redisAvailable)
  if (!REDIS_URL) return false

  connecting = true
  connectPromise = (async () => {
    try {
      redis = new Redis(REDIS_URL, {
        maxRetriesPerRequest: 1,
        retryStrategy: () => RECONNECT_DELAY,
        lazyConnect: true,
      })

      subscriber = new Redis(REDIS_URL, {
        maxRetriesPerRequest: 1,
        retryStrategy: () => RECONNECT_DELAY,
        lazyConnect: true,
      })

      await Promise.all([redis.connect(), subscriber.connect()])

      // Subscribe to the broadcast channel
      await subscriber.subscribe(CHANNEL)

      subscriber.on('message', (_channel: string, message: string) => {
        try {
          const event: RealtimeEvent = JSON.parse(message)
          // Dispatch to local subscribers
          const subs = localSubscribers.get(event.type)
          if (subs) {
            subs.forEach(cb => { try { cb(event) } catch { /* swallow */ } })
          }
          localWildcard.forEach(cb => { try { cb(event) } catch { /* swallow */ } })
        } catch (err) {
          logger.warn('[RedisEventBus] Failed to parse message', err as Record<string, unknown>)
        }
      })

      redisAvailable = true
      connecting = false
      logger.info('[RedisEventBus] Connected', { url: maskRedisUrl(REDIS_URL) })

      // Handle disconnection
      redis.on('close', () => {
        redisAvailable = false
        logger.warn('[RedisEventBus] Disconnected — falling back to in-memory')
      })

      redis.on('reconnecting', () => {
        logger.info('[RedisEventBus] Reconnecting...')
      })

      redis.on('error', (err) => {
        logger.warn('[RedisEventBus] Error', err as unknown as Record<string, unknown>)
      })
    } catch (err) {
      redisAvailable = false
      connecting = false
      connectPromise = null
      logger.warn('[RedisEventBus] Connection failed — using in-memory fallback', err as Record<string, unknown>)
    }
  })()

  await connectPromise
  return redisAvailable
}

function maskRedisUrl(url: string): string {
  try {
    const u = new URL(url)
    return `${u.protocol}//${u.username ? '***' : ''}${u.password ? ':***@' : ''}${u.host}${u.pathname}`
  } catch {
    return '(invalid url)'
  }
}

// ─── Public API ──────────────────────────────────

/**
 * Publish an event to the bus.
 * When Redis is connected, the event is broadcast to all instances.
 * Regardless of Redis, local subscribers always receive the event.
 */
export function publish(event: RealtimeEvent) {
  // Always deliver to local subscribers (fast path)
  const subs = localSubscribers.get(event.type)
  if (subs) {
    subs.forEach(cb => {
      try { cb(event) } catch { /* swallow */ }
    })
  }
  localWildcard.forEach(cb => {
    try { cb(event) } catch { /* swallow */ }
  })

  // Broadcast via Redis (if connected)
  if (redisAvailable && redis) {
    try {
      redis.publish(CHANNEL, JSON.stringify(event)).catch(() => {
        // Best-effort — don't block on Redis failures
      })
    } catch {
      // Swallow Redis errors
    }
  }
}

/**
 * Subscribe to a specific event type.
 * Returns an unsubscribe function.
 */
export function subscribe(
  type: string,
  callback: EventCallback
): () => void {
  if (!localSubscribers.has(type)) {
    localSubscribers.set(type, new Set())
  }
  localSubscribers.get(type)!.add(callback)

  // Attempt Redis connection (non-blocking)
  ensureConnected().catch(() => {})

  return () => {
    localSubscribers.get(type)?.delete(callback)
    if (localSubscribers.get(type)?.size === 0) {
      localSubscribers.delete(type)
    }
  }
}

/**
 * Subscribe to all event types (wildcard).
 * Returns an unsubscribe function.
 */
export function subscribeAll(callback: EventCallback): () => void {
  localWildcard.add(callback)

  ensureConnected().catch(() => {})

  return () => {
    localWildcard.delete(callback)
  }
}

/**
 * Match recent events by type (in-memory only — not persisted in Redis).
 * Returns an empty array when using Redis-only mode.
 */
export function matchEvents(types: string[]): RealtimeEvent[] {
  // With Redis, we don't maintain a local event cache, so this returns empty.
  // In practice this function is currently unused across the codebase.
  return []
}

/**
 * Gracefully close the Redis connection.
 * Call during server shutdown.
 */
export async function shutdown(): Promise<void> {
  try {
    if (subscriber) {
      await subscriber.unsubscribe(CHANNEL)
      subscriber.disconnect()
    }
    if (redis) {
      redis.disconnect()
    }
  } catch {
    // Swallow disconnect errors
  }
  redisAvailable = false
  redis = null
  subscriber = null
}
