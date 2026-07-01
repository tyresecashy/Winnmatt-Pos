// API endpoint: POST /api/prices/approve
// Approves, corrects, or protects a flagged price anomaly
// Admin only

import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { priceApproveSchema } from '@/lib/api-schemas'
import { badRequest } from '@/lib/api-errors'

export async function POST(request: Request) {
  const supabase = createClient(request)

  // Check auth
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check admin role
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (userData?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  // Parse & validate body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = priceApproveSchema.safeParse(body)
  if (!parsed.success) {
    return badRequest(parsed.error.issues.map(i => ({
      field: i.path.join('.'),
      message: i.message,
    })))
  }

  const { action, productId, newSellingPrice, newPurchasePrice, reason, protectionLevel } = parsed.data

  try {
    switch (action) {
      case 'approve':
      case 'correct': {
        // Build update object with only provided price fields
        const productUpdate: Record<string, any> = {
          price_review_status: action === 'approve' ? 'approved' : 'reviewed',
        }
        if (newSellingPrice != null) {
          productUpdate.selling_price = newSellingPrice
        }
        if (newPurchasePrice != null) {
          productUpdate.purchase_price = newPurchasePrice
        }

        const { error: productError } = await supabase
          .from('products')
          .update(productUpdate)
          .eq('id', productId)

        if (productError) {
          console.error('Error updating product:', productError)
          return NextResponse.json({ error: productError.message }, { status: 500 })
        }

        // Mark anomaly as resolved
        const anomalyUpdate: Record<string, any> = {
          status: 'resolved',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        }
        if (reason) {
          anomalyUpdate.resolution_note = reason
        }

        const { error: anomalyError } = await supabase
          .from('price_anomalies')
          .update(anomalyUpdate)
          .eq('product_id', productId)
          .eq('status', 'flagged')

        if (anomalyError) {
          console.error('Error updating anomaly:', anomalyError)
          return NextResponse.json({ error: anomalyError.message }, { status: 500 })
        }

        return NextResponse.json({
          success: true,
          message: `Price ${action}d successfully`,
          product: productId,
        })
      }

      case 'protect': {
        // Set price trust level to protect this item from future flagging
        const { error: productError } = await supabase
          .from('products')
          .update({
            price_trust_level: protectionLevel || 'high',
            price_review_status: 'protected',
          })
          .eq('id', productId)

        if (productError) {
          console.error('Error protecting product:', productError)
          return NextResponse.json({ error: productError.message }, { status: 500 })
        }

        // Mark anomalies as resolved with protection note
        const anomalyUpdate: Record<string, any> = {
          status: 'resolved',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          resolution_note: reason || `Protected with ${protectionLevel || 'high'} trust level`,
        }

        const { error: anomalyError } = await supabase
          .from('price_anomalies')
          .update(anomalyUpdate)
          .eq('product_id', productId)
          .eq('status', 'flagged')

        if (anomalyError) {
          console.error('Error updating anomaly:', anomalyError)
          return NextResponse.json({ error: anomalyError.message }, { status: 500 })
        }

        return NextResponse.json({
          success: true,
          message: 'Product protected from price flagging',
          product: productId,
        })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error: any) {
    console.error('Price approval error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
