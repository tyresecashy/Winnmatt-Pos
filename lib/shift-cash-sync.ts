'use server'

import { logger } from '@/lib/logger'
import { supabaseAdmin } from '@/lib/supabase-server'

// ──────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────

/**
 * Ensure a register exists for a branch.
 * Returns the first online/offline register, or creates one if none exist.
 */
export async function ensureRegisterForBranch(branchId: string) {
  try {
    // Look for an existing register for this branch
    const { data: existing } = await supabaseAdmin
      .from('registers')
      .select('id, register_name')
      .eq('branch_id', branchId)
      .in('status', ['online', 'offline'])
      .order('register_name', { ascending: true })
      .limit(1)

    if (existing && existing.length > 0) {
      return existing[0]
    }

    // Auto-create a register for the branch
    const { data: branch } = await supabaseAdmin
      .from('branches')
      .select('name, code')
      .eq('id', branchId)
      .single()

    const registerName = branch
      ? `Register (${branch.name})`
      : `Register (${branchId.slice(0, 8)})`

    const { data: created, error } = await supabaseAdmin
      .from('registers')
      .insert({
        register_name: registerName,
        branch_id: branchId,
        register_type: 'stationary',
        status: 'offline',
      })
      .select('id, register_name')
      .single()

    if (error) throw error
    logger.info('[shift-cash-sync] Auto-created register', { registerId: created.id, branchId })
    return created
  } catch (error) {
    logger.error('[shift-cash-sync] Failed to ensure register', { branchId, error: (error as Error).message })
    return null
  }
}

/**
 * Ensure a cash drawer exists for a register.
 * Returns the first open/closed drawer, or creates one if none exist.
 */
export async function ensureDrawerForRegister(registerId: string, branchId: string) {
  try {
    const { data: existing } = await supabaseAdmin
      .from('cash_drawers')
      .select('id, drawer_name')
      .eq('register_id', registerId)
      .eq('branch_id', branchId)
      .order('drawer_name', { ascending: true })
      .limit(1)

    if (existing && existing.length > 0) {
      return existing[0]
    }

    const drawerName = `Drawer ${registerId.slice(0, 8)}`

    const { data: created, error } = await supabaseAdmin
      .from('cash_drawers')
      .insert({
        drawer_name: drawerName,
        register_id: registerId,
        branch_id: branchId,
        status: 'closed',
        current_balance: 0,
        expected_balance: 0,
        last_variance: 0,
      })
      .select('id, drawer_name')
      .single()

    if (error) throw error
    logger.info('[shift-cash-sync] Auto-created drawer', { drawerId: created.id, registerId })
    return created
  } catch (error) {
    logger.error('[shift-cash-sync] Failed to ensure drawer', { registerId, error: (error as Error).message })
    return null
  }
}

// ──────────────────────────────────────────────────
// Sync: Shift Open — Open drawer, record float
// ──────────────────────────────────────────────────

export interface SyncShiftOpenCashParams {
  shiftId: string
  branchId: string
  cashierId: string
  openingFloat: number
  registerId: string
  drawerId?: string
}

/**
 * Called when a shift is opened.
 * - Finds/creates a cash drawer for the register
 * - Opens the drawer, sets balance to opening float
 * - Records an opening_float cash event
 * - Sets the register online with the cashier assigned
 * - Updates the shift with register_id and drawer_id
 */
