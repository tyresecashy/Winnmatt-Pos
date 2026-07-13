/**
 * Stripe Payment Intent Creation
 * POST /api/stripe/create-payment-intent
 *
 * Creates a Stripe PaymentIntent for card payment
 *
 * SECURITY:
 * - Requires a verified Supabase auth session
 * - Verifies user belongs to the sale's branch
 */

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabase-server'
import { authenticateRequest, verifySaleAccess, unauthorizedResponse, forbiddenResponse } from '@/lib/auth-helpers'
import { logger } from '@/lib/logger'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-06-24.dahlia' as const,
})

export async function POST(req: NextRequest) {
  try {
    // ========================================================================
    // AUTHENTICATION
    // ========================================================================
    const authResult = await authenticateRequest(req)
    
    if (!authResult.success) {
      logger.warn('[Stripe] Auth failed', { reason: authResult.error })
      return unauthorizedResponse(authResult.error)
    }

    const profile = authResult.profile!

    // ========================================================================
    // REQUEST VALIDATION
    // ========================================================================
    let body: unknown
    
    try {
      body = await req.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }

    const { saleId, amount, currency = 'kes' } = body as {
      saleId: string
      amount: number
      currency?: string
    }

    if (!saleId || !amount || amount <= 0) {
      return NextResponse.json(
        { error: 'saleId and positive amount are required' },
        { status: 400 }
      )
    }

    // ========================================================================
    // AUTHORIZATION: Verify sale access
    // ========================================================================
    const saleAccessResult = await verifySaleAccess(profile, saleId)
    
    if (!saleAccessResult.authorized) {
      return forbiddenResponse(saleAccessResult.error)
    }

    // ========================================================================
    // SALE VALIDATION
    // ========================================================================
    const { data: sale, error: saleError } = await supabaseAdmin
      .from('sales')
      .select('id, payment_status, total_amount, branch_id, receipt_number')
      .eq('id', saleId)
      .single()

    if (saleError || !sale) {
      return NextResponse.json(
        { error: 'Sale not found' },
        { status: 404 }
      )
    }

    if (sale.payment_status !== 'pending') {
      return NextResponse.json(
        { error: 'Sale is not awaiting payment' },
        { status: 400 }
      )
    }

    if (Math.abs(sale.total_amount - amount) > 1) {
      return NextResponse.json(
        { error: 'Amount does not match sale total' },
        { status: 400 }
      )
    }

    // ========================================================================
    // CREATE STRIPE PAYMENT INTENT
    // ========================================================================
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // KES is zero-decimal but stored as KSh, so convert to cents
      currency: currency.toLowerCase(),
      metadata: {
        saleId,
        receiptNumber: sale.receipt_number || '',
        branchId: sale.branch_id || '',
      },
      automatic_payment_methods: {
        enabled: true,
      },
    })

    logger.info('[Stripe] PaymentIntent created', {
      paymentIntentId: paymentIntent.id,
      saleId,
      amount,
    })

    return NextResponse.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    }, { status: 200 })
  } catch (error) {
    logger.error('[Stripe] Create PaymentIntent error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
