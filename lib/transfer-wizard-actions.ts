'use server'

import { logger } from '@/lib/logger'
import { supabaseAdmin } from '@/lib/supabase-server'

// ─── Types ────────────────────────────────────────────────────────────────

export interface TransferWizardItem {
  id: string
  product_id: string
  product_name: string
  product_sku: string
  quantity_requested: number
  quantity_dispatched: number
  quantity_received: number
  quantity_damaged: number
  variance: number
  variance_notes: string | null
  batch_number: string | null
  expiry_date: string | null
  unit_cost: number
}

export interface TransferWizard {
  id: string
  transfer_number: string | null
  from_warehouse_id: string | null
  from_warehouse_name: string | null
  to_warehouse_id: string | null
  to_warehouse_name: string | null
  requested_by: string | null
  requested_by_name: string | null
  approved_by: string | null
  driver_name: string | null
  driver_phone: string | null
  vehicle_number: string | null
  expected_arrival: string | null
  actual_arrival: string | null
  dispatched_at: string | null
  arrived_at: string | null
  received_by: string | null
  signature: string | null
  photos: string[] | null
  variance_report: Record<string, unknown> | null
  status: string
  notes: string | null
  items: TransferWizardItem[]
  created_at: string
  updated_at: string
}

// ─── Server Actions ───────────────────────────────────────────────────────

/**
 * Get all transfers as wizard objects
 */
export async function getTransferWizards() {
  try {
    const { data: transfers, error } = await supabaseAdmin
      .from('stock_transfers')
      .select(`
        *,
        items:stock_transfer_items(*),
        from_warehouse:from_warehouse_id(id, name),
        to_warehouse:to_warehouse_id(id, name),
        requester:requested_by(id, name),
        approver:approved_by(id, name),
        receiver:received_by(id, name)
      `)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      // If stock_transfers table doesn't exist yet, return empty
      if (error.code === '42P01') return []
      throw error
    }

    return (transfers || []).map(normalizeTransfer)
  } catch (error) {
    logger.error('Error fetching transfer wizards:', error)
    return []
  }
}

/**
 * Get transfers from stock_movements as fallback
 */
export async function getLegacyTransfers(limit = 50) {
  try {
    const { data, error } = await supabaseAdmin
      .from('stock_movements')
      .select(`
        id, product_id, branch_id, type, quantity, reference_id, notes, created_at,
        product:products(id, sku, name),
        branch:branches!branch_id(id, name, code)
      `)
      .eq('type', 'transfer')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      if (error.code === '42P01') return { transfers: [], mode: 'empty' as const }
      throw error
    }

    const movements = (data || []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      product_id: row.product_id as string,
      branch_id: row.branch_id as string,
      type: row.type as string,
      quantity: row.quantity as number,
      reference_id: row.reference_id as string,
      notes: row.notes as string | null,
      created_at: row.created_at as string,
      product: Array.isArray(row.product) ? (row.product[0] as { id: string; sku: string; name: string }) : (row.product as { id: string; sku: string; name: string }),
      branch: Array.isArray(row.branch) ? (row.branch[0] as { id: string; name: string; code: string }) : (row.branch as { id: string; name: string; code: string }),
    }))

    // Group by reference_id
    const groups: Record<string, { id: string; createdAt: string; notes: string | null; movements: typeof movements }> = {}
    movements.forEach(m => {
      const ref = m.reference_id || m.id
      if (!groups[ref]) {
        groups[ref] = { id: ref, createdAt: m.created_at, notes: m.notes, movements: [] }
      }
      groups[ref].movements.push(m)
    })

    return {
      transfers: Object.values(groups).map(g => {
        const outM = g.movements.find(m => m.quantity < 0)
        const inM = g.movements.find(m => m.quantity > 0)
        return {
          id: g.id,
          transfer_number: null,
          status: 'completed' as const,
          from_warehouse_name: outM?.branch?.name || null,
          to_warehouse_name: inM?.branch?.name || null,
          driver_name: null,
          vehicle_number: null,
          notes: g.notes,
          itemCount: g.movements.length / 2,
          created_at: g.createdAt,
        }
      }),
      mode: 'legacy' as const,
    }
  } catch (error) {
    logger.error('Error fetching legacy transfers:', error)
    return { transfers: [], mode: 'empty' as const }
  }
}

/**
 * Create a new transfer with wizard items
 */
