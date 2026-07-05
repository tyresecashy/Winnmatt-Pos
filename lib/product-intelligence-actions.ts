'use server'

import { authenticateServerAction } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

export interface ProductSummary {
  id: string
  sku: string
  name: string
  description: string | null
  brand: string | null
  barcode: string | null
  internal_code: string | null
  unit: string | null
  image_url: string | null
  status: string
  category_id: string
  category_name: string | null
  tags: string[] | null
  search_aliases: string[] | null
  // Pricing
  purchase_price: number
  selling_price: number
  wholesale_price: number
  promotion_price: number | null
  staff_price: number | null
  vip_price: number | null
  min_margin_percent: number | null
  max_discount_percent: number | null
  margin_cents: number
  margin_pct: number
  // Stock
  current_stock: number
  reserved_stock: number
  available_stock: number
  reorder_level: number
  safety_stock: number
  lead_time_days: number
  // Supplier
  preferred_supplier_id: string | null
  preferred_supplier_name: string | null
  // Sales
  avg_monthly_sales: number
  avg_weekly_sales: number
  last_purchase_date: string | null
  last_price_update: string | null
  created_at: string
  updated_at: string
}

export interface ProductActivity {
  id: string
  activity_type: string
  description: string
  changes_json: Record<string, unknown> | null
  performed_by: string | null
  performer_name: string | null
  reference_type: string | null
  reference_id: string | null
  created_at: string
}

export interface ProductPriceHistory {
  id: string
  price_type: string
  price: number
  effective_date: string
  is_active: boolean
  changed_by: string | null
  change_reason: string | null
}

export interface ProductStockAtLocation {
  location_id: string
  location_name: string
  location_type: string
  quantity: number
  reserved: number
}

export async function searchProducts(query: string) {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return []

    const { data, error } = await supabaseAdmin
      .from('products')
      .select('id, sku, name, brand, barcode, selling_price, purchase_price, status, category:categories(name)')
      .or(`name.ilike.%${query}%,sku.ilike.%${query}%,barcode.ilike.%${query}%,brand.ilike.%${query}%`)
      .limit(20)
      .order('name')

    if (error) throw error
    return (data || []).map(p => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      brand: p.brand,
      barcode: p.barcode,
      selling_price: p.selling_price,
      purchase_price: p.purchase_price,
      status: p.status,
      category: Array.isArray(p.category) ? p.category[0]?.name : (p.category as { name?: string } | null)?.name || null,
    }))
  } catch (error) {
    logger.error('Error searching products:', error)
    return []
  }
}

export async function getProductIntelligence(productId: string): Promise<ProductSummary | null> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return null

    const { data: product, error } = await supabaseAdmin
      .from('products')
      .select(`
        *,
        category:categories(name)
      `)
      .eq('id', productId)
      .single()

    if (error) throw error
    if (!product) return null

    // Get total stock across all branches
    const { data: stockData } = await supabaseAdmin
      .from('inventory')
      .select('quantity, reserved_stock')
      .eq('product_id', productId)

    const totalStock = (stockData || []).reduce((sum, r) => sum + (r.quantity || 0), 0)
    const totalReserved = (stockData || []).reduce((sum, r) => sum + (r.reserved_stock || 0), 0)

    // Get preferred supplier name
    let preferredSupplierName: string | null = null
    if (product.preferred_supplier_id) {
      const { data: supData } = await supabaseAdmin
        .from('suppliers')
        .select('name')
        .eq('id', product.preferred_supplier_id)
        .single()
      if (supData) preferredSupplierName = supData.name
    }

    const purchasePrice = product.purchase_price || 0
    const sellingPrice = product.selling_price || 0
    const marginCents = sellingPrice - purchasePrice
    const marginPct = purchasePrice > 0 ? Math.round(((sellingPrice - purchasePrice) / purchasePrice) * 10000) / 100 : 0

    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      description: product.description,
      brand: product.brand,
      barcode: product.barcode,
      internal_code: product.internal_code,
      unit: product.unit,
      image_url: product.image_url,
      status: product.status || 'active',
      category_id: product.category_id,
      category_name: Array.isArray(product.category) ? product.category[0]?.name : (product.category as { name?: string } | null)?.name || null,
      tags: product.tags,
      search_aliases: product.search_aliases,
      purchase_price: purchasePrice,
      selling_price: sellingPrice,
      wholesale_price: product.wholesale_price || 0,
      promotion_price: product.promotion_price,
      staff_price: product.staff_price,
      vip_price: product.vip_price,
      min_margin_percent: product.min_margin_percent,
      max_discount_percent: product.max_discount_percent,
      margin_cents: marginCents,
      margin_pct: marginPct,
      current_stock: totalStock,
      reserved_stock: totalReserved,
      available_stock: totalStock - totalReserved,
      reorder_level: product.reorder_level || 0,
      safety_stock: product.safety_stock || 0,
      lead_time_days: product.lead_time_days || 0,
      preferred_supplier_id: product.preferred_supplier_id,
      preferred_supplier_name: preferredSupplierName,
      avg_monthly_sales: product.avg_monthly_sales || 0,
      avg_weekly_sales: product.avg_weekly_sales || 0,
      last_purchase_date: product.last_purchase_date,
      last_price_update: product.last_price_update,
      created_at: product.created_at,
      updated_at: product.updated_at,
    }
  } catch (error) {
    logger.error('Error fetching product intelligence:', error)
    return null
  }
}

