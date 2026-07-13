import { logger } from '@/lib/logger';
// API endpoint: GET /api/prices/review
// Returns products flagged for price review
// Admin only

import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = createClient()

  // Check auth and admin role
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if admin
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (userData?.role !== 'admin' && userData?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  // Get summary of price anomalies
  const { data: anomalies, error } = await supabase
    .from('price_anomalies')
    .select(
      `
      id,
      product_id,
      batch_id,
      anomaly_type,
      description,
      severity,
      current_selling_price,
      current_purchase_price,
      suggested_selling_price,
      suggested_purchase_price,
      suggestion_reason,
      status,
      reviewed_by,
      reviewed_at,
      created_at,
      products(id, sku, name, category_id, price_trust_level, price_review_status)
    `
    )
    .eq('status', 'flagged')
    .order('severity', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    logger.error('[Prices Review] Database query failed', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json({
    anomalies,
    count: anomalies?.length || 0,
  })
}
