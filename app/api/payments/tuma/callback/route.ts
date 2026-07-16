/**
 * Tuma Payments — Callback Webhook
 * POST /api/payments/tuma/callback
 *
 * Receives payment results from Tuma Payments when an STK Push completes,
 * fails, is cancelled, or times out.
 *
 * Called by Tuma API (not by the POS).
 * Must return 200 OK quickly — heavy processing is done synchronously.
 *
 * Flow:
 * 1. Validate incoming payload
 * 2. Look up transaction by checkout_request_id
 * 3. Update payment status and sale
 * 4. Publish event for POS real-time updates
 * 5. Return 200 acknowledgment
 */

import { NextRequest, NextResponse } from 'next/server'
import { handleCallback, isTumaAvailable } from '@/lib/modules/payments'
import type { TumaCallbackPayload } from '@/lib/modules/payments'
import { logger } from '@/lib/logger'

// ─── POST Handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Generate correlation ID for callback tracing
  const correlationId = crypto.randomUUID?.() || `cb-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

  try {
    // ========================================================================
    // AVAILABILITY CHECK
    // ========================================================================
    if (!isTumaAvailable()) {
      logger.warn('[Tuma Callback Route] Tuma not configured', { correlationId })
      return NextResponse.json({ error: 'Tuma not configured' }, { status: 503 })
    }

    // ========================================================================
    // PAYLOAD VALIDATION
    // ========================================================================
    const body = await req.json().catch(() => null)

    if (!body || typeof body !== 'object') {
      logger.warn('[Tuma Callback Route] Invalid payload', { correlationId })
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    // Validate required fields
    const payload = body as Record<string, unknown>

    logger.info('[Tuma Callback Route] Callback received', {
      correlationId,
      bodyKeys: Object.keys(payload),
      merchantRequestId: !!payload.merchant_request_id,
      checkoutRequestId: !!payload.checkout_request_id,
      status: payload.status,
      resultCode: payload.result_code,
      resultDesc: payload.result_desc,
    })

    if (!payload.merchant_request_id || !payload.checkout_request_id) {
      logger.warn('[Tuma Callback Route] Missing required fields', {
        correlationId,
        hasMerchantRequestId: !!payload.merchant_request_id,
        hasCheckoutRequestId: !!payload.checkout_request_id,
      })
      return NextResponse.json({ error: 'Missing merchant_request_id or checkout_request_id' }, { status: 400 })
    }

    const validStatuses = ['completed', 'failed', 'cancelled', 'timeout']
    if (!payload.status || !validStatuses.includes(payload.status as string)) {
      logger.warn('[Tuma Callback Route] Invalid status', { correlationId, status: payload.status })
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    // ========================================================================
    // PROCESS CALLBACK
    // ========================================================================
    const callbackPayload: TumaCallbackPayload = {
      status: payload.status as TumaCallbackPayload['status'],
      merchant_request_id: payload.merchant_request_id as string,
      checkout_request_id: payload.checkout_request_id as string,
      mpesa_receipt_number: (payload.mpesa_receipt_number as string) || null,
      amount: typeof payload.amount === 'number' ? payload.amount : Number(payload.amount) || 0,
      result_code: String(payload.result_code || ''),
      result_desc: String(payload.result_desc || ''),
      failure_reason: (payload.failure_reason as string) || null,
      timestamp: String(payload.timestamp || new Date().toISOString()),
    }

    logger.info('[Tuma Callback Route] Processing callback', {
      correlationId,
      merchantRequestId: callbackPayload.merchant_request_id,
      checkoutRequestId: callbackPayload.checkout_request_id,
      status: callbackPayload.status,
      amount: callbackPayload.amount,
    })

    const result = await handleCallback(callbackPayload, correlationId)

    if (!result.success) {
      logger.error('[Tuma Callback Route] Processing failed', {
        correlationId,
        merchantRequestId: callbackPayload.merchant_request_id,
        error: result.error,
      })
      // Still return 200 to Tuma to prevent retries — we've logged the error
      return NextResponse.json(
        { received: true, warning: result.error, correlationId },
        { status: 200 }
      )
    }

    // ========================================================================
    // SUCCESS — Acknowledge receipt
    // ========================================================================
    logger.info('[Tuma Callback Route] Processed successfully', {
      correlationId,
      merchantRequestId: callbackPayload.merchant_request_id,
      status: callbackPayload.status,
    })

    return NextResponse.json(
      { received: true, status: callbackPayload.status, correlationId },
      { status: 200 }
    )
  } catch (error) {
    logger.error('[Tuma Callback Route] Unexpected error', {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    })
    // Always return 200 to Tuma to prevent spurious retries
    return NextResponse.json(
      { received: true, warning: 'Internal processing error — logged for review', correlationId },
      { status: 200 }
    )
  }
}
