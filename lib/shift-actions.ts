'use server'

import { logger } from '@/lib/logger'
import { emitEvent } from '@/lib/automation'
import { supabaseAdmin } from '@/lib/supabase-server'
import { syncShiftOpenCash, syncShiftCloseCash } from '@/lib/shift-cash-sync'

/**
 * OPEN SHIFT - Start a new cashier shift
 * - Creates shift record
 * - Records opening float
 * - Ties shift to cashier and branch
 * - Syncs with register/drawer cash management
 * - Can only open one shift per cashier per day
 */
export async function openShift(
  branchId: string,
  cashierId: string,
  openingFloat: number, // in KES
  registerId?: string,
  drawerId?: string
) {
  try {
    // Validation 1: Check if cashier already has open shift today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data: existingShift, error: checkError } = await supabaseAdmin
      .from('shifts')
      .select('id, shift_number')
      .eq('cashier_id', cashierId)
      .eq('branch_id', branchId)
      .eq('status', 'open')
      .gte('opened_at', today.toISOString())
      .lt('opened_at', tomorrow.toISOString())
      .single()

    // If query found an open shift, error - if error is "no rows", that's OK
    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError
    }

    if (existingShift) {
      throw new Error(`Cashier already has an open shift: ${existingShift.shift_number}`)
    }

    // Validation 2: Get branch name for shift number
    const { data: branch, error: branchError } = await supabaseAdmin
      .from('branches')
      .select('code')
      .eq('id', branchId)
      .single()

    if (branchError) throw new Error('Branch not found')

    // Validation 3: Generate shift number (BRANCH-YYYY-MM-DD-SEQ)
    const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
    const branchCode = branch.code || 'XX'

    // Count existing shifts for this branch today to get sequence number
    const { data: shiftsToday, error: countError } = await supabaseAdmin
      .from('shifts')
      .select('id', { count: 'exact' })
      .eq('branch_id', branchId)
      .gte('opened_at', today.toISOString())
      .lt('opened_at', tomorrow.toISOString())

    if (countError && countError.code !== 'PGRST116') throw countError

    const sequence = ((shiftsToday?.length || 0) + 1).toString().padStart(2, '0');
    const shiftNumber = `${branchCode}-${dateStr}-${sequence}`;

    // Step 1: Create shift record
    const { data: newShift, error: createError } = await supabaseAdmin
      .from('shifts')
      .insert({
        branch_id: branchId,
        cashier_id: cashierId,
        shift_number: shiftNumber,
        opened_at: new Date().toISOString(),
        opening_float: Math.round(openingFloat),
        status: 'open',
      })
      .select()
      .single()

    if (createError) throw createError

    // Step 2: Create opening ledger entry (records opening float as the starting point)
    const { error: ledgerError } = await supabaseAdmin
      .from('shift_ledgers')
      .insert({
        shift_id: newShift.id,
        action: 'opening',
        counted_cash: Math.round(openingFloat),
        expected_cash: Math.round(openingFloat), // At opening, expected = counted (no sales yet)
        difference: 0, // No difference at start
        payment_breakdown: {
          cash_opening: Math.round(openingFloat),
          card: 0,
          mpesa: 0,
          cheque: 0,
          bank_transfer: 0,
          credit: 0,
        },
        recorded_by: cashierId,
      })

    if (ledgerError) throw ledgerError

    // Step 3: Create audit log entry
    const { error: auditError } = await supabaseAdmin
      .from('shift_audit_log')
      .insert({
        shift_id: newShift.id,
        action: 'opened',
        performed_by: cashierId,
        notes: `Opening float: KShs ${openingFloat.toFixed(2)}`,
        details: {
          opening_float: openingFloat,
        },
      })

    if (auditError) throw auditError

    // Step 4: Sync with cash management (register/drawer) if a register was selected
    if (registerId) {
      await syncShiftOpenCash({
        shiftId: newShift.id,
        branchId,
        cashierId,
        openingFloat,
        registerId,
        drawerId,
      })
    }

    // Emit automation event (fire-and-forget)
    emitEvent({
      eventType: 'shift.opened',
      source: 'shift',
      entityType: 'shift',
      entityId: newShift.id,
      payload: {
        shiftId: newShift.id,
        branchId,
        cashierId,
        openingFloat: Math.round(openingFloat),
      },
    }).catch(err => logger.warn('[Automation] Failed to emit shift.opened', { error: err.message }))

    return {
      success: true,
      shift: newShift,
      message: `Shift ${shiftNumber} opened successfully`,
    }
  } catch (error) {
    logger.error('Error opening shift:', error)
    return {
      success: false,
      error: 'Operation failed. Please try again.',
    }
  }
}

/**
 * GET ACTIVE SHIFT - Get current open shift for a cashier
 */
export async function getActiveShift(branchId: string, cashierId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('shifts')
      .select(`
        *,
        cashier:users!cashier_id(id, full_name),
        branch:branches!branch_id(id, name),
        register:registers!register_id(id, register_name),
        drawer:cash_drawers!drawer_id(id, drawer_name)
      `)
      .eq('branch_id', branchId)
      .eq('cashier_id', cashierId)
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') throw error

    return data || null
  } catch (error) {
    logger.error('Error fetching active shift:', error)
    return null
  }
}

