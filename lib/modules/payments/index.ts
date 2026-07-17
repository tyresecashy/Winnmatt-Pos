/**
 * Payments Module — Public API
 *
 * Provides a unified interface for payment processing.
 * Currently supports Tuma Payments as the primary provider.
 * Designed for extensibility — add new providers by implementing the same pattern.
 *
 * Cross-module communication: Via events (payment.confirmed / payment.failed)
 *
 * Usage:
 *   import { initiatePayment, handleCallback } from '@/lib/modules/payments'
 */

// Tuma provider
export { initiatePayment, handleCallback, getPaymentStatus, isTumaAvailable, recoverPendingPayments } from './tuma-service'
export type { InitiatePaymentResult, PaymentStatusResult, TumaCallbackPayload, TumaConfig } from './tuma-types'
export { formatPhoneNumber } from './tuma-client'

// Database actions (for direct DB access in routes/services)
export {
  createPaymentTransaction,
  updatePaymentTransactionCallback,
  getPaymentTransactionByCheckoutId,
  getPaymentTransactionBySaleId,
  finalizePaymentSale,
  failPaymentSale,
  restoreInventoryForFailedPayment,
  getPendingPaymentTransactions,
  getStuckPaymentTransactions,
} from './tuma-actions'
export type { PaymentTransaction } from './tuma-actions'
