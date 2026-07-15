/**
 * Transfers Repository — Enterprise Core Data Access for Stock Transfers
 *
 * Encapsulates direct Supabase access for the stock_transfers, stock_transfer_items,
 * and stock_movements tables. Callers (module facade, server actions) use this
 * repository instead of calling supabase directly.
 *
 * Constitution Reference: §5 (Module Architecture), §9 (Transaction & Event Rules)
 */

import { BaseRepository } from '@/lib/modules/core/repository'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface StockTransferRow {
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
  items?: StockTransferItemRow[]
  [key: string]: unknown
}

export interface StockTransferItemRow {
  id: string
  transfer_id: string
  product_id: string
  quantity_requested: number
  quantity_received: number
  notes: string | null
  product?: { name: string; sku: string }
  [key: string]: unknown
}

export interface TransferWizardRow {
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
  items: TransferWizardItemRow[]
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface TransferWizardItemRow {
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

export interface LegacyTransferRow {
  id: string
  product_id: string
  branch_id: string
  type: string
  quantity: number
  reference_id: string
  notes: string | null
  created_at: string
  product: { id: string; sku: string; name: string }
  branch: { id: string; name: string; code: string }
  [key: string]: unknown
}

export interface ProductWithStock {
  id: string
  name: string
  sku: string
  category_id: string | null
  stock: Array<{ quantity: number; branch_id: string; [key: string]: unknown }>
  [key: string]: unknown
}

// ─── Mapping helper ─────────────────────────────────────────────────────────

/**
 * Normalise a raw stock_transfer row into a TransferWizardRow.
 */
function normalizeTransfer(raw: Record<string, unknown>): TransferWizardRow {
  const items = (raw.items as Record<string, unknown>[] | null) ?? []
  return {
    id: raw.id as string,
    transfer_number: (raw.transfer_number as string) ?? null,
    from_warehouse_id: (raw.from_warehouse_id as string) ?? null,
    from_warehouse_name: ((raw.from_warehouse as Record<string, unknown> | null)?.name as string) ?? null,
    to_warehouse_id: (raw.to_warehouse_id as string) ?? null,
    to_warehouse_name: ((raw.to_warehouse as Record<string, unknown> | null)?.name as string) ?? null,
    requested_by: (raw.requested_by as string) ?? null,
    requested_by_name: ((raw.requester as Record<string, unknown> | null)?.name as string) ?? null,
    approved_by: ((raw.approver as Record<string, unknown> | null)?.id as string) ?? null,
    driver_name: (raw.driver_name as string) ?? null,
    driver_phone: (raw.driver_phone as string) ?? null,
    vehicle_number: (raw.vehicle_number as string) ?? null,
    expected_arrival: (raw.expected_arrival as string) ?? null,
    actual_arrival: (raw.actual_arrival as string) ?? null,
    dispatched_at: (raw.dispatched_at as string) ?? null,
    arrived_at: (raw.arrived_at as string) ?? null,
    received_by: (raw.received_by as string) ?? null,
    signature: (raw.signature as string) ?? null,
    photos: (raw.photos as string[] | null) ?? null,
    variance_report: (raw.variance_report as Record<string, unknown> | null) ?? null,
    status: (raw.status as string) ?? 'pending',
    notes: (raw.notes as string) ?? null,
    items: items.map((i: Record<string, unknown>) => ({
      id: i.id as string,
      product_id: i.product_id as string,
      product_name: i.product_name as string ?? '',
      product_sku: i.product_sku as string ?? '',
      quantity_requested: (i.quantity_requested as number) ?? 0,
      quantity_dispatched: (i.quantity_dispatched as number) ?? 0,
      quantity_received: (i.quantity_received as number) ?? 0,
      quantity_damaged: (i.quantity_damaged as number) ?? 0,
      variance: (i.variance as number) ?? 0,
      variance_notes: (i.variance_notes as string) ?? null,
      batch_number: (i.batch_number as string) ?? null,
      expiry_date: (i.expiry_date as string) ?? null,
      unit_cost: (i.unit_cost as number) ?? 0,
    })),
    created_at: raw.created_at as string,
    updated_at: raw.updated_at as string,
  }
}

// ─── Repository ─────────────────────────────────────────────────────────────

export class TransferRepository extends BaseRepository<StockTransferRow> {
  constructor() {
    super('stock_transfers', {
      audit: { eventType: 'transfer.*', aggregateType: 'stock_transfer' },
      lock: { resourcePrefix: 'transfer:' },
    })
  }

  /**
   * Get stock transfers, optionally filtered by branch and/or status.
   */
  async getStockTransfers(branchId?: string, status?: string): Promise<StockTransferRow[]> {
    let q = this.client
      .from('stock_transfers')
      .select('*, from_branch:branches!stock_transfers_from_branch_id_fkey(name), to_branch:branches!stock_transfers_to_branch_id_fkey(name)')
      .order('created_at', { ascending: false })

    if (branchId) {
      q = q.or(`from_branch_id.eq.${branchId},to_branch_id.eq.${branchId}`)
    }
    if (status) {
      q = q.eq('status', status)
    }

    const { data, error } = await q
    if (error) throw this._toError(error, 'getStockTransfers')
    return (data ?? []) as unknown as StockTransferRow[]
  }

  /**
   * Get a single stock transfer by ID with full details.
   */
  async getStockTransfer(transferId: string): Promise<StockTransferRow | null> {
    const { data, error } = await this.client
      .from('stock_transfers')
      .select('*, from_branch:branches!stock_transfers_from_branch_id_fkey(name), to_branch:branches!stock_transfers_to_branch_id_fkey(name), items:stock_transfer_items(*, product:products(name, sku))')
      .eq('id', transferId)
      .single()

    if (error) {
      const errObj = error as { code?: string }
      if (errObj.code === 'PGRST116') return null
      throw this._toError(error, 'getStockTransfer')
    }
    return (data ?? null) as unknown as StockTransferRow
  }

  /**
   * Get all transfers as wizard objects (with deep joins and normalisation).
   */
  async getTransferWizards(): Promise<TransferWizardRow[]> {
    const { data, error } = await this.client
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
      if ((error as { code?: string }).code === '42P01') return []
      throw this._toError(error, 'getTransferWizards')
    }

    return ((data ?? []) as Record<string, unknown>[]).map(normalizeTransfer)
  }

  /**
   * Get transfers from stock_movements as fallback (legacy mode).
   */
  async getLegacyTransfers(limit = 50): Promise<{ transfers: LegacyTransferRow[]; mode: 'legacy' | 'empty' }> {
    const { data, error } = await this.client
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
      if ((error as { code?: string }).code === '42P01') return { transfers: [], mode: 'empty' as const }
      throw this._toError(error, 'getLegacyTransfers')
    }

    const transfers = ((data ?? []) as Record<string, unknown>[]).map((row) => {
      const product = Array.isArray(row.product)
        ? (row.product[0] as LegacyTransferRow['product'])
        : (row.product as LegacyTransferRow['product'])
      const branch = Array.isArray(row.branch)
        ? (row.branch[0] as LegacyTransferRow['branch'])
        : (row.branch as LegacyTransferRow['branch'])
      return {
        id: row.id as string,
        product_id: row.product_id as string,
        branch_id: row.branch_id as string,
        type: row.type as string,
        quantity: row.quantity as number,
        reference_id: row.reference_id as string,
        notes: (row.notes as string) ?? null,
        created_at: row.created_at as string,
        product,
        branch,
      } as LegacyTransferRow
    })

    return { transfers, mode: 'legacy' as const }
  }

  /**
   * Get all branches (convenience for transfer workflows).
   * NOTE: This duplicates BranchRepository.getBranches intentionally until
   * callers are migrated to the Branches module.
   */
  async getAllBranches(): Promise<Array<{ id: string; name: string; code: string }>> {
    const { data, error } = await this.client
      .from('branches')
      .select('id, name, code')
      .order('name')

    if (error) throw this._toError(error, 'getAllBranches')
    return (data ?? []) as Array<{ id: string; name: string; code: string }>
  }

  /**
   * Get products at a branch with stock info (convenience for transfer workflows).
   * NOTE: This duplicates InventoryRepository until callers are migrated.
   */
  async getProductsAtBranch(branchId: string): Promise<ProductWithStock[]> {
    const { data, error } = await this.client
      .from('products')
      .select('*, stock:inventory(*)')
      .eq('branch_id' as never, branchId as never)
      .order('name')

    if (error) throw this._toError(error, 'getProductsAtBranch')
    return (data ?? []) as ProductWithStock[]
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

export const transferRepo = new TransferRepository()
