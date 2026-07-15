/**
 * Purchase Repository — Enterprise Core Data Access for Purchases
 *
 * Encapsulates direct Supabase access for purchase_orders and
 * purchase_order_items tables. Callers (module facade, server actions)
 * use this repository instead of calling supabase directly.
 *
 * Constitution Reference: §5 (Module Architecture), §9 (Transaction & Event Rules)
 */

import { BaseRepository } from '@/lib/modules/core/repository'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PurchaseOrderItemRow {
  id: string
  purchase_order_id: string
  product_id: string
  quantity: number
  unit_price: number
  line_total: number
  received_quantity: number
  product?: { id: string; sku: string; name: string } | null
  [key: string]: unknown
}

export interface PurchaseOrderRow {
  id: string
  supplier_id: string
  branch_id: string
  status: 'draft' | 'pending' | 'approved' | 'received' | 'cancelled'
  subtotal: number
  tax_amount: number
  total_amount: number
  expected_delivery: string
  notes: string | null
  created_at: string
  updated_at: string
  // joined relations (returned by Supabase when using select('*, supplier:...'))
  supplier?: { id: string; name: string; contact_person: string; phone: string } | null
  items?: PurchaseOrderItemRow[] | null
  [key: string]: unknown
}

// ─── Repository ─────────────────────────────────────────────────────────────

export class PurchaseRepository extends BaseRepository<PurchaseOrderRow> {
  constructor() {
    super('purchase_orders', {
      audit: { eventType: 'purchase.*', aggregateType: 'purchase_order' },
      lock: { resourcePrefix: 'purchase:' },
    })
  }

  /**
   * Get purchase orders for a branch with supplier and items joins,
   * ordered by created_at descending.
   */
  async getPurchaseOrders(branchId: string, limit: number = 50): Promise<PurchaseOrderRow[]> {
    const { data, error } = await this.client
      .from('purchase_orders')
      .select(`
        *,
        supplier:suppliers(id, name, contact_person, phone),
        items:purchase_order_items(
          id,
          product_id,
          quantity,
          unit_price,
          line_total,
          received_quantity,
          product:products(id, sku, name)
        )
      `)
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw this._toError(error, 'getPurchaseOrders')
    return (data ?? []) as PurchaseOrderRow[]
  }

  /**
   * Get a single purchase order by ID with supplier and items joins.
   */
  async getPurchaseOrderById(poId: string): Promise<PurchaseOrderRow | null> {
    const { data, error } = await this.client
      .from('purchase_orders')
      .select(`
        *,
        supplier:suppliers(id, name, contact_person, phone),
        items:purchase_order_items(
          id,
          product_id,
          quantity,
          unit_price,
          line_total,
          received_quantity,
          product:products(id, sku, name)
        )
      `)
      .eq('id', poId)
      .single()

    if (error) {
      // single() returns PGRST116 when no rows match — treat as null
      const errObj = error as { code?: string }
      if (errObj.code === 'PGRST116') return null
      throw this._toError(error, 'getPurchaseOrderById')
    }
    return (data ?? null) as PurchaseOrderRow | null
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

export const purchaseRepo = new PurchaseRepository()
