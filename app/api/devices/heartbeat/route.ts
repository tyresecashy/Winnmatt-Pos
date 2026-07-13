import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { authenticateRequest } from '@/lib/auth-helpers'
import { publish } from '@/lib/realtime/event-bus'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { deviceId, ipAddress, appVersion } = body

    if (!deviceId) {
      return NextResponse.json({ error: 'deviceId is required' }, { status: 400 })
    }

    const { data: device, error: fetchError } = await supabaseAdmin
      .from('devices')
      .select('id, name, status')
      .eq('id', deviceId)
      .single()

    if (fetchError || !device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 })
    }

    const now = new Date().toISOString()
    const updates: Record<string, unknown> = {
      status: 'online',
      last_seen_at: now,
    }
    if (ipAddress) updates.ip_address = ipAddress
    if (appVersion) updates.app_version = appVersion

    const { error: updateError } = await supabaseAdmin
      .from('devices')
      .update(updates)
      .eq('id', deviceId)

    if (updateError) throw updateError

    if (device.status !== 'online') {
      publish({
        type: 'device.status',
        source: 'system',
        entityType: 'device',
        entityId: deviceId,
        payload: { deviceId, status: 'online', lastSeenAt: now, deviceName: device.name },
        timestamp: Date.now(),
      })
    }

    return NextResponse.json({
      success: true,
      lastSeenAt: now,
      status: 'online',
    })
  } catch (error) {
    logger.error('[Heartbeat] Unexpected error', { error })
    return NextResponse.json(
      { error: 'Heartbeat failed' },
      { status: 500 }
    )
  }
}