export async function syncShiftOpenCash(params: SyncShiftOpenCashParams) {
  const { shiftId, branchId, cashierId, openingFloat, registerId, drawerId } = params

  try {
    // 1. Resolve drawer
    let resolvedDrawerId = drawerId
    if (!resolvedDrawerId) {
      const drawer = await ensureDrawerForRegister(registerId, branchId)
      if (!drawer) {
        logger.warn('[shift-cash-sync] Could not resolve drawer, skipping open sync')
        return
      }
      resolvedDrawerId = drawer.id
    }

    const floatCents = Math.round(openingFloat)

    // 2. Record opening_float cash event
    const { error: eventError } = await supabaseAdmin
      .from('cash_events')
      .insert({
        register_id: registerId,
        drawer_id: resolvedDrawerId,
        branch_id: branchId,
        event_type: 'opening_float',
        amount: floatCents,
        balance_before: 0,
        balance_after: floatCents,
        reference_type: 'shift',
        reference_id: shiftId,
        reason: 'Shift opening float',
        performed_by: cashierId,
      })

    if (eventError) {
      logger.error('[shift-cash-sync] Failed to record opening_float event', { error: eventError.message })
    }

    // 3. Open drawer and set balance
    const { error: drawerError } = await supabaseAdmin
      .from('cash_drawers')
      .update({
        status: 'open',
        current_balance: floatCents,
      })
      .eq('id', resolvedDrawerId)

    if (drawerError) {
      logger.error('[shift-cash-sync] Failed to open drawer', { error: drawerError.message })
    }

    // 4. Set register online with cashier
    const { error: registerError } = await supabaseAdmin
      .from('registers')
      .update({
        status: 'online',
        current_cashier_id: cashierId,
        current_drawer_id: resolvedDrawerId,
      })
      .eq('id', registerId)

    if (registerError) {
      logger.error('[shift-cash-sync] Failed to update register', { error: registerError.message })
    }

    // 5. Link shift to register + drawer
    const { error: shiftUpdateError } = await supabaseAdmin
      .from('shifts')
      .update({
        register_id: registerId,
        drawer_id: resolvedDrawerId,
      })
      .eq('id', shiftId)

    if (shiftUpdateError) {
      logger.error('[shift-cash-sync] Failed to update shift with register/drawer', { error: shiftUpdateError.message })
    }

    logger.info('[shift-cash-sync] Shift open synced', {
      shiftId,
      registerId,
      drawerId: resolvedDrawerId,
      openingFloat: floatCents,
    })
  } catch (error) {
    // Non-fatal — shift already created, cash sync is additive
    logger.error('[shift-cash-sync] Unhandled error in syncShiftOpenCash', {
      shiftId,
      error: (error as Error).message,
    })
  }
}

// ──────────────────────────────────────────────────
// Sync: Cash Sale — Record cash event, update balance
// ──────────────────────────────────────────────────

export interface SyncCashSaleEventParams {
  saleId: string
  branchId: string
  amount: number
  shiftId: string
  cashierId: string
}

/**
 * Called after a cash sale is completed.
 * Looks up the shift to find register/drawer, then:
 * - Records a cash_sale event
 * - Updates drawer current_balance
 *
 * Safe to call even if shift has no register/drawer (noop).
 */
export async function syncCashSaleEvent(params: SyncCashSaleEventParams) {
  const { saleId, branchId, amount, shiftId, cashierId } = params

  try {
    // Get shift's register + drawer
    const { data: shift } = await supabaseAdmin
      .from('shifts')
      .select('register_id, drawer_id')
      .eq('id', shiftId)
      .single()

    if (!shift?.register_id || !shift?.drawer_id) {
      // Old shift without register link — skip
      return
    }

    // Get current drawer balance
    const { data: drawer } = await supabaseAdmin
      .from('cash_drawers')
      .select('current_balance')
      .eq('id', shift.drawer_id)
      .single()

    const balanceBefore = drawer?.current_balance ?? 0
    const saleAmount = Math.round(amount)
    const balanceAfter = balanceBefore + saleAmount

    // Record cash_sale event
    const { error: eventError } = await supabaseAdmin
      .from('cash_events')
      .insert({
        register_id: shift.register_id,
        drawer_id: shift.drawer_id,
        branch_id: branchId,
        event_type: 'cash_sale',
        amount: saleAmount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        reference_type: 'sale',
        reference_id: saleId,
        reason: 'Cash sale',
        performed_by: cashierId,
      })

    if (eventError) {
      logger.error('[shift-cash-sync] Failed to record cash_sale event', { error: eventError.message })
    }

    // Update drawer balance
    const { error: drawerError } = await supabaseAdmin
      .from('cash_drawers')
      .update({ current_balance: balanceAfter })
      .eq('id', shift.drawer_id)

    if (drawerError) {
      logger.error('[shift-cash-sync] Failed to update drawer balance', { error: drawerError.message })
    }
  } catch (error) {
    // Non-fatal — sale already completed
    logger.error('[shift-cash-sync] Unhandled error in syncCashSaleEvent', {
      saleId,
      shiftId,
      error: (error as Error).message,
    })
  }
}

