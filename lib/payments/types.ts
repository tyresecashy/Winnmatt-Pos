/**
 * Payment Gateway Abstraction
 * 
 * This module provides a unified interface for multiple payment providers.
 * Currently supports: M-Pesa, Cash, Card, Bank Transfer, Credit.
 */

// ─── Payment Types ──────────────────────────────────────────────────────────

export type PaymentMethod = 'cash' | 'card' | 'mpesa' | 'bank_transfer' | 'credit' | 'cheque'

export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'refunded'

export interface PaymentRequest {
  method: PaymentMethod
  amount: number
  currency: string
  reference?: string
  customerPhone?: string
  customerEmail?: string
  description?: string
  metadata?: Record<string, unknown>
}

export interface PaymentResponse {
  success: boolean
  transactionId?: string
  reference?: string
  status: PaymentStatus
  message?: string
  receiptNumber?: string
  providerReference?: string
  metadata?: Record<string, unknown>
  error?: string
}

export interface PaymentRefundRequest {
  transactionId: string
  amount: number
  reason?: string
  metadata?: Record<string, unknown>
}

export interface PaymentRefundResponse {
  success: boolean
  refundId?: string
  status: PaymentStatus
  message?: string
  error?: string
}

export interface PaymentStatusQuery {
  transactionId?: string
  reference?: string
}

export interface PaymentStatusResponse {
  transactionId: string
  status: PaymentStatus
  amount: number
  currency: string
  method: PaymentMethod
  createdAt: string
  updatedAt: string
  metadata?: Record<string, unknown>
}

// ─── Payment Provider Interface ─────────────────────────────────────────────

export interface PaymentProvider {
  id: string
  name: string
  description: string
  methods: PaymentMethod[]
  currencies: string[]
  isActive: boolean
  
  // Core methods
  initiatePayment(request: PaymentRequest): Promise<PaymentResponse>
  queryPaymentStatus(query: PaymentStatusQuery): Promise<PaymentStatusResponse>
  refundPayment(request: PaymentRefundRequest): Promise<PaymentRefundResponse>
  
  // Optional methods
  validateCredentials?(): Promise<boolean>
  getBalance?(): Promise<{ available: number; pending: number; currency: string }>
  getTransactionHistory?(filters: {
    startDate?: string
    endDate?: string
    status?: PaymentStatus
    limit?: number
  }): Promise<PaymentStatusResponse[]>
}

// ─── Payment Provider Registry ──────────────────────────────────────────────

export interface PaymentProviderConfig {
  id: string
  name: string
  enabled: boolean
  config: Record<string, unknown>
  credentials: Record<string, string>
}

export interface PaymentGatewayConfig {
  providers: PaymentProviderConfig[]
  defaultMethod: PaymentMethod
  autoRetry: boolean
  maxRetries: number
}
