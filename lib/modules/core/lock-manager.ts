/**
 * Lock Manager — Enterprise concurrency protection
 *
 * Provides distributed locking for repository operations to prevent
 * concurrent mutations on the same resource. This baseline implementation
 * uses an in-memory Map; in production this would use Redis or Postgres
 * advisory locks.
 *
 * Constitution Reference: §9 (Transaction & Event Rules)
 */

const _locks = new Map<string, { holder: string; acquiredAt: Date }>()

/**
 * Acquire a lock on the given resource.
 * Throws if the lock is held by another holder.
 */
export async function acquireLock(resource: string, holder: string): Promise<void> {
  const existing = _locks.get(resource)
  if (existing && existing.holder !== holder) {
    throw new Error(`Resource ${resource} is locked by ${existing.holder} since ${existing.acquiredAt.toISOString()}`)
  }
  _locks.set(resource, { holder, acquiredAt: new Date() })
}

/**
 * Release a lock on the given resource.
 * Throws if the lock is not held by the given holder.
 */
export async function releaseLock(resource: string, holder: string): Promise<void> {
  const existing = _locks.get(resource)
  if (!existing) return
  if (existing.holder !== holder) {
    throw new Error(`Cannot release lock on ${resource}: held by ${existing.holder}, not ${holder}`)
  }
  _locks.delete(resource)
}

/**
 * Acquire a lock for the duration of the callback, then release.
 */
export async function withLock<T>(resource: string, holder: string, fn: () => Promise<T>): Promise<T> {
  await acquireLock(resource, holder)
  try {
    return await fn()
  } finally {
    await releaseLock(resource, holder).catch(() => {})
  }
}
