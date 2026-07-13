'use server'

import { supabaseAdmin } from '@/lib/supabase-server'
import { authenticateServerAction } from '@/lib/auth-helpers'
import { logger } from '@/lib/logger'
import { publish } from '@/lib/realtime/event-bus'

export interface Device {
  id: string
  name: string
  device_type: 'pos_terminal' | 'tablet' | 'mobile' | 'kiosk' | 'other'
  branch_id: string
  register_id: string | null
  app_version: string | null
  ip_address: string | null
  status: 'online' | 'offline' | 'idle'
  last_seen_at: string | null
  first_seen_at: string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export async function getDevices(branchId?: string): Promise<Device[]> {
  await authenticateServerAction()
  let q = supabaseAdmin.from('devices').select('*').order('last_seen_at', { ascending: false, nullsFirst: false })
  if (branchId) q = q.eq('branch_id', branchId)
  const { data, error } = await q
  if (error) {
    if (error) logger.error('Operation failed', { error: error })
    throw new Error('Operation failed')
  }
  return (data || []) as Device[]
}

export async function getDevice(deviceId: string): Promise<Device | null> {
  await authenticateServerAction()
  const { data, error } = await supabaseAdmin.from('devices').select('*').eq('id', deviceId).single()
  if (error) return null
  return data as Device
}

export async function registerDevice(input: {
  name: string
  device_type: Device['device_type']
  branch_id: string
  app_version?: string
}): Promise<{ success: boolean; device?: Device; error?: string }> {
  try {
    const { profile } = await authenticateServerAction()
    if (!profile) return { success: false, error: 'Unauthorized' }

    const ip = 'unknown'

    const { data, error } = await supabaseAdmin
      .from('devices')
      .insert({
        name: input.name,
        device_type: input.device_type,
        branch_id: input.branch_id,
        app_version: input.app_version || null,
        ip_address: ip,
        status: 'online',
        last_seen_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error

    return { success: true, device: data as Device }
  } catch (error) {
    logger.error('Operation failed', { error: error })
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function updateDeviceStatus(
  deviceId: string,
  status: Device['status'],
  ipAddress?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const updates: Partial<Device> = {
      status,
      last_seen_at: new Date().toISOString(),
    }
    if (ipAddress) updates.ip_address = ipAddress

    const { error } = await supabaseAdmin
      .from('devices')
      .update(updates)
      .eq('id', deviceId)

    if (error) throw error

    publish({
      type: 'device.status',
      source: 'system',
      entityType: 'device',
      entityId: deviceId,
      payload: { deviceId, status, lastSeenAt: updates.last_seen_at },
      timestamp: Date.now(),
    })

    return { success: true }
  } catch (error) {
    logger.error('Operation failed', { error: error })
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function deactivateDevice(deviceId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { profile } = await authenticateServerAction()
    if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
      return { success: false, error: 'Only admins can deactivate devices' }
    }
    return updateDeviceStatus(deviceId, 'offline')
  } catch (error) {
    logger.error('Operation failed', { error: error })
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function getDevicesByBranch(branchId: string): Promise<{
  online: Device[]
  offline: Device[]
  idle: Device[]
}> {
  const devices = await getDevices(branchId)
  return {
    online: devices.filter(d => d.status === 'online'),
    offline: devices.filter(d => d.status === 'offline'),
    idle: devices.filter(d => d.status === 'idle'),
  }
}
