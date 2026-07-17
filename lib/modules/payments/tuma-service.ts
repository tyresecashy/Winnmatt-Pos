/**
 * Tuma Payments — Business Logic Service
 *
 * Orchestrates the Tuma payment flow:
 * 1. Create payment transaction (DB)
 * 2. Initiate STK Push (API)
 * 3. Handle callback (API → DB → events)
 * 4. Check status (DB → POS)
 *
 * This is a runtime singleton — config loaded once from env vars.
 */

import { logger } from '@/lib/logger'
import { env } from '@/lib/env'
import * as tumaClient from './tuma-client'
import * as tumaActions from './tuma-actions'
import { publishPaymentEvent } from './tuma-events'
import type {
  InitiatePaymentResult,
  PaymentStatusResult,
  TumaConfig,
  TumaCallbackPayload,
} from './tuma-types'

// ─── Config ────────────────────────────────────────────────────────────────

function getConfig(): TumaConfig {
  return {
    apiUrl: env.TUMA_API_URL,
    apiKey: env.TUMA_API_KEY,
    businessEmail: env.TUMA_BUSINESS_EMAIL,
    callbackUrl: env.TUMA_CALLBACK_URL,
  }
}

/**
 * Check if Tuma Payments is configured and available.
 */
export function isTumaAvailable(): boolean {
  try {
    const config = getConfig()
    return !!(config.apiKey && config.businessEmail && config.apiUrl)
  } catch {
    return false
  }
}

// ─── Initiate Payment ──────────────────────────────────────────────────────

/**
 * Initiate a Tuma STK Push payment.
 *
 * Flow:
 * 1. Generate idempotency key (saleId + timestamp)
 * 2. Create pending payment_transactions record
 * 3. Call Tuma API to send STK Push
 * 4. Update record with merchant_request_id / checkout_request_id
 *
 * @param correlationId - Optional UUID for tracing across the request chain
 *
 * POS callers:
 * - POST /api/payments/tuma/stk-push route
 */
