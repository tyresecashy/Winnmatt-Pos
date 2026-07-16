/**
 * Tuma Payments — API Client
 *
 * Handles low-level HTTP communication with Tuma API:
 * - Authentication (JWT token with in-memory caching)
 * - STK Push initiation
 * - Automatic retry with exponential backoff for network errors
 *
 * SECURITY: Tokens are stored only in memory, never persisted to disk/DB.
 */

import { logger } from '@/lib/logger'
import type {
  TumaAuthRequest,
  TumaAuthApiResponse,
  TumaSTKPushRequest,
  TumaSTKPushResponse,
  TumaSTKPushApiResponse,
  TumaConfig,
} from './tuma-types'

// ─── Constants ─────────────────────────────────────────────────────────────

const AUTH_ENDPOINT = '/auth/token'
const STK_PUSH_ENDPOINT = '/payment/stk-push'

const MAX_RETRIES = 3
const BASE_RETRY_MS = 500
const MAX_RETRY_MS = 4000

// ─── In-Memory Token Cache ─────────────────────────────────────────────────

let cachedToken: string | null = null
let tokenExpiresAt: number = 0

function isTokenValid(): boolean {
  // Refresh 30s before expiry to be safe
  return cachedToken !== null && Date.now() < tokenExpiresAt - 30_000
}

function clearTokenCache(): void {
  cachedToken = null
  tokenExpiresAt = 0
}

// ─── HTTP Helper ───────────────────────────────────────────────────────────

interface HttpError {
  status: number
  message: string
  body?: unknown
}

