'use server'

import { authenticateServerAction } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

export interface StockCount {
  id: string
  branch_id: string
  count_date: string
  status: 'draft' | 'in_progress' | 'completed' | 'approved' | 'cancelled'
  notes: string | null
  total_items: number
  total_discrepancies: number
  net_variance: number
  created_by: string
  approved_by: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
}

export interface StockCountItem {
  id: string
  stock_count_id: string
  product_id: string
  expected_quantity: number
  physical_quantity: number
  variance: number
  notes: string | null
  created_at: string
}

/** Create a new stock count (draft) */
export async function createStockCount(
  branchId: string,
  userId: string
): Promise<{ success: boolean; data?: StockCount; error?: string }> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data, error } = await supabaseAdmin
      .from('stock_counts')
      .insert({
        branch_id: branchId,
        status: 'draft',
        created_by: userId,
      })
      .select()
      .single()

    if (error) {
      if (error) logger.error('Operation failed', { error: error })
      throw new Error('Operation failed')
    }
    return { success: true, data: data as StockCount }
  } catch (error) {
    logger.error('Error creating stock count', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

/** Fetch stock counts for a branch */
export async function getStockCounts(
  branchId: string,
  status?: string
): Promise<StockCount[]> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return []

    let query = supabaseAdmin
      .from('stock_counts')
      .select('*')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query
    if (error) throw error
    return (data || []) as StockCount[]
  } catch (error) {
    logger.error('Error fetching stock counts', error)
    return []
  }
}

/** Get a single stock count with items */
export async function getStockCountWithItems(
  stockCountId: string
): Promise<{ count?: StockCount; items?: StockCountItem[]; error?: string }> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return { error: 'Not authenticated' }

    const { data: countData, error: countError } = await supabaseAdmin
      .from('stock_counts')
      .select('*')
      .eq('id', stockCountId)
      .single()

    if (countError) {
        if (countError) logger.error('Operation failed', { error: countError })
        throw new Error('Operation failed')
      }

    const { data: itemsData, error: itemsError } = await supabaseAdmin
      .from('stock_count_items')
      .select(`
        *,
        product:products(id, sku, name, selling_price, purchase_price)
      `)
      .eq('stock_count_id', stockCountId)
      .order('created_at', { ascending: true })

    if (itemsError) {
        if (itemsError) logger.error('Operation failed', { error: itemsError })
        throw new Error('Operation failed')
      }

    return { count: countData as StockCount, items: (itemsData || []) as StockCountItem[] }
  } catch (error) {
    logger.error('Error fetching stock count', error)
    return { error: 'Operation failed. Please try again.' }
  }
}