export async function initiatePayment(
  saleId: string,
  phoneNumber: string,
  amount: number,
  description?: string,
  correlationId?: string
): Promise<InitiatePaymentResult> {
  try {
    logger.info('[Tuma initiatePayment] Starting', { correlationId, saleId, amount })

    if (!isTumaAvailable()) {
      logger.warn('[Tuma initiatePayment] Tuma not configured', { correlationId, saleId })
      return { success: false, error: 'Tuma Payments is not configured. Check TUMA_API_KEY and TUMA_BUSINESS_EMAIL.' }
    }

    const config = getConfig()
    const formattedPhone = tumaClient.formatPhoneNumber(phoneNumber)

    if (!formattedPhone || formattedPhone.length < 10) {
      logger.warn('[Tuma initiatePayment] Invalid phone', { correlationId, saleId })
      return { success: false, error: 'Invalid phone number. Please enter a valid Safaricom number.' }
    }

    if (amount < 1 || amount > 150000) {
      logger.warn('[Tuma initiatePayment] Amount out of range', { correlationId, saleId, amount })
      return { success: false, error: 'Amount must be between KSh 1 and KSh 150,000.' }
    }

    // Tuma's API expects the phone number in 0-prefix format (e.g. 0796421104),
    // NOT 254-prefix format. Use the original phoneNumber for the API call
    // and formattedPhone (254XXX) for the DB record for consistent storage.
    const tumaPhone = phoneNumber.replace(/[^0-9]/g, '').startsWith('254')
      ? '0' + phoneNumber.replace(/[^0-9]/g, '').slice(3)
      : phoneNumber.replace(/[^0-9]/g, '')

    // Generate idempotency key to prevent duplicate charges
    const idempotencyKey = `tuma_${saleId}_${Date.now()}`
    const desc = description || 'WinnMatt POS Payment'

    // Step 1: Create pending transaction record
    const createResult = await tumaActions.createPaymentTransaction(
      saleId,
      null, // merchantRequestId — will update after STK Push
      null, // checkoutRequestId — will update after STK Push
      formattedPhone,
      amount,
      {
        description: desc,
        idempotencyKey,
      }
    )

    if (!createResult.success || !createResult.transaction) {
      logger.warn('[Tuma initiatePayment] Failed to create payment record', {
        correlationId, saleId, error: createResult.error,
      })
      return { success: false, error: createResult.error || 'Failed to create payment record.' }
    }

    logger.info('[Tuma initiatePayment] Payment record created', {
      correlationId,
      saleId,
      transactionId: createResult.transaction.id,
    })

    // Step 2: Initiate STK Push with Tuma
    // NOTE: Tuma rejects requests that include invoice_number — do NOT send it.
    const stkResponse = await tumaClient.initiateSTKPush(config, {
      amount,
      phone: tumaPhone, // Tuma expects 0-prefix format (e.g. 0796421104)
      callback_url: config.callbackUrl,
      description: desc,
    }, correlationId)

    logger.info('[Tuma initiatePayment] STK Push response received', {
      correlationId,
      saleId,
      transactionId: createResult.transaction.id,
      merchantRequestId: !!stkResponse.merchant_request_id,
      checkoutRequestId: !!stkResponse.checkout_request_id,
      customerMessage: !!stkResponse.customer_message,
    })

    // Step 3: Update transaction with Tuma identifiers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = (await import('@/lib/supabase-server')).supabaseAdmin as any
    const { error: updateError } = await sb
      .from('payment_transactions')
      .update({
        merchant_request_id: stkResponse.merchant_request_id || null,
        checkout_request_id: stkResponse.checkout_request_id || null,
        status: 'processing',
      })
      .eq('id', createResult.transaction.id)

    if (updateError) {
      logger.error('[Tuma initiatePayment] DB update failed', {
        correlationId, saleId, transactionId: createResult.transaction.id, error: updateError,
      })
    }

    return {
      success: true,
      transactionId: createResult.transaction.id,
      merchantRequestId: stkResponse.merchant_request_id || undefined,
      checkoutRequestId: stkResponse.checkout_request_id || undefined,
      customerMessage: stkResponse.customer_message || undefined,
    }
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : (error && typeof error === 'object' && 'message' in error
        ? String((error as { message: string }).message)
        : 'Failed to initiate Tuma payment')
    logger.error('[Tuma initiatePayment] Payment initiation failed', {
      correlationId, saleId, error: errorMessage,
    })

    // Restore inventory first (sale is still pending), then mark as failed
    if (saleId) {
      await tumaActions.restoreInventoryForFailedPayment(saleId).catch(() => {})
      await tumaActions.failPaymentSale(saleId, errorMessage).catch(() => {})
    }

    return { success: false, error: errorMessage }
  }
}

// ─── Handle Callback ───────────────────────────────────────────────────────

/**
 * Process a Tuma payment callback webhook.
 *
 * Flow:
 * 1. Look up transaction by merchant_request_id
 * 2. Validate and deduplicate
 * 3. Update transaction with callback data
 * 4. Finalize or fail the sale
 * 5. Publish event to event bus
 *
 * Callers:
 * - POST /api/payments/tuma/callback (Tuma webhook)
 */