async function tumaFetch<T>(
  baseUrl: string,
  endpoint: string,
  options: RequestInit,
  retriesLeft: number = MAX_RETRIES,
  correlationId?: string
): Promise<T> {
  const url = `${baseUrl.replace(/\/+$/, '')}${endpoint}`
  const lastError: HttpError = { status: 0, message: 'Unknown error' }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const fetchStart = Date.now()
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...options.headers,
        },
        signal: AbortSignal.timeout(15_000),
      })

      const durationMs = Date.now() - fetchStart
      const body = await response.json().catch(() => null)

      logger.info('[TumaFetch] Response received', {
        correlationId,
        endpoint,
        httpStatus: response.status,
        httpOk: response.ok,
        durationMs,
        hasBody: body !== null && typeof body === 'object',
        attempt,
      })

      if (response.ok) {
        logger.info('[TumaFetch] Request succeeded', {
          correlationId, endpoint, durationMs, attempt,
        })
        return body as T
      }

      lastError.status = response.status
      lastError.message = body?.message || body?.error || `HTTP ${response.status}`
      lastError.body = body

      // 4xx errors are not retryable (except 429 rate limit)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        logger.warn('[TumaFetch] Non-retryable HTTP error', {
          correlationId, endpoint, httpStatus: response.status, message: lastError.message, durationMs,
        })
        throw lastError
      }
    } catch (error) {
      const durationMs = Date.now() - fetchStart

      // Explicit timeout detection
      if (error instanceof DOMException && error.name === 'AbortError') {
        lastError.status = 0
        lastError.message = `TIMEOUT after ${durationMs}ms`
        logger.warn('[TumaFetch] TIMEOUT', {
          correlationId, endpoint, durationMs, attempt,
        })
      } else if (error && typeof error === 'object' && 'status' in error && 'message' in error) {
        // Already formatted as HttpError — re-throw immediately
        throw error
      } else {
        lastError.message = error instanceof Error ? error.message : 'Network request failed'
        logger.warn('[TumaFetch] Request error', {
          correlationId, endpoint, message: lastError.message, durationMs, attempt,
        })
      }

      // Last attempt — throw
      if (attempt >= retriesLeft) {
        throw lastError
      }

      // Exponential backoff with jitter (skip for non-retryable)
      const delay = Math.min(
        BASE_RETRY_MS * Math.pow(2, attempt) + Math.random() * 500,
        MAX_RETRY_MS
      )

      logger.warn('[TumaFetch] Retrying', {
        correlationId, endpoint, attempt: attempt + 1, delayMs: delay, error: lastError.message,
      })

      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

// ─── JWT Payload Decoder (no crypto — safe for exp/iat extraction) ────────

/**
 * Safely decode a JWT's payload section (base64url JSON) to extract claims.
 * Never verifies the signature — only reads publicly-embedded fields.
 * Returns decoded payload or null if the token is malformed.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = Buffer.from(base64, 'base64').toString('utf8')
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}

// ─── Auth ──────────────────────────────────────────────────────────────────

async function fetchNewToken(config: TumaConfig): Promise<string> {
  const authPayload: TumaAuthRequest = {
    email: config.businessEmail,
    api_key: config.apiKey,
  }

  const apiResponse = await tumaFetch<TumaAuthApiResponse>(
    config.apiUrl,
    AUTH_ENDPOINT,
    {
      method: 'POST',
      body: JSON.stringify(authPayload),
    },
    // Auth retries: 2 attempts max
    Math.min(MAX_RETRIES, 2)
  )

  // Extract token from response.data (Tuma wraps in envelope)
  const token = apiResponse?.data?.token
  if (!token) {
    throw { status: 502, message: 'Tuma auth response missing token in data.token', body: apiResponse }
  }

  // Calculate token lifetime from JWT payload claims
  const payload = decodeJwtPayload(token)
  const iat = (payload?.iat as number) || 0
  const exp = (payload?.exp as number) || 0
  const expiresInSeconds = Math.max(exp - iat, 3600) // fallback 1h if claims missing

  // Cache token in memory only
  cachedToken = token
  tokenExpiresAt = Date.now() + expiresInSeconds * 1000

  logger.info('[Tuma] New auth token acquired', {
    expiresIn: expiresInSeconds + 's',
    tokenExpiresAt: new Date(tokenExpiresAt).toISOString(),
  })

  return token
}

/**
 * Get a valid Tuma API token.
 * Returns cached token if still valid, otherwise fetches a new one.
 * Token is held in memory only — never persisted.
 */
export async function getToken(config: TumaConfig): Promise<string> {
  if (isTokenValid()) {
    return cachedToken!
  }

  return fetchNewToken(config)
}

/**
 * Force token refresh on next request.
 * Call this when receiving a 401 response.
 */
export function invalidateToken(): void {
  clearTokenCache()
}

// ─── STK Push ──────────────────────────────────────────────────────────────

/**
 * Initiate an STK Push to the customer's phone via Tuma Payments.
 *
 * @param config - Tuma API configuration
 * @param request - STK Push request details
 * @param correlationId - Optional UUID for tracing across the request chain
 * @returns STK Push response with merchant_request_id and checkout_request_id
 *
 * @throws {Error} With message from Tuma API or network error
 */
export async function initiateSTKPush(
  config: TumaConfig,
  request: TumaSTKPushRequest,
  correlationId?: string
): Promise<TumaSTKPushResponse> {
  const token = await getToken(config)

  const requestBody = {
    amount: request.amount,
    phone: request.phone,
    callback_url: request.callback_url,
    description: request.description.slice(0, 20), // Tuma max 20 chars
  }

  logger.info('[Tuma initiateSTKPush] Preparing request', {
    correlationId,
    hasToken: !!token,
    endpoint: STK_PUSH_ENDPOINT,
    // Phone is intentionally excluded — masked by logger redact anyway
    amount: request.amount,
    callbackUrlPresent: !!request.callback_url,
    description: requestBody.description,
  })

  try {
    // Fetch as the actual API response shape (with data envelope)
    const apiResponse = await tumaFetch<TumaSTKPushApiResponse>(
      config.apiUrl,
      STK_PUSH_ENDPOINT,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      },
      MAX_RETRIES,
      correlationId
    )

    // Extract fields from the data envelope (Bug #5 fix)
    const merchantRequestId = apiResponse?.data?.merchant_request_id
    const checkoutRequestId = apiResponse?.data?.checkout_request_id
    const customerMessage = apiResponse?.data?.customer_message

    logger.info('[Tuma initiateSTKPush] STK Push response extracted', {
      correlationId,
      merchantRequestId: !!merchantRequestId,
      checkoutRequestId: !!checkoutRequestId,
      customerMessage: !!customerMessage,
    })

    // Build the service-layer contract from extracted data fields
    const response: TumaSTKPushResponse = {
      merchant_request_id: merchantRequestId || '',
      checkout_request_id: checkoutRequestId || '',
      customer_message: customerMessage || '',
    }

    logger.info('[Tuma initiateSTKPush] STK Push initiated successfully', {
      correlationId,
      merchantRequestId: !!response.merchant_request_id,
      checkoutRequestId: !!response.checkout_request_id,
    })

    return response
  } catch (error) {
    // Capture error details
    logger.warn('[Tuma initiateSTKPush] Request failed', {
      correlationId,
      errorStatus: error && typeof error === 'object' && 'status' in error ? (error as HttpError).status : 'unknown',
      errorMessage: error && typeof error === 'object' && 'message' in error ? (error as HttpError).message : String(error),
    })

    // If 401, force token refresh for next attempt
    if (
      error &&
      typeof error === 'object' &&
      'status' in error &&
      (error as HttpError).status === 401
    ) {
      invalidateToken()
    }
    throw error
  }
}

// ─── Phone Formatting ──────────────────────────────────────────────────────

/**
 * Format phone number to 254XXXXXXXXX format required by Tuma API.
 * Accepts: 0712345678, 0112345678, 254712345678, +254712345678
 */
export function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/[^0-9]/g, '')

  if (cleaned.startsWith('0')) {
    cleaned = '254' + cleaned.slice(1)
  } else if (cleaned.startsWith('+')) {
    cleaned = cleaned.slice(1)
  } else if (!cleaned.startsWith('254')) {
    cleaned = '254' + cleaned
  }

  return cleaned
}
