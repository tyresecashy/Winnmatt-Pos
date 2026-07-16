/**
 * Tuma Payments — STK Push Initiation
 * POST /api/payments/tuma/stk-push
 *
 * Initiates an STK Push to the customer's phone via Tuma Payments.
 * The customer receives a standard M-Pesa PIN prompt on their phone.
 *
 * Flow:
 * 1. Authenticate the POS user
 * 2. Validate request payload (saleId, phoneNumber, amount)
 * 3. Create pending sale (already done by caller for M-Pesa flow)
 * 4. Initiate STK Push via Tuma API
 * 5. Return checkout identifiers for POS polling
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, verifySaleAccess, unauthorizedResponse, forbiddenResponse } from '@/lib/auth-helpers'
import { badRequest } from '@/lib/api-errors'
import { supabaseAdmin } from '@/lib/supabase-server'
import { initiatePayment, isTumaAvailable } from '@/lib/modules/payments'
import { logger } from '@/lib/logger'
import { z } from 'zod'

// ─── Validation Schema ─────────────────────────────────────────────────────

const stkPushSchema = z.object({
  saleId: z.string().uuid(),
  phoneNumber: z.string().regex(/^(254|0|\+254)\d{9}$/, 'Phone must be a valid Safaricom number (e.g. 0712345678)'),
  amount: z.number().int().positive().max(150000),
  description: z.string().max(20).optional(),
})

// ─── POST Handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Generate correlation ID at the start of every STK Push request
  const correlationId = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

  try {
    // ========================================================================
    // SERVICE AVAILABILITY CHECK
    // ========================================================================
    if (!isTumaAvailable()) {
      logger.warn('[Tuma STK Push Route] Tuma not configured', { correlationId })
      return NextResponse.json(
        { error: 'Tuma Payments is not configured. Please set TUMA_API_KEY and TUMA_BUSINESS_EMAIL.' },
        { status: 503 }
      )
    }

    // ========================================================================
    // AUTHENTICATION
    // ========================================================================
    const authResult = await authenticateRequest(req)

    if (!authResult.success) {
      logger.warn('[Tuma STK Push Route] Auth failed', { correlationId, reason: authResult.error })
      return unauthorizedResponse(authResult.error)
    }

    const profile = authResult.profile!

    logger.info('[Tuma STK Push Route] Authenticated', {
      correlationId,
      userId: profile.id,
      branchId: profile.branch_id,
    })

    // ========================================================================
    // REQUEST VALIDATION
    // ========================================================================
    const body = await req.json().catch(() => null)

    if (!body) {
      logger.warn('[Tuma STK Push Route] No request body', { correlationId })
      return badRequest([{ field: 'body', message: 'Request body is required' }])
    }

    const parsed = stkPushSchema.safeParse(body)

    if (!parsed.success) {
      logger.warn('[Tuma STK Push Route] Validation failed', {
        correlationId,
        issues: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      })
      return badRequest(
        parsed.error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        }))
      )
    }

    const { saleId, phoneNumber, amount, description } = parsed.data

    logger.info('[Tuma STK Push Route] Request parsed', {
      correlationId,
      saleId,
      phoneFormat: phoneNumber.startsWith('0') ? '0-prefix' : phoneNumber.startsWith('254') ? '254-prefix' : phoneNumber.startsWith('+') ? 'plus-prefix' : 'other',
      phoneLength: phoneNumber.replace(/[^0-9]/g, '').length,
      amount,
      description: description || '(auto)',
    })

    // ========================================================================
    // SALE VERIFICATION
    // ========================================================================
    const saleAccessResult = await verifySaleAccess(profile, saleId)

    if (!saleAccessResult.authorized) {
      logger.warn('[Tuma STK Push Route] Sale access denied', {
        correlationId, saleId, reason: saleAccessResult.error,
      })
      return forbiddenResponse(saleAccessResult.error)
    }

    // Verify sale exists and is in pending payment state
    const { data: sale, error: saleError } = await supabaseAdmin
      .from('sales')
      .select('id, total_amount, payment_status, receipt_number')
      .eq('id', saleId)
      .single()

    if (saleError || !sale) {
      logger.warn('[Tuma STK Push Route] Sale not found', { correlationId, saleId })
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
    }

    logger.info('[Tuma STK Push Route] Sale verified', {
      correlationId,
      saleId,
      receiptNumber: sale.receipt_number,
      totalAmount: sale.total_amount,
      paymentStatus: sale.payment_status,
    })

    if (sale.payment_status !== 'pending') {
      logger.warn('[Tuma STK Push Route] Wrong payment status', {
        correlationId, saleId, actual: sale.payment_status,
      })
      return NextResponse.json(
        { error: `Sale payment status is '${sale.payment_status}', expected 'pending'` },
        { status: 409 }
      )
    }

    // Verify amount matches (with tolerance for rounding)
    const amountDiff = Math.abs((sale.total_amount || 0) - amount)
    if (amountDiff > 1) {
      logger.warn('[Tuma STK Push Route] Amount mismatch', {
        correlationId, saleId, saleAmount: sale.total_amount, providedAmount: amount,
      })
      return NextResponse.json(
        { error: `Amount mismatch: sale total is KSh ${sale.total_amount}, but payment is KSh ${amount}` },
        { status: 409 }
      )
    }

    // ========================================================================
    // INITIATE TUMA PAYMENT
    // ========================================================================
    logger.info('[Tuma STK Push Route] Calling initiatePayment', {
      correlationId,
      saleId,
      amount,
      callbackUrl: new URL('/api/payments/tuma/callback', req.url).toString(),
    })

    const result = await initiatePayment(
      saleId,
      phoneNumber,
      amount,
      description || `POS ${sale.receipt_number || saleId.slice(-8)}`,
      correlationId
    )

    if (!result.success) {
      logger.error('[Tuma STK Push Route] Payment initiation failed', {
        correlationId,
        saleId,
        error: result.error,
      })

      return NextResponse.json(
        { error: result.error || 'Failed to initiate payment. Please try again.' },
        { status: 502 }
      )
    }

    // ========================================================================
    // SUCCESS RESPONSE
    // ========================================================================
    logger.info('[Tuma STK Push Route] Success', {
      correlationId,
      saleId,
      checkoutRequestId: !!result.checkoutRequestId,
      merchantRequestId: !!result.merchantRequestId,
      transactionId: result.transactionId,
      customerMessage: result.customerMessage || '(default)',
    })

    return NextResponse.json(
      {
        success: true,
        message: result.customerMessage || 'STK Push sent. Ask customer to enter M-Pesa PIN.',
        checkoutRequestId: result.checkoutRequestId,
        merchantRequestId: result.merchantRequestId,
        transactionId: result.transactionId,
        correlationId,
      },
      { status: 200 }
    )
  } catch (error) {
    logger.error('[Tuma STK Push Route] Endpoint error', {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
