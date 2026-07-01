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

export async function GET(req: NextRequest) {
  try {
    // ========================================================================
    // AUTHENTICATION
    // ========================================================================
    const authResult = await authenticateRequest(req)
    
    if (!authResult.success) {
      console.warn('[M-Pesa Status] Auth failed:', authResult.error)
      return unauthorizedResponse(authResult.error)
    }

    const profile = authResult.profile!

    // ========================================================================
    // REQUEST VALIDATION
    // ========================================================================
    const searchParams = req.nextUrl.searchParams
    const checkoutRequestId = searchParams.get('checkoutRequestId')
    const saleId = searchParams.get('saleId')

    if (!checkoutRequestId && !saleId) {
      return NextResponse.json(
        { error: 'Missing checkoutRequestId or saleId parameter' },
        { status: 400 }
      )
    }

    // Validate query parameter types
    if (checkoutRequestId && typeof checkoutRequestId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid checkoutRequestId format' },
        { status: 400 }
      )
    }

    if (saleId && typeof saleId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid saleId format' },
        { status: 400 }
      )
    }

    let transactionResult

    if (checkoutRequestId) {
      transactionResult = await getMpesaTransactionByCheckoutId(checkoutRequestId)
    } else {
      transactionResult = await getMpesaTransactionBySaleId(saleId!)
    }

    if (!transactionResult.success || !transactionResult.transaction) {
      console.warn('[M-Pesa Status] Transaction not found', {
        checkoutRequestId: checkoutRequestId || 'N/A',
        saleId: saleId || 'N/A',
      })
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      )
    }

    const transaction = transactionResult.transaction

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
      console.warn('[M-Pesa Status] Access denied:', {
        userId: profile.id,
        saleId: transaction.sale_id,
        reason: saleAccessResult.error,
      })
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
    console.error('[M-Pesa Status] Endpoint error', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
