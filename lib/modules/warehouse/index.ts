/**
 * Warehouse Module — Public API
 *
 * Manages warehouses, locations, and stock movements.
 * Other modules should ONLY import from this file.
 *
 * Implementation: Delegates to lib/warehouse-actions.ts.
 */

import { logger } from '@/lib/logger'
import * as warehouseActions from '@/lib/warehouse-actions'

// Re-export types derived from the underlying actions so callers stay typed.
type WarehouseRow = Awaited<ReturnType<typeof warehouseActions.getWarehouses>>[number]
type WarehouseLocationRow = Awaited<ReturnType<typeof warehouseActions.getLocations>>[number]
type StockMovementRow = Awaited<ReturnType<typeof warehouseActions.getProductStockMovements>>[number]

// ─── Public API - Warehouses ────────────────────────────────────────────────

export async function getWarehouses(branchId?: string): Promise<WarehouseRow[]> {
  try {
    return await warehouseActions.getWarehouses(branchId)
  } catch (error) {
    logger.error('[Warehouse Module] getWarehouses failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function getWarehouseById(id: string): Promise<WarehouseRow | null> {
  try {
    return await warehouseActions.getWarehouseById(id)
  } catch (error) {
    logger.error('[Warehouse Module] getWarehouseById failed', error instanceof Error ? error.message : String(error))
    return null
  }
}

export async function createWarehouse(data: Record<string, unknown>): Promise<WarehouseRow | null> {
  try {
    return await warehouseActions.createWarehouse(data as Parameters<typeof warehouseActions.createWarehouse>[0])
  } catch (error) {
    logger.error('[Warehouse Module] createWarehouse failed', error instanceof Error ? error.message : String(error))
    return null
  }
}

export async function updateWarehouse(id: string, data: Record<string, unknown>): Promise<WarehouseRow | null> {
  try {
    return await warehouseActions.updateWarehouse(id, data as Parameters<typeof warehouseActions.updateWarehouse>[1])
  } catch (error) {
    logger.error('[Warehouse Module] updateWarehouse failed', error instanceof Error ? error.message : String(error))
    return null
  }
}

export async function deleteWarehouse(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    return await warehouseActions.deleteWarehouse(id)
  } catch (error) {
    logger.error('[Warehouse Module] deleteWarehouse failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Public API - Locations ─────────────────────────────────────────────────

export async function getLocations(warehouseId: string): Promise<WarehouseLocationRow[]> {
  try {
    return await warehouseActions.getLocations(warehouseId)
  } catch (error) {
    logger.error('[Warehouse Module] getLocations failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function getLocationById(id: string): Promise<WarehouseLocationRow | null> {
  try {
    return await warehouseActions.getLocationById(id)
  } catch (error) {
    logger.error('[Warehouse Module] getLocationById failed', error instanceof Error ? error.message : String(error))
    return null
  }
}

export async function createLocation(data: Record<string, unknown>): Promise<WarehouseLocationRow | null> {
  try {
    return await warehouseActions.createLocation(data as Parameters<typeof warehouseActions.createLocation>[0])
  } catch (error) {
    logger.error('[Warehouse Module] createLocation failed', error instanceof Error ? error.message : String(error))
    return null
  }
}

export async function updateLocation(id: string, data: Record<string, unknown>): Promise<WarehouseLocationRow | null> {
  try {
    return await warehouseActions.updateLocation(id, data as Parameters<typeof warehouseActions.updateLocation>[1])
  } catch (error) {
    logger.error('[Warehouse Module] updateLocation failed', error instanceof Error ? error.message : String(error))
    return null
  }
}

export async function deleteLocation(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    return await warehouseActions.deleteLocation(id)
  } catch (error) {
    logger.error('[Warehouse Module] deleteLocation failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Public API - Stock Movements ───────────────────────────────────────────

export async function getProductStockMovements(productId: string, branchId?: string): Promise<StockMovementRow[]> {
  try {
    return await warehouseActions.getProductStockMovements(productId, branchId)
  } catch (error) {
    logger.error('[Warehouse Module] getProductStockMovements failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function recordStockMovement(data: Record<string, unknown>): Promise<StockMovementRow | null> {
  try {
    return await warehouseActions.recordStockMovement(data as Parameters<typeof warehouseActions.recordStockMovement>[0])
  } catch (error) {
    logger.error('[Warehouse Module] recordStockMovement failed', error instanceof Error ? error.message : String(error))
    return null
  }
}
