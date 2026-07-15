/**
 * Inventory Module — Public API
 *
 * Handles products, stock levels, transfers, and warehouse operations.
 * Other modules should ONLY import from this file.
 *
 * Implementation: Delegates to lib/products-actions.ts,
 * lib/inventory-analytics-actions.ts, lib/stock-count-actions.ts,
 * and lib/inventory-actions.ts.
 */

import { logger } from '@/lib/logger'
import * as products from '@/lib/products-actions'
import * as analytics from '@/lib/inventory-analytics-actions'
import * as stockCount from '@/lib/stock-count-actions'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Product {
  id: string
  sku: string
  name: string
  description: string | null
  category_id: string | null
  purchase_price: number
  selling_price: number
  wholesale_price: number | null
  unit: string
  barcode: string | null
  image_url: string | null
  is_active: boolean
  is_weighable: boolean
  tax_rate: number
  branch_id: string | null
  reorder_level: number
  brand: string | null
  status: string | null
  tags: string[] | null
  created_at: string
  updated_at: string
}

export interface InventoryLevel {
  id: string
  product_id: string
  branch_id: string
  quantity: number
  reserved_stock: number | null
  last_counted_at: string | null
  created_at: string
  updated_at: string
}

export interface StockMovement {
  id: string
  product_id: string
  branch_id: string
  type: string
  quantity: number
  reference_id: string | null
  notes: string | null
  created_at: string
}

export interface StockTransfer {
  id: string
  transfer_number: string | null
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
}

// ─── Events Emitted ─────────────────────────────────────────────────────────

export const INVENTORY_EVENTS = {
  PRODUCT_CREATED: 'product.created',
  PRODUCT_UPDATED: 'product.updated',
  PRICE_CHANGED: 'product.price_changed',
  STOCK_LOW: 'stock.low',
  STOCK_OUT: 'stock.out',
  STOCK_CHANGED: 'stock.changed',
  STOCK_RECEIVED: 'stock.received',
  STOCK_TRANSFERRED: 'stock.transferred',
  STOCK_COUNTED: 'stock.counted',
} as const

// ─── Backward-Compatible Re-exports (products-actions) ─────────────────────

export { getAllProducts } from '@/lib/products-actions'
export { getCategories } from '@/lib/products-actions'
export { createProduct } from '@/lib/products-actions'
export { updateProduct } from '@/lib/products-actions'
export { deleteProduct } from '@/lib/products-actions'
export { getProductsForPOS } from '@/lib/products-actions'
export { searchProducts } from '@/lib/products-actions'
export { getProductById } from '@/lib/products-actions'
export { getInventoryForBranch } from '@/lib/products-actions'
export { getInventoryForProduct } from '@/lib/products-actions'
export { updateInventory } from '@/lib/products-actions'
export { createStockMovement } from '@/lib/products-actions'
export { adjustStockQuantity } from '@/lib/products-actions'
// setReorderLevel and getProductDetails are not available from products-actions at this time

// ─── Backward-Compatible Re-exports (inventory-analytics-actions) ──────────

export { getInventoryAnalytics } from '@/lib/inventory-analytics-actions'
export { getReorderSuggestions } from '@/lib/inventory-analytics-actions'
export { getTopPerformers } from '@/lib/inventory-analytics-actions'
export { createPurchaseOrdersFromSuggestions } from '@/lib/inventory-analytics-actions'
export { dismissReorderSuggestion } from '@/lib/inventory-analytics-actions'
export type { AnalyticsProduct, ReorderSuggestion } from '@/lib/inventory-analytics-actions'

// ─── Backward-Compatible Re-exports (stock-count-actions) ──────────────────

export { createStockCount } from '@/lib/stock-count-actions'
export { getStockCounts } from '@/lib/stock-count-actions'
export { getStockCountWithItems } from '@/lib/stock-count-actions'
export { populateStockCount } from '@/lib/stock-count-actions'
export { updateStockCountItem } from '@/lib/stock-count-actions'
export { completeStockCount } from '@/lib/stock-count-actions'
export { approveStockCount } from '@/lib/stock-count-actions'
export { cancelStockCount } from '@/lib/stock-count-actions'
export type { StockCount, StockCountItem } from '@/lib/stock-count-actions'

// ─── Backward-Compatible Re-exports (inventory-actions) ────────────────────

export { getStockMovements } from '@/lib/inventory-actions'
export { adjustInventoryStock } from '@/lib/inventory-actions'

// ─── Public API ─────────────────────────────────────────────────────────────

export async function getProduct(productId: string): Promise<Product | null> {
  try {
    const result = await products.getProductById(productId)
    return result as unknown as Product | null
  } catch (error) {
    logger.error('[Inventory Module] getProduct failed', error instanceof Error ? error.message : String(error))
    return null
  }
}

export async function getProducts(filters: {
  branch_id?: string
  category_id?: string
  search?: string
  status?: string
  limit?: number
  offset?: number
}): Promise<{ data: Product[]; total: number }> {
  try {
    const all = await products.getAllProducts()
    const list = (all || []) as unknown as Product[]
    let filtered = [...list]
    if (filters.branch_id) {
      filtered = filtered.filter((p) => p.branch_id === filters.branch_id)
    }
    if (filters.category_id) {
      filtered = filtered.filter((p) => p.category_id === filters.category_id)
    }
    if (filters.search) {
      const q = filters.search.toLowerCase()
      filtered = filtered.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
    }
    if (filters.status) {
      filtered = filtered.filter((p) => p.status === filters.status)
    }
    const total = filtered.length
    if (filters.limit || filters.offset) {
      const start = filters.offset || 0
      const end = start + (filters.limit || 100)
      filtered = filtered.slice(start, end)
    }
    return { data: filtered, total }
  } catch (error) {
    logger.error('[Inventory Module] getProducts failed', error instanceof Error ? error.message : String(error))
    return { data: [], total: 0 }
  }
}

export async function getInventoryLevel(
  productId: string,
  branchId: string
): Promise<InventoryLevel | null> {
  try {
    const rows = await products.getInventoryForProduct(productId)
    const match = (rows as unknown as InventoryLevel[]).find(r => r.branch_id === branchId)
    return match ?? null
  } catch (error) {
    logger.error('[Inventory Module] getInventoryLevel failed', error instanceof Error ? error.message : String(error))
    return null
  }
}

export async function adjustStock(
  productId: string,
  branchId: string,
  quantity: number,
  type: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Look up inventory record first to get inventoryId
    const rows = await products.getInventoryForProduct(productId)
    const inventoryRows = rows as unknown as { id: string; branch_id: string; product_id: string }[]
    const match = inventoryRows.find(r => r.branch_id === branchId)
    const inventoryId = match?.id ?? ''
    return await products.adjustStockQuantity(inventoryId, productId, branchId, quantity, notes ?? type ?? 'adjustment')
  } catch (error) {
    logger.error('[Inventory Module] adjustStock failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Product Intelligence re-exports ─────────────────────────────────────────
// Note: searchProducts is NOT re-exported here because modules/inventory already
// exports searchProducts from lib/products-actions (different return shape).
export { getProductIntelligence, getProductActivity, getProductPriceHistory, getProductStockLocations, logProductActivity, updateProductPricing } from '@/lib/product-intelligence-actions'
export type { ProductSummary, ProductActivity, ProductPriceHistory, ProductStockAtLocation } from '@/lib/product-intelligence-actions'
