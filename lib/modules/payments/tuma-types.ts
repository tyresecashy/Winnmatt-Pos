/**
 * Tuma Payments — Type Definitions
 *
 * Tuma API reference (v1.0.6):
 * - Auth: POST /auth/token with { email, api_key } → { token, expires_in, token_type }
 * - STK Push: POST /payment/stk-push with { amount, phone, callback_url, description }
 *   → { merchant_request_id, checkout_request_id, response_code, response_description, customer_message }
 * - Callback: POST to callback_url with payment result
 */

// ─── Auth ─────────────────────────────────────────────────────────────────

export interface TumaAuthRequest {
  email: string
  api_key: string
}

/**
 * Actual Tuma API auth response (v1.0.6):
 * {
 *   "success": true,
 *   "message": "Authentication successful",
 *   "data": {
 *     "token": "eyJ...JWT...",
 *     "shop": { "id": "...", "name": "...", "email": "..." }
 *   }
 * }
 * Note: `expires_in` is NOT provided — calculate from JWT payload claims.
 */
export interface TumaAuthApiResponse {
  success: boolean
  message: string
  data: {
    token: string
    shop?: {
      id: string
      name: string
      email: string
    }
  }
}

// ─── STK Push ─────────────────────────────────────────────────────────────

export interface TumaSTKPushRequest {
  amount: number
  phone: string
  callback_url: string
  description: string
  // NOTE: Tuma API v1.0.6 rejects invoice_number — do not include it
}

/**
 * Actual Tuma API STK Push response (v1.0.6):
 * Fields are wrapped inside a `data` envelope at the top level.
 * {
 *   "success": true,
 *   "message": "Payment request sent successfully...",
 *   "data": {
 *     "merchant_request_id": "4640-...",
 *     "checkout_request_id": "ws_CO_...",
 *     "customer_message": "Success. Request accepted..."
 *   }
 * }
 */
export interface TumaSTKPushApiResponse {
  success: boolean
  message: string
  data: {
    merchant_request_id: string
    checkout_request_id: string
    customer_message: string
  }
}

/**
 * Internal contract for the STK Push response used by the service layer.
 * Populated by extracting fields from TumaSTKPushApiResponse.data.
 */
export interface TumaSTKPushResponse {
  merchant_request_id: string
  checkout_request_id: string
  customer_message: string
}

// ─── Callback ──────────────────────────────────────────────────────────────

export type TumaCallbackStatus = 'completed' | 'failed' | 'cancelled' | 'timeout'

export interface TumaCallbackPayload {
  status: TumaCallbackStatus
  merchant_request_id: string
  checkout_request_id: string
  mpesa_receipt_number: string | null
  amount: number
  result_code: string
  result_desc: string
  failure_reason: string | null
  timestamp: string
}

// ─── Service Layer ─────────────────────────────────────────────────────────

export interface InitiatePaymentResult {
  success: boolean
  transactionId?: string
  merchantRequestId?: string
  checkoutRequestId?: string
  customerMessage?: string
  error?: string
}

export interface PaymentStatusResult {
  success: boolean
  status?: string
  mpesaReceiptNumber?: string | null
  errorMessage?: string | null
  isConfirmed?: boolean
  isFailed?: boolean
  isPending?: boolean
  transactionId?: string
  saleId?: string
  error?: string
}

export interface TumaConfig {
  apiUrl: string
  apiKey: string
  businessEmail: string
  callbackUrl: string
}
