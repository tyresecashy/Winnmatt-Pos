/**
 * M-Pesa Transaction Actions
 * Database operations for M-Pesa payments and callbacks
 */

'use server'

import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import type { Json } from '@/lib/types/database'

export interface MpesaTransaction {
  id: string
  sale_id: string
  merchant_request_id: string
  checkout_request_id: string
  phone_number: string
  amount: number
  status: 'pending' | 'confirmed' | 'failed' | 'cancelled' | 'timeout'
  mpesa_receipt_number: string | null
  callback_payload: unknown
  initiated_at: string
  callback_received_at: string | null
  sale_finalized_at: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

/**
 * Create a new M-Pesa transaction record
 * Called when STK Push is initiated
 */
export async function createMpesaTransaction(
  saleId: string,
  merchantRequestId: string,
  checkoutRequestId: string,
  phoneNumber: string,
  amount: number
) {
  try {
    const { data, error } = await supabaseAdmin
      .from('mpesa_transactions')
      .insert({
        sale_id: saleId,
        merchant_request_id: merchantRequestId,
        checkout_request_id: checkoutRequestId,
        phone_number: phoneNumber,
        amount: Math.round(amount),
        status: 'pending',
        initiated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error

    logger.info('[M-Pesa] Transaction created', { saleId })

    return {
      success: true,
      transaction: data,
    }
  } catch (error) {
    logger.error('[M-Pesa] Failed to create transaction', error)
    return {
      success: false,
      error: 'Operation failed. Please try again.',
    }
  }
}

/**
 * Update M-Pesa transaction with callback result
 * Called when callback is received from Safaricom
 */
export async function updateMpesaTransactionCallback(
  checkoutRequestId: string,
  callbackPayload: unknown,
  resultCode: number,
  resultDesc: string,
  mpesaReceiptNumber?: string
) {
  try {
    const status =
      resultCode === 0
        ? 'confirmed'
        : resultCode === 1032
          ? 'cancelled'
          : resultCode === 1001
            ? 'timeout'
            : 'failed'

    const { data, error } = await supabaseAdmin
      .from('mpesa_transactions')
      .update({
        status,
        callback_payload: callbackPayload as Json,
        callback_received_at: new Date().toISOString(),
        mpesa_receipt_number: mpesaReceiptNumber || null,
        error_message: resultDesc,
      })
      .eq('checkout_request_id', checkoutRequestId)
      .select()
      .single()

    if (error) throw error

    logger.info('[M-Pesa] Callback processed', { checkoutRequestId })

    return {
      success: true,
      transaction: data,
    }
  } catch (error) {
    logger.error('[M-Pesa] Failed to update callback', error)
    return {
      success: false,
      error: 'Operation failed. Please try again.',
    }
  }
}

/**
 * Get M-Pesa transaction by checkout request ID
 */
export async function getMpesaTransactionByCheckoutId(
  checkoutRequestId: string
) {
  try {
    const { data, error } = await supabaseAdmin
      .from('mpesa_transactions')
      .select('*')
      .eq('checkout_request_id', checkoutRequestId)
      .single()

    if (error) throw error

    return {
      success: true,
      transaction: data,
    }
  } catch (error) {
    logger.error('[M-Pesa] Failed to get transaction', error)
    return {
      success: false,
      error: 'Operation failed. Please try again.',
    }
  }
}

/**
 * Get M-Pesa transaction by sale ID
 */
export async function getMpesaTransactionBySaleId(saleId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('mpesa_transactions')
      .select('*')
      .eq('sale_id', saleId)
      .single()

    if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows

    return {
      success: true,
      transaction: data || null,
    }
  } catch (error) {
    logger.error('[M-Pesa] Failed to get transaction by sale', error)
    return {
      success: false,
      error: 'Operation failed. Please try again.',
    }
  }
}

/**
 * Finalize sale after M-Pesa payment confirmed
 * Updates sale payment_status to completed
 * Updates M-Pesa transaction with finalization timestamp
 * Idempotent: Can be called multiple times safely
 */
export async function finalizeMpesaSale(saleId: string) {
  try {
    // Update sale status to completed
    const { error: saleError } = await supabaseAdmin
      .from('sales')
      .update({
        payment_status: 'completed',
      })
      .eq('id', saleId)

    if (saleError) throw saleError

    // Mark M-Pesa transaction as finalized
    const { error: transError } = await supabaseAdmin
      .from('mpesa_transactions')
      .update({
        sale_finalized_at: new Date().toISOString(),
      })
      .eq('sale_id', saleId)

    if (transError) throw transError

    logger.info('[M-Pesa] Sale finalized', { saleId })

    return { success: true }
  } catch (error) {
    logger.error('[M-Pesa] Failed to finalize sale', error)
    return {
      success: false,
      error: 'Operation failed. Please try again.',
    }
  }
}

/**
 * Mark sale as failed (payment failed, cancelled, or timeout)
 * Allows cashier to retry or use different payment method
 */
export async function failMpesaSale(
  saleId: string,
  errorMessage: string = 'Payment failed'
) {
  try {
    const { error } = await supabaseAdmin
      .from('sales')
      .update({
        payment_status: 'failed',
      })
      .eq('id', saleId)

    if (error) throw error

    logger.info('[M-Pesa] Sale marked as failed', { saleId })

    return { success: true }
  } catch (error) {
    logger.error('[M-Pesa] Failed to mark sale as failed', error)
    return {
      success: false,
      error: 'Operation failed. Please try again.',
    }
  }
}

/**
 * Get M-Pesa transactions for reconciliation
 * Returns pending/unconfirmed transactions that may need attention
 */
export async function getPendingMpesaTransactions(
  maxAgeMinutes: number = 60
) {
  try {
    const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000)

    const { data, error } = await supabaseAdmin
      .from('mpesa_transactions')
      .select(
        `
        *,
        sale:sales(*)
      `
      )
      .eq('status', 'pending')
      .gte('initiated_at', cutoffTime.toISOString())
      .order('initiated_at', { ascending: false })

    if (error) throw error

    return {
      success: true,
      transactions: data || [],
    }
  } catch (error) {
    logger.error('[M-Pesa] Failed to get pending transactions', error)
    return {
      success: false,
      error: 'Operation failed. Please try again.',
      transactions: [],
    }
  }
}

/**
 * Get M-Pesa transactions for a date range
 * For reconciliation and reporting
 */
export async function getMpesaTransactionsByDateRange(
  startDate: string,
  endDate: string,
  branch_id?: string
) {
  try {
    let query = supabaseAdmin
      .from('mpesa_transactions')
      .select(
        `
        *,
        sale:sales(*)
      `
      )
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false })

