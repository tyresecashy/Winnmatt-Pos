/**
 * API Middleware — Authentication, Rate Limiting, CORS, Logging
 *
 * Every API route goes through this middleware pipeline.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface APIContext {
  userId: string
  branchId: string | null
  role: string
  supabase: SupabaseClient
}

export interface APIError {
  code: string
  message: string
  details?: unknown
}

// ─── Rate Limiting ──────────────────────────────────────────────────────────

import { rateLimiter, getRateLimitKey, checkRateLimitSimple } from './rate-limiter'
export { rateLimiter, getRateLimitKey, checkRateLimitSimple }

// ─── Authentication ─────────────────────────────────────────────────────────

async function authenticate(request: NextRequest): Promise<APIContext | null> {
  // Check for Bearer token
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.slice(7)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
    }
  )

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return null
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return null
  }

  return {
    userId: user.id,
    branchId: profile.branch_id,
    role: profile.role,
    supabase: supabase,
  }
}

// ─── Middleware Pipeline ─────────────────────────────────────────────────────

export async function withAuth(
  request: NextRequest,
  handler: (ctx: APIContext) => Promise<NextResponse>
): Promise<NextResponse> {
  const startTime = Date.now()

  // 1. Authenticate
  const ctx = await authenticate(request)
  if (!ctx) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Invalid or missing authentication' } },
      { status: 401 }
    )
  }

  // 2. Rate limit
  const rateLimitKey = getRateLimitKey(ctx.userId, request.nextUrl.pathname)
  const allowed = await Promise.resolve(checkRateLimitSimple(rateLimitKey))
  if (!allowed) {
    return NextResponse.json(
      { error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
      { status: 429 }
    )
  }

  // 3. Execute handler
  try {
    const response = await handler(ctx)

    // 4. Add response headers
    response.headers.set('X-Response-Time', `${Date.now() - startTime}ms`)
    response.headers.set('X-Request-Id', crypto.randomUUID())

    return response
  } catch (error) {
    logger.error(`[API] Error in ${request.method} ${request.nextUrl.pathname}:`, error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    )
  }
}

// ─── CORS ───────────────────────────────────────────────────────────────────

// Explicit allow-list — never use wildcard with credentials
const ALLOWED_ORIGINS = new Set([
  // Production
  'https://winnmatt.com',
  'https://www.winnmatt.com',
  'https://pos.winnmatt.com',
  // Vercel preview deployments
  ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
  // Local development
  ...(process.env.NODE_ENV === 'development'
    ? ['http://localhost:3000', 'http://127.0.0.1:3000']
    : []),
])

export function withCORS(response: NextResponse, origin?: string): NextResponse {
  // Only allow origins in the allow-list
  const allowedOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : ''
  response.headers.set('Access-Control-Allow-Origin', allowedOrigin)
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-Id')
  response.headers.set('Access-Control-Max-Age', '86400')
  return response
}

// ─── Role Checking ──────────────────────────────────────────────────────────

export function requireRole(ctx: APIContext, ...roles: string[]): boolean {
  return roles.includes(ctx.role)
}
