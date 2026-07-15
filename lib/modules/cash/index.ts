/**
 * Cash Module — Public API
 *
 * Manages registers, cash drawers, cash events, and shifts.
 * Other modules should ONLY import from this file.
 *
 * Implementation: Delegates to lib/cash-actions.ts and lib/shift-actions.ts.
 */

import { logger } from '@/lib/logger'
import * as cash from '@/lib/cash-actions'
import * as shiftActions from '@/lib/shift-actions'

// ─── Type helpers ─────────────────────────────────────────────────────────────
type RegisterRow = Awaited<ReturnType<typeof cash.getRegisters>>[number]
type RegisterResult = Awaited<ReturnType<typeof cash.getRegisterById>>
type CashDrawerRow = Awaited<ReturnType<typeof cash.getCashDrawers>>[number]
type CashEventRow = Awaited<ReturnType<typeof cash.getCashEvents>>[number]
type CashSummaryResult = Awaited<ReturnType<typeof cash.getCashSummary>>
type ShiftResult = Awaited<ReturnType<typeof shiftActions.getActiveShift>>
type ShiftSummaryResult = Awaited<ReturnType<typeof shiftActions.getShiftSummary>>
type ShiftHistoryRow = Awaited<ReturnType<typeof shiftActions.getShiftHistory>>[number]

// ─── Public API - Registers ─────────────────────────────────────────────────

export async function getRegisters(branchId?: string): Promise<RegisterRow[]> {
  try {
    return await cash.getRegisters(branchId)
  } catch (error) {
    logger.error('[Cash Module] getRegisters failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function getRegisterById(id: string): Promise<RegisterResult> {
  try {
    return await cash.getRegisterById(id)
  } catch (error) {
    logger.error('[Cash Module] getRegisterById failed', error instanceof Error ? error.message : String(error))
    return null
  }
}

export async function createRegister(data: Record<string, unknown>): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const result = await cash.createRegister(data as Parameters<typeof cash.createRegister>[0])
    if (!result.success) return { success: false, error: result.error }
    return { success: true, id: result.data?.id }
  } catch (error) {
    logger.error('[Cash Module] createRegister failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function updateRegister(id: string, data: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  try {
    return await cash.updateRegister(id, data)
  } catch (error) {
    logger.error('[Cash Module] updateRegister failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Public API - Cash Drawers ──────────────────────────────────────────────

export async function getCashDrawers(branchId: string): Promise<CashDrawerRow[]> {
  try {
    return await cash.getCashDrawers(branchId)
  } catch (error) {
    logger.error('[Cash Module] getCashDrawers failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function createCashDrawer(data: Record<string, unknown>): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const result = await cash.createCashDrawer(data as Parameters<typeof cash.createCashDrawer>[0])
    if (!result.success) return { success: false, error: result.error }
    return { success: true, id: result.data?.id }
  } catch (error) {
    logger.error('[Cash Module] createCashDrawer failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Public API - Cash Events ───────────────────────────────────────────────

export async function getCashEvents(branchId: string, opts?: { drawerId?: string; limit?: number; eventType?: string }): Promise<CashEventRow[]> {
  try {
    return await cash.getCashEvents(branchId, opts)
  } catch (error) {
    logger.error('[Cash Module] getCashEvents failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function recordCashEvent(data: Record<string, unknown>): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const result = await cash.recordCashEvent(data as Parameters<typeof cash.recordCashEvent>[0])
    if (!result.success) return { success: false, error: result.error }
    return { success: true, id: result.data?.id }
  } catch (error) {
    logger.error('[Cash Module] recordCashEvent failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function getCashSummary(branchId: string): Promise<CashSummaryResult> {
  try {
    return await cash.getCashSummary(branchId)
  } catch (error) {
    logger.error('[Cash Module] getCashSummary failed', error instanceof Error ? error.message : String(error))
    return null
  }
}

// ─── Public API - Shifts ────────────────────────────────────────────────────

export async function openShift(branchId: string, cashierId: string, openingFloat: number, registerId?: string, drawerId?: string): Promise<{ success: boolean; id?: string; shift?: Record<string, unknown>; message?: string; error?: string }> {
  try {
    const result = await shiftActions.openShift(branchId, cashierId, openingFloat, registerId, drawerId)
    if (!result.success) return { success: false, error: result.error }
    return { success: true, id: result.shift?.id, shift: result.shift, message: result.message }
  } catch (error) {
    logger.error('[Cash Module] openShift failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function getActiveShift(branchId: string, cashierId: string): Promise<ShiftResult> {
  try {
    return await shiftActions.getActiveShift(branchId, cashierId)
  } catch (error) {
    logger.error('[Cash Module] getActiveShift failed', error instanceof Error ? error.message : String(error))
    return null
  }
}

export async function closeShift(shiftId: string, countedCash: number, closingNotes: string, cashierId: string): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const result = await shiftActions.closeShift(shiftId, countedCash, closingNotes, cashierId)
    if (!result.success) return { success: false, error: result.error }
    return { success: true, message: result.message }
  } catch (error) {
    logger.error('[Cash Module] closeShift failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function getShiftSummary(shiftId: string): Promise<ShiftSummaryResult> {
  try {
    return await shiftActions.getShiftSummary(shiftId)
  } catch (error) {
    logger.error('[Cash Module] getShiftSummary failed', error instanceof Error ? error.message : String(error))
    return null
  }
}

export async function getShiftHistory(branchId: string, limit?: number): Promise<ShiftHistoryRow[]> {
  try {
    return await shiftActions.getShiftHistory(branchId, limit)
  } catch (error) {
    logger.error('[Cash Module] getShiftHistory failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function reopenShift(shiftId: string, userId: string, reason: string): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const result = await shiftActions.reopenShift(shiftId, userId, reason)
    if (!result.success) return { success: false, error: result.error }
    return { success: true, message: result.message }
  } catch (error) {
    logger.error('[Cash Module] reopenShift failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}
