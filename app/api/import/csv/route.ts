import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      error: 'CSV import is temporarily disabled during production hardening.',
    },
    { status: 503 }
  )
}

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 })
}
