/**
 * Business Clock — Enterprise time source
 *
 * Provides the authoritative time for business operations.
 * In production this may return a configurable business time
 * (e.g. "what time is it at HQ") rather than the server's local time.
 *
 * Constitution Reference: §5 (Module Architecture)
 */

/**
 * Returns the current business time.
 * In this baseline implementation it returns `new Date()`.
 * In production this would consult a timezone configuration.
 */
export function now(): Date {
  return new Date()
}
