/**
 * M-Pesa Daraja Integration Service
 * Handles all Safaricom Daraja API interactions for STK Push
 * 
 * Production-grade implementation with:
 * - Access token management (10 min cache)
 * - STK Push request builder
 * - Callback parsing
 * - Structured logging
 * - Error handling
 */

import crypto from 'crypto'
import { logger } from '@/lib/logger'

interface DarajaConfig {
  consumerKey: string
  consumerSecret: string
  paybill: string
  accountReference: string
  callbackUrl: string
  environment: 'sandbox' | 'production'
}

interface AccessTokenResponse {
  access_token: string
  expires_in: number
}

interface STKPushRequest {
  BusinessShortCode: string
  Password: string
  Timestamp: string
  TransactionType: string
  Amount: number
  PartyA: string
  PartyB: string
  PhoneNumber: string
  CallBackURL: string
  AccountReference: string
  TransactionDesc: string
}

interface STKPushResponse {
  MerchantRequestID: string
  CheckoutRequestID: string
  ResponseCode: string
  ResponseDescription: string
  CustomerMessage: string
  [key: string]: unknown
}

interface CallbackPayload {
  Body: {
    stkCallback: {
      MerchantRequestID: string
      CheckoutRequestID: string
      ResultCode: number
      ResultDesc: string
      CallbackMetadata?: {
        Item: Array<{
          Name: string
          Value: string | number
        }>
      }
    }
  }
}

class MpesaService {
  private config: DarajaConfig
  private tokenCache: { token: string; expiresAt: number } | null = null

  private readonly API_URLS = {
    sandbox: {
      auth: 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      stkpush: 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      stkquery: 'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query',
    },
    production: {
      auth: 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      stkpush: 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      stkquery: 'https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query',
    },
  }

  constructor(config: DarajaConfig) {
    if (!config.consumerKey || !config.consumerSecret) {
      throw new Error('M-Pesa Consumer Key and Secret are required')
    }
    if (!config.paybill || !config.accountReference) {
      throw new Error('M-Pesa PayBill and Account Reference are required')
    }
    this.config = config
  }

