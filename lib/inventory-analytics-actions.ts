'use server'

import { authenticateServerAction } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

export interface AnalyticsProduct {
  id: string
  sku: string
  name: string
  brand: string | null
  category_id: string
  category_name: string | null
  selling_price: number
  purchase_price: number
  margin_cents: number
  margin_pct: number
  total_stock: number
  available_stock: number
  reorder_level: number
  safety_stock: number
  avg_monthly_sales: number
  avg_weekly_sales: number
  stock_status: 'reorder' | 'critical' | 'ok'
  stock_value_cents: number
  branch_count: number
  preferred_supplier_name: string | null
}

export interface ReorderSuggestion {
  product_id: string
  sku: string
  name: string
  brand: string | null
  category_name: string | null
  current_stock: number
  available_stock: number
  reorder_level: number
  safety_stock: number
  lead_time_days: number
  avg_daily_sales: number
  suggested_order_qty: number
  priority: 'critical' | 'high' | 'normal'
  purchase_price: number
  estimated_cost: number
  preferred_supplier_id: string | null
  preferred_supplier_name: string | null
}

export async function getInventoryAnalytics() {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return { products: [], suppliers: [], summary: null }

    // Get all products with inventory
    const { data: products, error } = await supabaseAdmin
      .from('products')
      .select(`
        id, sku, name, brand, category_id, selling_price, purchase_price,
        reorder_level, safety_stock, avg_monthly_sales, avg_weekly_sales,
        wholesale_price, status,
        preferred_supplier_id,
        category:categories(name)
      `)
      .order('name')

    if (error) throw error

    // Get inventory sums per product
    const { data: inventoryRows } = await supabaseAdmin
      .from('inventory')
      .select('product_id, quantity, reserved_stock')

    const stockMap: Record<string, { total: number; reserved: number; branches: Set<string> }> = {}
    for (const row of inventoryRows || []) {
      if (!stockMap[row.product_id]) {
        stockMap[row.product_id] = { total: 0, reserved: 0, branches: new Set() }
      }
      stockMap[row.product_id].total += row.quantity || 0
      stockMap[row.product_id].reserved += (row as Record<string, unknown>).reserved_stock as number || 0
    }

    // Get preferred supplier names
    const supplierIds = [...new Set(products?.map(p => p.preferred_supplier_id).filter(Boolean) as string[])]
    const { data: suppliers } = supplierIds.length > 0
      ? await supabaseAdmin.from('suppliers').select('id, name').in('id', supplierIds)
      : { data: [] }
    const supplierMap: Record<string, string> = {}
    for (const s of suppliers || []) { supplierMap[s.id] = s.name }

    const processedProducts: AnalyticsProduct[] = ((products || [])
      .filter(p => p.status === 'active')
      .map(p => {
        const stock = stockMap[p.id] || { total: 0, reserved: 0, branches: new Set() }
        const purchasePrice = p.purchase_price || 0
        const sellingPrice = p.selling_price || 0
        const marginCents = sellingPrice - purchasePrice
        const marginPct = purchasePrice > 0
          ? Math.round(((sellingPrice - purchasePrice) / purchasePrice) * 10000) / 100
          : 0
        const available = stock.total - stock.reserved
        const reorderLevel = p.reorder_level || 0
        const safetyStock = p.safety_stock || 0

        let stockStatus: 'reorder' | 'critical' | 'ok'
        if (available <= safetyStock) stockStatus = 'critical'
        else if (available <= reorderLevel) stockStatus = 'reorder'
        else stockStatus = 'ok'

        return {
          id: p.id,
          sku: p.sku,
          name: p.name,
          brand: p.brand,
          category_id: p.category_id,
          category_name: Array.isArray(p.category) ? p.category[0]?.name : (p.category as { name?: string } | null)?.name || null,
          selling_price: sellingPrice,
          purchase_price: purchasePrice,
          margin_cents: marginCents,
          margin_pct: marginPct,
          total_stock: stock.total,
          available_stock: available,
          reorder_level: reorderLevel,
          safety_stock: safetyStock,
          avg_monthly_sales: p.avg_monthly_sales || 0,
          avg_weekly_sales: p.avg_weekly_sales || 0,
          stock_status: stockStatus,
          stock_value_cents: stock.total * purchasePrice,
          branch_count: stock.branches.size,
          preferred_supplier_name: supplierMap[p.preferred_supplier_id || ''] || null,
        }
      })) as AnalyticsProduct[]

    return {
      products: processedProducts,
      summary: {
        total_products: processedProducts.length,
        total_stock_value: processedProducts.reduce((s, p) => s + p.stock_value_cents, 0),
        total_margin: processedProducts.reduce((s, p) => s + p.margin_cents * p.avg_monthly_sales, 0),
        critical_count: processedProducts.filter(p => p.stock_status === 'critical').length,
        reorder_count: processedProducts.filter(p => p.stock_status === 'reorder').length,
        ok_count: processedProducts.filter(p => p.stock_status === 'ok').length,
        avg_margin_pct: processedProducts.length > 0
          ? Math.round(processedProducts.reduce((s, p) => s + p.margin_pct, 0) / processedProducts.length * 100) / 100
          : 0,
      },
    }
  } catch (error) {
    logger.error('Error fetching inventory analytics:', error)
    return { products: [], suppliers: [], summary: null }
  }
}

