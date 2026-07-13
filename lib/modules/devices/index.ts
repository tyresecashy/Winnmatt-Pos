/**
 * Devices Module — Public API
 *
 * Manages POS devices.
 * Other modules should ONLY import from this file.
 *
 * Implementation: Delegates to lib/device-actions.ts.
 */

import { logger } from '@/lib/logger'
import * as deviceActions from '@/lib/device-actions'

// ─── Type helpers ─────────────────────────────────────────────────────────────
type DeviceRow = Awaited<ReturnType<typeof deviceActions.getDevices>>[number]

// ─── Public API - Devices ───────────────────────────────────────────────────

export async function getDevices(branchId?: string): Promise<DeviceRow[]> {
  try {
    return await deviceActions.getDevices(branchId)
  } catch (error) {
    logger.error('[Devices Module] getDevices failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function registerDevice(data: Record<string, unknown>): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    return await deviceActions.registerDevice(data as Parameters<typeof deviceActions.registerDevice>[0])
  } catch (error) {
    logger.error('[Devices Module] registerDevice failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export type { Device } from '@/lib/device-actions'
