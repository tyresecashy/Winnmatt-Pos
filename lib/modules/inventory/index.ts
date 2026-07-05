/**
 * Inventory Module — Public API
 *
 * Handles products, stock levels, transfers, and warehouse operations.
 * Other modules should ONLY import from this file.
 */

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

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Get product by ID.
 */
export async function getProduct(productId: string): Promise<Product | null> {
  throw new Error('Not implemented')
}

/**
 * Get products with filters.
 */
export async function getProducts(filters: {
  branch_id?: string
  category_id?: string
  search?: string
  status?: string
  limit?: number
  offset?: number
}): Promise<{ data: Product[]; total: number }> {
  throw new Error('Not implemented')
}

/**
 * Get inventory level for a product at a branch.
 */
export async function getInventoryLevel(
  productId: string,
  branchId: string
): Promise<InventoryLevel | null> {
  throw new Error('Not implemented')
}

/**
 * Adjust stock level.
 * Emits: stock.changed
 */
export async function adjustStock(
  productId: string,
  branchId: string,
  quantity: number,
  type: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  throw new Error('Not implemented')
}

/**
 * Get stock movements for a product.
 */
export async function getStockMovements(
  productId: string,
  branchId?: string,
  limit?: number
): Promise<StockMovement[]> {
  throw new Error('Not implemented')
}