  /**
   * Get access token from Daraja
   * Caches token for 10 minutes (expires_in is 3599 seconds)
   */
  async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now()) {
      return this.tokenCache.token
    }

    const auth = Buffer.from(
      `${this.config.consumerKey}:${this.config.consumerSecret}`
    ).toString('base64')

    const apiUrl = this.API_URLS[this.config.environment].auth

    try {
      logger.info('[M-Pesa] Requesting Daraja access token')

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          Authorization: `Basic ${auth}`,
        },
      })

      if (!response.ok) {
        const errorBody = await response.text()
        logger.error('[M-Pesa] Daraja access token request failed', undefined, { status: response.status })
        throw new Error(
          `Token request failed: ${response.status} ${response.statusText} - ${errorBody}`
        )
      }

      const data = (await response.json()) as AccessTokenResponse
      const expiresAt = Date.now() + (data.expires_in - 60) * 1000 // Cache for 1 min less

      this.tokenCache = {
        token: data.access_token,
        expiresAt,
      }

      return data.access_token
    } catch (error) {
      logger.error('[M-Pesa] Failed to get access token', error)
      throw error
    }
  }

  /**
   * Generate STK Push password (Base64 of ShortCode + Passkey + Timestamp)
   * For Daraja, passkey is provided during app registration and provided in env
   */
  private generatePassword(timestamp: string, passkey: string): string {
    const data = this.config.paybill + passkey + timestamp
    return Buffer.from(data).toString('base64')
  }

  /**
   * Initiate STK Push prompt
   * Sends M-Pesa prompt to customer phone
   */
  async initiateStkPush(
    phoneNumber: string,
    amount: number,
    accountReference: string,
    transactionDesc: string,
    passkey: string
  ): Promise<STKPushResponse> {
    // Validate inputs
    if (!phoneNumber || !amount || amount <= 0) {
      throw new Error('Invalid phone number or amount')
    }

    // Get access token
    const token = await this.getAccessToken()

    // Generate timestamp (YYYYMMDDHHmmss)
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:.TZ]/g, '')
      .substring(0, 14)

    // Generate password
    const password = this.generatePassword(timestamp, passkey)

    // Ensure phone number is in correct format (254 + 9 digits)
    const formattedPhone = this.formatPhoneNumber(phoneNumber)

    const requestBody: STKPushRequest = {
      BusinessShortCode: this.config.paybill,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(amount), // M-Pesa requires whole numbers
      PartyA: formattedPhone,
      PartyB: this.config.paybill,
      PhoneNumber: formattedPhone,
      CallBackURL: this.config.callbackUrl,
      AccountReference: accountReference,
      TransactionDesc: transactionDesc,
    }

    const apiUrl = this.API_URLS[this.config.environment].stkpush

    logger.info('[M-Pesa] STK Push request payload', { amount, shortCode: this.config.paybill })

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      })

      const responseBody = await response.text()

      if (!response.ok) {
        logger.error('[M-Pesa] STK Push HTTP error response', undefined, { status: response.status })
        throw new Error(
          `STK Push request failed: ${response.status} - ${responseBody}`
        )
      }

      const data = JSON.parse(responseBody) as STKPushResponse

      logger.info('[M-Pesa] STK Push Daraja response body', { ResponseCode: data.ResponseCode })

      // Log successful request
      logger.info('[M-Pesa] STK Push initiated')

      return data
    } catch (error) {
      logger.error('[M-Pesa] STK Push failed')
      throw error
    }
  }

  /**
   * Format phone number to 254XXXXXXXXX format
   */
  private formatPhoneNumber(phone: string): string {
    // Remove any non-digit characters
    const cleaned = phone.replace(/\D/g, '')

    // If already starts with 254, return as is
    if (cleaned.startsWith('254')) {
      return cleaned
    }

    // If starts with 0, replace with 254
    if (cleaned.startsWith('0')) {
      return '254' + cleaned.substring(1)
    }

    // Otherwise prepend 254
    return '254' + cleaned
  }

  normalizePhoneNumber(phone: string): string {
    return this.formatPhoneNumber(phone)
  }

  /**
   * Parse callback payload from M-Pesa
   * Returns structured payment result
   */
  parseCallback(payload: CallbackPayload): {
    merchantRequestId: string
    checkoutRequestId: string
    resultCode: number
    resultDesc: string
    isSuccessful: boolean
    amount?: number
    mpesaReceiptNumber?: string
  } {
    const stkCallback = payload.Body.stkCallback

    // Result code 0 = success, anything else = failure
    const isSuccessful = stkCallback.ResultCode === 0

    const result: {
      merchantRequestId: string
      checkoutRequestId: string
      resultCode: number
      resultDesc: string
      isSuccessful: boolean
      amount?: number
      mpesaReceiptNumber?: string
      phoneNumber?: string
    } = {
      merchantRequestId: stkCallback.MerchantRequestID,
      checkoutRequestId: stkCallback.CheckoutRequestID,
      resultCode: stkCallback.ResultCode,
      resultDesc: stkCallback.ResultDesc,
      isSuccessful,
    }

    if (isSuccessful && stkCallback.CallbackMetadata?.Item) {
      // Extract values from callback metadata
      const items = stkCallback.CallbackMetadata.Item
      const amountItem = items.find((item) => item.Name === 'Amount')
      const receiptItem = items.find(
        (item) => item.Name === 'MpesaReceiptNumber'
      )
      const phoneItem = items.find((item) => item.Name === 'PhoneNumber')

      if (amountItem) {
        result.amount = Number(amountItem.Value)
      }
      if (receiptItem) {
        result.mpesaReceiptNumber = String(receiptItem.Value)
      }
      if (phoneItem) {
        result.phoneNumber = String(phoneItem.Value)
      }
    }

    return result
  }

  /**
   * Generate callback signature for validation
   * Uses SHA256(token + callbackUrl)
   */
  generateCallbackSignature(token: string, timestamp: string): string {
    return crypto
      .createHash('sha256')
      .update(token + timestamp)
      .digest('hex')
  }

  /**
   * Get environment configuration
   */
  getEnvironment(): string {
    return this.config.environment
  }

  /**
   * Get PayBill number (for display/debugging)
   */
  getPaybill(): string {
    return this.config.paybill
  }
}

export default MpesaService
export type { DarajaConfig, STKPushResponse, CallbackPayload }
