/**
 * Tuma Payments — Payment Status Check
 * GET /api/payments/tuma/status?checkoutRequestId=...&saleId=...
 *
 * Allows POS to check payment status via polling.
 * Returns the same shape as the existing M-Pesa status endpoint
 * so the PaymentPanel polling mechanism works identically.
 *
 * SECURITY:
 * - Requires a verified Supabase auth session
 * - Verifies user belongs to the sale's branch
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, verifySaleAccess, unauthorizedResponse, forbiddenResponse } from '@/lib/auth-helpers'
import { badRequest } from '@/lib/api-errors'
import { getPaymentStatus } from '@/lib/modules/payments'
import { logger } from '@/lib/logger'

// ─── GET Handler ───────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    // ========================================================================
    // AUTHENTICATION
    // ========================================================================
    const authResult = await authenticateRequest(req)

    if (!authResult.success) {
      logger.warn('[Tuma Status] Auth failed', { reason: authResult.error })
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
      return badRequest([{ field: 'checkoutRequestId', message: 'Missing checkoutRequestId or saleId parameter' }])
    }

    // ========================================================================
    // STATUS LOOKUP
    // ========================================================================
    const result = await getPaymentStatus(
      checkoutRequestId || undefined,
      saleId || undefined
    )

    if (!result.success || !result.transactionId) {
      const statusCode = result.error === 'Transaction not found' ? 404 : 500
      return NextResponse.json(
        { error: result.error || 'Failed to check payment status' },
        { status: statusCode }
      )
    }

    // ========================================================================
    // AUTHORIZATION: Verify sale access if saleId is present
    // ========================================================================
    if (result.saleId) {
      const saleAccessResult = await verifySaleAccess(profile, result.saleId)

      if (!saleAccessResult.authorized) {
        logger.warn('[Tuma Status] Access denied', { reason: saleAccessResult.error })
        return forbiddenResponse(saleAccessResult.error)
      }
    }

    // ========================================================================
    // RESPONSE — matches M-Pesa status shape for compatibility
    // ========================================================================
    return NextResponse.json(
      {
        success: true,
        transactionId: result.transactionId,
        saleId: result.saleId || null,
        status: result.status,
        mpesaReceiptNumber: result.mpesaReceiptNumber || null,
        errorMessage: result.errorMessage || null,
        isConfirmed: result.isConfirmed || false,
        isFailed: result.isFailed || false,
        isPending: result.isPending || false,
        provider: 'tuma',
      },
      { status: 200 }
    )
  } catch (error) {
    logger.error('[Tuma Status] Endpoint error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
