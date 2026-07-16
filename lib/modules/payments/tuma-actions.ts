/**
 * Tuma Payments — Database Actions
 *
 * Server-only database operations for payment_transactions table.
 * Mirrors the pattern from lib/mpesa-actions.ts for the new provider-agnostic table.
 *
 * All functions use supabaseAdmin (service role) for DB access.
 */

'use server'

import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import type { Json } from '@/lib/types/database'

// Helper: payment_transactions is a new table not yet in auto-generated Supabase types.
// Using `as unknown` breaks the deep inference chain that causes
// "Type instantiation is excessively deep" errors.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const txDb = supabaseAdmin as any

// ─── Types ─────────────────────────────────────────────────────────────────

export interface PaymentTransaction {
  id: string
  provider: string
  merchant_request_id: string | null
  checkout_request_id: string | null
  mpesa_receipt_number: string | null
  amount: number
  currency: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'timeout'
  sale_id: string | null
  callback_payload: unknown
  result_code: string | null
  result_desc: string | null
  failure_reason: string | null
  phone_number: string
  description: string | null
  idempotency_key: string | null
  initiated_at: string
  callback_received_at: string | null
  sale_finalized_at: string | null
  created_at: string
  updated_at: string
}

// ─── Create ────────────────────────────────────────────────────────────────

// Helper: typed supabase client for payment_transactions 
// (table not yet in auto-generated types, use generic query builder)
type PaymentTxDb = import('@supabase/supabase-js').SupabaseClient<never, 'public'>

/**
 * Create a new payment transaction record.
 * Called when STK Push is initiated to Tuma.
 */
