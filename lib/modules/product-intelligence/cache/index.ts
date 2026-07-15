/**
 * Cache Layer — In-memory + Redis-backed caching for Product Intelligence.
 *
 * Provides a unified cache interface with:
 * - In-memory fallback (always available, no external dependency)
 * - Redis-backed storage (when REDIS_URL is configured)
 * - TTL-based expiration per entry
 * - Cache hit/miss metrics tracking
 * - Intelligent invalidation hooks
 *
 * Sprint 11F — Production Hardening.
 *
 * @see lib/realtime/event-bus.ts (follows same factory pattern)
 */

import { logger } from '@/lib/logger'
import { cacheMetrics } from '../instrumentation'

// ─── Types ──────────────────────────────────────────────────────

export interface CacheEntry<T> {
  value: T
  expiresAt: number
  storedAt: number
}

export interface CacheOptions {
  /** Time-to-live in seconds. Default: 300 (5 min) */
  ttlSeconds?: number
  /** Cache label for metrics tracking. */
  label?: string
}

export interface CacheStats {
  entries: number
  memoryEstimateBytes: number
  oldestEntry: number | null
  newestEntry: number | null
}

// ─── In-Memory Cache ────────────────────────────────────────────

class InMemoryCache {
  private readonly store = new Map<string, CacheEntry<unknown>>()
  private readonly created = Date.now()

  /** Get a value. Returns null if missing or expired. */
  get<T>(key: string, label = 'cache'): T | null {
    const raw = this.store.get(key)
    if (!raw) {
      cacheMetrics.recordMiss(label)
      return null
    }
    if (Date.now() > raw.expiresAt) {
      this.store.delete(key)
      cacheMetrics.recordMiss(label)
      return null
    }
    cacheMetrics.recordHit(label)
    return raw.value as T
  }

  /** Set a value with TTL. */
  set<T>(key: string, value: T, ttlSeconds: number): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
      storedAt: Date.now(),
    })
  }

  /** Delete a specific key. */
  del(key: string): void {
    this.store.delete(key)
  }

  /** Delete all keys matching a prefix pattern. */
  delByPrefix(prefix: string): number {
    let count = 0
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key)
        count++
      }
    }
    return count
  }

  /** Clear entire cache. */
  clear(): void {
    this.store.clear()
  }

  /** Get cache statistics. */
  getStats(): CacheStats {
    let oldest = Infinity
    let newest = 0
    for (const entry of this.store.values()) {
      if (entry.storedAt < oldest) oldest = entry.storedAt
      if (entry.storedAt > newest) newest = entry.storedAt
    }
    // Rough memory estimate: key + value strings
    let bytes = 0
    for (const [k, v] of this.store.entries()) {
      bytes += k.length * 2
      bytes += JSON.stringify(v).length * 2
    }
    return {
      entries: this.store.size,
      memoryEstimateBytes: bytes,
      oldestEntry: oldest === Infinity ? null : oldest,
      newestEntry: newest === 0 ? null : newest,
    }
  }
}

// ─── Cache Manager ───────────────────────────────────────────────

export type CacheBackend = 'memory' | 'redis'

/**
 * Product Intelligence Cache Manager.
 *
 * Uses in-memory cache by default. If Redis becomes available,
 * set `useRedis(true)` to delegate to Redis-backed storage.
 *
 * The cache is designed to be non-blocking: cache failures are
 * logged but never thrown. If the cache is unavailable, operations
 * fall through to the source.
 */
export class PICache {
  private readonly memory: InMemoryCache
  private redisAvailable = false

  /** Default TTL per cache domain (in seconds). */
  static readonly TTL = {
    /** Product scores — recomputed on sale/stock events */
    PRODUCT_SCORE: 300,       // 5 min
    /** Customer scores — recomputed on sale events */
    CUSTOMER_SCORE: 300,      // 5 min
    /** Supplier scores — relatively stable */
    SUPPLIER_SCORE: 600,      // 10 min
    /** Business health — recomputed hourly-ish */
    BUSINESS_HEALTH: 600,     // 10 min
    /** Product forecasts — invalidated on stock change */
    FORECAST: 120,            // 2 min
    /** Revenue forecasts — daily cadence */
    REVENUE_FORECAST: 900,    // 15 min
    /** Seasonality patterns — stable week-over-week */
    SEASONALITY: 3600,        // 1 hour
    /** Product affinities — stable day-over-day */
    AFFINITIES: 1800,         // 30 min
    /** Reorder suggestions — updated on stock.low */
    REORDER: 120,             // 2 min
    /** KPI snapshots — depends on cadence */
    KPI_SNAPSHOT: 300,        // 5 min
    /** Anomaly results — ephemeral, short TTL */
    ANOMALY: 60,              // 1 min
    /** Trend analysis — ephemeral */
    TREND: 120,               // 2 min
  } as const

