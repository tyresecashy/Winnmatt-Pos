/**
 * API Response Helpers — Standardized response formatting
 *
 * All API responses follow this format:
 * Success: { data: T, meta?: { total, page, limit } }
 * Error: { error: { code, message, details? } }
 */

import { NextResponse } from 'next/server'

// ─── Success Responses ──────────────────────────────────────────────────────

export function apiSuccess<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data }, { status })
}

export function apiCreated<T>(data: T): NextResponse {
  return NextResponse.json({ data }, { status: 201 })
}

export function apiNoContent(): NextResponse {
  return new NextResponse(null, { status: 204 })
}

export function apiPaginated<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): NextResponse {
  return NextResponse.json({
    data,
    meta: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  })
}

// ─── Error Responses ────────────────────────────────────────────────────────

export function apiError(
  code: string,
  message: string,
  status = 400,
  details?: unknown
): NextResponse {
  return NextResponse.json(
    { error: { code, message, details } },
    { status }
  )
}

export function apiBadRequest(message: string, details?: unknown): NextResponse {
  return apiError('BAD_REQUEST', message, 400, details)
}

export function apiUnauthorized(message = 'Authentication required'): NextResponse {
  return apiError('UNAUTHORIZED', message, 401)
}

export function apiForbidden(message = 'Insufficient permissions'): NextResponse {
  return apiError('FORBIDDEN', message, 403)
}

export function apiNotFound(resource = 'Resource'): NextResponse {
  return apiError('NOT_FOUND', `${resource} not found`, 404)
}

export function apiConflict(message: string): NextResponse {
  return apiError('CONFLICT', message, 409)
}

export function apiInternal(message = 'Internal server error'): NextResponse {
  return apiError('INTERNAL_ERROR', message, 500)
}

// ─── Query Parameter Parsing ────────────────────────────────────────────────

export function parseSearchParams(request: NextRequest): Record<string, string> {
  const params: Record<string, string> = {}
  request.nextUrl.searchParams.forEach((value, key) => {
    params[key] = value
  })
  return params
}

export function getPaginationParams(request: NextRequest): { page: number; limit: number; offset: number } {
  const params = parseSearchParams(request)
  const page = Math.max(1, parseInt(params.page || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(params.limit || '20', 10)))
  const offset = (page - 1) * limit
  return { page, limit, offset }
}

export function getSortParams(request: NextRequest): { column: string; ascending: boolean } {
  const params = parseSearchParams(request)
  return {
    column: params.sort || 'created_at',
    ascending: params.order !== 'desc',
  }
}