/**
 * CLOSE SHIFT - Complete a shift and record reconciliation
 * - Records counted cash
 * - Calculates expected vs actual
 * - Detects over/short
 * - Records all metrics
 */
export async function closeShift(
  shiftId: string,
  countedCash: number, // Actual cash counted in drawer (in KES)
  closingNotes: string,
  cashierId: string
) {
  try {
    // Validation 1: Fetch shift details
    const { data: shift, error: shiftError } = await supabaseAdmin
      .from('shifts')
      .select('*')
      .eq('id', shiftId)
      .single()

    if (shiftError) throw new Error('Shift not found')
    if (shift.status !== 'open') throw new Error(`Cannot close an already ${shift.status} shift`)
    if (shift.cashier_id !== cashierId) {
      throw new Error('Can only close your own shift')
    }

    // Validation 2: Get all sales for this shift (non-voided)
    // NOTE: For existing sales without shift_id FK (requires migration), we use timestamp-based matching.
    // There is a small race window: a sale could be created between query time and shift close.
    // The .lte('created_at', new Date().toISOString()) caps the time window to minimize this.
    // A future migration adding shift_id FK would eliminate this race condition entirely.
    const { data: shiftSales, error: salesError } = await supabaseAdmin
      .from('sales')
      .select('id, payment_method, total_amount, sale_status')
      .eq('cashier_id', cashierId)
      .eq('branch_id', shift.branch_id)
      .eq('payment_status', 'completed')
      .gte('created_at', shift.opened_at)
      .neq('sale_status', 'voided') // Exclude voided from counts
      .neq('sale_status', 'returned') // Exclude returned from counts
      .lte('created_at', new Date().toISOString()) // Sales up to now

    if (salesError) throw salesError

    const sales = shiftSales || []

    // Calculate expected cash in drawer
    // = opening_float + cash_sales - (card + mpesa + other methods)
    let cashSalesTotal = 0;
    let cardTotal = 0;
    let mpesaTotal = 0;
    let chequeTotal = 0;
    let bankTransferTotal = 0;
    let creditTotal = 0;

    sales.forEach((sale) => {
      if (sale.payment_method === 'cash') {
        cashSalesTotal += sale.total_amount;
      } else if (sale.payment_method === 'card') {
        cardTotal += sale.total_amount;
      } else if (sale.payment_method === 'mpesa') {
        mpesaTotal += sale.total_amount;
      } else if (sale.payment_method === 'cheque') {
        chequeTotal += sale.total_amount;
      } else if (sale.payment_method === 'bank_transfer') {
        bankTransferTotal += sale.total_amount;
      } else if (sale.payment_method === 'credit') {
        creditTotal += sale.total_amount;
      }
    })

    // Expected formula: opening_float + cash_sales - non_cash (card is not added to cash drawer)
    // Actually: opening_float + cash_sales = expected
    // Because cash sales ADD to drawer, non-cash payments are not in drawer
    const expectedCash = shift.opening_float + cashSalesTotal;
    const difference = countedCash - expectedCash; // positive = over, negative = short

    // Step 1: Update shift as closed
    const { error: updateError } = await supabaseAdmin
      .from('shifts')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        closing_notes: closingNotes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', shiftId)

    if (updateError) throw updateError

    // Step 2: Create closing ledger entry
    const { error: ledgerError } = await supabaseAdmin
      .from('shift_ledgers')
      .insert({
        shift_id: shiftId,
        action: 'closing',
        counted_cash: Math.round(countedCash),
        expected_cash: Math.round(expectedCash),
        difference: Math.round(difference),
        payment_breakdown: {
          opening_float: shift.opening_float,
          cash_sales: cashSalesTotal,
          card_sales: cardTotal,
          mpesa_sales: mpesaTotal,
          cheque_sales: chequeTotal,
          bank_transfer_sales: bankTransferTotal,
          credit_sales: creditTotal,
          expected_cash: expectedCash,
          counted_cash: countedCash,
          difference: difference,
        },
        recorded_by: cashierId,
        notes: closingNotes,
      })

    if (ledgerError) throw ledgerError

    // Step 3: Create audit log entry
    const { error: auditError } = await supabaseAdmin
      .from('shift_audit_log')
      .insert({
        shift_id: shiftId,
        action: 'closed',
        performed_by: cashierId,
        notes: `Shift closed. Over/Short: KShs ${difference.toFixed(2)}${difference > 0 ? ' OVER' : difference < 0 ? ' SHORT' : ''}`,
        details: {
          opening_float: shift.opening_float,
          cash_sales: cashSalesTotal,
          expected_cash: expectedCash,
          counted_cash: countedCash,
          difference: difference,
          transaction_count: sales.length,
        },
      })

    if (auditError) throw auditError

    // Step 4: Sync with cash management (register/drawer) if the shift is linked to one
    if (shift.register_id && shift.drawer_id) {
      await syncShiftCloseCash({
        shiftId,
        branchId: shift.branch_id,
        cashierId,
        countedCash,
        expectedCash,
        difference,
        registerId: shift.register_id,
        drawerId: shift.drawer_id,
      })
    }

    // Emit automation event (fire-and-forget)
    emitEvent({
      eventType: 'shift.closed',
      source: 'shift',
      entityType: 'shift',
      entityId: shiftId,
      payload: {
        shiftId,
        branchId: shift.branch_id,
        cashierId,
        openingFloat: shift.opening_float,
        cashSalesTotal,
        expectedCash,
        countedCash,
        difference,
        transactionCount: sales.length,
      },
    }).catch(err => logger.warn('[Automation] Failed to emit shift.closed', { error: err.message }))

    return {
      success: true,
      shift: {
        id: shiftId,
        shift_number: shift.shift_number,
        opening_float: shift.opening_float,
        cashSalesTotal,
        cardTotal,
        mpesaTotal,
        expectedCash,
        countedCash,
        difference,
        transactionCount: sales.length,
        closedAt: new Date().toISOString(),
      },
      message: `Shift closed successfully. ${difference === 0 ? 'Perfect reconciliation!' : difference > 0 ? `Over by KShs ${difference.toFixed(2)}` : `Short by KShs ${Math.abs(difference).toFixed(2)}`}`,
    }
  } catch (error) {
    logger.error('Error closing shift:', error)
    return {
      success: false,
      error: 'Operation failed. Please try again.',
    }
  }
}

