/**
 * Rate Limiter — Redis-backed when available, in-memory fallback
 *
 * Factory pattern similar to the event bus.
 * When REDIS_URL is set, uses Redis for distributed rate limiting.
 * Falls back to in-memory Map for single-instance dev.
 */

import { logger } from '@/lib/logger'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RateLimiterOptions {
  limit: number
  windowMs: number
}

interface InMemoryEntry {
  count: number
  resetTime: number
}

// ─── In-memory implementation ──────────────────────────────────────────────

const inMemoryMap = new Map<string, InMemoryEntry>()

function createInMemoryRateLimiter() {
  // Periodic cleanup to prevent memory leaks
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of inMemoryMap.entries()) {
      if (now > entry.resetTime) {
        inMemoryMap.delete(key)
      }
    }
    // If map grows too large, clear all expired
    if (inMemoryMap.size > 10_000) {
      const now = Date.now()
      for (const [key, entry] of inMemoryMap.entries()) {
        if (now > entry.resetTime) {
          inMemoryMap.delete(key)
        }
      }
    }
  }, 60_000).unref()

  return {
    check: (key: string, options: RateLimiterOptions): boolean => {
      const now = Date.now()
      const entry = inMemoryMap.get(key)

      if (!entry || now > entry.resetTime) {
        inMemoryMap.set(key, { count: 1, resetTime: now + options.windowMs })
        return true
      }

      if (entry.count >= options.limit) {
        return false
      }

      entry.count++
      return true
    },
    reset: (key: string): void => {
      inMemoryMap.delete(key)
    },
  }
}

// ─── Redis implementation ──────────────────────────────────────────────────

let redisClient: any = null
let redisRateLimiter: ReturnType<typeof createInMemoryRateLimiter> | null = null

async function getRedisClient() {
  if (redisClient) return redisClient
  try {
    const Redis = (await import('ioredis')).default
    redisClient = new Redis(process.env.REDIS_URL!, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        if (times > 3) return null
        return Math.min(times * 200, 2000)
      },
    })
    await redisClient.connect()
    logger.info('[RateLimiter] Redis connected')
    return redisClient
  } catch (err) {
    logger.error('[RateLimiter] Redis connection failed, falling back to in-memory', err)
    redisClient = null
    return null
  }
}

function createRedisRateLimiter() {
  return {
    check: async (key: string, options: RateLimiterOptions): Promise<boolean> => {
      const client = await getRedisClient()
      if (!client) {
        // Fallback to in-memory if Redis is unavailable
        if (!redisRateLimiter) redisRateLimiter = createInMemoryRateLimiter()
        return redisRateLimiter.check(key, options)
      }

      try {
        const now = Date.now()
        const windowKey = `${key}:${Math.floor(now / options.windowMs)}`

        const multi = client.multi()
        multi.incr(windowKey)
        multi.expire(windowKey, Math.ceil(options.windowMs / 1000))
        const results = await multi.exec()

        if (results && results[0]) {
          const count = Number(results[0][1]) || 0
          return count <= options.limit
        }
        return true
      } catch (err) {
        logger.error('[RateLimiter] Redis check failed, allowing request', err)
        return true
      }
    },
    reset: async (key: string): Promise<void> => {
      const client = await getRedisClient()
      if (!client) return
      try {
        // Delete all time windows for the key
        const keys = await client.keys(`${key}:*`)
        if (keys.length > 0) {
          await client.del(...keys)
        }
      } catch (err) {
        logger.error('[RateLimiter] Redis reset failed', err)
      }
    },
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

const useRedis = typeof process !== 'undefined' && !!process.env.REDIS_URL

const defaultOptions: RateLimiterOptions = {
  limit: 100,
  windowMs: 60_000,
}

export interface RateLimiter {
  check(key: string, options?: Partial<RateLimiterOptions>): boolean | Promise<boolean>
  reset(key: string): void | Promise<void>
}

export function createRateLimiter(): RateLimiter {
  if (useRedis) {
    logger.info('[RateLimiter] REDIS_URL detected — using Redis-backed rate limiter')
    return createRedisRateLimiter()
  }

  logger.info('[RateLimiter] No REDIS_URL — using in-memory rate limiter')
  return createInMemoryRateLimiter()
}

// Singleton instance
export const rateLimiter: RateLimiter = createRateLimiter()

// Convenience function for legacy API middleware
export function getRateLimitKey(
  identifier: string,
  pathname: string,
  type: string = 'default'
): string {
  return `${type}:${identifier}:${pathname}`
}

export function checkRateLimitSimple(
  key: string,
  limit?: number,
  windowMs?: number
): boolean | Promise<boolean> {
  return rateLimiter.check(key, {
    limit: limit ?? defaultOptions.limit,
    windowMs: windowMs ?? defaultOptions.windowMs,
  })
}

export { defaultOptions }