export async function createPaymentTransaction(
  saleId: string,
  merchantRequestId: string | null,
  checkoutRequestId: string | null,
  phoneNumber: string,
  amount: number,
  options?: {
    description?: string
    idempotencyKey?: string
    provider?: string
  }
) {
  try {
    const { data, error } = await txDb
      .from('payment_transactions')
      .insert({
        provider: options?.provider || 'tuma',
        sale_id: saleId,
        merchant_request_id: merchantRequestId || undefined,
        checkout_request_id: checkoutRequestId || undefined,
        phone_number: phoneNumber,
        amount: Math.round(amount),
        status: 'pending',
        description: options?.description || null,
        idempotency_key: options?.idempotencyKey || null,
        initiated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error

    logger.info('[Tuma] Payment transaction created', { saleId, transactionId: data.id })

    return { success: true, transaction: data as PaymentTransaction }
  } catch (error) {
    logger.error('[Tuma] Failed to create payment transaction', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Update from Callback ──────────────────────────────────────────────────

/**
 * Update payment transaction with callback result from Tuma.
 * Status mapping: completed→completed, cancelled→cancelled, timeout→timeout, failed→failed
 */
export async function updatePaymentTransactionCallback(
  checkoutRequestId: string,
  callbackPayload: unknown,
  status: string,
  resultCode: string,
  resultDesc: string,
  mpesaReceiptNumber?: string,
  failureReason?: string
) {
  try {
    const { data, error } = await txDb
      .from('payment_transactions')
      .update({
        status,
        callback_payload: callbackPayload as Json,
        callback_received_at: new Date().toISOString(),
        mpesa_receipt_number: mpesaReceiptNumber || null,
        result_code: resultCode,
        result_desc: resultDesc,
        failure_reason: failureReason || null,
      })
      .eq('checkout_request_id', checkoutRequestId)
      .select()
      .single()

    if (error) throw error

    logger.info('[Tuma] Callback processed', { checkoutRequestId, status })

    return { success: true, transaction: data as PaymentTransaction }
  } catch (error) {
    logger.error('[Tuma] Failed to update callback', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Lookup ────────────────────────────────────────────────────────────────

/**
 * Get payment transaction by checkout_request_id.
 */
export async function getPaymentTransactionByCheckoutId(checkoutRequestId: string) {
  try {
    const { data, error } = await txDb
      .from('payment_transactions')
      .select('*')
      .eq('checkout_request_id', checkoutRequestId)
      .single()

    if (error) throw error

    return { success: true, transaction: data as PaymentTransaction }
  } catch (error) {
    logger.error('[Tuma] Failed to get transaction by checkout ID', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

/**
 * Get payment transaction by sale_id.
 */
export async function getPaymentTransactionBySaleId(saleId: string) {
  try {
    const { data, error } = await txDb
      .from('payment_transactions')
      .select('*')
      .eq('sale_id', saleId)
      .single()

    if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows

    return { success: true, transaction: (data as PaymentTransaction) || null }
  } catch (error) {
    logger.error('[Tuma] Failed to get transaction by sale ID', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Sale Finalization ─────────────────────────────────────────────────────

/**
 * Finalize sale after payment confirmed.
 * Updates sale payment_status to 'completed' and marks transaction finalized.
 * Idempotent: safe to call multiple times.
 */
export async function finalizePaymentSale(saleId: string) {
  try {
    const { error: saleError } = await supabaseAdmin
      .from('sales')
      .update({ payment_status: 'completed', sale_status: 'completed' })
      .eq('id', saleId)

    if (saleError) throw saleError

    const { error: transError } = await txDb
      .from('payment_transactions')
      .update({ sale_finalized_at: new Date().toISOString() })
      .eq('sale_id', saleId)

    if (transError) throw transError

    logger.info('[Tuma] Sale finalized', { saleId })

    return { success: true }
  } catch (error) {
    logger.error('[Tuma] Failed to finalize sale', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

/**
 * Mark sale as failed (payment failed, cancelled, or timeout).
 * Allows cashier to retry or use different payment method.
 */
export async function failPaymentSale(saleId: string, errorMessage: string = 'Payment failed') {
  try {
    // Update sale payment_status to 'failed'
    const { error: saleError } = await supabaseAdmin
      .from('sales')
      .update({ payment_status: 'failed' })
      .eq('id', saleId)

    if (saleError) throw saleError

    // Also update payment_transactions.status to 'failed' for consistency
    const { error: txError } = await txDb
      .from('payment_transactions')
      .update({ status: 'failed', failure_reason: errorMessage })
      .eq('sale_id', saleId)
      .in('status', ['pending', 'processing'])

    if (txError) throw txError

    logger.info('[Tuma] Sale and transaction marked as failed', { saleId, errorMessage })

    return { success: true }
  } catch (error) {
    logger.error('[Tuma] Failed to mark sale as failed', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Inventory Restoration for Failed Payments ─────────────────────────────

/**
 * Restore inventory quantities for a failed/cancelled pending sale.
 * Writes stock_movements to maintain audit trail.
 * Mirrors restoreFailedMpesaSaleInventory from app/api/mpesa/callback/route.ts.
 */
export async function restoreInventoryForFailedPayment(saleId: string) {
  try {
    const { data: sale, error: saleError } = await supabaseAdmin
      .from('sales')
      .select('id, branch_id, payment_status')
      .eq('id', saleId)
      .single()

    if (saleError || !sale) {
      logger.error('[Tuma] Failed to load sale for inventory restore', saleError, { saleId })
      return { success: true }
    }

    if (sale.payment_status !== 'pending') {
      return { success: true }
    }

    const { data: saleItems, error: itemsError } = await supabaseAdmin
      .from('sale_items')
      .select('product_id, quantity')
      .eq('sale_id', saleId)

    if (itemsError) {
      logger.error('[Tuma] Failed to load sale items for inventory restore', itemsError, { saleId })
      return { success: true }
    }

    for (const item of saleItems || []) {
      const { data: inventory, error: inventoryError } = await supabaseAdmin
        .from('inventory')
        .select('id, quantity')
        .eq('branch_id', sale.branch_id)
        .eq('product_id', item.product_id)
        .single()

      if (inventoryError || !inventory) {
        logger.warn('[Tuma] Inventory restore skipped for item', { saleId, productId: item.product_id })
        continue
      }

      const restoredQuantity = inventory.quantity + item.quantity

      const { error: updateError } = await supabaseAdmin
        .from('inventory')
        .update({
          quantity: restoredQuantity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', inventory.id)

      if (updateError) {
        logger.error('[Tuma] Failed to restore inventory quantity', updateError, { saleId, productId: item.product_id })
        continue
      }

      const { error: movementError } = await supabaseAdmin
        .from('stock_movements')
        .insert({
          product_id: item.product_id,
          branch_id: sale.branch_id,
          type: 'adjustment',
          quantity: item.quantity,
          reference_id: saleId,
          notes: 'Payment failed or cancelled - inventory restored',
        })

      if (movementError) {
        logger.error('[Tuma] Failed to write inventory restore movement', movementError, { saleId, productId: item.product_id })
      }
    }

    logger.info('[Tuma] Inventory restored for failed payment', { saleId })
    return { success: true }
  } catch (error) {
    logger.error('[Tuma] Failed to restore inventory', error)
    return { success: false, error: 'Failed to restore inventory' }
  }
}

// ─── Pending Transactions ──────────────────────────────────────────────────

/**
 * Get pending payment transactions for reconciliation.
 */
export async function getPendingPaymentTransactions(maxAgeMinutes: number = 60) {
  try {
    const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000)

    const { data, error } = await txDb
      .from('payment_transactions')
      .select('*, sale:sales(*)')
      .eq('status', 'pending')
      .gte('initiated_at', cutoffTime.toISOString())
      .order('initiated_at', { ascending: false })

    if (error) throw error

    return { success: true, transactions: (data || []) as PaymentTransaction[] }
  } catch (error) {
    logger.error('[Tuma] Failed to get pending transactions', error)
    return { success: false, error: 'Operation failed. Please try again.', transactions: [] }
  }
}