/**
 * GET SHIFT SUMMARY - View complete shift details and reconciliation
 */
export async function getShiftSummary(shiftId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('shift_summaries')
      .select('*')
      .eq('id', shiftId)
      .single()

    if (error && error.code !== 'PGRST116') throw error

    if (!data) return null

    // Get ledger entries for this shift
    const { data: ledgers } = await supabaseAdmin
      .from('shift_ledgers')
      .select('*')
      .eq('shift_id', shiftId)
      .order('created_at', { ascending: true })

    // Get audit log  
    const { data: auditLog } = await supabaseAdmin
      .from('shift_audit_log')
      .select('*')
      .eq('shift_id', shiftId)
      .order('created_at', { ascending: true })

    return {
      ...data,
      ledgers: ledgers || [],
      auditLog: auditLog || [],
    }
  } catch (error) {
    logger.error('Error fetching shift summary:', error)
    return null
  }
}

/**
 * GET SHIFT HISTORY - View all shifts for a branch
 */
export async function getShiftHistory(branchId: string, limit: number = 20) {
  try {
    const { data, error } = await supabaseAdmin
      .from('shift_summaries')
      .select('*')
      .eq('branch_id', branchId)
      .order('opened_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return data || []
  } catch (error) {
    logger.error('Error fetching shift history:', error)
    return []
  }
}

/**
 * REOPEN SHIFT - Allow manager/admin to reopen a closed shift (with audit trail)
 * - Only manager/admin can reopen
 * - Must provide reason
 * - Previous closing data preserved
 */
export async function reopenShift(
  shiftId: string,
  userId: string,
  reopenReason: string
) {
  try {
    // Validation 1: Check user permissions
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('role, branch_id')
      .eq('id', userId)
      .single()

    if (userError) throw new Error('User not found')
    if (!['manager', 'admin'].includes(userData.role)) {
      throw new Error('Only managers and admins can reopen shifts')
    }

    // Validation 2: Fetch shift
    const { data: shift, error: shiftError } = await supabaseAdmin
      .from('shifts')
      .select('*')
      .eq('id', shiftId)
      .single()

    if (shiftError) throw new Error('Shift not found')
    if (userData.branch_id !== shift.branch_id) {
      throw new Error('Cannot reopen shifts from other branches')
    }

    if (shift.status !== 'closed') {
      throw new Error('Can only reopen closed shifts')
    }

    // Step 1: Update shift status to reopened
    const { error: updateError } = await supabaseAdmin
      .from('shifts')
      .update({
        status: 'reopened',
        reopened_by: userId,
        reopened_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', shiftId)

    if (updateError) throw updateError

    // Step 2: Create audit log entry
    const { error: auditError } = await supabaseAdmin
      .from('shift_audit_log')
      .insert({
        shift_id: shiftId,
        action: 'reopened',
        performed_by: userId,
        notes: reopenReason,
      })

    if (auditError) throw auditError

    return {
      success: true,
      message: `Shift ${shift.shift_number} reopened by management`,
    }
  } catch (error) {
    logger.error('Error reopening shift:', error)
    return {
      success: false,
      error: 'Operation failed. Please try again.',
    }
  }
}

/**
 * GET SHIFTS FOR DATE RANGE - Analytics for reconciliation
 */
export async function getShiftsForDateRange(
  branchId: string,
  startDate: string,
  endDate: string
) {
  try {
    const { data, error } = await supabaseAdmin
      .from('shift_summaries')
      .select('*')
      .eq('branch_id', branchId)
      .gte('opened_at', startDate)
      .lte('opened_at', endDate)
      .order('opened_at', { ascending: false })

    if (error) throw error

    return data || []
  } catch (error) {
    logger.error('Error fetching shifts for range:', error)
    return []
  }
}
