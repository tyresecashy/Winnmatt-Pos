/**
 * Reliability Layer — Retry, timeout, circuit breaker for Product Intelligence.
 *
 * All external calls (Supabase, Redis, AI tools) go through these wrappers,
 * ensuring fault tolerance without altering business logic.
 *
 * Sprint 11F — Production Hardening.
 *
 * Design principles:
 * - Non-blocking: failures are isolated, never cascade
 * - Exponential backoff with jitter for retries
 * - Circuit breaker prevents thundering herd on degraded services
 * - Structured logging on every failure
 */

import { logger } from '@/lib/logger'

// ─── Types ──────────────────────────────────────────────────────

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number
  /** Base delay in ms (default: 200) */
  baseDelayMs?: number
  /** Maximum delay in ms (default: 5000) */
  maxDelayMs?: number
  /** Timeout in ms (default: 10000, passed to withTimeout) */
  timeoutMs?: number
  /** Label for logging */
  label?: string
}

export interface TimeoutOptions {
  /** Timeout in milliseconds (default: 10000) */
  timeoutMs?: number
  /** Label for logging */
  label?: string
}

export interface CircuitBreakerOptions {
  /** Failure threshold to open circuit (default: 5) */
  failureThreshold?: number
  /** Reset timeout in ms before trying half-open (default: 30000) */
  resetTimeoutMs?: number
  /** Label for logging */
  label?: string
}

type CircuitState = 'closed' | 'open' | 'half-open'

// ─── Retry ──────────────────────────────────────────────────────

/**
 * Execute an async function with retry + exponential backoff + jitter.
 *
 * @example
 * const data = await withRetry(() => supabaseAdmin.from('products').select('*'), { label: 'fetch-products' })
 */
export async function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? 3
  const baseDelayMs = options?.baseDelayMs ?? 200
  const maxDelayMs = options?.maxDelayMs ?? 5000
  const label = options?.label ?? 'unknown'

  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt === maxAttempts) {
        logger.warn(`[Retry] ${label} exhausted after ${maxAttempts} attempts`, { error })
        throw error
      }
      // Exponential backoff with jitter: delay = min(base * 2^(attempt-1) * (0.5 + random*0.5), maxDelay)
      const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1)
      const jitter = 0.5 + Math.random() * 0.5
      const delay = Math.min(exponentialDelay * jitter, maxDelayMs)

      logger.debug(`[Retry] ${label} attempt ${attempt}/${maxAttempts} failed, retrying in ${Math.round(delay)}ms`, {
        error,
        attempt,
        maxAttempts,
        delayMs: Math.round(delay),
      })

      await sleep(delay)
    }
  }

  // Should never reach here
  throw lastError as Error
}

// ─── Timeout ─────────────────────────────────────────────────────

/**
 * Execute an async function with a timeout guard.
 * Throws if the operation exceeds the timeout.
 *
 * @example
 * const data = await withTimeout(() => slowQuery(), { timeoutMs: 5000 })
 */
export async function withTimeout<T>(fn: () => Promise<T>, options?: TimeoutOptions): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? 10000
  const label = options?.label ?? 'unknown'

  const result = await Promise.race([
    fn(),
    sleep(timeoutMs).then(() => {
      throw new Error(`[Timeout] ${label} exceeded ${timeoutMs}ms`)
    }),
  ])

  return result
}

// ─── Circuit Breaker ────────────────────────────────────────────

/**
 * Simple circuit breaker for non-critical PI operations.
 * Prevents cascading failures when downstream services are degraded.
 *
 * State machine:
 *   CLOSED → (on failure threshold) → OPEN → (after reset timeout) → HALF-OPEN
 *   HALF-OPEN → (on success) → CLOSED
 *   HALF-OPEN → (on failure) → OPEN
 */
export class CircuitBreaker {
  private state: CircuitState = 'closed'
  private failureCount = 0
  private lastFailureTime = 0
  private successCount = 0
  private readonly failureThreshold: number
  private readonly resetTimeoutMs: number
  private readonly label: string

  constructor(options?: CircuitBreakerOptions) {
    this.failureThreshold = options?.failureThreshold ?? 5
    this.resetTimeoutMs = options?.resetTimeoutMs ?? 30000
    this.label = options?.label ?? 'unknown'
  }

  /** Get current state. */
  getState(): CircuitState {
    return this.state
  }

  /** Get failure count. */
  getFailureCount(): number {
    return this.failureCount
  }

  /**
   * Execute an operation through the circuit breaker.
   * Returns a fallback value if the circuit is open.
   */
  async call<T>(fn: () => Promise<T>, fallback?: () => T): Promise<T | null> {
    // Check if circuit is open
    if (this.state === 'open') {
      // Check if reset timeout has elapsed → half-open
      if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
        this.state = 'half-open'
        logger.info('[CircuitBreaker] half-open', { label: this.label })
      } else {
        logger.warn('[CircuitBreaker] circuit open, skipping', { label: this.label })
        return fallback ? fallback() : null
      }
    }

    try {
      const result = await fn()

      // Success — reset if half-open
      if (this.state === 'half-open') {
        this.successCount++
        if (this.successCount >= 2) {
          this.reset()
          logger.info('[CircuitBreaker] reset (closed)', { label: this.label })
        }
      } else {
        // In closed state, reset failure count on success
        this.failureCount = 0
      }

      return result
    } catch (error) {
      this.failureCount++
      this.lastFailureTime = Date.now()
      this.successCount = 0

      if (this.failureCount >= this.failureThreshold) {
        this.state = 'open'
        logger.warn('[CircuitBreaker] opened', {
          label: this.label,
          failureCount: this.failureCount,
          threshold: this.failureThreshold,
        })
      }

      if (fallback) {
        logger.debug('[CircuitBreaker] returning fallback', { label: this.label, error })
        return fallback()
      }

      throw error
    }
  }

  /** Reset to closed state. */
  reset(): void {
    this.state = 'closed'
    this.failureCount = 0
    this.successCount = 0
  }
}

// ─── Compound Wrapper ───────────────────────────────────────────

/**
 * Execute an operation with retry + timeout + circuit breaker protection.
 * The standard wrapper for all PI database operations.
 *
 * @example
 * const data = await resilientCall(
 *   () => scoringRepository.getProductScore('prod-123'),
 *   { label: 'get-product-score' },
 *   () => null, // fallback
 * )
 */
export async function resilientCall<T>(
  fn: () => Promise<T>,
  options?: RetryOptions & { circuitBreaker?: CircuitBreaker },
  fallback?: () => T,
): Promise<T | null> {
  const label = options?.label ?? 'unknown'
  const cb = options?.circuitBreaker

  const execute = async (): Promise<T | null> => {
    if (cb) {
      return cb.call(
        () =>
          withTimeout(
            () => withRetry(fn, { ...options, maxAttempts: Math.min(options?.maxAttempts ?? 3, 2) }),
            { timeoutMs: options?.timeoutMs ?? 10000, label },
          ),
        fallback,
      )
    }

    // Without circuit breaker
    try {
      return await withTimeout(
        () => withRetry(fn, options),
        { timeoutMs: options?.timeoutMs ?? 10000, label },
      )
    } catch (err) {
      if (fallback) return fallback()
      throw err
    }
  }

  return execute()
}

// ─── Utility ────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
