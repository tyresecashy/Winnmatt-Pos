/**
 * M-Pesa Payment Provider
 * 
 * Implements the Safaricom M-Pesa Daraja API for STK Push payments.
 */

import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import type {
  PaymentProvider,
  PaymentRequest,
  PaymentResponse,
  PaymentRefundRequest,
  PaymentRefundResponse,
  PaymentStatusQuery,
  PaymentStatusResponse,
  PaymentStatus,
} from './types'

// ─── M-Pesa Configuration ───────────────────────────────────────────────────

interface MpesaConfig {
  consumerKey: string
  consumerSecret: string
  shortCode: string
  passKey: string
  callbackUrl: string
  environment: 'sandbox' | 'production'
}

// ─── M-Pesa Provider ────────────────────────────────────────────────────────

export class MpesaProvider implements PaymentProvider {
  id = 'mpesa'
  name = 'M-Pesa'
  description = 'Safaricom M-Pesa mobile money payments'
  methods = ['mpesa'] as const
  currencies = ['KES'] as const
  isActive = true

  private config: MpesaConfig | null = null
  private accessToken: string | null = null
  private tokenExpiry: number = 0

  constructor(config?: MpesaConfig) {
    this.config = config || null
  }

  /**
   * Initialize provider with config from database
   */
  async initialize(): Promise<void> {
    try {
      const { data } = await supabaseAdmin
        .from('integration_configs')
        .select('config, credentials')
        .eq('integration_id', 'mpesa')
        .single()

      if (data) {
        this.config = {
          consumerKey: data.credentials?.consumer_key || '',
          consumerSecret: data.credentials?.consumer_secret || '',
          shortCode: data.config?.short_code || '',
          passKey: data.config?.pass_key || '',
          callbackUrl: data.config?.callback_url || '',
          environment: (data.config?.environment as 'sandbox' | 'production') || 'sandbox',
        }
      }
    } catch (error) {
      logger.error('[Mpesa] Failed to load config:', error)
    }
  }

  /**
   * Get M-Pesa API base URL
   */
  private getBaseUrl(): string {
    return this.config?.environment === 'production'
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke'
  }

  /**
   * Generate M-Pesa password
   */
  private generatePassword(): string {
    const timestamp = new Date().toISOString().replace(/[-T:\.Z]/g, '').substring(0, 14)
    const data = `${this.config?.shortCode}${this.config?.passKey}${timestamp}`
    return Buffer.from(data).toString('base64')
  }

  /**
   * Get access token from M-Pesa API
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if valid
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken
    }

    if (!this.config) {
      throw new Error('M-Pesa not configured')
    }

    const auth = Buffer.from(`${this.config.consumerKey}:${this.config.consumerSecret}`).toString('base64')

    const response = await fetch(`${this.getBaseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to get M-Pesa access token: ${response.status}`)
    }

    const data = await response.json()
    this.accessToken = data.access_token
    this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000 // Refresh 1 minute early

    return this.accessToken!
  }

  /**
   * Initiate STK Push payment
   */
  async initiatePayment(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      if (!this.config) {
        await this.initialize()
      }

      if (!this.config) {
        return { success: false, status: 'failed', error: 'M-Pesa not configured' }
      }

      if (!request.customerPhone) {
        return { success: false, status: 'failed', error: 'Phone number required for M-Pesa' }
      }

      // Format phone number (remove + and leading 0)
      let phone = request.customerPhone.replace(/[^\d]/g, '')
      if (phone.startsWith('0')) {
        phone = '254' + phone.substring(1)
      }
      if (!phone.startsWith('254')) {
        phone = '254' + phone
      }

      const accessToken = await this.getAccessToken()
      const password = this.generatePassword()
      const timestamp = new Date().toISOString().replace(/[-T:\.Z]/g, '').substring(0, 14)

      const requestBody = {
        BusinessShortCode: this.config.shortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(request.amount),
        PartyA: phone,
        PartyB: this.config.shortCode,
        PhoneNumber: phone,
        CallBackURL: this.config.callbackUrl,
        AccountReference: request.reference || 'WINNMATT',
        TransactionDesc: request.description || 'Payment',
      }

      const response = await fetch(`${this.getBaseUrl()}/mpesa/stkpush/v1/processrequest`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      const data = await response.json()

      if (data.ResponseCode === '0') {
        // Store transaction in database
        const { data: transaction, error: dbError } = await supabaseAdmin
          .from('mpesa_transactions')
          .insert({
            checkout_request_id: data.CheckoutRequestID,
            merchant_request_id: data.MerchantRequestID,
            amount: request.amount,
            phone_number: phone,
            account_reference: request.reference || 'WINNMATT',
            status: 'pending',
          })
          .select()
          .single()

        if (dbError) {
          logger.error('[Mpesa] Failed to store transaction:', dbError)
        }

        return {
          success: true,
          transactionId: transaction?.id || data.CheckoutRequestID,
          reference: data.CheckoutRequestID,
          status: 'pending',
          message: 'STK Push sent successfully. Please check your phone.',
          providerReference: data.CheckoutRequestID,
          metadata: {
            merchantRequestId: data.MerchantRequestID,
            checkoutRequestId: data.CheckoutRequestID,
          },
        }
      } else {
        return {
          success: false,
          status: 'failed',
          error: data.CustomerMessage || data.ResponseDescription || 'STK Push failed',
        }
      }
    } catch (error) {
      logger.error('[Mpesa] Payment initiation failed:', error)
      return {
        success: false,
        status: 'failed',
        error: error instanceof Error ? error.message : 'M-Pesa payment failed',
      }
    }
  }

