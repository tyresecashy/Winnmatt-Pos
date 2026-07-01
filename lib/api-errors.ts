import { logger } from '@/lib/logger';
import { NextResponse } from 'next/server'

export function badRequest(errors: { field: string; message: string }[]) {
  return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 })
}

export function unauthorized(msg = 'Unauthorized') {
  return NextResponse.json({ error: msg }, { status: 401 })
}

export function notFound(msg = 'Not found') {
  return NextResponse.json({ error: msg }, { status: 404 })
}

export function serverError(error: unknown) {
  logger.error('[API]', error instanceof Error ? error.message : error)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}
