'use server'

import { logger } from '@/lib/logger'

/**
 * Stripe Payment Server Actions
 * Handles Stripe card payment completion
 */

import Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabase-server'
import { authenticateServerAction } from './auth-helpers'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-06-24.dahlia' as any,
})

export interface StripePaymentResult {
  success: boolean
  paymentIntentId?: string
  clientSecret?: string
  error?: string
}

/**
 * Create a Stripe PaymentIntent for a sale
 */
export async function createStripePaymentIntent(
  saleId: string,
  amount: number,
  currency: string = 'kes'
): Promise<StripePaymentResult> {
  try {
    await authenticateServerAction()

    // Validate sale exists and is pending
    const { data: sale, error: saleError } = await supabaseAdmin
      .from('sales')
      .select('id, payment_status, total_amount, receipt_number, branch_id')
      .eq('id', saleId)
      .single()

    if (saleError || !sale) {
      return { success: false, error: 'Sale not found' }
    }

    if (sale.payment_status !== 'pending') {
      return { success: false, error: 'Sale is not awaiting payment' }
    }

    if (Math.abs(sale.total_amount - amount) > 1) {
      return { success: false, error: 'Amount does not match sale total' }
    }

    // Create PaymentIntent - KES is zero-decimal, but we store amounts as KSh (not cents)
    // so multiply by 100 to convert to cents for Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
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

    return {
      success: true,
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret || undefined,
    }
  } catch (error) {
    logger.error('[Stripe] Failed to create PaymentIntent', error)
    return {
      success: false,
      error: 'Operation failed. Please try again.',
    }
  }
}

/**
 * Confirm a Stripe payment (called after webhook confirmation)
 */
export async function confirmStripePayment(
  saleId: string,
  paymentIntentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await authenticateServerAction()

    // Verify the PaymentIntent with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

    if (paymentIntent.status !== 'succeeded') {
      return { success: false, error: `Payment status: ${paymentIntent.status}` }
    }

    // Update sale
    const { error: updateError } = await supabaseAdmin
      .from('sales')
      .update({
        payment_status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', saleId)

    if (updateError) {
      logger.error('[Stripe] Failed to update sale', updateError)
      return { success: false, error: 'Failed to update sale status' }
    }

    // Store payment intent ID in notes field
    try {
      const { data: sale } = await supabaseAdmin
        .from('sales')
        .select('notes')
        .eq('id', saleId)
        .single()
      const existingNotes = sale?.notes ? JSON.parse(sale.notes) : {}
      existingNotes.stripePaymentIntentId = paymentIntentId
      await supabaseAdmin
        .from('sales')
        .update({ notes: JSON.stringify(existingNotes) })
        .eq('id', saleId)
    } catch {
      // Non-critical - payment is still completed
    }

    // Log payment - table may not exist yet, so wrap in try-catch
    try {
      await supabaseAdmin.from('payment_logs').insert({
        sale_id: saleId,
        provider: 'stripe',
        transaction_id: paymentIntentId,
        amount: paymentIntent.amount,
        status: 'completed',
        metadata: JSON.stringify({
          paymentMethod: paymentIntent.payment_method_types?.[0] || 'card',
        }),
      })
    } catch (logError) {
      logger.warn('[Stripe] Failed to log payment (table may not exist)', logError as Record<string, unknown>)
    }

    logger.info('[Stripe] Payment confirmed', { saleId, paymentIntentId })
    return { success: true }
  } catch (error) {
    logger.error('[Stripe] Failed to confirm payment', error)
    return {
      success: false,
      error: 'Operation failed. Please try again.',
    }
  }
}

/**
 * Refund a Stripe payment
 */
export async function refundStripePayment(
  saleId: string,
  amount?: number
): Promise<{ success: boolean; refundId?: string; error?: string }> {
  try {
    await authenticateServerAction()

    // Get the payment intent from the sale's notes or payment_logs
    const { data: sale, error: saleError } = await supabaseAdmin
      .from('sales')
      .select('id, total_amount, receipt_number, notes')
      .eq('id', saleId)
      .single()

    if (saleError || !sale) {
      return { success: false, error: 'Sale not found' }
    }

    // Look up payment_intent_id from notes first, then payment_logs
    let paymentIntentId: string | null = null
    try {
      const notes = sale.notes ? JSON.parse(sale.notes) : {}
      paymentIntentId = notes.stripePaymentIntentId || null
    } catch {
      // notes is not JSON
    }

    if (!paymentIntentId) {
      try {
        const { data: paymentLog } = await supabaseAdmin
          .from('payment_logs')
          .select('transaction_id')
          .eq('sale_id', saleId)
          .eq('provider', 'stripe')
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        if (paymentLog?.transaction_id) {
          paymentIntentId = paymentLog.transaction_id
        }
      } catch {
        // payment_logs table may not exist
      }
    }

    if (!paymentIntentId) {
      return { success: false, error: 'No Stripe payment found for this sale' }
    }

    // Create refund
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amount ? Math.round(amount * 100) : undefined,
    })

    // Log refund
    try {
      await supabaseAdmin.from('payment_logs').insert({
        sale_id: saleId,
        provider: 'stripe',
        transaction_id: refund.id,
        amount: refund.amount,
        status: 'refunded',
        metadata: JSON.stringify({
          originalPaymentIntent: paymentIntentId,
          refundReason: 'customer_request',
        }),
      })
    } catch (logError) {
      logger.warn('[Stripe] Failed to log refund (table may not exist)', logError as Record<string, unknown>)
    }

    logger.info('[Stripe] Refund created', { saleId, refundId: refund.id })
    return { success: true, refundId: refund.id }
  } catch (error) {
    logger.error('[Stripe] Refund failed', error)
    return {
      success: false,
      error: 'Operation failed. Please try again.',
    }
  }
}