    if (branch_id) {
      // Filter via the sales table join - use a subquery for cross-table filtering
      query = query.not('sale_id', 'is', null)
    }

    const { data, error } = await query

    if (error) throw error

    // If branch filter was requested, filter in-memory via the expanded sale relation
    let transactions = data || []
    if (branch_id && transactions.length > 0) {
      transactions = transactions.filter(
        (t: { sale?: { branch_id?: string } | null }) => t.sale?.branch_id === branch_id
      )
    }

    return {
      success: true,
      transactions,
    }
  } catch (error) {
    logger.error('[M-Pesa] Failed to get transactions by date range', error)
    return {
      success: false,
      error: 'Operation failed. Please try again.',
      transactions: [],
    }
  }
}

/**
 * Get M-Pesa transaction summary for dashboard
 */
export async function getMpesaTransactionSummary(
  branchId?: string,
  daysBack: number = 7
) {
  try {
    const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)

    let query = supabaseAdmin
      .from('mpesa_transactions')
      .select(`
        status, amount, sale_id,
        sale:sales(branch_id)
      `)
      .gte('created_at', startDate.toISOString())

    if (branchId) {
      // First filter: only transactions linked to a sale
      query = query.not('sale_id', 'is', null)
    }

    const { data, error } = await query

    if (error) throw error

    let transactions = data || []

    // If branch filter was requested, filter in-memory via the expanded sale relation
    if (branchId && transactions.length > 0) {
      transactions = transactions.filter(
        (t) => (t.sale as unknown as { branch_id: string } | null)?.branch_id === branchId
      )
    }

    const summary = {
      total_initiated: transactions.length,
      total_confirmed: transactions
        .filter((t) => t.status === 'confirmed')
        .reduce((sum, t) => sum + t.amount, 0),
      total_failed: transactions.filter((t) => t.status === 'failed').length,
      total_cancelled: transactions.filter((t) => t.status === 'cancelled')
        .length,
      success_rate:
        transactions.length > 0
          ? Math.round(
              (transactions.filter((t) => t.status === 'confirmed').length /
                transactions.length) *
                100
            )
          : 0,
    }

    return {
      success: true,
      summary,
    }
  } catch (error) {
    logger.error('[M-Pesa] Failed to get summary', error)
    return {
      success: false,
      error: 'Operation failed. Please try again.',
    }
  }
}
