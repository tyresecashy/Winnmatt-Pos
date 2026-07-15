/**
 * Device Repository — Enterprise Core Data Access for Devices
 *
 * Encapsulates direct Supabase access for the devices table.
 * Callers (module facade, server actions) use this repository
 * instead of calling supabase directly.
 *
 * Constitution Reference: §5 (Module Architecture), §9 (Transaction & Event Rules)
 */

import { BaseRepository } from '@/lib/modules/core/repository'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DeviceRow {
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
  [key: string]: unknown
}

// ─── Repository ─────────────────────────────────────────────────────────────

export class DeviceRepository extends BaseRepository<DeviceRow> {
  constructor() {
    super('devices', {
      audit: { eventType: 'device.*', aggregateType: 'device' },
      lock: { resourcePrefix: 'device:' },
    })
  }

  /**
   * Get all devices, optionally filtered by branch, ordered by last_seen_at descending.
   */
  async getDevices(branchId?: string): Promise<DeviceRow[]> {
    let q = this.client
      .from('devices')
      .select('*')
      .order('last_seen_at', { ascending: false, nullsFirst: false })

    if (branchId) q = q.eq('branch_id', branchId)

    const { data, error } = await q
    if (error) throw this._toError(error, 'getDevices')
    return (data ?? []) as DeviceRow[]
  }

  /**
   * Get a single device by ID.
   */
  async getDevice(deviceId: string): Promise<DeviceRow | null> {
    const { data, error } = await this.client
      .from('devices')
      .select('*')
      .eq('id', deviceId)
      .single()

    if (error) {
      const errObj = error as { code?: string }
      if (errObj.code === 'PGRST116') return null
      throw this._toError(error, 'getDevice')
    }
    return (data ?? null) as DeviceRow | null
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

export const deviceRepo = new DeviceRepository()
