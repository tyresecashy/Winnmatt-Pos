/**
 * M-Pesa Payment Status Check
 * GET /api/mpesa/status?checkoutRequestId=...&saleId=...
 *
 * Allows POS to check payment status
 * Used for polling until callback arrives
 *
 * SECURITY:
 * - Requires a verified Supabase auth session
 * - Loads the app profile from the authenticated Supabase user id
 * - Verifies user belongs to the sale's branch
 * - Owner can access any branch, others only their own
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getMpesaTransactionByCheckoutId,
  getMpesaTransactionBySaleId,
} from '@/lib/mpesa-actions'
import { supabaseAdmin } from '@/lib/supabase-server'
import { authenticateRequest, verifySaleAccess, unauthorizedResponse, forbiddenResponse } from '@/lib/auth-helpers'
import { logger } from '@/lib/logger'
import { mpesaStatusSchema } from '@/lib/api-schemas'
import { badRequest } from '@/lib/api-errors'

export async function GET(req: NextRequest) {
  try {
    // ========================================================================
    // AUTHENTICATION
    // ========================================================================
    const authResult = await authenticateRequest(req)
    
    if (!authResult.success) {
      logger.warn('[M-Pesa Status] Auth failed', { reason: authResult.error })
      return unauthorizedResponse(authResult.error)
    }

    const profile = authResult.profile!

    // ========================================================================
    // REQUEST VALIDATION
    // ========================================================================
    const searchParams = req.nextUrl.searchParams
    const checkoutRequestId = searchParams.get('checkoutRequestId')
    const saleId = searchParams.get('saleId')

    if (checkoutRequestId) {
      const parsed = mpesaStatusSchema.safeParse({ checkoutRequestId })
      if (!parsed.success) {
        return badRequest(parsed.error.issues.map(i => ({
          field: i.path.join('.'),
          message: i.message,
        })))
      }
    } else if (!saleId) {
      return badRequest([{ field: 'checkoutRequestId', message: 'Missing checkoutRequestId or saleId parameter' }])
    }

    let transactionResult

    if (checkoutRequestId) {
      transactionResult = await getMpesaTransactionByCheckoutId(checkoutRequestId)
    } else {
      transactionResult = await getMpesaTransactionBySaleId(saleId!)
    }

    if (!transactionResult.success || !transactionResult.transaction) {
      logger.warn('[M-Pesa Status] Transaction not found', { checkoutRequestId })
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      )
    }

    const transaction = transactionResult.transaction

    // ========================================================================
    // SANDBOX SIMULATION: Auto-confirm after delay
    // ========================================================================
    if (process.env.MPESA_SANDBOX_SIMULATE === 'true' && transaction.status === 'pending') {
      const initiatedAt = new Date(transaction.initiated_at).getTime()
      const now = Date.now()
      const secondsSinceInit = (now - initiatedAt) / 1000

      // Auto-confirm after 5 seconds (simulates user entering PIN)
      if (secondsSinceInit >= 5) {
        logger.info('[M-Pesa Status] Sandbox simulation - auto-confirming payment')

        const simulatedReceipt = `SMP${Date.now().toString().slice(-8)}`

        // Update transaction to confirmed
        await supabaseAdmin
          .from('mpesa_transactions')
          .update({
            status: 'confirmed',
            mpesa_receipt_number: simulatedReceipt,
            callback_received_at: new Date().toISOString(),
          })
          .eq('id', transaction.id)

        // Update sale to completed
        await supabaseAdmin
          .from('sales')
          .update({
            payment_status: 'completed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', transaction.sale_id)

        // Return confirmed status
        return NextResponse.json(
          {
            success: true,
            transactionId: transaction.id,
            saleId: transaction.sale_id,
            status: 'confirmed',
            amount: transaction.amount,
            phoneNumber: transaction.phone_number,
            mpesaReceiptNumber: simulatedReceipt,
            errorMessage: null,
            initiatedAt: transaction.initiated_at,
            callbackReceivedAt: new Date().toISOString(),
            saleFinalizedAt: new Date().toISOString(),
            salePaymentStatus: 'completed',
            isConfirmed: true,
            isFailed: false,
            isPending: false,
            sandbox: true,
          },
          { status: 200 }
        )
      }
    }

    const { data: sale } = await supabaseAdmin
      .from('sales')
      .select('id, payment_status')
      .eq('id', transaction.sale_id)
      .single()

    // ========================================================================
    // AUTHORIZATION: Verify sale access
    // ========================================================================
    const saleAccessResult = await verifySaleAccess(profile, transaction.sale_id)
    
    if (!saleAccessResult.authorized) {
      logger.warn('[M-Pesa Status] Access denied', { reason: saleAccessResult.error })
      return forbiddenResponse(saleAccessResult.error)
    }

    // Return transaction status
    return NextResponse.json(
      {
        success: true,
        transactionId: transaction.id,
        saleId: transaction.sale_id,
        status: transaction.status,
        amount: transaction.amount,
        phoneNumber: transaction.phone_number,
        mpesaReceiptNumber: transaction.mpesa_receipt_number,
        errorMessage: transaction.error_message,
        initiatedAt: transaction.initiated_at,
        callbackReceivedAt: transaction.callback_received_at,
        saleFinalizedAt: transaction.sale_finalized_at,
        salePaymentStatus: sale?.payment_status || null,
        isConfirmed:
          transaction.status === 'confirmed' &&
          (sale?.payment_status === 'completed' || !!transaction.sale_finalized_at),
        isFailed: ['failed', 'cancelled', 'timeout'].includes(transaction.status),
        isPending: transaction.status === 'pending',
      },
      { status: 200 }
    )
  } catch (error) {
    logger.error('[M-Pesa Status] Endpoint error', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
