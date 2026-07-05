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
  if (error) throw new Error(error.message)
  return (data || []) as StockTransfer[]
}

export async function getStockTransfer(transferId: string): Promise<StockTransfer | null> {
  await authenticateServerAction()

  const { data, error } = await supabaseAdmin
    .from('stock_transfers')
    .select('*, from_branch:branches!stock_transfers_from_branch_id_fkey(name), to_branch:branches!stock_transfers_to_branch_id_fkey(name), items:stock_transfer_items(*, product:products(name, sku))')
    .eq('id', transferId)
    .single()

  if (error) throw new Error(error.message)
  return data as StockTransfer
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
      await supabaseAdmin.from('stock_transfer_items').insert(items)
    }

    return { success: true, id: transfer.id }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create transfer' }
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
    return { success: false, error: error instanceof Error ? error.message : 'Failed to approve' }
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
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update' }
  }
}

export async function receiveStockTransfer(
  transferId: string,
  receivedItems: Array<{ item_id: string; quantity_received: number }>
): Promise<{ success: boolean; error?: string }> {
  try {
    const { profile } = await authenticateServerAction()
    if (!profile) throw new Error('Unauthorized')

    // Update received quantities
    for (const item of receivedItems) {
      await supabaseAdmin
        .from('stock_transfer_items')
        .update({ quantity_received: item.quantity_received })
        .eq('id', item.item_id)
    }

    // Update transfer status
    const { error } = await supabaseAdmin
      .from('stock_transfers')
      .update({
        status: 'received',
        received_by: profile.id,
        received_at: new Date().toISOString(),
      })
      .eq('id', transferId)
      .eq('status', 'in_transit')

    if (error) throw error
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to receive' }
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
    return { success: false, error: error instanceof Error ? error.message : 'Failed to cancel' }
  }
}

export async function getAllBranches() {
  const { data, error } = await supabaseAdmin
    .from('branches')
    .select('*')
    .order('name')
  if (error) throw new Error(error.message)
  return data || []
}

export async function getProductsAtBranch(branchId: string) {
  const { data, error } = await supabaseAdmin
    .from('products')
    .select('*, stock:inventory(*)')
    .eq('branch_id', branchId)
    .order('name')
  if (error) throw new Error(error.message)
  return data || []
}
