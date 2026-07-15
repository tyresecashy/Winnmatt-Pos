/**
 * Hardening Tests — Sprint 11F infrastructure tests.
 *
 * Covers:
 * - Cache layer (in-memory CRUD, TTL, invalidation, stats)
 * - Reliability layer (retry, timeout, circuit breaker)
 * - Cold-start handling (confidence assessment, fallback strategies)
 * - Instrumentation (timers, histograms, cache metrics)
 * - DB utilities (column selects, chunked operations)
 * - Integration: cache + reliability + cold-start composing together
 *
 * @see lib/modules/product-intelligence/cache/
 * @see lib/modules/product-intelligence/reliability/
 * @see lib/modules/product-intelligence/cold-start/
 * @see lib/modules/product-intelligence/instrumentation/
 * @see lib/modules/product-intelligence/db-utils.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Cache Tests ──────────────────────────────────────────────────

describe('Cache Layer', () => {
  let PICache: typeof import('../cache').PICache
  let piCache: import('../cache').PICache

  beforeEach(async () => {
    const mod = await import('../cache')
    PICache = mod.PICache
    piCache = new PICache()
  })

  describe('set / get / del', () => {
    it('stores and retrieves values', () => {
      piCache.set('test:1', { name: 'hello' }, { ttlSeconds: 60 })
      expect(piCache.get('test:1')).toEqual({ name: 'hello' })
    })

    it('returns null for missing keys', () => {
      expect(piCache.get('nonexistent')).toBeNull()
    })

    it('returns null for expired entries', async () => {
      piCache.set('test:2', 'value', { ttlSeconds: 0 }) // expires immediately
      // Wait a tick for expiration
      await new Promise(r => setTimeout(r, 10))
      expect(piCache.get('test:2')).toBeNull()
    })

    it('deletes specific keys', () => {
      piCache.set('test:3', 'value', { ttlSeconds: 60 })
      piCache.del('test:3')
      expect(piCache.get('test:3')).toBeNull()
    })

    it('stores null as a valid value', () => {
      piCache.set('test:null', null, { ttlSeconds: 60 })
      expect(piCache.get('test:null')).toBeNull()
    })

    it('stores complex objects', () => {
      const obj = { id: 'p1', score: 87.5, tags: ['star', 'high'], meta: { version: 2 } }
      piCache.set('test:complex', obj, { ttlSeconds: 300 })
      const retrieved = piCache.get<typeof obj>('test:complex')
      expect(retrieved).toEqual(obj)
    })
  })

  describe('prefix deletion', () => {
    it('deletes all keys matching a prefix', () => {
      piCache.set('product:p1', 'a', { ttlSeconds: 60 })
      piCache.set('product:p2', 'b', { ttlSeconds: 60 })
      piCache.set('forecast:p1', 'c', { ttlSeconds: 60 })
      piCache.set('other', 'd', { ttlSeconds: 60 })

      piCache.delByPrefix('product:')
      expect(piCache.get('product:p1')).toBeNull()
      expect(piCache.get('product:p2')).toBeNull()
      expect(piCache.get('forecast:p1')).toEqual('c')
      expect(piCache.get('other')).toEqual('d')
    })

    it('handles empty prefix matches gracefully', () => {
      piCache.set('a:1', 'x', { ttlSeconds: 60 })
      piCache.delByPrefix('nonexistent:')
      expect(piCache.get('a:1')).toEqual('x')
    })
  })

  describe('invalidation helpers', () => {
    it('invalidates product-related caches', () => {
      piCache.set('product:p1:score', 'a', { ttlSeconds: 60 })
      piCache.set('forecast:p1:daily', 'b', { ttlSeconds: 60 })
      piCache.set('reorder:p1:all', 'c', { ttlSeconds: 60 })
      piCache.set('affinity:p1:all', 'd', { ttlSeconds: 60 })
      piCache.set('other', 'e', { ttlSeconds: 60 })

      piCache.invalidateProduct('p1')
      expect(piCache.get('product:p1:score')).toBeNull()
      expect(piCache.get('forecast:p1:daily')).toBeNull()
      expect(piCache.get('reorder:p1:all')).toBeNull()
      expect(piCache.get('affinity:p1:all')).toBeNull()
      expect(piCache.get('other')).toEqual('e')
    })

    it('invalidates customer caches', () => {
      piCache.set('customer:c1:score', 'x', { ttlSeconds: 60 })
      piCache.invalidateCustomer('c1')
      expect(piCache.get('customer:c1:score')).toBeNull()
    })

    it('invalidates supplier caches', () => {
      piCache.set('supplier:s1:score', 'y', { ttlSeconds: 60 })
      piCache.invalidateSupplier('s1')
      expect(piCache.get('supplier:s1:score')).toBeNull()
    })

    it('invalidates KPI caches', () => {
      piCache.set('kpi:revenue_velocity:all', 'z', { ttlSeconds: 60 })
      piCache.invalidateKPI()
      expect(piCache.get('kpi:revenue_velocity:all')).toBeNull()
    })
  })

  describe('TTL constants', () => {
    it('defines all TTL constants with positive values', () => {
      const ttls = PICache.TTL
      expect(ttls.PRODUCT_SCORE).toBeGreaterThan(0)
      expect(ttls.CUSTOMER_SCORE).toBeGreaterThan(0)
      expect(ttls.SUPPLIER_SCORE).toBeGreaterThan(0)
      expect(ttls.BUSINESS_HEALTH).toBeGreaterThan(0)
      expect(ttls.FORECAST).toBeGreaterThan(0)
      expect(ttls.REVENUE_FORECAST).toBeGreaterThan(0)
      expect(ttls.SEASONALITY).toBeGreaterThan(0)
      expect(ttls.AFFINITIES).toBeGreaterThan(0)
      expect(ttls.REORDER).toBeGreaterThan(0)
      expect(ttls.KPI_SNAPSHOT).toBeGreaterThan(0)
      expect(ttls.ANOMALY).toBeGreaterThan(0)
      expect(ttls.TREND).toBeGreaterThan(0)
    })
  })

  describe('stats', () => {
    it('returns stats with entry count and memory estimate', () => {
      piCache.set('a:1', 'hello', { ttlSeconds: 60 })
      piCache.set('a:2', 'world', { ttlSeconds: 60 })
      const stats = piCache.getStats()
      expect(stats.entries).toBe(2)
      expect(stats.memoryEstimateBytes).toBeGreaterThan(0)
      expect(stats.oldestEntry).toBeGreaterThan(0)
      expect(stats.newestEntry).toBeGreaterThan(0)
    })

    it('reports zero entries after clear', () => {
      piCache.set('x:1', 'test', { ttlSeconds: 60 })
      piCache.clear()
      const stats = piCache.getStats()
      expect(stats.entries).toBe(0)
    })

    it('reports empty stats on fresh cache', () => {
      const stats = piCache.getStats()
      expect(stats.entries).toBe(0)
      expect(stats.oldestEntry).toBeNull()
      expect(stats.newestEntry).toBeNull()
    })
  })

  describe('key builders', () => {
    it('scoreKey builds correct keys', async () => {
      const { scoreKey } = await import('../cache')
      expect(scoreKey('product', 'p1')).toBe('product:score:p1')
      expect(scoreKey('customer', 'c1')).toBe('customer:score:c1')
      expect(scoreKey('supplier', 's1')).toBe('supplier:score:s1')
    })

    it('forecastKey builds correct keys', async () => {
      const { forecastKey } = await import('../cache')
      expect(forecastKey('p1')).toBe('forecast:p1:all')
      expect(forecastKey('p1', 'b1')).toBe('forecast:p1:b1')
    })
  })
})

// ─── Reliability Tests ─────────────────────────────────────────────

describe('Reliability Layer', () => {
  describe('withRetry', () => {
    it('succeeds on first attempt', async () => {
      const { withRetry } = await import('../reliability')
      const result = await withRetry(async () => 'success', { label: 'test' })
      expect(result).toBe('success')
    })

    it('retries on failure and eventually succeeds', async () => {
      const { withRetry } = await import('../reliability')
      let attempts = 0
      const result = await withRetry(async () => {
        attempts++
        if (attempts < 3) throw new Error('temporary failure')
        return 'recovered'
      }, { maxAttempts: 3, baseDelayMs: 10, label: 'test-retry' })
      expect(result).toBe('recovered')
      expect(attempts).toBe(3)
    })

    it('throws after exhausting all retries', async () => {
      const { withRetry } = await import('../reliability')
      const fn = vi.fn().mockRejectedValue(new Error('persistent failure'))
      await expect(withRetry(fn, { maxAttempts: 2, baseDelayMs: 10, label: 'test-fail' })).rejects.toThrow('persistent failure')
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('succeeds on single attempt (maxAttempts=1)', async () => {
      const { withRetry } = await import('../reliability')
      const fn = vi.fn().mockResolvedValue('ok')
      const result = await withRetry(fn, { maxAttempts: 1, label: 'test-no-retry' })
      expect(result).toBe('ok')
      expect(fn).toHaveBeenCalledTimes(1)
    })
  })

  describe('withTimeout', () => {
    it('resolves before timeout', async () => {
      const { withTimeout } = await import('../reliability')
      const result = await withTimeout(async () => 'fast', { timeoutMs: 1000, label: 'test-fast' })
      expect(result).toBe('fast')
    })

    it('throws if operation exceeds timeout', async () => {
      const { withTimeout } = await import('../reliability')
      const slow = async () => {
        await new Promise(r => setTimeout(r, 500))
        return 'too late'
      }
      await expect(withTimeout(slow, { timeoutMs: 50, label: 'test-slow' })).rejects.toThrow('test-slow exceeded 50ms')
    })
  })

  describe('CircuitBreaker', () => {
    it('starts in closed state', async () => {
      const { CircuitBreaker } = await import('../reliability')
      const cb = new CircuitBreaker({ label: 'test-cb' })
      expect(cb.getState()).toBe('closed')
      expect(cb.getFailureCount()).toBe(0)
    })

    it('opens after reaching failure threshold', async () => {
      const { CircuitBreaker } = await import('../reliability')
      const cb = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 1000, label: 'test-cb' })
      const failFn = vi.fn().mockRejectedValue(new Error('fail'))

      for (let i = 0; i < 3; i++) {
        await expect(cb.call(failFn)).rejects.toThrow('fail')
      }

      expect(cb.getState()).toBe('open')
      expect(cb.getFailureCount()).toBe(3)
    })

    it('returns fallback when circuit is open', async () => {
      const { CircuitBreaker } = await import('../reliability')
      const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 5000, label: 'test-cb' })
      const failFn = vi.fn().mockRejectedValue(new Error('fail'))

      // Trip the circuit
      for (let i = 0; i < 2; i++) {
        await expect(cb.call(failFn)).rejects.toThrow('fail')
      }

      // Circuit is open — should use fallback
      const result = await cb.call(failFn, () => 'fallback-value')
      expect(result).toBe('fallback-value')
      expect(cb.getState()).toBe('open')
    })

    it('resets to closed after success in half-open state', async () => {
      const { CircuitBreaker } = await import('../reliability')
      const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 50, label: 'test-cb' })
      const failFn = vi.fn().mockRejectedValue(new Error('fail'))

      // Trip the circuit
      for (let i = 0; i < 2; i++) {
        await expect(cb.call(failFn)).rejects.toThrow('fail')
      }
      expect(cb.getState()).toBe('open')

      // Wait for half-open
      await new Promise(r => setTimeout(r, 60))

      // Succeed twice in half-open state
      const successFn = vi.fn().mockResolvedValue('ok')
      const r1 = await cb.call(successFn)
      expect(r1).toBe('ok')
      expect(cb.getState()).toBe('half-open')

      const r2 = await cb.call(successFn)
      expect(r2).toBe('ok')
      expect(cb.getState()).toBe('closed')
    })
  })

  describe('resilientCall', () => {
    it('succeeds with retry + timeout + no circuit breaker', async () => {
      const { resilientCall } = await import('../reliability')
      const result = await resilientCall(
        async () => 'ok',
        { label: 'test-resilient', maxAttempts: 1 },
      )
      expect(result).toBe('ok')
    })

    it('returns fallback value on failure', async () => {
      const { resilientCall } = await import('../reliability')
      const result = await resilientCall(
        async () => { throw new Error('db down') },
        { label: 'test-fallback', maxAttempts: 1 },
        () => null,
      )
      expect(result).toBeNull()
    })
  })
})

// ─── Cold-Start Tests ──────────────────────────────────────────────

describe('Cold-Start Handling', () => {
  describe('assessConfidence', () => {
    it('returns insufficient for zero data points', async () => {
      const { assessConfidence } = await import('../cold-start')
      const result = assessConfidence(0, 15, 'test')
      expect(result.level).toBe('insufficient')
      expect(result.message).toContain('No data')
    })

    it('returns insufficient below minimum threshold', async () => {
      const { assessConfidence, THRESHOLDS } = await import('../cold-start')
      const result = assessConfidence(3, THRESHOLDS.MIN_ZSCORE_POINTS, 'zscore')
      expect(result.level).toBe('insufficient')
      expect(result.dataPoints).toBe(3)
    })

    it('returns low when data < 50% of required', async () => {
      const { assessConfidence } = await import('../cold-start')
      const result = assessConfidence(5, 20, 'test')
      expect(result.level).toBe('low')
    })

    it('returns medium when data >= 50% but < 100% of required', async () => {
      const { assessConfidence } = await import('../cold-start')
      const result = assessConfidence(12, 20, 'test')
      expect(result.level).toBe('medium')
    })

    it('returns high when data meets or exceeds threshold', async () => {
      const { assessConfidence } = await import('../cold-start')
      const result = assessConfidence(15, 15, 'test')
      expect(result.level).toBe('high')
    })

    it('returns high for excess data', async () => {
      const { assessConfidence } = await import('../cold-start')
      const result = assessConfidence(100, 15, 'test')
      expect(result.level).toBe('high')
    })
  })

  describe('domain-specific checks', () => {
    it('canUseZScore evaluates correctly', async () => {
      const { canUseZScore, THRESHOLDS } = await import('../cold-start')
      expect(canUseZScore(0).level).toBe('insufficient')
      expect(canUseZScore(4).level).toBe('insufficient')
      // 10 → ≥5 and between 50% and 100% of MIN_ZSCORE_POINTS(15)
      expect(canUseZScore(10).level).toBe('medium')
      expect(canUseZScore(THRESHOLDS.MIN_ZSCORE_POINTS).level).toBe('high')
      expect(canUseZScore(50).level).toBe('high')
    })

    it('canUseRegression evaluates correctly', async () => {
      const { canUseRegression, THRESHOLDS } = await import('../cold-start')
      expect(canUseRegression(4).level).toBe('insufficient')
      // 5 → ≥5 and ≥50% of MIN_REGRESSION_POINTS(10), but < 10 → medium
      expect(canUseRegression(5).level).toBe('medium')
      expect(canUseRegression(THRESHOLDS.MIN_REGRESSION_POINTS).level).toBe('high')
    })

    it('canUseSeasonalDecomposition evaluates correctly', async () => {
      const { canUseSeasonalDecomposition, THRESHOLDS } = await import('../cold-start')
      expect(canUseSeasonalDecomposition(0).level).toBe('insufficient')
      expect(canUseSeasonalDecomposition(4).level).toBe('insufficient')
      // MIN_SEASONAL_POINTS is 12; 10 → ≥5 and ≥50% (6) but <12 → medium
      expect(canUseSeasonalDecomposition(10).level).toBe('medium')
      expect(canUseSeasonalDecomposition(THRESHOLDS.MIN_SEASONAL_POINTS).level).toBe('high')
    })

    it('canUseAffinityMining evaluates correctly', async () => {
      const { canUseAffinityMining, THRESHOLDS } = await import('../cold-start')
      expect(canUseAffinityMining(0).level).toBe('insufficient')
      expect(canUseAffinityMining(4).level).toBe('insufficient')
      // 10 → ≥5 and <50% of MIN_AFFINITY_TRANSACTIONS(50) → low
      expect(canUseAffinityMining(10).level).toBe('low')
      expect(canUseAffinityMining(THRESHOLDS.MIN_AFFINITY_TRANSACTIONS).level).toBe('high')
    })

    it('canUseRFM evaluates correctly', async () => {
      const { canUseRFM, THRESHOLDS } = await import('../cold-start')
      expect(canUseRFM(0).level).toBe('insufficient')
      expect(canUseRFM(4).level).toBe('insufficient')
      // 5 → ≥5 and <50% of MIN_RFM_TRANSACTIONS(20) → low
      expect(canUseRFM(5).level).toBe('low')
      expect(canUseRFM(THRESHOLDS.MIN_RFM_TRANSACTIONS).level).toBe('high')
    })

    it('isColdStart checks product age', async () => {
      const { isColdStart } = await import('../cold-start')
      expect(isColdStart(0, 'new product').level).toBe('insufficient')
      expect(isColdStart(4, 'new product').level).toBe('insufficient')
      // 5 → ≥5 and <50% of COLD_START_DAYS(30) → low
      expect(isColdStart(5, 'new product').level).toBe('low')
      expect(isColdStart(60, 'mature product').level).toBe('high')
    })
  })

  describe('selectForecastMethod', () => {
    it('selects holt-winters with sufficient seasonal data', async () => {
      const { selectForecastMethod, THRESHOLDS } = await import('../cold-start')
      const result = selectForecastMethod(THRESHOLDS.MIN_HOLT_WINTERS_POINTS, true)
      expect(result.method).toBe('holt-winters')
      expect(result.confidence).toBe('high')
    })

    it('selects seasonal-decomposition with moderate seasonal data', async () => {
      const { selectForecastMethod, THRESHOLDS } = await import('../cold-start')
      // 25 points: >= MIN_SEASONAL_POINTS(12) but < MIN_HOLT_WINTERS_POINTS(30)
      const result = selectForecastMethod(25, true)
      expect(result.method).toBe('seasonal-decomposition')
      expect(result.confidence).toBe('medium')
    })

    it('selects linear-regression with enough non-seasonal data', async () => {
      const { selectForecastMethod } = await import('../cold-start')
      const result = selectForecastMethod(15, false)
      expect(result.method).toBe('linear-regression')
      expect(result.confidence).toBe('medium')
    })

    it('selects exponential-smoothing with minimal data', async () => {
      const { selectForecastMethod } = await import('../cold-start')
      const result = selectForecastMethod(5, false)
      expect(result.method).toBe('exponential-smoothing')
      expect(result.confidence).toBe('low')
    })

    it('selects sma with tiny data', async () => {
      const { selectForecastMethod } = await import('../cold-start')
      const result = selectForecastMethod(3, false)
      expect(result.method).toBe('sma')
    })

    it('returns none with no data', async () => {
      const { selectForecastMethod } = await import('../cold-start')
      const result = selectForecastMethod(0, false)
      expect(result.method).toBe('none')
      expect(result.confidence).toBe('insufficient')
    })
  })

  describe('getFallbackStrategy', () => {
    it('returns fallback for holt-winters', async () => {
      const { getFallbackStrategy } = await import('../cold-start')
      const fb = getFallbackStrategy('holt-winters')
      expect(fb).not.toBeNull()
      expect(fb!.fallbackTo).toBe('exponential-smoothing')
    })

    it('returns fallback for zscore-anomaly', async () => {
      const { getFallbackStrategy } = await import('../cold-start')
      const fb = getFallbackStrategy('zscore-anomaly')
      expect(fb).not.toBeNull()
      expect(fb!.fallbackTo).toBe('iqr')
    })

    it('returns null for unknown method', async () => {
      const { getFallbackStrategy } = await import('../cold-start')
      expect(getFallbackStrategy('unknown')).toBeNull()
    })
  })

  describe('confidenceWeight', () => {
    it('returns 0 for zero data', async () => {
      const { confidenceWeight } = await import('../cold-start')
      expect(confidenceWeight(0, 100)).toBe(0)
    })

    it('returns 1 when data meets threshold', async () => {
      const { confidenceWeight } = await import('../cold-start')
      expect(confidenceWeight(100, 100)).toBe(1)
    })

    it('returns proportional weight for partial data', async () => {
      const { confidenceWeight } = await import('../cold-start')
      expect(confidenceWeight(50, 100)).toBe(0.5)
      expect(confidenceWeight(25, 100)).toBe(0.25)
    })
  })

  describe('thresholds', () => {
    it('has all thresholds defined with positive values', async () => {
      const { THRESHOLDS } = await import('../cold-start')
      expect(THRESHOLDS.MIN_DATA_POINTS).toBeGreaterThan(0)
      expect(THRESHOLDS.MIN_ZSCORE_POINTS).toBeGreaterThan(0)
      expect(THRESHOLDS.MIN_SEASONAL_POINTS).toBeGreaterThan(0)
      expect(THRESHOLDS.MIN_HOLT_WINTERS_POINTS).toBeGreaterThan(0)
      expect(THRESHOLDS.MIN_REGRESSION_POINTS).toBeGreaterThan(0)
      expect(THRESHOLDS.MIN_AFFINITY_TRANSACTIONS).toBeGreaterThan(0)
      expect(THRESHOLDS.MIN_RFM_TRANSACTIONS).toBeGreaterThan(0)
      expect(THRESHOLDS.COLD_START_DAYS).toBe(30)
      expect(THRESHOLDS.BRANCH_COLD_START_DAYS).toBe(60)
    })
  })
})

// ─── Instrumentation Tests ─────────────────────────────────────────

describe('Performance Instrumentation', () => {
  beforeEach(async () => {
    const { resetMetrics } = await import('../instrumentation')
    resetMetrics()
  })

  describe('timed', () => {
    it('measures successful operations', async () => {
      const { timed, histograms } = await import('../instrumentation')
      const result = await timed('test.op', async () => {
        await new Promise(r => setTimeout(r, 5))
        return 42
      })
      expect(result).toBe(42)
      const h = histograms.getHistogram('test.op')
      expect(h).not.toBeNull()
      expect(h!.count).toBe(1)
      expect(h!.mean).toBeGreaterThan(0)
    })

    it('measures failed operations', async () => {
      const { timed, histograms } = await import('../instrumentation')
      await expect(timed('test.fail', async () => {
        await new Promise(r => setTimeout(r, 2))
        throw new Error('oops')
      })).rejects.toThrow('oops')
      const h = histograms.getHistogram('test.fail')
      expect(h).not.toBeNull()
      expect(h!.count).toBe(1)
    })
  })

  describe('timedSync', () => {
    it('measures synchronous operations', async () => {
      const { timedSync, histograms } = await import('../instrumentation')
      const result = timedSync('test.sync', () => 'hello')
      expect(result).toBe('hello')
      expect(histograms.getHistogram('test.sync')!.count).toBe(1)
    })
  })

  describe('generatePerformanceReport', () => {
    it('generates a report with histograms and metrics', async () => {
      const { timed, generatePerformanceReport } = await import('../instrumentation')
      await timed('report.test', async () => {
        await new Promise(r => setTimeout(r, 5))
        return 1
      })
      const report = generatePerformanceReport()
      expect(report.totalOperations).toBeGreaterThanOrEqual(1)
      expect(report.totalDurationMs).toBeGreaterThanOrEqual(0)
      expect(report.histograms.length).toBeGreaterThan(0)
      expect(report.since).toBeTruthy()
    })

    it('includes cache metrics', async () => {
      const { generatePerformanceReport } = await import('../instrumentation')
      const report = generatePerformanceReport()
      expect(Array.isArray(report.cacheMetrics)).toBe(true)
    })
  })
})

// ─── DB Utilities Tests ───────────────────────────────────────────

describe('DB Utilities', () => {
  describe('column selectors', () => {
    it('defines PRODUCT_SCORE_COLUMNS', async () => {
      const { PRODUCT_SCORE_COLUMNS } = await import('../db-utils')
      expect(PRODUCT_SCORE_COLUMNS).toContain('product_id')
      expect(PRODUCT_SCORE_COLUMNS).toContain('composite_score')
      expect(PRODUCT_SCORE_COLUMNS).not.toContain('*')
    })

    it('defines all column selectors without wildcards', async () => {
      const mod = await import('../db-utils')
      const selectors = [
        'PRODUCT_SCORE_COLUMNS', 'CUSTOMER_SCORE_COLUMNS', 'SUPPLIER_SCORE_COLUMNS',
        'BUSINESS_HEALTH_COLUMNS', 'PRODUCT_FORECAST_COLUMNS', 'REVENUE_FORECAST_COLUMNS',
        'SEASONALITY_COLUMNS', 'ACCURACY_LOG_COLUMNS', 'AFFINITY_COLUMNS', 'REORDER_COLUMNS',
      ]
      for (const name of selectors) {
        const val = mod[name as keyof typeof mod] as string
        expect(val).toBeTruthy()
        expect(val).not.toContain('*')
      }
    })
  })

  describe('chunkedUpsert', () => {
    it('returns without error for empty input', async () => {
      const { chunkedUpsert } = await import('../db-utils')
      // Should not throw for empty input
      await expect(chunkedUpsert('test', [])).resolves.not.toThrow()
    })
  })
})

// ─── Integration Tests ─────────────────────────────────────────────

describe('Cross-Layer Integration', () => {
  it('cache + cold-start: caches confidence assessments', async () => {
    const { piCache } = await import('../cache')
    const { assessConfidence } = await import('../cold-start')

    // First call — compute
    const result1 = assessConfidence(15, 15, 'integration-test')
    expect(result1.level).toBe('high')

    // Cache the result
    piCache.set('confidence:integration-test', result1, { ttlSeconds: 60 })

    // Retrieve from cache
    const cached = piCache.get<typeof result1>('confidence:integration-test')
    expect(cached).not.toBeNull()
    expect(cached!.level).toBe('high')
  })

  it('reliability + cache: retry on cache eviction', async () => {
    const { piCache } = await import('../cache')
    const { withRetry } = await import('../reliability')

    piCache.set('retry-test', 'cached-value', { ttlSeconds: 60 })
    expect(piCache.get('retry-test')).toBe('cached-value')

    piCache.del('retry-test')
    expect(piCache.get('retry-test')).toBeNull()

    const result = await withRetry(async () => 'fresh-value', { maxAttempts: 1, label: 'integration-retry' })
    expect(result).toBe('fresh-value')
  })

  it('cold-start + reliability: fallback on insufficient data', async () => {
    const { selectForecastMethod, getFallbackStrategy } = await import('../cold-start')
    const { resilientCall } = await import('../reliability')

    // Use a method that has a registered fallback: exponential-smoothing → sma
    const method = selectForecastMethod(5, false)
    expect(method.method).toBe('exponential-smoothing')

    const fallback = getFallbackStrategy(method.method)
    expect(fallback).not.toBeNull()
    expect(fallback!.fallbackTo).toBe('sma')

    // Simulate: primary method fails, fallback returns simpler method
    const result = await resilientCall(
      async () => {
        throw new Error('primary method failed')
      },
      { label: 'integration-fallback', maxAttempts: 1 },
      () => fallback!.fallbackTo,
    )
    expect(result).toBe('sma')
  })

  it('instrumentation tracks all operations', async () => {
    const { timed, generatePerformanceReport, resetMetrics } = await import('../instrumentation')
    resetMetrics()

    await timed('integration.op1', async () => 1)
    await timed('integration.op2', async () => 2)

    const report = generatePerformanceReport()
    expect(report.totalOperations).toBe(2)
    expect(report.histograms.length).toBe(2)
  })

  it('cache invalidation + reliability: invalidate then re-fetch', async () => {
    const { piCache } = await import('../cache')
    const { withRetry } = await import('../reliability')

    let dbCalls = 0
    const mockFetch = async (id: string) => {
      dbCalls++
      return { id, score: 95 }
    }

    // Set cache
    piCache.set('integration:prod-1', { id: 'prod-1', score: 95 }, { ttlSeconds: 60 })
    expect(piCache.get('integration:prod-1')).toEqual({ id: 'prod-1', score: 95 })

    // Invalidate
    piCache.delByPrefix('integration:')
    expect(piCache.get('integration:prod-1')).toBeNull()

    // Re-fetch with retry
    const result = await withRetry(() => mockFetch('prod-1'), { label: 'integration-refetch' })
    expect(result).toEqual({ id: 'prod-1', score: 95 })
    expect(dbCalls).toBe(1)
  })
})