export async function handleCallback(
  payload: TumaCallbackPayload,
  correlationId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { merchant_request_id: merchantRequestId, status, mpesa_receipt_number: mpesaReceiptNumber } = payload

    logger.info('[Tuma handleCallback] Callback received', {
      correlationId,
      merchantRequestId,
      checkoutRequestId: payload.checkout_request_id,
      status,
      resultCode: payload.result_code,
      resultDesc: payload.result_desc,
      failureReason: payload.failure_reason || null,
      mpesaReceiptNumber: mpesaReceiptNumber || null,
      amount: payload.amount,
    })

    // Step 1: Look up transaction by checkout_request_id
    const txResult = await tumaActions.getPaymentTransactionByCheckoutId(payload.checkout_request_id)

    if (!txResult.success || !txResult.transaction) {
      logger.warn('[Tuma handleCallback] Unknown transaction', {
        correlationId,
        merchantRequestId,
        checkoutRequestId: payload.checkout_request_id,
      })
      // Acknowledge receipt to Tuma, but log the orphan
      return { success: true }
    }

    const transaction = txResult.transaction
    const saleId = transaction.sale_id

    logger.info('[Tuma handleCallback] Transaction found', {
      correlationId,
      transactionId: transaction.id,
      saleId,
      currentDbStatus: transaction.status,
      callbackAlreadyReceived: !!transaction.callback_received_at,
    })

    // Step 2: Idempotency — already processed
    if (transaction.callback_received_at) {
      logger.info('[Tuma handleCallback] Duplicate callback ignored', {
        correlationId,
        merchantRequestId,
        transactionId: transaction.id,
        currentStatus: transaction.status,
      })
      return { success: true }
    }

    if (!saleId) {
      logger.error('[Tuma handleCallback] No sale_id', {
        correlationId,
        transactionId: transaction.id,
      })
      return { success: false, error: 'Transaction has no linked sale' }
    }

    // Step 3: Map Tuma status to our lifecycle
    const txnStatus = status === 'completed' ? 'completed'
      : status === 'cancelled' ? 'cancelled'
      : status === 'timeout' ? 'timeout'
      : 'failed'

    logger.info('[Tuma handleCallback] Processing status transition', {
      correlationId,
      saleId,
      transactionId: transaction.id,
      fromStatus: transaction.status,
      toStatus: txnStatus,
      callbackStatus: status,
    })

    // Step 4: Update payment transaction
    const updateResult = await tumaActions.updatePaymentTransactionCallback(
      payload.checkout_request_id,
      payload,
      txnStatus,
      payload.result_code,
      payload.result_desc,
      mpesaReceiptNumber || undefined,
      payload.failure_reason || undefined
    )

    if (!updateResult.success) {
      logger.error('[Tuma handleCallback] DB update failed', {
        correlationId, merchantRequestId, transactionId: transaction.id,
      })
      return { success: false, error: 'Failed to update transaction' }
    }

    // If no transaction was updated (atomic guard prevented duplicate), the first
    // callback already handled Step 5. Skip to avoid re-finalizing or re-failing.
    if (!updateResult.transaction) {
      logger.info('[Tuma handleCallback] Duplicate callback skipped — first callback already processed', {
        correlationId, merchantRequestId, saleId, status,
      })
      return { success: true }
    }

    // Step 5: Finalize or fail the sale
    if (status === 'completed') {
      await tumaActions.finalizePaymentSale(saleId)
      logger.info('[Tuma handleCallback] Sale completed', {
        correlationId, saleId, mpesaReceiptNumber, transactionId: transaction.id,
      })
    } else {
      // Restore inventory for failed/cancelled/timeout payments
      await tumaActions.restoreInventoryForFailedPayment(saleId)
      await tumaActions.failPaymentSale(saleId, payload.failure_reason || payload.result_desc)
      logger.info('[Tuma handleCallback] Sale marked as failed', {
        correlationId,
        saleId,
        status,
        reason: payload.failure_reason || payload.result_desc,
        transactionId: transaction.id,
      })
    }

    // Step 6: Publish event for real-time POS updates
    const errorMsg = status !== 'completed'
      ? payload.failure_reason || payload.result_desc || 'Payment was not completed'
      : undefined

    publishPaymentEvent(
      status,
      saleId,
      payload.checkout_request_id,
      mpesaReceiptNumber || undefined,
      errorMsg
    )

    logger.info('[Tuma handleCallback] Done', {
      correlationId,
      saleId,
      transactionId: transaction.id,
      finalStatus: txnStatus,
      eventPublished: true,
    })

    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to process callback'
    logger.error('[Tuma handleCallback] Processing error', {
      correlationId: (payload as any)?.merchant_request_id,
      error: errorMessage,
    })
    return { success: false, error: errorMessage }
  }
}

// ─── Check Transaction Status ──────────────────────────────────────────────

/**
 * Get payment transaction status for POS polling.
 *
 * Returns the same shape as the existing M-Pesa status endpoint so
 * the PaymentPanel polling mechanism works identically.
 *
 * Callers:
 * - GET /api/payments/tuma/status (POS polling)
 */
