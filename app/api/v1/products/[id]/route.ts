/**
 * Product API — GET/PUT/DELETE /api/v1/products/[id]
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type APIContext } from '@/lib/api/middleware'
import { apiSuccess, apiNotFound, apiBadRequest, apiInternal } from '@/lib/api/response'
import { logger } from '@/lib/logger'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (ctx: APIContext) => {
    try {
      const { id } = await params
      const { data, error } = await ctx.supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single()

      if (error || !data) {
        return apiNotFound('Product')
      }

      return apiSuccess(data)
    } catch (error) {
      logger.error('[Products API] Error:', error)
      return apiInternal()
    }
  })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (ctx: APIContext) => {
    try {
      const { id } = await params
      const body = await request.json()

      // Only admins can update products
      if (!['super_admin', 'admin'].includes(ctx.role)) {
        return apiBadRequest('Insufficient permissions to update products')
      }

      // Column allowlist — only updateable fields
      const allowedColumns = [
        'name', 'sku', 'description', 'category_id', 'purchase_price', 'selling_price',
        'reorder_level', 'brand', 'status', 'internal_code', 'manufacturer',
        'department', 'subcategory', 'tags', 'search_aliases', 'qr_code',
        'wholesale_price', 'promotion_price', 'staff_price', 'vip_price',
        'tax_inclusive_price', 'tax_exclusive_price',
        'min_margin_percent', 'max_discount_percent',
        'reserved_stock', 'safety_stock', 'lead_time_days', 'preferred_supplier_id',
        'weight', 'weight_unit', 'dimensions', 'is_serialized', 'is_batch_tracked', 'is_expirable',
        'last_purchase_date', 'last_price_update',
      ]
      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
      for (const key of allowedColumns) {
        if (key in body) {
          updateData[key] = body[key]
        }
      }

      const { data, error } = await (ctx.supabase as any)
        .from('products')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        logger.error('[Products API] Update failed', { id, message: error.message, code: error.code })
        return apiInternal()
      }

      return apiSuccess(data)
    } catch (error) {
      logger.error('[Products API] Error:', error)
      return apiInternal()
    }
  })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (ctx: APIContext) => {
    try {
      const { id } = await params
      // Only admins can delete products
      if (!['super_admin', 'admin'].includes(ctx.role)) {
        return apiBadRequest('Insufficient permissions to delete products')
      }

      // Soft delete — set status to inactive
      const { error } = await (ctx.supabase as any)
        .from('products')
        .update({ status: 'inactive', updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) {
        logger.error('[Products API] Delete failed', { id, message: error.message, code: error.code })
        return apiInternal()
      }

      return apiSuccess({ message: 'Product deactivated' })
    } catch (error) {
      logger.error('[Products API] Error:', error)
      return apiInternal()
    }
  })
}