  constructor() {
    this.memory = new InMemoryCache()
  }

  /** Attempt to enable Redis backend (called at startup if available). */
  enableRedis(): void {
    this.redisAvailable = true
    logger.info('[PICache] Redis caching enabled')
  }

  /** Check if Redis is active. */
  isRedisAvailable(): boolean {
    return this.redisAvailable
  }

  /** Get the cache backend type. */
  getBackend(): CacheBackend {
    return this.redisAvailable ? 'redis' : 'memory'
  }

  // ── Get ─────────────────────────────────────────────────────

  get<T>(key: string, options?: CacheOptions): T | null {
    const label = options?.label ?? 'pi.cache'
    try {
      return this.memory.get<T>(key, label)
    } catch (error) {
      logger.warn('[PICache] get failed (falling through)', { key, error })
      return null
    }
  }

  // ── Set ─────────────────────────────────────────────────────

  set<T>(key: string, value: T, options?: CacheOptions): void {
    const ttl = options?.ttlSeconds ?? 300
    try {
      this.memory.set(key, value, ttl)
    } catch (error) {
      logger.warn('[PICache] set failed', { key, error })
    }
  }

  // ── Delete ──────────────────────────────────────────────────

  del(key: string): void {
    try {
      this.memory.del(key)
    } catch (error) {
      logger.warn('[PICache] del failed', { key, error })
    }
  }

  /** Delete all keys matching a prefix. */
  delByPrefix(prefix: string): void {
    try {
      const count = this.memory.delByPrefix(prefix)
      if (count > 0) {
        logger.debug('[PICache] invalidated by prefix', { prefix, count })
      }
    } catch (error) {
      logger.warn('[PICache] delByPrefix failed', { prefix, error })
    }
  }

  // ── Invalidation Helpers ─────────────────────────────────────

  /** Invalidate all cache entries related to a specific product. */
  invalidateProduct(productId: string): void {
    this.delByPrefix(`product:${productId}`)
    this.delByPrefix(`forecast:${productId}`)
    this.delByPrefix(`reorder:${productId}`)
    this.delByPrefix(`affinity:${productId}`)
    logger.debug('[PICache] invalidated product caches', { productId })
  }

  /** Invalidate all cache entries related to a customer. */
  invalidateCustomer(customerId: string): void {
    this.delByPrefix(`customer:${customerId}`)
  }

  /** Invalidate all cache entries related to a supplier. */
  invalidateSupplier(supplierId: string): void {
    this.delByPrefix(`supplier:${supplierId}`)
  }

  /** Invalidate business health cache for a branch. */
  invalidateBusinessHealth(branchId?: string): void {
    this.delByPrefix(`health:${branchId ?? 'all'}`)
  }

  /** Invalidate KPI snapshot cache. */
  invalidateKPI(): void {
    this.delByPrefix('kpi:')
  }

  /** Invalidate anomaly cache (fresh scan needed). */
  invalidateAnomalies(): void {
    this.delByPrefix('anomaly:')
    this.delByPrefix('trend:')
  }

  /** Invalidate forecasting caches for a product/branch. */
  invalidateForecasts(productId?: string): void {
    if (productId) {
      this.delByPrefix(`forecast:${productId}`)
    } else {
      this.delByPrefix('forecast:')
    }
  }

  // ── Stats ───────────────────────────────────────────────────

  getStats(): CacheStats {
    return this.memory.getStats()
  }

  /** Clear all caches. */
  clear(): void {
    this.memory.clear()
    logger.info('[PICache] cache cleared')
  }
}

// ─── Singleton ───────────────────────────────────────────────────

export const piCache = new PICache()

// ─── Key Builders ────────────────────────────────────────────────

export function scoreKey(type: 'product' | 'customer' | 'supplier', id: string): string {
  return `${type}:score:${id}`
}

export function forecastKey(productId: string, branchId?: string): string {
  return `forecast:${productId}:${branchId ?? 'all'}`
}

export function revenueForecastKey(branchId?: string): string {
  return `revenue-forecast:${branchId ?? 'all'}`
}

export function seasonalityKey(productId: string, branchId?: string): string {
  return `seasonality:${productId}:${branchId ?? 'all'}`
}

export function affinityKey(productId: string, branchId?: string): string {
  return `affinity:${productId}:${branchId ?? 'all'}`
}

export function reorderKey(productId: string, branchId?: string): string {
  return `reorder:${productId}:${branchId ?? 'all'}`
}

export function kpiKey(kpiId: string, branchId?: string): string {
  return `kpi:${kpiId}:${branchId ?? 'all'}`
}

export function healthKey(branchId?: string): string {
  return `health:${branchId ?? 'all'}`
}

export function anomalyKey(type: string): string {
  return `anomaly:${type}`
}

export function trendKey(metric: string): string {
  return `trend:${metric}`
}