export async function getPaymentStatus(
  checkoutRequestId?: string,
  saleId?: string
): Promise<PaymentStatusResult> {
  try {
    let txResult

    if (checkoutRequestId) {
      txResult = await tumaActions.getPaymentTransactionByCheckoutId(checkoutRequestId)
    } else if (saleId) {
      txResult = await tumaActions.getPaymentTransactionBySaleId(saleId)
    } else {
      return { success: false, error: 'Missing checkoutRequestId or saleId' }
    }

    if (!txResult.success || !txResult.transaction) {
      return { success: false, error: 'Transaction not found' }
    }

    const txn = txResult.transaction

    return {
      success: true,
      transactionId: txn.id,
      saleId: txn.sale_id || undefined,
      status: txn.status,
      mpesaReceiptNumber: txn.mpesa_receipt_number,
      errorMessage: txn.failure_reason || txn.result_desc,
      isConfirmed: txn.status === 'completed',
      isFailed: ['failed', 'cancelled', 'timeout'].includes(txn.status),
      isPending: txn.status === 'pending' || txn.status === 'processing',
    }
  } catch (error) {
    logger.error('[Tuma] Failed to check payment status', error)
    return { success: false, error: 'Failed to check payment status' }
  }
}

// ─── Payment Recovery ───────────────────────────────────────────────────────

/**
 * Recover stuck payment transactions.
 *
 * Three scenarios are handled (all idempotent):
 *   A. Callback received, transaction completed, but sale not finalized
 *      → Re-run finalizePaymentSale
 *   B. Callback received, transaction failed/cancelled, but inventory
 *      not restored and sale not marked failed
 *      → Re-run restoreInventoryForFailedPayment + failPaymentSale
 *   C. No callback received, transaction still pending/processing
 *      beyond max age → Mark as timeout, restore inventory, fail sale
 *
 * Returns a summary of actions taken.
 *
 * Callers:
 * - Automation scheduler (recurring task)
 * - Manual trigger via admin dashboard
 */
export async function recoverPendingPayments(): Promise<{
  success: boolean
  recovered: number
  errors: string[]
  details: Array<{ saleId: string; status: string; action: string }>
}> {
  const result = {
    success: true,
    recovered: 0,
    errors: [] as string[],
    details: [] as Array<{ saleId: string; status: string; action: string }>,
  }

  const { transactions, error } = await tumaActions.getStuckPaymentTransactions()

  if (error) {
    logger.error('[Recovery] getStuckPaymentTransactions failed', { error })
    return { ...result, success: false, errors: [error] }
  }

  for (const txn of transactions) {
    const saleId = txn.sale_id
    // Skip orphan transactions (no linked sale)
    if (!saleId) continue

    try {
      // sale is the related record loaded via the Supabase join
      const sale = (txn as unknown as { sale: { payment_status: string } | null }).sale
      const salePaymentStatus = sale?.payment_status

      // Already processed — nothing to do
      if (salePaymentStatus === 'completed' || salePaymentStatus === 'failed') {
        result.details.push({ saleId, status: txn.status, action: 'skipped_already_processed' })
        continue
      }

      // ── Scenario A + B: Callback received but finalization failed ──
      if (txn.callback_received_at && !txn.sale_finalized_at) {
        if (txn.status === 'completed') {
          await tumaActions.finalizePaymentSale(saleId)
          result.details.push({ saleId, status: txn.status, action: 'finalized' })
          result.recovered++
          logger.info('[Recovery] Sale finalized (callback was processed)', { saleId, status: txn.status })
        } else if (['failed', 'cancelled', 'timeout'].includes(txn.status)) {
          await tumaActions.restoreInventoryForFailedPayment(saleId)
          await tumaActions.failPaymentSale(saleId, txn.failure_reason || 'Payment failed (recovered)')
          result.details.push({ saleId, status: txn.status, action: 'failed_with_restore' })
          result.recovered++
          logger.info('[Recovery] Sale failed + inventory restored', { saleId, status: txn.status })
        }
        continue
      }

      // ── Scenario C: No callback — timeout ──
      if (!txn.callback_received_at && ['pending', 'processing'].includes(txn.status)) {
        await tumaActions.restoreInventoryForFailedPayment(saleId)
        await tumaActions.failPaymentSale(saleId, 'Payment timed out (recovered)')
        result.details.push({ saleId, status: txn.status, action: 'timeout_with_restore' })
        result.recovered++
        logger.info('[Recovery] Sale timed out + inventory restored', { saleId, status: txn.status })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      result.errors.push(`sale:${saleId}: ${msg}`)
      logger.error('[Recovery] Failed to process transaction', { saleId, error: msg })
    }
  }

  logger.info('[Recovery] Complete', {
    recovered: result.recovered,
    errors: result.errors.length,
    totalChecked: transactions.length,
  })

  return result
}
