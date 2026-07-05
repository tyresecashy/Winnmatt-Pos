'use server'

import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

export interface SuggestionItem {
  product_id: string
  name: string
  sku: string
  selling_price: number
  purchase_price: number
  available_quantity: number
  reason: string
  match_score: number
}

/**
 * Get smart add-on suggestions based on current cart contents
 * Uses purchase history patterns to recommend complementary items
 */
export async function getSmartSuggestions(
  branchId: string,
  cartProductIds: string[]
): Promise<SuggestionItem[]> {
  if (cartProductIds.length === 0) return []

  try {
    // Find products frequently bought together with cart items
    // Based on sale_items co-occurrence analysis
    const { data: coBought } = await supabaseAdmin
      .from('sale_items')
      .select(`
        product_id,
        quantity,
        sale:sales!inner(id, branch_id)
      `)
      .in('sale.branch_id', [branchId])
      .in('product_id', cartProductIds)
      .limit(500)

    if (!coBought || coBought.length === 0) return []

    // Get sale IDs that contain our cart items
    const saleIds = [...new Set(coBought.map(item => {
      const sale = (item as Record<string, unknown>).sale as { id: string }
      return sale?.id
    }).filter(Boolean))] as string[]

    if (saleIds.length === 0) return []

    // Find other products in those same sales
    const { data: otherItems } = await supabaseAdmin
      .from('sale_items')
      .select(`
        product_id,
        quantity,
        product:products(id, name, sku, selling_price, purchase_price, status)
      `)
      .in('sale_id', saleIds)
      .not('product_id', 'in', `(${cartProductIds.map(id => `'${id}'`).join(',')})`)
      .limit(500)

    if (!otherItems) return []

    // Count co-occurrences
    const coOccurrence: Record<string, { count: number; name: string; sku: string; selling_price: number; purchase_price: number }> = {}

    for (const item of otherItems) {
      const row = item as Record<string, unknown>
      const product = row.product as { id: string; name: string; sku: string; selling_price: number; purchase_price: number; status: string } | null
      if (!product || product.status !== 'active') continue
      const pid = row.product_id as string
      if (!coOccurrence[pid]) {
        coOccurrence[pid] = { count: 0, name: product.name, sku: product.sku, selling_price: product.selling_price || 0, purchase_price: product.purchase_price || 0 }
      }
      coOccurrence[pid].count += (row.quantity as number) || 0
    }

    // Get current inventory availability
    const productIds = Object.keys(coOccurrence)
    if (productIds.length === 0) return []

    const { data: inventory } = await supabaseAdmin
      .from('inventory')
      .select('product_id, quantity')
      .eq('branch_id', branchId)
      .in('product_id', productIds)

    const stockMap: Record<string, number> = {}
    for (const row of inventory || []) {
      stockMap[row.product_id] = (stockMap[row.product_id] || 0) + (row.quantity || 0)
    }

    // Sort by co-occurrence count, filter to in-stock, limit to 5
    return Object.entries(coOccurrence)
      .map(([pid, item]) => ({
        product_id: pid,
        name: item.name,
        sku: item.sku,
        selling_price: item.selling_price,
        purchase_price: item.purchase_price,
        available_quantity: stockMap[pid] || 0,
        reason: 'Frequently bought together',
        match_score: item.count,
      }))
      .filter(item => item.available_quantity > 0)
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, 5)
  } catch (error) {
    logger.error('Error getting smart suggestions:', error)
    return []
  }
}

/**
 * Get suggested quantity add-ons based on common upsell logic
 */
export async function getStaticSuggestions(products: Array<{ id: string; name: string; sku: string; selling_price?: number; purchase_price?: number; quantity: number; category?: { id: string; name: string } | null }>, cartProductIds: string[]): Promise<SuggestionItem[]> {
  // Categories and their common add-ons
  const suggestionRules: Record<string, Array<{ categoryName: string; reason: string }>> = {
    'Bread': [{ categoryName: 'Dairy', reason: 'Goes well with bread' }],
    'Milk': [{ categoryName: 'Cereal', reason: 'Perfect with milk' }],
    'Paint': [{ categoryName: 'Tools', reason: 'Essential for painting' }],
    'Rice': [{ categoryName: 'Cooking Oil', reason: 'Staple cooking companion' }],
    'Sugar': [{ categoryName: 'Tea', reason: 'Common breakfast combo' }],
  }

  const suggestions: SuggestionItem[] = []
  const addedIds = new Set(cartProductIds)

  // Get categories of products in cart
  const cartCategories = products
    .filter(p => cartProductIds.includes(p.id))
    .map(p => p.category?.name)
    .filter(Boolean) as string[]

  for (const catName of cartCategories) {
    const rules = suggestionRules[catName] || []
    for (const rule of rules) {
      const matches = products.filter(p =>
        p.category?.name === rule.categoryName &&
        !addedIds.has(p.id) &&
        p.quantity > 0
      )
      for (const m of matches) {
        suggestions.push({
          product_id: m.id,
          name: m.name,
          sku: m.sku,
          selling_price: m.selling_price || 0,
          purchase_price: m.purchase_price || 0,
          available_quantity: m.quantity,
          reason: rule.reason,
          match_score: 50,
        })
        addedIds.add(m.id)
        if (suggestions.length >= 3) break
      }
      if (suggestions.length >= 3) break
    }
    if (suggestions.length >= 3) break
  }

  return suggestions
}
