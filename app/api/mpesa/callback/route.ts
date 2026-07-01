/**
 * M-Pesa Callback Webhook
 * POST /api/mpesa/callback
 * 
 * Receives payment confirmation from Safaricom Daraja
 * This is the source of truth for payment status
 * 
 * IMPORTANT:
 * - This endpoint is called by Safaricom's servers
 * - Must respond with 200 OK quickly (within 30 seconds)
 * - Should process the callback asynchronously
 * - Must validate callback authenticity
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  updateMpesaTransactionCallback,
  finalizeMpesaSale,
  failMpesaSale,
  getMpesaTransactionByCheckoutId,
} from '@/lib/mpesa-actions'
import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import type { CallbackPayload } from '@/lib/mpesa-service'

async function restoreFailedMpesaSaleInventory(saleId: string) {
  const { data: sale, error: saleError } = await supabaseAdmin
    .from('sales')
    .select('id, branch_id, payment_status')
    .eq('id', saleId)
    .single()

// ── restoreFailedMpesaSaleInventory ──
  if (saleError || !sale) {
    logger.error('[M-Pesa Callback] Failed to load sale for inventory restore', saleError, { saleId })
    return
  }

  if (sale.payment_status !== 'pending') {
    return
  }

  const { data: saleItems, error: itemsError } = await supabaseAdmin
    .from('sale_items')
    .select('product_id, quantity')
    .eq('sale_id', saleId)

  if (itemsError) {
    logger.error('[M-Pesa Callback] Failed to load sale items for inventory restore', itemsError, { saleId })
    return
  }

  for (const item of saleItems || []) {
    const { data: inventory, error: inventoryError } = await supabaseAdmin
      .from('inventory')
      .select('id, quantity')
      .eq('branch_id', sale.branch_id)
      .eq('product_id', item.product_id)
      .single()

    if (inventoryError || !inventory) {
      logger.warn('[M-Pesa Callback] Inventory restore skipped for item', { saleId, productId: item.product_id })
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
      logger.error('[M-Pesa Callback] Failed to restore inventory quantity', updateError, { saleId, productId: item.product_id })
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
        notes: 'M-Pesa payment cancelled or failed - inventory restored',
      })

    if (movementError) {
      logger.error('[M-Pesa Callback] Failed to write inventory restore movement', movementError, { saleId, productId: item.product_id })
    }
  }
}

async function failPendingMpesaSaleWithRestore(saleId: string, errorMessage: string) {
  await restoreFailedMpesaSaleInventory(saleId)
  return failMpesaSale(saleId, errorMessage)
}

export async function POST(req: NextRequest) {
  try {
    const body: CallbackPayload = await req.json()

    // Validate callback structure
    const stkCallback = body?.Body?.stkCallback
    if (!stkCallback) {
      logger.error('[M-Pesa Callback] Invalid callback payload structure')
      return NextResponse.json(
        { success: false },
        { status: 200 } // Return 200 to acknowledge to Safaricom
      )
    }

    // Validate required callback fields
    const {
      MerchantRequestID: merchantRequestId,
      CheckoutRequestID: checkoutRequestId,
      ResultCode: resultCode,
      ResultDesc: resultDesc,
    } = stkCallback

    // Reject malformed callbacks - must have checkoutRequestId
    if (!checkoutRequestId) {
      logger.error('[M-Pesa Callback] Callback missing CheckoutRequestID')
      return NextResponse.json(
        { success: false },
        { status: 200 }
      )
    }

    // Reject if ResultCode is not a number
    if (typeof resultCode !== 'number') {
      logger.error('[M-Pesa Callback] Callback ResultCode is not a number', undefined, { resultCode })
      return NextResponse.json(
        { success: false },
        { status: 200 }
      )
    }

    logger.info('[M-Pesa Callback] Callback received', { resultCode, resultDesc })

    // Get the corresponding M-Pesa transaction
    const transactionResult = await getMpesaTransactionByCheckoutId(
      checkoutRequestId
    )

    if (!transactionResult.success || !transactionResult.transaction) {
      logger.error('[M-Pesa Callback] Transaction not found in callback', undefined, { checkoutRequestId })
      return NextResponse.json(
        { success: false },
        { status: 200 } // Still return 200 to Safaricom
      )
    }

    const transaction = transactionResult.transaction
    const saleId = transaction.sale_id

    // ============================================================================
    // IDEMPOTENCY CHECK: Prevent duplicate processing
    // ============================================================================
    // If callback_received_at is already set, this callback has been processed
    if (transaction.callback_received_at) {
      logger.info('[M-Pesa Callback] Callback already processed (idempotency)', { resultCode, previousResultCode: transaction.status })
      
      // Return success without re-processing side effects
      // This prevents duplicate finalization, loyalty points, etc.
      return NextResponse.json(
        { success: true, resultCode, isReplayed: true },
        { status: 200 }
      )
    }

    // Extract M-Pesa receipt number if payment was successful
    let mpesaReceiptNumber: string | undefined
    if (resultCode === 0 && stkCallback.CallbackMetadata?.Item) {
      const receiptItem = stkCallback.CallbackMetadata.Item.find(
        (item) => item.Name === 'MpesaReceiptNumber'
      )
      if (receiptItem) {
        mpesaReceiptNumber = String(receiptItem.Value)
      }
    }

    // Update M-Pesa transaction with callback data
    const updateResult = await updateMpesaTransactionCallback(
      checkoutRequestId,
      body, // Store full callback payload for audit trail
      resultCode,
      resultDesc,
      mpesaReceiptNumber
    )

    if (!updateResult.success) {
      logger.error('[M-Pesa Callback] Failed to update transaction', updateResult.error, { checkoutRequestId })
      return NextResponse.json(
        { success: false },
        { status: 200 } // Acknowledge to Safaricom anyway
      )
    }

    // Process result based on result code
    const resultMapping: Record<number, string> = {
      0: 'Payment successful',
      1: 'Insufficient balance',
      1001: 'Request timeout',
      1002: 'The originator of the transaction is not allowed to originate transactions',
      1014: 'Initiator information is invalid',
      1032: 'Transaction cancelled by user',
      1033: 'An error occurred while processing your request. Please retry. Request reference',
      2000: 'Unable to lock subscriber account for further transaction. This might mean subscriber cannot transact or an error occurred.',
    }

    // Handle success case (result code 0)
    if (resultCode === 0) {
      logger.info('[M-Pesa Callback] Payment confirmed', { saleId, mpesaReceiptNumber })

      // Finalize the sale (mark as completed)
      const finalizeResult = await finalizeMpesaSale(saleId)
      if (!finalizeResult.success) {
        logger.error('[M-Pesa Callback] Failed to finalize sale', finalizeResult.error, { saleId })
        // Even if finalization fails, we've updated the transaction
        // The sale will be in pending state but M-Pesa transaction confirmed
        // This should be rare and caught by reconciliation
      }

      // Call webhook for real-time updates (optional)
      await notifyPaymentSuccess(saleId, mpesaReceiptNumber)
    } else {
      // Payment failed, cancelled, or timeout
      logger.info('[M-Pesa Callback] Payment failed', { saleId, resultCode, resultDesc })

      // Mark sale as failed to allow retry
      const failResult = await failPendingMpesaSaleWithRestore(
        saleId,
        resultMapping[resultCode] || resultDesc
      )

      if (!failResult?.success) {
        logger.error('[M-Pesa Callback] Failed to mark sale as failed', failResult?.error, { saleId })
      }

      // Call webhook for payment failure notification (optional)
      await notifyPaymentFailure(saleId, resultDesc)
    }

    // IMPORTANT: Return 200 OK to acknowledge receipt to Safaricom
    // They will retry if we don't respond with 200
    return NextResponse.json(
      { success: true, resultCode },
      { status: 200 }
    )
  } catch (error) {
    logger.error('[M-Pesa Callback] Callback processing error', error)
    return NextResponse.json(
      { success: false },
      { status: 200 } // Still return 200 to stop Safaricom retries
    )
  }
}

/**
 * Send success notification to POS system
 * Can use Socket.io, Server-sent events, or polling
 * For now, we've already updated the database which POS can poll
 */
async function notifyPaymentSuccess(
  saleId: string,
  mpesaReceiptNumber?: string
) {
  try {
    // TODO: Implement real-time notification
    // For now, database is the source of truth that POS polls
    logger.info('[M-Pesa Callback] Payment success notification', { saleId, mpesaReceiptNumber })
  } catch (error) {
    logger.error('[M-Pesa Callback] Failed to notify success', error)
    // Don't throw - failure to notify shouldn't affect callback processing
  }
}

/**
 * Send failure notification to POS system
 */
async function notifyPaymentFailure(saleId: string, errorMessage: string) {
  try {
    // TODO: Implement real-time notification
    logger.info('[M-Pesa Callback] Payment failure notification', { saleId, errorMessage })
  } catch (error) {
    logger.error('[M-Pesa Callback] Failed to notify failure', error)
    // Don't throw - failure to notify shouldn't affect callback processing
  }
}
