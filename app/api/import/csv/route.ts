import { NextRequest, NextResponse } from 'next/server'
import { csvImportSchema } from '@/lib/api-schemas'
import { badRequest } from '@/lib/api-errors'

export async function POST(request: NextRequest) {
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return badRequest([{ field: 'body', message: 'Invalid JSON body' }])
    }

    const parsed = csvImportSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest(parsed.error.issues.map(i => ({
        field: i.path.join('.'),
        message: i.message,
      })))
    }

    return NextResponse.json(
      {
        error: 'CSV import is temporarily disabled during production hardening.',
      },
      { status: 503 }
    )
  } catch (error) {
    console.error('[CSV Import] Unhandled error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 })
}
