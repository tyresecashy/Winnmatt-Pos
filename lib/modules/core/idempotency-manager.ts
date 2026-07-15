/**
 * Idempotency Manager — Duplicate operation prevention
 *
 * Ensures that operations with the same idempotency key are only
 * processed once. In production this would use Redis with TTL-based
 * expiry. This baseline implementation uses an in-memory Set.
 *
 * Constitution Reference: §9 (Transaction & Event Rules)
 */

const _processedKeys = new Set<string>()

/**
 * Check whether the given key has already been processed.
 * Returns true if the operation should be rejected (already processed).
 */
export function isIdempotent(key: string): boolean {
  if (_processedKeys.has(key)) return true
  _processedKeys.add(key)
  return false
}

/**
 * Remove an idempotency key (for testing or error recovery).
 */
export function removeIdempotencyKey(key: string): void {
  _processedKeys.delete(key)
}

/**
 * Clear all idempotency keys (e.g. for testing).
 */
export function clearIdempotencyKeys(): void {
  _processedKeys.clear()
}
