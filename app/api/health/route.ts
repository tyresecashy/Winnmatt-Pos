import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { isRedisConfigured } from '@/lib/realtime/event-bus'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET() {
  const start = Date.now()

  let dbOk = false
  let dbError: string | null = null

  try {
    const { error } = await (supabaseAdmin as any).from('health_check').select('id').limit(1).maybeSingle()
    dbOk = !error
    if (error) { logger.error('[Health] DB query failed', { message: error.message }); dbError = 'Database error occurred' }
  } catch (err) {
    dbOk = false
    dbError = 'Database error occurred'
  }

  const eventBusMode = isRedisConfigured() ? 'redis' : 'in-memory'
  const elapsed = Date.now() - start
  const healthy = dbOk

  if (!healthy) {
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
