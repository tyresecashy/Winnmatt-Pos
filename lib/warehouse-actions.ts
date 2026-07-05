'use server'
import { logger } from '@/lib/logger';

import {
  authenticateServerAction,
  authorizeInventoryControlProfile,
} from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'
import type { Database } from '@/lib/db.types'

type WarehouseRow = Database['public']['Tables']['warehouses']['Row']
type StockMovementRow = Database['public']['Tables']['stock_movements']['Row']

export async function getWarehouses(branchId?: string): Promise<WarehouseRow[]> {
  try {
    const authResult = await authenticateServerAction()
    if (!authResult.success || !authResult.profile) {
      logger.warn('[WAREHOUSE] Fetch denied:', { error: authResult.error })
      return []
    }

    let query = supabaseAdmin
      .from('warehouses')
      .select('*')
      .order('name')

    if (branchId) {
      query = query.eq('branch_id', branchId)
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  } catch (error) {
    logger.error('Error fetching warehouses:', error)
    return []
  }
}

export async function getWarehouseById(id: string): Promise<WarehouseRow | null> {
  try {
    const authResult = await authenticateServerAction()
    if (!authResult.success || !authResult.profile) {
      logger.warn('[WAREHOUSE] Fetch by ID denied:', { error: authResult.error })
      return null
    }

    const { data, error } = await supabaseAdmin
      .from('warehouses')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  } catch (error) {
    logger.error('Error fetching warehouse:', error)
    return null
  }
}

export async function createWarehouse(data: {
  name: string
  code: string
  branch_id?: string | null
  location?: string | null
  type: 'central' | 'branch' | 'regional'
}): Promise<WarehouseRow | null> {
  try {
    const authResult = await authenticateServerAction()
    if (!authResult.success || !authResult.profile) {
      logger.warn('[WAREHOUSE] Create denied:', { error: authResult.error })
      return null
    }

    const inventoryAccess = authorizeInventoryControlProfile(authResult.profile)
    if (!inventoryAccess.authorized) {
      logger.warn('[WAREHOUSE] Create access denied:', { error: inventoryAccess.error })
      return null
    }

    const { data: warehouse, error } = await supabaseAdmin
      .from('warehouses')
      .insert({
        name: data.name,
        code: data.code,
        branch_id: data.branch_id ?? null,
        location: data.location ?? null,
        type: data.type,
        status: 'active',
      })
      .select()
      .single()

    if (error) throw error
    return warehouse
  } catch (error) {
    logger.error('Error creating warehouse:', error)
    return null
  }
}

export async function updateWarehouse(id: string, data: Partial<WarehouseRow>): Promise<WarehouseRow | null> {
  try {
    const authResult = await authenticateServerAction()
    if (!authResult.success || !authResult.profile) {
      logger.warn('[WAREHOUSE] Update denied:', { error: authResult.error })
      return null
    }

    const inventoryAccess = authorizeInventoryControlProfile(authResult.profile)
    if (!inventoryAccess.authorized) {
      logger.warn('[WAREHOUSE] Update access denied:', { error: inventoryAccess.error })
      return null
    }

    const { data: warehouse, error } = await supabaseAdmin
      .from('warehouses')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return warehouse
  } catch (error) {
    logger.error('Error updating warehouse:', error)
    return null
  }
}

export async function deleteWarehouse(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const authResult = await authenticateServerAction()
    if (!authResult.success || !authResult.profile) {
      return { success: false, error: authResult.error || 'Unauthorized' }
    }

    const inventoryAccess = authorizeInventoryControlProfile(authResult.profile)
    if (!inventoryAccess.authorized) {
      return { success: false, error: inventoryAccess.error || 'Access denied' }
    }

    const { error } = await supabaseAdmin
      .from('warehouses')
      .update({ status: 'inactive', updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error
    return { success: true }
  } catch (error) {
    logger.error('Error deactivating warehouse:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to deactivate warehouse' }
  }
}

export async function getProductStockMovements(productId: string, warehouseId?: string): Promise<StockMovementRow[]> {
  try {
    const authResult = await authenticateServerAction()
    if (!authResult.success || !authResult.profile) {
      logger.warn('[WAREHOUSE] Stock movement fetch denied:', { error: authResult.error })
      return []
    }

    let query = supabaseAdmin
      .from('stock_movements')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })

    if (warehouseId) {
      query = query.or(`from_warehouse_id.eq.${warehouseId},to_warehouse_id.eq.${warehouseId}`)
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  } catch (error) {
    logger.error('Error fetching product stock movements:', error)
    return []
  }
}

export async function recordStockMovement(data: {
  product_id: string
  from_warehouse_id?: string | null
  to_warehouse_id?: string | null
  quantity: number
  type: 'transfer' | 'adjustment' | 'receive' | 'issue'
  reference_type?: string | null
  reference_id?: string | null
  notes?: string | null
  created_by: string
}): Promise<StockMovementRow | null> {
  try {
    const authResult = await authenticateServerAction()
    if (!authResult.success || !authResult.profile) {
      logger.warn('[WAREHOUSE] Record movement denied:', { error: authResult.error })
      return null
    }

    const inventoryAccess = authorizeInventoryControlProfile(authResult.profile)
    if (!inventoryAccess.authorized) {
      logger.warn('[WAREHOUSE] Record movement access denied:', { error: inventoryAccess.error })
      return null
    }

    const { data: movement, error } = await supabaseAdmin
      .from('stock_movements')
      .insert({
        product_id: data.product_id,
        from_warehouse_id: data.from_warehouse_id ?? null,
        to_warehouse_id: data.to_warehouse_id ?? null,
        quantity: data.quantity,
        type: data.type,
        reference_type: data.reference_type ?? null,
        reference_id: data.reference_id ?? null,
        notes: data.notes ?? null,
        created_by: data.created_by,
      })
      .select()
      .single()

    if (error) throw error
    return movement
  } catch (error) {
    logger.error('Error recording stock movement:', error)
    return null
  }
}