/** Load products into a draft stock count (fetch inventory snapshot) */
export async function populateStockCount(
  stockCountId: string,
  branchId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return { success: false, error: 'Not authenticated' }

    // Get all products with inventory for this branch
    const { data: inventory, error: invError } = await supabaseAdmin
      .from('inventory')
      .select(`
        product_id,
        quantity,
        product:products(id, sku, name, selling_price, purchase_price)
      `)
      .eq('branch_id', branchId)
      .gt('quantity', 0)

    if (invError) {
      logger.error('Operation failed', { error: invError })
      throw new Error('Operation failed')
    }
    if (!inventory || inventory.length === 0) {
      return { success: false, error: 'No inventory found for this branch' }
    }

    // Build stock_count_items inserts
    const items = inventory.map((inv: Record<string, unknown>) => ({
      stock_count_id: stockCountId,
      product_id: inv.product_id as string,
      expected_quantity: inv.quantity as number,
      physical_quantity: 0,
      variance: 0,
    }))

    const { error: insertError } = await supabaseAdmin
      .from('stock_count_items')
      .insert(items)

    if (insertError) {
        if (insertError) logger.error('Operation failed', { error: insertError })
        throw new Error('Operation failed')
      }

    // Update count header
    const { error: updateError } = await supabaseAdmin
      .from('stock_counts')
      .update({
        total_items: items.length,
        status: 'in_progress',
        updated_at: new Date().toISOString(),
      })
      .eq('id', stockCountId)

    if (updateError) {
      if (updateError) logger.error('Operation failed', { error: updateError })
      throw new Error('Operation failed')
    }

    return { success: true }
  } catch (error) {
    logger.error('Error populating stock count', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

/** Update physical count for a stock count item */
export async function updateStockCountItem(
  itemId: string,
  physicalQuantity: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return { success: false, error: 'Not authenticated' }

    // Get current item to compute variance
    const { data: item, error: fetchError } = await supabaseAdmin
      .from('stock_count_items')
      .select('*')
      .eq('id', itemId)
      .single()

    if (fetchError) throw new Error('Stock count item not found')

    const variance = physicalQuantity - item.expected_quantity

    const { error: updateError } = await supabaseAdmin
      .from('stock_count_items')
      .update({
        physical_quantity: physicalQuantity,
        variance,
      })
      .eq('id', itemId)

    if (updateError) {
      if (updateError) logger.error('Operation failed', { error: updateError })
      throw new Error('Operation failed')
    }

    return { success: true }
  } catch (error) {
    logger.error('Error updating stock count item', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

/** Complete a stock count: compute totals, flag discrepancies, calculate shrinkage */
export async function completeStockCount(
  stockCountId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return { success: false, error: 'Not authenticated' }

    // Get all items with product cost info
    const { data: items, error: itemsError } = await supabaseAdmin
      .from('stock_count_items')
      .select('*, product:products(purchase_price)')
      .eq('stock_count_id', stockCountId)

    if (itemsError) {
      logger.error('Operation failed', { error: itemsError })
      throw new Error('Operation failed')
    }
    if (!items || items.length === 0) throw new Error('No items in stock count')

    const totalDiscrepancies = items.filter((i: { variance: number }) => i.variance !== 0).length
    const netVariance = items.reduce((sum: number, i: { variance: number }) => sum + (i.variance || 0), 0)

    // Compute shrinkage: only negative variances (stock loss), sum amounts + values
    let shrinkageAmount = 0
    let shrinkageValue = 0
    for (const item of items as { variance: number; product?: { purchase_price: number } }[]) {
      if (item.variance < 0) {
        const loss = Math.abs(item.variance)
        shrinkageAmount += loss
        const unitCost = item.product?.purchase_price || 0
        shrinkageValue += loss * unitCost
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from('stock_counts')
      .update({
        status: 'completed',
        total_discrepancies: totalDiscrepancies,
        net_variance: netVariance,
        shrinkage_amount: shrinkageAmount,
        shrinkage_value: shrinkageValue,
        updated_at: new Date().toISOString(),
      })
      .eq('id', stockCountId)

    if (updateError) {
      if (updateError) logger.error('Operation failed', { error: updateError })
      throw new Error('Operation failed')
    }

    return { success: true }
  } catch (error) {
    logger.error('Error completing stock count', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

/** Approve a completed stock count, applying inventory adjustments for discrepancies */
export async function approveStockCount(
  stockCountId: string,
  userId: string,
  branchId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return { success: false, error: 'Not authenticated' }

    const result = await getStockCountWithItems(stockCountId)
    if (result.error || !result.items) throw new Error(result.error || 'No items found')
    if (result.count?.status !== 'completed') {
      return { success: false, error: 'Stock count must be completed before approval' }
    }

    // Apply adjustments for discrepant items
    for (const item of result.items) {
      if (item.variance === 0) continue

      const adjustment = item.variance // positive = add stock, negative = remove

      // Update inventory
      const { data: inv, error: invFetchError } = await supabaseAdmin
        .from('inventory')
        .select('id, quantity')
        .eq('product_id', item.product_id)
        .eq('branch_id', branchId)
        .single()

      if (invFetchError || !inv) continue

      const newQuantity = Math.max(0, inv.quantity + adjustment)
      await supabaseAdmin
        .from('inventory')
        .update({
          quantity: newQuantity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', inv.id)

      // Log stock movement
      await supabaseAdmin
        .from('stock_movements')
        .insert({
          product_id: item.product_id,
          branch_id: branchId,
          type: adjustment > 0 ? 'stock_count_addition' : 'stock_count_removal',
          quantity: Math.abs(adjustment),
          reference_id: stockCountId,
          notes: `Stock count adjustment: expected ${item.expected_quantity}, counted ${item.physical_quantity}`,
        })
    }

    // Mark as approved
    const { error: updateError } = await supabaseAdmin
      .from('stock_counts')
      .update({
        status: 'approved',
        approved_by: userId,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', stockCountId)

    if (updateError) {
      if (updateError) logger.error('Operation failed', { error: updateError })
      throw new Error('Operation failed')
    }

    return { success: true }
  } catch (error) {
    logger.error('Error approving stock count', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

/** Cancel a stock count (draft or in_progress only) */
export async function cancelStockCount(
  stockCountId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return { success: false, error: 'Not authenticated' }

    const { error } = await supabaseAdmin
      .from('stock_counts')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', stockCountId)
      .in('status', ['draft', 'in_progress'])

    if (error) {
      if (error) logger.error('Operation failed', { error: error })
      throw new Error('Operation failed')
    }

    return { success: true }
  } catch (error) {
    logger.error('Error cancelling stock count', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}
