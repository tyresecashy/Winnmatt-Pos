/**
 * Event Bus — selects implementation based on environment.
 *
 * In-memory (default): single-process dev, no dependencies.
 * Redis (REDIS_URL):   multi-instance production via Pub/Sub.
 *
 * All implementations export the same 4 functions:
 *   publish(event), subscribe(type, cb), subscribeAll(cb), matchEvents(types)
 */

import type { RealtimeEvent } from './types'
import { logger } from '@/lib/logger'

type EventCallback = (event: RealtimeEvent) => void

// Lazy-load the implementation so ioredis is only required when REDIS_URL is set.
function loadImpl(): {
  publish: (event: RealtimeEvent) => void
  subscribe: (type: string, callback: EventCallback) => () => void
  subscribeAll: (callback: EventCallback) => () => void
  matchEvents: (types: string[]) => RealtimeEvent[]
} {
  const useRedis = typeof process !== 'undefined' && !!process.env.REDIS_URL

  if (useRedis) {
    logger.info('[EventBus] REDIS_URL detected — using Redis-backed event bus')
    return require('./_redis') as typeof import('./_in-memory')
  }

  return require('./_in-memory') as typeof import('./_in-memory')
}

const impl = loadImpl()

export const publish = impl.publish
export const subscribe = impl.subscribe
export const subscribeAll = impl.subscribeAll
export const matchEvents = impl.matchEvents

/** Check whether Redis is configured (read-only, safe to call from client) */
export function isRedisConfigured(): boolean {
  return typeof process !== 'undefined' && !!process.env.REDIS_URL
}

/** Gracefully close the Redis connection (no-op for in-memory) */
export async function shutdownEventBus(): Promise<void> {
  try {
    const { shutdown } = require('./_redis')
    await shutdown()
  } catch {
    // Redis module not available or noop
  }
}