export async function createTransferWizard(data: {
  fromWarehouseId: string
  toWarehouseId: string
  notes?: string
  driverName?: string
  driverPhone?: string
  vehicleNumber?: string
  expectedArrival?: string
  items: Array<{
    productId: string
    quantityRequested: number
    batchNumber?: string
    expiryDate?: string
  }>
}) {
  try {
    // Get the next transfer number
    const { data: seqData } = await supabaseAdmin.rpc('next_transfer_number' as never).maybeSingle()
    const transferNumber = seqData || `TRF-${Date.now().toString(36).toUpperCase()}`

    // Insert the transfer
    const { data: transfer, error } = await supabaseAdmin
      .from('stock_transfers')
      .insert({
        transfer_number: transferNumber,
        from_warehouse_id: data.fromWarehouseId,
        to_warehouse_id: data.toWarehouseId,
        status: 'draft',
        driver_name: data.driverName || null,
        driver_phone: data.driverPhone || null,
        vehicle_number: data.vehicleNumber || null,
        expected_arrival: data.expectedArrival || null,
        notes: data.notes || null,
      } as never)
      .select()
      .single()

    if (error) throw error

    // Insert items
    if (data.items.length > 0) {
      const { error: itemsError } = await supabaseAdmin
        .from('stock_transfer_items')
        .insert(
          data.items.map(item => ({
            transfer_id: transfer.id,
            product_id: item.productId,
            quantity_requested: item.quantityRequested,
            batch_number: item.batchNumber || null,
            expiry_date: item.expiryDate || null,
          })) as never
        )

      if (itemsError) throw itemsError
    }

    return { success: true, transferId: transfer.id, transferNumber }
  } catch (error) {
    logger.error('Error creating transfer:', error)
    return {
      success: false,
      error: 'Operation failed. Please try again.',
    }
  }
}

/**
 * Update transfer status (advance workflow)
 */
export async function updateTransferStatus(
  transferId: string,
  newStatus: string,
  additionalData?: Record<string, unknown>
) {
  try {
    const updateData: Record<string, unknown> = {
      status: newStatus,
      ...additionalData,
    }

    const { error } = await supabaseAdmin
      .from('stock_transfers')
      .update(updateData)
      .eq('id', transferId)

    if (error) throw error
    return { success: true }
  } catch (error) {
    logger.error('Error updating transfer status:', error)
    return {
      success: false,
      error: 'Operation failed. Please try again.',
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function normalizeTransfer(row: Record<string, unknown>): TransferWizard {
  const rawItems = row.items as Record<string, unknown>[]
  const fromW = row.from_warehouse as { id: string; name: string } | null
  const toW = row.to_warehouse as { id: string; name: string } | null
  const requester = row.requester as { id: string; name: string } | null
  const approver = row.approver as { id: string; name: string } | null
  const receiver = row.receiver as { id: string; name: string } | null

  return {
    id: row.id as string,
    transfer_number: row.transfer_number as string | null,
    from_warehouse_id: row.from_warehouse_id as string | null,
    from_warehouse_name: fromW?.name || null,
    to_warehouse_id: row.to_warehouse_id as string | null,
    to_warehouse_name: toW?.name || null,
    requested_by: row.requested_by as string | null,
    requested_by_name: requester?.name || null,
    approved_by: row.approved_by as string | null,
    driver_name: row.driver_name as string | null,
    driver_phone: row.driver_phone as string | null,
    vehicle_number: row.vehicle_number as string | null,
    expected_arrival: row.expected_arrival as string | null,
    actual_arrival: row.actual_arrival as string | null,
    dispatched_at: row.dispatched_at as string | null,
    arrived_at: row.arrived_at as string | null,
    received_by: row.received_by as string | null,
    signature: row.signature as string | null,
    photos: row.photos as string[] | null,
    variance_report: row.variance_report as Record<string, unknown> | null,
    status: row.status as string,
    notes: row.notes as string | null,
    items: (rawItems || []).map(normalizeItem),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

function normalizeItem(row: Record<string, unknown>): TransferWizardItem {
  const product = row.product as { id: string; name: string; sku: string } | null
  return {
    id: row.id as string,
    product_id: row.product_id as string,
    product_name: product?.name || 'Unknown',
    product_sku: product?.sku || '',
    quantity_requested: (row.quantity_requested as number) || 0,
    quantity_dispatched: (row.quantity_dispatched as number) || 0,
    quantity_received: (row.quantity_received as number) || 0,
    quantity_damaged: (row.quantity_damaged as number) || 0,
    variance: (row.variance as number) || 0,
    variance_notes: row.variance_notes as string | null,
    batch_number: row.batch_number as string | null,
    expiry_date: row.expiry_date as string | null,
    unit_cost: (row.unit_cost as number) || 0,
  }
}
