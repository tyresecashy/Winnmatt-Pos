/**
 * Stripe Webhook Handler
 * POST /api/stripe/webhook
 *
 * Handles Stripe webhook events for payment confirmation
 *
 * Events handled:
 * - payment_intent.succeeded → Confirm sale
 * - payment_intent.payment_failed → Mark sale as failed
 */

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-06-24.dahlia' as const,
})

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const signature = req.headers.get('stripe-signature')

    if (!signature) {
      logger.warn('[Stripe Webhook] Missing signature header')
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 400 }
      )
    }

    if (!webhookSecret) {
      logger.error('[Stripe Webhook] STRIPE_WEBHOOK_SECRET not configured')
      return NextResponse.json(
        { error: 'Webhook not configured' },
        { status: 500 }
      )
    }

    // ========================================================================
    // VERIFY WEBHOOK SIGNATURE
    // ========================================================================
    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      logger.error('[Stripe Webhook] Signature verification failed', err)
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      )
    }

    // ========================================================================
    // HANDLE EVENT
    // ========================================================================
    logger.info('[Stripe Webhook] Received event', { type: event.type })

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const saleId = paymentIntent.metadata.saleId

        if (!saleId) {
          logger.warn('[Stripe Webhook] No saleId in payment metadata')
          break
        }

        // Update sale to completed
        const { error: updateError } = await supabaseAdmin
          .from('sales')
          .update({
            payment_status: 'completed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', saleId)

        if (updateError) {
          logger.error('[Stripe Webhook] Failed to update sale', updateError, { saleId })
          break
        }

        // Store payment intent ID in notes field
        try {
          const { data: sale } = await supabaseAdmin
            .from('sales')
            .select('notes')
            .eq('id', saleId)
            .single()
          const existingNotes = sale?.notes ? JSON.parse(sale.notes) : {}
          existingNotes.stripePaymentIntentId = paymentIntent.id
          await supabaseAdmin
            .from('sales')
            .update({ notes: JSON.stringify(existingNotes) })
            .eq('id', saleId)
        } catch {
          // Non-critical
        }

        // Log the payment
        try {
          await supabaseAdmin.from('payment_logs').insert({
            sale_id: saleId,
            provider: 'stripe',
            transaction_id: paymentIntent.id,
            amount: paymentIntent.amount,
            status: 'completed',
            metadata: JSON.stringify({
              paymentMethod: paymentIntent.payment_method_types?.[0] || 'card',
              receiptEmail: paymentIntent.receipt_email,
            }),
          })
        } catch (logError) {
          logger.warn('[Stripe Webhook] Failed to log payment (table may not exist)', logError as Record<string, unknown>)
        }

        logger.info('[Stripe Webhook] Sale confirmed', { saleId, paymentIntentId: paymentIntent.id })
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const saleId = paymentIntent.metadata.saleId

        if (!saleId) {
          logger.warn('[Stripe Webhook] No saleId in failed payment metadata')
          break
        }

        // Update sale to failed
        await supabaseAdmin
          .from('sales')
          .update({
            payment_status: 'failed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', saleId)

        // Log the failure
        try {
          await supabaseAdmin.from('payment_logs').insert({
            sale_id: saleId,
            provider: 'stripe',
            transaction_id: paymentIntent.id,
            amount: paymentIntent.amount,
            status: 'failed',
            metadata: JSON.stringify({
              error: paymentIntent.last_payment_error?.message || 'Payment failed',
            }),
          })
        } catch (logError) {
          logger.warn('[Stripe Webhook] Failed to log payment failure', logError as Record<string, unknown>)
        }

        logger.info('[Stripe Webhook] Sale marked as failed', { saleId })
        break
      }

      default:
        logger.info('[Stripe Webhook] Unhandled event type', { type: event.type })
    }

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (error) {
    logger.error('[Stripe Webhook] Error processing webhook', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}