export async function getProductActivity(productId: string): Promise<ProductActivity[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('product_activity_log')
      .select(`
        *,
        performer:performed_by(full_name)
      `)
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      // Table might not exist yet after migration
      if (error.code === '42P01') return []
      throw error
    }

    return (data || []).map(a => ({
      id: a.id,
      activity_type: a.activity_type,
      description: a.description,
      changes_json: a.changes_json,
      performed_by: a.performed_by,
      performer_name: Array.isArray(a.performer) ? a.performer[0]?.full_name : (a.performer as { full_name?: string } | null)?.full_name || null,
      reference_type: a.reference_type,
      reference_id: a.reference_id,
      created_at: a.created_at,
    }))
  } catch (error) {
    logger.error('Error fetching product activity:', error)
    return []
  }
}

export async function getProductPriceHistory(productId: string): Promise<ProductPriceHistory[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('product_price_history')
      .select('*')
      .eq('product_id', productId)
      .order('effective_date', { ascending: false })
      .limit(20)

    if (error) {
      if (error.code === '42P01') return []
      throw error
    }

    return (data || []).map(p => ({
      id: p.id,
      price_type: p.price_type,
      price: p.price,
      effective_date: p.effective_date,
      is_active: p.is_active ?? true,
      changed_by: p.changed_by,
      change_reason: p.change_reason,
    }))
  } catch (error) {
    logger.error('Error fetching price history:', error)
    return []
  }
}

export async function getProductStockLocations(productId: string): Promise<ProductStockAtLocation[]> {
  try {
    // Try to get from warehouses
    const { data: warehouseData, error } = await supabaseAdmin
      .from('inventory')
      .select(`
        quantity,
        branch_id,
        branch:branches(id, name)
      `)
      .eq('product_id', productId)

    if (error) throw error

    return (warehouseData || []).map(i => ({
      location_id: i.branch_id,
      location_name: Array.isArray(i.branch) ? i.branch[0]?.name : (i.branch as { name?: string })?.name || 'Unknown',
      location_type: 'branch',
      quantity: i.quantity || 0,
      reserved: 0,
    }))
  } catch (error) {
    logger.error('Error fetching stock locations:', error)
    return []
  }
}

export async function logProductActivity(
  productId: string,
  activityType: string,
  description: string,
  changesJson?: Record<string, unknown>,
  performedBy?: string,
  referenceType?: string,
  referenceId?: string
): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('product_activity_log')
      .insert({
        product_id: productId,
        activity_type: activityType,
        description,
        changes_json: changesJson || null,
        performed_by: performedBy || null,
        reference_type: referenceType || null,
        reference_id: referenceId || null,
      })

    if (error) {
      if (error.code === '42P01') return false // Table not created yet
      throw error
    }
    return true
  } catch (error) {
    logger.error('Error logging product activity:', error)
    return false
  }
}

export async function updateProductPricing(
  productId: string,
  updates: Record<string, number | string | null>
) {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile || !['super_admin', 'admin'].includes(auth.profile.role)) {
      return { success: false, error: 'Unauthorized' }
    }

    const { error } = await supabaseAdmin
      .from('products')
      .update({ ...updates, last_price_update: new Date().toISOString() })
      .eq('id', productId)

    if (error) throw new Error(error.message)

    // Log price changes
    const priceFields = ['selling_price', 'purchase_price', 'wholesale_price', 'promotion_price', 'staff_price', 'vip_price']
    for (const field of priceFields) {
      if (field in updates && updates[field] !== undefined) {
        await logProductActivity(
          productId,
          'price_changed',
          `${field.replace('_', ' ')} updated to ${updates[field]}`,
          { field, new_value: updates[field] },
          auth.profile.id
        )
      }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update pricing' }
  }
}