export async function getReorderSuggestions() {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return []

    const { data: products, error } = await supabaseAdmin
      .from('products')
      .select(`
        id, sku, name, brand, category_id, purchase_price, selling_price,
        reorder_level, safety_stock, lead_time_days, avg_monthly_sales,
        preferred_supplier_id, status,
        category:categories(name)
      `)
      .eq('status', 'active')
      .order('name')

    if (error) throw error

    const { data: inventoryRows } = await supabaseAdmin
      .from('inventory')
      .select('product_id, quantity, reserved_stock')

    const stockMap: Record<string, { total: number; reserved: number }> = {}
    for (const row of inventoryRows || []) {
      if (!stockMap[row.product_id]) {
        stockMap[row.product_id] = { total: 0, reserved: 0 }
      }
      stockMap[row.product_id].total += row.quantity || 0
      stockMap[row.product_id].reserved += (row as Record<string, unknown>).reserved_stock as number || 0
    }

    // Get supplier names
    const supplierIds = [...new Set(products?.map(p => p.preferred_supplier_id).filter(Boolean) as string[])]
    const { data: suppliers } = supplierIds.length > 0
      ? await supabaseAdmin.from('suppliers').select('id, name').in('id', supplierIds)
      : { data: [] }
    const supplierMap: Record<string, string> = {}
    for (const s of suppliers || []) { supplierMap[s.id] = s.name }

    const suggestions: ReorderSuggestion[] = []

    for (const p of products || []) {
      const stock = stockMap[p.id] || { total: 0, reserved: 0 }
      const available = stock.total - stock.reserved
      const reorderLevel = p.reorder_level || 0
      const safetyStock = p.safety_stock || 0
      const leadTimeDays = p.lead_time_days || 0
      const avgMonthly = p.avg_monthly_sales || 0
      const avgDaily = avgMonthly > 0 ? Math.round((avgMonthly / 30) * 100) / 100 : 0

      // Only suggest for products that need reordering
      if (available > reorderLevel && available > safetyStock) continue

      // Calculate suggested order quantity
      const suggestedQty = Math.max(
        reorderLevel - available,
        safetyStock - available,
        Math.ceil(avgDaily * leadTimeDays * 1.5) // 50% buffer
      )

      const priority: 'critical' | 'high' | 'normal' =
        available <= safetyStock ? 'critical' :
        available <= reorderLevel ? 'high' :
        'normal'

      suggestions.push({
        product_id: p.id,
        sku: p.sku,
        name: p.name,
        brand: p.brand,
        category_name: Array.isArray(p.category) ? p.category[0]?.name : (p.category as { name?: string } | null)?.name || null,
        current_stock: stock.total,
        available_stock: available,
        reorder_level: reorderLevel,
        safety_stock: safetyStock,
        lead_time_days: leadTimeDays,
        avg_daily_sales: avgDaily,
        suggested_order_qty: suggestedQty,
        priority,
        purchase_price: p.purchase_price || 0,
        estimated_cost: suggestedQty * (p.purchase_price || 0),
        preferred_supplier_id: p.preferred_supplier_id,
        preferred_supplier_name: supplierMap[p.preferred_supplier_id || ''] || null,
      })
    }

    // Sort by priority (critical first), then by availability ascending
    const priorityOrder = { critical: 0, high: 1, normal: 2 }
    suggestions.sort((a, b) => {
      const pa = priorityOrder[a.priority]
      const pb = priorityOrder[b.priority]
      if (pa !== pb) return pa - pb
      return a.available_stock - b.available_stock
    })

    return suggestions
  } catch (error) {
    logger.error('Error generating reorder suggestions:', error)
    return []
  }
}

