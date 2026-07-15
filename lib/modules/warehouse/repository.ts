/**
 * Warehouse Repository — Enterprise Core Data Access for Warehouses
 *
 * Encapsulates direct Supabase access for the warehouses, warehouse_locations,
 * and stock_movements tables. Callers (module facade, server actions) use this
 * repository instead of calling supabase directly.
 *
 * Constitution Reference: §5 (Module Architecture), §9 (Transaction & Event Rules)
 */

import { BaseRepository } from '@/lib/modules/core/repository'
import type { Database } from '@/lib/supabase-server'

// ─── Types (mirrors Database row types for backward compatibility) ──────────

export type WarehouseRow = Database['public']['Tables']['warehouses']['Row']
export type WarehouseLocationRow = Database['public']['Tables']['warehouse_locations']['Row']
export type StockMovementRow = Database['public']['Tables']['stock_movements']['Row']

// ─── Repository ─────────────────────────────────────────────────────────────

export class WarehouseRepository extends BaseRepository<WarehouseRow> {
  constructor() {
    super('warehouses', {
      audit: { eventType: 'warehouse.*', aggregateType: 'warehouse' },
      lock: { resourcePrefix: 'warehouse:' },
    })
  }

  /**
   * Get all warehouses, optionally filtered by branch, ordered by name.
   */
  async getWarehouses(branchId?: string): Promise<WarehouseRow[]> {
    let q = this.client.from('warehouses').select('*').order('name')
    if (branchId) q = q.eq('branch_id', branchId)

    const { data, error } = await q
    if (error) throw this._toError(error, 'getWarehouses')
    return (data ?? []) as WarehouseRow[]
  }

  /**
   * Get a single warehouse by ID.
   */
  async getWarehouseById(id: string): Promise<WarehouseRow | null> {
    const { data, error } = await this.client
      .from('warehouses')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      const errObj = error as { code?: string }
      if (errObj.code === 'PGRST116') return null
      throw this._toError(error, 'getWarehouseById')
    }
    return (data ?? null) as WarehouseRow | null
  }

  /**
   * Get all locations in a warehouse, ordered by zone → aisle → row.
   */
  async getLocations(warehouseId: string): Promise<WarehouseLocationRow[]> {
    const { data, error } = await this.client
      .from('warehouse_locations')
      .select('*')
      .eq('warehouse_id', warehouseId)
      .order('zone')
      .order('aisle')
      .order('row')

    if (error) throw this._toError(error, 'getLocations')
    return (data ?? []) as WarehouseLocationRow[]
  }

  /**
   * Get a single location by ID.
   */
  async getLocationById(id: string): Promise<WarehouseLocationRow | null> {
    const { data, error } = await this.client
      .from('warehouse_locations')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      const errObj = error as { code?: string }
      if (errObj.code === 'PGRST116') return null
      throw this._toError(error, 'getLocationById')
    }
    return (data ?? null) as WarehouseLocationRow | null
  }

  /**
   * Get stock movements for a product, optionally filtered by warehouse.
   */
  async getProductStockMovements(productId: string, warehouseId?: string): Promise<StockMovementRow[]> {
    let q = this.client
      .from('stock_movements')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })

    if (warehouseId) {
      q = q.or(`from_warehouse_id.eq.${warehouseId},to_warehouse_id.eq.${warehouseId}`)
    }

    const { data, error } = await q
    if (error) throw this._toError(error, 'getProductStockMovements')
    return (data ?? []) as StockMovementRow[]
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

export const warehouseRepo = new WarehouseRepository()