// ──────────────────────────────────────────────────
// Sync: Shift Close — Count cash, close drawer, take register offline
// ──────────────────────────────────────────────────

export interface SyncShiftCloseCashParams {
  shiftId: string
  branchId: string
  cashierId: string
  countedCash: number
  expectedCash: number
  difference: number
  registerId: string
  drawerId: string
}

/**
 * Called when a shift is closed.
 * - Records a cash_count event with the final counted cash
 * - Records a drawer_close event
 * - Marks drawer as counted with variance
 * - Sets register offline
 */
export async function syncShiftCloseCash(params: SyncShiftCloseCashParams) {
  const { shiftId, branchId, cashierId, countedCash, expectedCash, difference, registerId, drawerId } = params

  try {
    const countedCents = Math.round(countedCash)
    const expectedCents = Math.round(expectedCash)
    const diffCents = Math.round(difference)

    // 1. Record cash_count event
    const { error: countEventError } = await supabaseAdmin
      .from('cash_events')
      .insert({
        register_id: registerId,
        drawer_id: drawerId,
        branch_id: branchId,
        event_type: 'cash_count',
        amount: countedCents,
        balance_before: expectedCents,
        balance_after: countedCents,
        reference_type: 'shift',
        reference_id: shiftId,
        reason: `Shift close count. Expected: ${expectedCents}, Counted: ${countedCents}, Diff: ${diffCents >= 0 ? `Over ${diffCents}` : `Short ${Math.abs(diffCents)}`}`,
        performed_by: cashierId,
      })

    if (countEventError) {
      logger.error('[shift-cash-sync] Failed to record cash_count event', { error: countEventError.message })
    }

    // 2. Record drawer_close event
    const { error: closeEventError } = await supabaseAdmin
      .from('cash_events')
      .insert({
        register_id: registerId,
        drawer_id: drawerId,
        branch_id: branchId,
        event_type: 'drawer_close',
        amount: 0,
        balance_before: countedCents,
        balance_after: countedCents,
        reference_type: 'shift',
        reference_id: shiftId,
        reason: 'Shift closed',
        performed_by: cashierId,
      })

    if (closeEventError) {
      logger.error('[shift-cash-sync] Failed to record drawer_close event', { error: closeEventError.message })
    }

    // 3. Update drawer: mark counted, record variance
    const { error: drawerError } = await supabaseAdmin
      .from('cash_drawers')
      .update({
        status: 'counted',
        current_balance: countedCents,
        expected_balance: expectedCents,
        last_variance: diffCents,
        last_counted_at: new Date().toISOString(),
        last_counted_by: cashierId,
      })
      .eq('id', drawerId)

    if (drawerError) {
      logger.error('[shift-cash-sync] Failed to close drawer', { error: drawerError.message })
    }

    // 4. Set register offline
    const { error: registerError } = await supabaseAdmin
      .from('registers')
      .update({
        status: 'offline',
        current_cashier_id: null,
        current_drawer_id: null,
      })
      .eq('id', registerId)

    if (registerError) {
      logger.error('[shift-cash-sync] Failed to take register offline', { error: registerError.message })
    }

    logger.info('[shift-cash-sync] Shift close synced', {
      shiftId,
      registerId,
      drawerId,
      countedCents,
      expectedCents,
      diffCents,
    })
  } catch (error) {
    // Non-fatal — shift already closed
    logger.error('[shift-cash-sync] Unhandled error in syncShiftCloseCash', {
      shiftId,
      error: (error as Error).message,
    })
  }
}