  /**
   * Query payment status
   */
  async queryPaymentStatus(query: PaymentStatusQuery): Promise<PaymentStatusResponse> {
    try {
      if (!this.config) {
        await this.initialize()
      }

      if (!this.config) {
        throw new Error('M-Pesa not configured')
      }

      // Check local database first
      const { data: localTransaction } = await supabaseAdmin
        .from('mpesa_transactions')
        .select('*')
        .eq('checkout_request_id', query.transactionId || query.reference)
        .single()

      if (localTransaction) {
        return {
          transactionId: localTransaction.checkout_request_id,
          status: this.mapMpesaStatus(localTransaction.status),
          amount: localTransaction.amount,
          currency: 'KES',
          method: 'mpesa',
          createdAt: localTransaction.created_at,
          updatedAt: localTransaction.updated_at || localTransaction.created_at,
          metadata: {
            resultCode: localTransaction.result_code,
            resultDescription: localTransaction.result_description,
          },
        }
      }

      // Query M-Pesa API
      const accessToken = await this.getAccessToken()

      const response = await fetch(`${this.getBaseUrl()}/mpesa/transactionstatus/v1/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          BusinessShortCode: this.config.shortCode,
          Password: this.generatePassword(),
          Timestamp: new Date().toISOString().replace(/[-T:\.Z]/g, '').substring(0, 14),
          CheckoutRequestID: query.transactionId || query.reference,
        }),
      })

      const data = await response.json()

      return {
        transactionId: query.transactionId || query.reference || '',
        status: data.ResponseCode === '0' ? 'completed' : 'failed',
        amount: 0,
        currency: 'KES',
        method: 'mpesa',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: data,
      }
    } catch (error) {
      logger.error('[Mpesa] Status query failed:', error)
      throw error
    }
  }

  /**
   * Refund payment (not supported by M-Pesa STK Push)
   */
  async refundPayment(request: PaymentRefundRequest): Promise<PaymentRefundResponse> {
    // M-Pesa STK Push doesn't support direct refunds
    // Would need to use Business-to-Customer API instead
    return {
      success: false,
      status: 'failed',
      error: 'Direct refunds not supported for M-Pesa STK Push. Use Business-to-Customer API.',
    }
  }

  /**
   * Validate M-Pesa credentials
   */
  async validateCredentials(): Promise<boolean> {
    try {
      await this.getAccessToken()
      return true
    } catch {
      return false
    }
  }

  /**
   * Map M-Pesa status to PaymentStatus
   */
  private mapMpesaStatus(status: string): PaymentStatus {
    switch (status) {
      case 'completed':
      case 'success':
        return 'completed'
      case 'pending':
      case 'processing':
        return 'processing'
      case 'failed':
      case 'cancelled':
        return 'failed'
      default:
        return 'pending'
    }
  }
}

/**
 * M-Pesa callback handler for webhook
 */
export async function handleMpesaCallback(callbackData: {
  Body: {
    stkCallback: {
      MerchantRequestID: string
      CheckoutRequestID: string
      ResultCode: number
      ResultDesc: string
      CallbackMetadata?: {
        Item: Array<{
          Name: string
          Value: unknown
        }>
      }
    }
  }
}): Promise<void> {
  try {
    const { stkCallback } = callbackData.Body
    const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback

    // Extract metadata
    let amount = 0
    let phoneNumber = ''
    let transactionId = ''

    if (CallbackMetadata?.Item) {
      for (const item of CallbackMetadata.Item) {
        switch (item.Name) {
          case 'Amount':
            amount = item.Value as number
            break
          case 'PhoneNumber':
            phoneNumber = String(item.Value)
            break
          case 'MpesaReceiptNumber':
            transactionId = item.Value as string
            break
        }
      }
    }

    // Update transaction in database
    const { error } = await supabaseAdmin
      .from('mpesa_transactions')
      .update({
        status: ResultCode === 0 ? 'completed' : 'failed',
        result_code: ResultCode,
        result_description: ResultDesc,
        mpesa_receipt_number: transactionId,
        updated_at: new Date().toISOString(),
      })
      .eq('checkout_request_id', CheckoutRequestID)

    if (error) {
      logger.error('[Mpesa] Failed to update transaction:', error)
    }

    // If successful, trigger automation events
    if (ResultCode === 0) {
      const { emitEvent } = await import('@/lib/automation/events')
      await emitEvent('payment.received', {
        provider: 'mpesa',
        transactionId,
        amount,
        phoneNumber,
        checkoutRequestId: CheckoutRequestID,
      }, { source: 'payment', entity_type: 'payment', entity_id: CheckoutRequestID })
    }
  } catch (error) {
    logger.error('[Mpesa] Callback handling failed:', error)
  }
}
