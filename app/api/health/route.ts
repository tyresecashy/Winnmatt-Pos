import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { isRedisConfigured } from '@/lib/realtime/event-bus'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/** Maximum time (ms) the health check DB query is allowed to take. */
const DB_TIMEOUT_MS = 5_000

/**
 * Execute an async function with a deadline.
 * Timer is always cleaned up — no leaks.
 * Pattern matches the existing timeout in complete-payment-action.ts
 * but with explicit timer cleanup.
 */
async function withTimeout<T>(fn: () => Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`[Timeout] ${label} exceeded ${timeoutMs}ms`))
    }, timeoutMs)
  })

  try {
    return await Promise.race([fn(), timeoutPromise])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export async function GET() {
  const start = Date.now()

  let dbOk = false
  let dbError: string | null = null
  let timedOut = false

  try {
    const { error } = await withTimeout(
      async () => supabaseAdmin.from('health_check').select('id').limit(1).maybeSingle(),
      DB_TIMEOUT_MS,
      'Health DB query'
    )
    dbOk = !error
    if (error) {
      logger.error('[Health] DB query failed', { message: error.message })
      dbError = 'Database error occurred'
    }
  } catch (err) {
    dbOk = false
    if (err instanceof Error && err.message.includes('[Timeout]')) {
      timedOut = true
      dbError = 'Database query timed out'
      logger.error('[Health] DB query timed out', { elapsedMs: Date.now() - start })
    } else {
      dbError = 'Database error occurred'
      logger.error('[Health] DB query failed unexpectedly', { message: err instanceof Error ? err.message : String(err) })
    }
  }

  const eventBusMode = isRedisConfigured() ? 'redis' : 'in-memory'
  const elapsed = Date.now() - start
  const healthy = dbOk

  if (!healthy && !timedOut) {
    logger.error('[Health] Health check failed', { dbError, elapsedMs: elapsed })
  }

  return NextResponse.json({
    status: healthy ? 'healthy' : 'degraded',
    database: { ok: dbOk, error: dbError },
    eventBus: { mode: eventBusMode },
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    elapsedMs: elapsed,
  }, { status: healthy ? 200 : 503 })
}