/**
 * Create purchase orders from reorder suggestions, grouped by supplier
 */
export async function createPurchaseOrdersFromSuggestions(branchId: string) {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) {
      return { success: false, error: 'Unauthorized', orders: [] }
    }

    const suggestions = await getReorderSuggestions()
    if (suggestions.length === 0) {
      return { success: true, message: 'No products need reordering', orders: [] }
    }

    // Group by supplier
    const groups: Record<string, { supplier_id: string; supplier_name: string; items: ReorderSuggestion[] }> = {}
    for (const s of suggestions) {
      const sid = s.preferred_supplier_id || 'unknown'
      if (!groups[sid]) {
        groups[sid] = {
          supplier_id: sid,
          supplier_name: s.preferred_supplier_name || (sid === 'unknown' ? 'No Preferred Supplier' : 'Unknown'),
          items: [],
        }
      }
      groups[sid].items.push(s)
    }

    const createdOrders: Array<{ id: string; supplier_name: string; item_count: number; total: number }> = []

    for (const group of Object.values(groups)) {
      const items = group.items.map(item => ({
        product_id: item.product_id,
        quantity: item.suggested_order_qty,
        unit_price: item.purchase_price,
      }))

      // Use the createPurchaseOrder from purchase-actions
      const { createPurchaseOrder: createPO } = await import('@/lib/purchase-actions')
      const result = await createPO({
        supplier_id: group.supplier_id,
        branch_id: branchId,
        items,
        expected_delivery: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0], // 7 days from now
        notes: `Auto-generated from reorder engine — ${group.items.length} product(s) needing restock`,
      })

      if (result.success && result.purchase_order) {
        createdOrders.push({
          id: result.purchase_order.id,
          supplier_name: group.supplier_name,
          item_count: group.items.length,
          total: result.purchase_order.total_amount || 0,
        })
      }
    }

    return {
      success: createdOrders.length > 0,
      message: createdOrders.length > 0
        ? `Created ${createdOrders.length} purchase order(s)`
        : 'Could not create purchase orders',
      orders: createdOrders,
    }
  } catch (error) {
    logger.error('Error creating POs from suggestions:', error)
    return { success: false, error: 'Operation failed. Please try again.', orders: [] }
  }
}

export async function dismissReorderSuggestion(productId: string) {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return { success: false, error: 'Unauthorized' }

    // Could update reorder_suggestions table if it exists
    return { success: true }
  } catch (error) {
    logger.error('Operation failed', { error: error })
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function getTopPerformers() {
  try {
    const analytics = await getInventoryAnalytics()
    if (!analytics.products.length) return { topProfit: [], topRevenue: [], slowest: [], topShrinkage: [] }

    const products = analytics.products

    // Top profit makers (margin_cents * avg_monthly_sales)
    const topProfit = [...products]
      .sort((a, b) => (b.margin_cents * b.avg_monthly_sales) - (a.margin_cents * a.avg_monthly_sales))
      .slice(0, 10)

    // Top revenue (selling_price * avg_monthly_sales)
    const topRevenue = [...products]
      .sort((a, b) => (b.selling_price * b.avg_monthly_sales) - (a.selling_price * a.avg_monthly_sales))
      .slice(0, 10)

    // Slow movers (products tying up cash)
    const slowest = [...products]
      .filter(p => p.avg_monthly_sales > 0)
      .sort((a, b) => (a.avg_monthly_sales / Math.max(a.total_stock, 1)) - (b.avg_monthly_sales / Math.max(b.total_stock, 1)))
      .slice(0, 10)

    return { topProfit, topRevenue, slowest, topShrinkage: [] }
  } catch (error) {
    logger.error('Error getting top performers:', error)
    return { topProfit: [], topRevenue: [], slowest: [], topShrinkage: [] }
  }
}
