import { NextResponse } from 'next/server'

export function badRequest(errors: { field: string; message: string }[]) {
  return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 })
}
