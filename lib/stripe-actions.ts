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
  apiVersion: '2026-06-24.dahlia' as typeof Stripe.API_VERSION,
})

export interface StripePaymentResult {
  success: boolean
  paymentIntentId?: string
  clientSecret?: string
  error?: string
}


