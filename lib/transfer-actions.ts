'use server'

/**
 * Stock Transfers — Multi-branch transfer workflow
 *
 * Workflow: pending → approved → in_transit → received
 */

import { logger } from '@/lib/logger'
import { supabaseAdmin } from '@/lib/supabase-server'
import { authenticateServerAction } from '@/lib/auth-helpers'

export interface StockTransfer {
  id: string
  transfer_number: string
  from_branch_id: string
  to_branch_id: string
  status: string
  notes: string | null
  requested_by: string | null
  approved_by: string | null
  received_by: string | null
  requested_at: string
  approved_at: string | null
  received_at: string | null
  created_at: string
  from_branch?: { name: string }
  to_branch?: { name: string }
  items?: StockTransferItem[]
}

export interface StockTransferItem {
  id: string
  transfer_id: string
  product_id: string
  quantity_requested: number
  quantity_received: number
  notes: string | null
  product?: { name: string; sku: string }
}

export interface TransferItem {
  productId: string
  productName: string
  quantity: number
  notes?: string
}

export interface TransferFormItem {
  productId: string
  productName: string
  quantity: number
  maxQuantity: number
  [key: string]: unknown
}

export async function getStockTransfers(branchId?: string, status?: string): Promise<StockTransfer[]> {
  await authenticateServerAction()

  let query = supabaseAdmin
    .from('stock_transfers')
    .select('*, from_branch:branches!stock_transfers_from_branch_id_fkey(name), to_branch:branches!stock_transfers_to_branch_id_fkey(name)')
    .order('created_at', { ascending: false })

  if (branchId) {
    query = query.or(`from_branch_id.eq.${branchId},to_branch_id.eq.${branchId}`)
  }
  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) {
    if (error) logger.error('Operation failed', { error: error })
    throw new Error('Operation failed')
  }
  return (data || []) as unknown as StockTransfer[]
}

export async function getStockTransfer(transferId: string): Promise<StockTransfer | null> {
  await authenticateServerAction()

  const { data, error } = await supabaseAdmin
    .from('stock_transfers')
    .select('*, from_branch:branches!stock_transfers_from_branch_id_fkey(name), to_branch:branches!stock_transfers_to_branch_id_fkey(name), items:stock_transfer_items(*, product:products(name, sku))')
    .eq('id', transferId)
    .single()

  if (error) {
    if (error) logger.error('Operation failed', { error: error })
    throw new Error('Operation failed')
  }
  return data as unknown as StockTransfer
}

export async function createStockTransfer(data: {
  from_branch_id: string
  to_branch_id: string
  items: Array<{ product_id: string; quantity_requested: number; notes?: string }>
  notes?: string
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const { profile } = await authenticateServerAction()
    if (!profile) throw new Error('Unauthorized')

    if (data.from_branch_id === data.to_branch_id) {
      return { success: false, error: 'Cannot transfer to the same branch' }
    }

    // Generate transfer number
    const now = new Date()
    const dateStr = now.toISOString().split('T')[0]
    const transferNumber = `TRF-${dateStr}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`

    const { data: transfer, error } = await supabaseAdmin
      .from('stock_transfers')
      .insert({
        transfer_number: transferNumber,
        from_branch_id: data.from_branch_id,
        to_branch_id: data.to_branch_id,
        status: 'pending',
        notes: data.notes || null,
        requested_by: profile.id,
      })
      .select('id')
      .single()

    if (error) throw error

    // Insert items
    if (data.items.length > 0) {
      const items = data.items.map(item => ({
        transfer_id: transfer.id,
        product_id: item.product_id,
        quantity_requested: item.quantity_requested,
        quantity_received: 0,
        notes: item.notes || null,
      }))
      await supabaseAdmin.from('stock_transfer_items').insert(items as never)
    }

    return { success: true, id: transfer.id }
  } catch (error) {
    logger.error('Operation failed', { error: error })
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function approveStockTransfer(transferId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { profile } = await authenticateServerAction()
    if (!profile) throw new Error('Unauthorized')

    const { error } = await supabaseAdmin
      .from('stock_transfers')
      .update({
        status: 'approved',
        approved_by: profile.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', transferId)
      .eq('status', 'pending')

    if (error) throw error
    return { success: true }
  } catch (error) {
    logger.error('Operation failed', { error: error })
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function markInTransit(transferId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from('stock_transfers')
      .update({ status: 'in_transit' })
      .eq('id', transferId)
      .eq('status', 'approved')

    if (error) throw error
    return { success: true }
  } catch (error) {
    logger.error('Operation failed', { error: error })
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function receiveStockTransfer(
  transferId: string,
  receivedItems: Array<{ item_id: string; product_id?: string; quantity_received: number }>
): Promise<{ success: boolean; error?: string }> {
  try {
    const { profile } = await authenticateServerAction()
    if (!profile) throw new Error('Unauthorized')

    // Fetch transfer details to get product_id for each item
    const { data: transfer, error: transferError } = await supabaseAdmin
      .from('stock_transfers')
      .select('status, from_branch_id, to_branch_id, items:stock_transfer_items(id, product_id)')
      .eq('id', transferId)
      .single()

    if (transferError || !transfer) throw new Error('Transfer not found')
    if (transfer.status !== 'in_transit') throw new Error('Transfer is not in transit')

    // Build product-level items map from received items
    const itemProductMap = new Map<string, string>()
    for (const item of transfer.items ?? []) {
      itemProductMap.set(item.id, item.product_id)
    }

    const productItems: Array<{ product_id: string; quantity: number }> = []
    for (const ri of receivedItems) {
      const productId = ri.product_id || itemProductMap.get(ri.item_id)
      if (!productId) throw new Error(`Unknown product for item ${ri.item_id}`)
      productItems.push({ product_id: productId, quantity: ri.quantity_received })
    }

    // Call the atomic RPC — inventory debit/credit, status update,
    // stock movements, and quantity_received all in one DB transaction.
    const { data: result, error: rpcError } = await supabaseAdmin
      .rpc('receive_stock_transfer', {
        p_transfer_id: transferId,
        p_items: JSON.parse(JSON.stringify(productItems)),
        p_received_by: profile.id,
        p_received_at: new Date().toISOString(),
      })

    if (rpcError) {
      if (rpcError) logger.error('Operation failed', { error: rpcError })
      throw new Error('Operation failed')
    }

    const parsed = (result as { success: boolean; error?: string; itemErrors?: unknown[] }) || {}
    if (!parsed.success) {
      throw new Error(parsed.error || 'RPC returned failure')
    }

    return { success: true }
  } catch (error) {
    logger.error('Operation failed', { error: error })
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function cancelStockTransfer(transferId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from('stock_transfers')
      .update({ status: 'cancelled' })
      .eq('id', transferId)
      .in('status', ['pending', 'approved'])

    if (error) throw error
    return { success: true }
  } catch (error) {
    logger.error('Operation failed', { error: error })
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function getAllBranches() {
  const { data, error } = await supabaseAdmin
    .from('branches')
    .select('*')
    .order('name')
  if (error) {
    if (error) logger.error('Operation failed', { error: error })
    throw new Error('Operation failed')
  }
  return data || []
}

export async function getProductsAtBranch(branchId: string) {
  const { data, error } = await supabaseAdmin
    .from('products')
    .select('*, stock:inventory(*)')
    .eq('branch_id' as never, branchId as never)
    .order('name')
  if (error) {
    if (error) logger.error('Operation failed', { error: error })
    throw new Error('Operation failed')
  }
  return data || []
}
