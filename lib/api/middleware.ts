/**
 * API Middleware — Authentication, Rate Limiting, CORS, Logging
 *
 * Every API route goes through this middleware pipeline.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface APIContext {
  userId: string
  branchId: string | null
  role: string
  supabase: ReturnType<typeof createClient>
}

export interface APIError {
  code: string
  message: string
  details?: unknown
}

// ─── Rate Limiting ──────────────────────────────────────────────────────────

const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

function getRateLimitKey(request: NextRequest, userId: string): string {
  return `${userId}:${request.nextUrl.pathname}`
}

function checkRateLimit(key: string, limit = 100, windowMs = 60000): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(key)

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (entry.count >= limit) {
    return false
  }

  entry.count++
  return true
}

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
    supabase,
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
  const rateLimitKey = getRateLimitKey(request, ctx.userId)
  if (!checkRateLimit(rateLimitKey)) {
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
    console.error(`[API] Error in ${request.method} ${request.nextUrl.pathname}:`, error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    )
  }
}

// ─── CORS ───────────────────────────────────────────────────────────────────

export function withCORS(response: NextResponse, origin?: string): NextResponse {
  response.headers.set('Access-Control-Allow-Origin', origin || '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-Id')
  response.headers.set('Access-Control-Max-Age', '86400')
  return response
}

// ─── Role Checking ──────────────────────────────────────────────────────────

export function requireRole(ctx: APIContext, ...roles: string[]): boolean {
  return roles.includes(ctx.role)
}
