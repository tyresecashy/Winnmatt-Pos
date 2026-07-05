'use server'

import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import { MpesaProvider, handleMpesaCallback } from './providers/mpesa'
import type {
  PaymentProvider,
  PaymentRequest,
  PaymentResponse,
  PaymentRefundRequest,
  PaymentRefundResponse,
  PaymentStatusQuery,
  PaymentStatusResponse,
  PaymentMethod,
} from './types'

// ─── Provider Registry ──────────────────────────────────────────────────────

const providers = new Map<string, PaymentProvider>()

/**
 * Initialize payment providers
 */
async function initializeProviders(): Promise<void> {
  // M-Pesa
  const mpesa = new MpesaProvider()
  await mpesa.initialize()
  providers.set('mpesa', mpesa)

  // Cash (always available, no external dependency)
  providers.set('cash', {
    id: 'cash',
    name: 'Cash',
    description: 'Cash payments',
    methods: ['cash'],
    currencies: ['KES', 'USD', 'EUR', 'GBP'],
    isActive: true,
    initiatePayment: async (request) => {
      return {
        success: true,
        transactionId: `CASH-${Date.now()}`,
        status: 'completed',
        message: 'Cash payment accepted',
      }
    },
    queryPaymentStatus: async (query) => {
      return {
        transactionId: query.transactionId || '',
        status: 'completed',
        amount: 0,
        currency: 'KES',
        method: 'cash',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    },
    refundPayment: async (request) => {
      return {
        success: true,
        status: 'completed',
        message: 'Cash refund processed',
      }
    },
  })

  // Card (placeholder - would integrate with card processor)
  providers.set('card', {
    id: 'card',
    name: 'Card',
    description: 'Credit/Debit card payments',
    methods: ['card'],
    currencies: ['KES', 'USD', 'EUR', 'GBP'],
    isActive: true,
    initiatePayment: async (request) => {
      // Placeholder - would integrate with card processor
      return {
        success: true,
        transactionId: `CARD-${Date.now()}`,
        status: 'completed',
        message: 'Card payment processed',
      }
    },
    queryPaymentStatus: async (query) => {
      return {
        transactionId: query.transactionId || '',
        status: 'completed',
        amount: 0,
        currency: 'KES',
        method: 'card',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    },
    refundPayment: async (request) => {
      return {
        success: true,
        status: 'completed',
        message: 'Card refund processed',
      }
    },
  })

  // Bank Transfer
  providers.set('bank_transfer', {
    id: 'bank_transfer',
    name: 'Bank Transfer',
    description: 'Direct bank transfers',
    methods: ['bank_transfer'],
    currencies: ['KES', 'USD', 'EUR', 'GBP'],
    isActive: true,
    initiatePayment: async (request) => {
      return {
        success: true,
        transactionId: `BANK-${Date.now()}`,
        status: 'pending',
        message: 'Bank transfer initiated. Awaiting confirmation.',
      }
    },
    queryPaymentStatus: async (query) => {
      return {
        transactionId: query.transactionId || '',
        status: 'pending',
        amount: 0,
        currency: 'KES',
        method: 'bank_transfer',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    },
    refundPayment: async (request) => {
      return {
        success: true,
        status: 'completed',
        message: 'Bank transfer refund initiated',
      }
    },
  })

  // Credit (store credit)
  providers.set('credit', {
    id: 'credit',
    name: 'Credit',
    description: 'Store credit / account payments',
    methods: ['credit'],
    currencies: ['KES'],
    isActive: true,
    initiatePayment: async (request) => {
      return {
        success: true,
        transactionId: `CREDIT-${Date.now()}`,
        status: 'completed',
        message: 'Credit payment recorded',
      }
    },
    queryPaymentStatus: async (query) => {
      return {
        transactionId: query.transactionId || '',
        status: 'completed',
        amount: 0,
        currency: 'KES',
        method: 'credit',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    },
    refundPayment: async (request) => {
      return {
        success: true,
        status: 'completed',
        message: 'Credit refund processed',
      }
    },
  })

  logger.info('[PaymentGateway] Initialized providers:', Array.from(providers.keys()))
}

// ─── Payment Gateway Service ────────────────────────────────────────────────

/**
 * Get a payment provider by method
 */
async function getProvider(method: PaymentMethod): Promise<PaymentProvider> {
  if (providers.size === 0) {
    await initializeProviders()
  }

  const provider = providers.get(method)
  if (!provider) {
    throw new Error(`No provider found for method: ${method}`)
  }

  return provider
}

/**
 * Process a payment
 */
export async function processPayment(
  request: PaymentRequest
): Promise<PaymentResponse> {
  try {
    const provider = await getProvider(request.method)

    // Log the payment attempt (best-effort)
    try {
      await supabaseAdmin
        .from('payment_logs')
        .insert({
          method: request.method,
          amount: request.amount,
          currency: request.currency,
          reference: request.reference,
          status: 'initiated',
        })
    } catch (logErr) {
      logger.warn('[PaymentGateway] payment_logs insert failed (table may not exist):', logErr)
    }

    // Process payment
    const response = await provider.initiatePayment(request)

    // Log the result (best-effort)
    try {
      await supabaseAdmin
        .from('payment_logs')
        .update({
          status: response.status,
          transaction_id: response.transactionId,
          error: response.error,
        })
        .eq('reference', request.reference)
    } catch (logErr) {
      logger.warn('[PaymentGateway] payment_logs update failed (table may not exist):', logErr)
    }

    return response
  } catch (error) {
    logger.error('[PaymentGateway] Payment failed:', error)
    return {
      success: false,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Payment processing failed',
    }
  }
}

/**
 * Query payment status
 */
export async function queryPaymentStatus(
  query: PaymentStatusQuery
): Promise<PaymentStatusResponse | null> {
  try {
    // Try all providers until one has the transaction
    for (const provider of providers.values()) {
      try {
        const status = await provider.queryPaymentStatus(query)
        if (status.transactionId) {
          return status
        }
      } catch {
        // Continue to next provider
      }
    }

    return null
  } catch (error) {
    logger.error('[PaymentGateway] Status query failed:', error)
    return null
  }
}

/**
 * Process a refund
 */
export async function processRefund(
  request: PaymentRefundRequest,
  method: PaymentMethod
): Promise<PaymentRefundResponse> {
  try {
    const provider = await getProvider(method)
    return await provider.refundPayment(request)
  } catch (error) {
    logger.error('[PaymentGateway] Refund failed:', error)
    return {
      success: false,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Refund processing failed',
    }
  }
}

/**
 * Handle M-Pesa callback
 */
export async function handleMpesaWebhook(
  callbackData: Record<string, unknown>
): Promise<void> {
  await handleMpesaCallback(callbackData as Parameters<typeof handleMpesaCallback>[0])
}

/**
 * Get available payment methods
 */
export async function getAvailablePaymentMethods(): Promise<{
  method: PaymentMethod
  name: string
  description: string
  available: boolean
}[]> {
  if (providers.size === 0) {
    await initializeProviders()
  }

  return Array.from(providers.values()).map(provider => ({
    method: provider.methods[0],
    name: provider.name,
    description: provider.description,
    available: provider.isActive,
  }))
}

/**
 * Validate provider credentials
 */
export async function validateProviderCredentials(
  method: PaymentMethod
): Promise<boolean> {
  try {
    const provider = await getProvider(method)
    if (provider.validateCredentials) {
      return await provider.validateCredentials()
    }
    return true
  } catch {
    return false
  }
}
