/**
 * Tuma Payments — Full Diagnostics
 * GET /api/payments/tuma/debug
 *
 * Independently verifies every stage of the Tuma API connection:
 *   ✓ Environment configuration (secrets masked)
 *   ✓ DNS resolution of api.tuma.co.ke
 *   ✓ Authentication (token acquisition)
 *   ✓ Runtime diagnostics (Node version, fetch impl, region)
 *
 * Returns structured JSON with timings for every stage.
 * Does NOT initiate an STK Push — that would charge the merchant.
 * Auth success proves STK Push would work given identical credentials.
 *
 * If any stage fails, the response includes:
 *   - status / error code
 *   - message
 *   - durationMs
 *   - endpoint
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth-helpers'
import { isTumaAvailable } from '@/lib/modules/payments'
import { getToken } from '@/lib/modules/payments/tuma-client'
import { logger } from '@/lib/logger'
import { env } from '@/lib/env'
import dns from 'dns/promises'

export async function GET(req: NextRequest) {
  const globalStart = Date.now()
  const correlationId = crypto.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

  try {
    // ========================================================================
    // AUTHENTICATION
    // ========================================================================
    const authResult = await authenticateRequest(req)

    if (!authResult.success) {
      return unauthorizedResponse(authResult.error)
    }

    const profile = authResult.profile!

    // ========================================================================
    // 1. ENVIRONMENT
    // ========================================================================
    const environment = {
      apiUrl: env.TUMA_API_URL,
      businessEmail: env.TUMA_BUSINESS_EMAIL
        ? `✓ set (${env.TUMA_BUSINESS_EMAIL})`
        : '✗ missing',
      apiKey: env.TUMA_API_KEY
        ? `✓ set (${env.TUMA_API_KEY.slice(0, 4)}…${env.TUMA_API_KEY.slice(-4)})`
        : '✗ missing',
      callbackUrl: env.TUMA_CALLBACK_URL
        ? `✓ set (${env.TUMA_CALLBACK_URL})`
        : '✗ missing',
      isAvailable: isTumaAvailable(),
    }

    const config = {
      apiUrl: env.TUMA_API_URL || 'https://api.tuma.co.ke',
      apiKey: env.TUMA_API_KEY || '',
      businessEmail: env.TUMA_BUSINESS_EMAIL || '',
      callbackUrl: env.TUMA_CALLBACK_URL || '',
    }

    // ========================================================================
    // 2. DNS RESOLUTION
    // ========================================================================
    const dnsStart = Date.now()
    let dnsResult: {
      hostname: string
      resolved: boolean
      addresses: string[]
      error: string | null
      durationMs: number
    } = { hostname: '', resolved: false, addresses: [], error: null, durationMs: 0 }

    try {
      const hostname = new URL(config.apiUrl).hostname
      const addresses = await dns.resolve4(hostname)
      dnsResult = {
        hostname,
        resolved: addresses.length > 0,
        addresses,
        error: null,
        durationMs: Date.now() - dnsStart,
      }
    } catch (dnsError) {
      dnsResult = {
        hostname: new URL(config.apiUrl).hostname,
        resolved: false,
        addresses: [],
        error: dnsError instanceof Error ? dnsError.message : String(dnsError),
        durationMs: Date.now() - dnsStart,
      }
    }

    // ========================================================================
    // 3. AUTH (TOKEN ACQUISITION)
    // ========================================================================
    const authStart = Date.now()
    let auth: {
      success: boolean
      durationMs: number
      endpoint: string
      tokenPreview?: string
      error?: string
      errorStatus?: number | string
      rawBody?: unknown
    } = {
      success: false,
      durationMs: 0,
      endpoint: `${config.apiUrl}/auth/token`,
    }

    if (!environment.isAvailable) {
      auth = {
        ...auth,
        success: false,
        durationMs: 0,
        error: 'Tuma not configured — see environment section',
      }
    } else {
      try {
        const token = await getToken(config)
        auth = {
          ...auth,
          success: true,
          durationMs: Date.now() - authStart,
          tokenPreview: token
            ? `${token.slice(0, 12)}…${token.slice(-8)}`
            : 'empty',
        }
      } catch (error) {
        const errStatus =
          error && typeof error === 'object' && 'status' in error
            ? (error as { status: number }).status
            : 'unknown'
        const errMessage =
          error && typeof error === 'object' && 'message' in error
            ? String((error as { message: string }).message)
            : String(error)
        const errBody =
          error && typeof error === 'object' && 'body' in error
            ? (error as { body: unknown }).body
            : undefined

        auth = {
          ...auth,
          success: false,
          durationMs: Date.now() - authStart,
          error: errMessage,
          errorStatus: errStatus,
          rawBody: errBody,
        }

        logger.warn('[Tuma Debug] Auth failed', {
          correlationId,
          userId: profile.id,
          errorStatus: errStatus,
          errorMessage: errMessage,
        })
      }
    }

    // ========================================================================
    // 4. STK PUSH — skipped (would charge the merchant)
    // ========================================================================
    const stkPush = {
      status: 'skipped',
      reason:
        'Actual STK Push would charge the merchant. Auth success proves the API is reachable with valid credentials.',
      endpoint: `${config.apiUrl}/payment/stk-push`,
      samplePayload: {
        amount: '<number>',
        phone: '<0-prefix phone>',
        callback_url: config.callbackUrl,
        description: '<max 20 chars>',
      },
    }

    // ========================================================================
    // 5. RUNTIME DIAGNOSTICS
    // ========================================================================
    const runtime = {
      nodeVersion: process.version,
      platform: process.platform,
      runtime: 'serverless',
      region: 'cle1', // from vercel.json — Cleveland, Ohio, USA
      fetchImplementation: 'undici (Node.js built-in)',
      hostArchitecture: process.arch,
      timestamp: new Date().toISOString(),
      correlationId,
    }

    // ========================================================================
    // RESPONSE
    // ========================================================================
    const body = {
      status: auth.success ? 'ok' : 'degraded',
      correlationId,
      timestamp: new Date().toISOString(),
      environment,
      dns: dnsResult,
      auth,
      stkPush,
      runtime,
      timings: {
        total: Date.now() - globalStart,
        dns: dnsResult.durationMs,
        auth: auth.durationMs,
      },
    }

    return NextResponse.json(body, { status: 200 })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    logger.error('[Tuma Debug] Endpoint error', {
      correlationId,
      error: errorMessage,
    })

    return NextResponse.json(
      {
        status: 'error',
        correlationId,
        timestamp: new Date().toISOString(),
        error: errorMessage,
        timings: { total: Date.now() - globalStart },
      },
      { status: 500 }
    )
  }
}
