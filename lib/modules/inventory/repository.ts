/**
 * Inventory Repository — Enterprise Core Data Access for Inventory
 *
 * Encapsulates ALL direct Supabase access for products, inventory,
 * stock movements, and categories tables. Callers (module facade,
 * server actions) use this repository instead of calling supabase directly.
 *
 * Constitution Reference: §5 (Module Architecture), §9 (Transaction & Event Rules)
 */

import { BaseRepository } from '@/lib/modules/core/repository'
import type { PaginatedResult } from '@/lib/modules/core/repository'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ProductRow {
  id: string
  sku: string
  name: string
  description: string | null
  brand: string | null
  category_id: string | null
  purchase_price: number
  selling_price: number
  wholesale_price: number | null
  unit: string
  barcode: string | null
  image_url: string | null
  status: string | null
  reorder_level: number
  tags: string[] | null
  is_active: boolean
  is_weighable: boolean
  tax_rate: number
  branch_id: string | null
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface InventoryRow {
  id: string
  product_id: string
  branch_id: string
  quantity: number
  reserved_stock: number | null
  last_counted_at: string | null
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface StockMovementRow {
  id: string
  product_id: string
  branch_id: string
  type: string
  quantity: number
  reference_id: string | null
  reference_type: string | null
  notes: string | null
  reason_category: string | null
  created_by: string | null
  approved_by: string | null
  approved_at: string | null
  created_at: string
  [key: string]: unknown
}

export interface CategoryRow {
  id: string
  name: string
  description: string | null
  icon: string | null
  created_at: string
  [key: string]: unknown
}

export interface ProductWithInventory {
  id: string
  sku: string
  name: string
  description: string | null
  brand: string | null
  category_id: string | null
  purchase_price: number
  selling_price: number
  wholesale_price: number | null
  unit: string
  barcode: string | null
  image_url: string | null
  status: string | null
  tags: string[] | null
  category?: { id: string; name: string } | null
  inventory?: {
    id: string
    quantity: number
    reserved_stock: number | null
    branch_id: string
  } | null
  [key: string]: unknown
}

export interface InventoryWithProduct {
  id: string
  product_id: string
  branch_id: string
  quantity: number
  reserved_stock: number | null
  product?: Partial<ProductRow> | null
  [key: string]: unknown
}

export interface CreateProductParams {
  sku: string
  name: string
  description?: string | null
  brand?: string | null
  category_id?: string | null
  purchase_price?: number
  selling_price?: number
  wholesale_price?: number | null
  unit?: string
  barcode?: string | null
  image_url?: string | null
  status?: string
  reorder_level?: number
  branch_id?: string | null
  is_weighable?: boolean
  tax_rate?: number
}

export interface CreateStockMovementParams {
  productId: string
  branchId: string
  type: string
  quantity: number
  referenceId?: string | null
  referenceType?: string | null
  notes?: string | null
  reasonCategory?: string | null
  createdBy?: string | null
}

// ─── Repository ─────────────────────────────────────────────────────────────

export class InventoryRepository extends BaseRepository<ProductRow> {
  constructor() {
    super('products', {
      audit: { eventType: 'product.*', aggregateType: 'product' },
      lock: { resourcePrefix: 'product:' },
    })
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Products
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Find a product by SKU.
   */
  async findBySku(sku: string): Promise<ProductRow | null> {
    return this.findOne('sku', sku) as Promise<ProductRow | null>
  }

  /**
   * Search products by name or SKU (ILIKE).
   */
  async searchProducts(
    query: string,
    limit = 20,
  ): Promise<ProductRow[]> {
    const { data, error } = await this.client
      .from('products')
      .select('*')
      .or(`name.ilike.%${query}%,sku.ilike.%${query}%`)
      .order('name', { ascending: true })
      .limit(limit)

    if (error) throw this._toError(error, 'searchProducts')
    return (data ?? []) as ProductRow[]
  }

  /**
   * Get all products with category name.
   */
  async getAllProducts(): Promise<ProductRow[]> {
    const { data, error } = await this.client
      .from('products')
      .select('*, category:categories(name)')
      .order('name', { ascending: true })

    if (error) throw this._toError(error, 'getAllProducts')
    return (data ?? []) as unknown as ProductRow[]
  }

  /**
   * Get products for POS display — includes category name and
   * inventory quantity for a specific branch.
   */
  async getProductsForPOS(
    branchId: string,
  ): Promise<ProductWithInventory[]> {
    const { data, error } = await this.client
      .from('products')
      .select(`
        *,
        category:categories(name),
        inventory!inner(branch_id, quantity, reserved_stock, id)
      `)
      .eq('inventory.branch_id', branchId)
      .order('name', { ascending: true })

    if (error) throw this._toError(error, 'getProductsForPOS')
    return (data ?? []) as unknown as ProductWithInventory[]
  }

  /**
   * Create a product and its initial inventory record.
   * Returns the created product with category join.
   */
  async createProduct(
    params: CreateProductParams,
  ): Promise<ProductRow> {
    const product = await this.insert({
      sku: params.sku,
      name: params.name,
      description: params.description ?? null,
      brand: params.brand ?? null,
      category_id: params.category_id ?? null,
      purchase_price: params.purchase_price ?? 0,
      selling_price: params.selling_price ?? 0,
      wholesale_price: params.wholesale_price ?? null,
      unit: params.unit ?? 'pcs',
      barcode: params.barcode ?? null,
      image_url: params.image_url ?? null,
      status: params.status ?? 'active',
      reorder_level: params.reorder_level ?? 10,
      is_weighable: params.is_weighable ?? false,
      tax_rate: params.tax_rate ?? 0,
      branch_id: params.branch_id ?? null,
    } as Partial<ProductRow>)

    // Create initial inventory record for the assigned branch
    if (params.branch_id) {
      await this._ensureInventoryRecord(product.id, params.branch_id, 0)
    }

    return product
  }

  /**
   * Delete a product — checks for existing sale_items first,
   * then removes inventory records and the product itself.
   */
  async deleteProduct(
    productId: string,
  ): Promise<{ success: boolean; error?: string }> {
    // Guard: check if product has been sold
    const { data: saleCheck, error: saleCheckError } = await this.client
      .from('sale_items')
      .select('id')
      .eq('product_id', productId)
      .limit(1)

    if (saleCheckError) {
      return { success: false, error: saleCheckError.message }
    }

    if ((saleCheck ?? []).length > 0) {
      return { success: false, error: 'Cannot delete product with existing sales' }
    }

    // Delete inventory records
    const { error: invDeleteError } = await this.client
      .from('inventory')
      .delete()
      .eq('product_id', productId)

    if (invDeleteError) {
      return { success: false, error: invDeleteError.message }
    }

    // Delete product
    try {
      await this.delete(productId)
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to delete product',
      }
    }

    return { success: true }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Inventory (stock levels)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get inventory record for a specific product and branch.
   */
  async getByProductAndBranch(
    productId: string,
    branchId: string,
  ): Promise<InventoryRow | null> {
    const { data, error } = await this.client
      .from('inventory')
      .select('*')
      .eq('product_id', productId)
      .eq('branch_id', branchId)
      .maybeSingle()

    if (error) throw this._toError(error, 'getByProductAndBranch')
    return (data ?? null) as InventoryRow | null
  }

  /**
   * Get all inventory for a branch with product details.
   * Uses fallback queries if complex join fails (backward-compatible).
   */
  async getForBranch(
    branchId: string,
  ): Promise<InventoryWithProduct[]> {
    // Attempt 1: Full join
    const { data, error } = await this.client
      .from('inventory')
      .select(`
        *,
        product:products(
          id, sku, name, description, category_id, brand,
          selling_price, purchase_price, wholesale_price,
          unit, barcode, image_url, status, reorder_level, tags,
          category:categories(name)
        )
      `)
      .eq('branch_id', branchId)
      .order('product_id', { ascending: true })

    if (!error && data) {
      return data as unknown as InventoryWithProduct[]
    }

    // Attempt 2: Without category join
    const { data: data2, error: error2 } = await this.client
      .from('inventory')
      .select(`
        *,
        product:products(
          id, sku, name, description, category_id, brand,
          selling_price, purchase_price, wholesale_price,
          unit, barcode, image_url, status, reorder_level, tags
        )
      `)
      .eq('branch_id', branchId)
      .order('product_id', { ascending: true })

    if (!error2 && data2) {
      return data2 as unknown as InventoryWithProduct[]
    }

    // Fallback: Get inventory rows, then fetch products separately
    const { data: invRows, error: invError } = await this.client
      .from('inventory')
      .select('*')
      .eq('branch_id', branchId)
      .order('product_id', { ascending: true })

    if (invError) throw this._toError(invError, 'getForBranch')
    const inventory = (invRows ?? []) as InventoryRow[]

    // Batch fetch products
    const productIds = [...new Set(inventory.map((r) => r.product_id))]
    const { data: productRows } = await this.client
      .from('products')
      .select('*')
      .in('id', productIds)

    const productMap = new Map(
      (productRows ?? []).map((p: Record<string, unknown>) => [p.id, p]),
    )

    return inventory.map((inv) => ({
      ...inv,
      product: productMap.get(inv.product_id) ?? null,
    })) as unknown as InventoryWithProduct[]
  }

  /**
   * Get all inventory rows for a product (across branches).
   * Includes branch name.
   */
  async getForProduct(
    productId: string,
  ): Promise<InventoryRow[]> {
    const { data, error } = await this.client
      .from('inventory')
      .select('*, branch:branches!branch_id(name, code)')
      .eq('product_id', productId)

    if (error) throw this._toError(error, 'getForProduct')
    return (data ?? []) as unknown as InventoryRow[]
  }

  /**
   * Update inventory quantity for a product+brach.
   * Returns the updated inventory row.
   */
  async updateQuantity(
    productId: string,
    branchId: string,
    quantity: number,
  ): Promise<InventoryRow | null> {
    const { data, error } = await this.client
      .from('inventory')
      .update({ quantity, updated_at: new Date().toISOString() })
      .eq('product_id', productId)
      .eq('branch_id', branchId)
      .select()
      .single()

    if (error) throw this._toError(error, 'updateQuantity')
    return (data ?? null) as InventoryRow | null
  }

  /**
   * Adjust stock: updates inventory and creates a stock movement record.
   * This is an idempotent stock adjustment (not a full inventory update).
   */
  async adjustStock(
    inventoryId: string,
    productId: string,
    branchId: string,
    quantity: number,
    notes: string,
    createdBy?: string,
  ): Promise<{ success: boolean; error?: string }> {
    // 1. Fetch current quantity
    const { data: current, error: fetchError } = await this.client
      .from('inventory')
      .select('quantity')
      .eq('id', inventoryId)
      .eq('product_id', productId)
      .eq('branch_id', branchId)
      .single()

    if (fetchError) {
      return { success: false, error: fetchError.message }
    }

    const newQuantity = Math.max(0, (current?.quantity ?? 0) + quantity)

    // 2. Update inventory
    const { error: updateError } = await this.client
      .from('inventory')
      .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
      .eq('id', inventoryId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    // 3. Record stock movement
    const { error: movementError } = await this.client
      .from('stock_movements')
      .insert({
        product_id: productId,
        branch_id: branchId,
        type: 'adjustment',
        quantity,
        notes,
        created_by: createdBy ?? null,
      })

    if (movementError) {
      return { success: false, error: movementError.message }
    }

    return { success: true }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Stock Movements
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get stock movements for a product+branch combo.
   */
  async getMovements(
    productId: string,
    branchId: string,
    limit = 50,
  ): Promise<StockMovementRow[]> {
    const { data, error } = await this.client
      .from('stock_movements')
      .select('id, type, quantity, reference_id, reference_type, notes, created_at')
      .eq('product_id', productId)
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw this._toError(error, 'getMovements')
    return (data ?? []) as StockMovementRow[]
  }

  /**
   * Create a stock movement record.
   */
  async createMovement(
    params: CreateStockMovementParams,
  ): Promise<StockMovementRow> {
    const { data, error } = await this.client
      .from('stock_movements')
      .insert({
        product_id: params.productId,
        branch_id: params.branchId,
        type: params.type,
        quantity: params.quantity,
        reference_id: params.referenceId ?? null,
        reference_type: params.referenceType ?? null,
        notes: params.notes ?? null,
        reason_category: params.reasonCategory ?? null,
        created_by: params.createdBy ?? null,
      })
      .select()
      .single()

    if (error) throw this._toError(error, 'createMovement')
    return data as unknown as StockMovementRow
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Categories
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get all product categories.
   */
  async getCategories(): Promise<CategoryRow[]> {
    const { data, error } = await this.client
      .from('categories')
      .select('*')
      .order('name', { ascending: true })

    if (error) throw this._toError(error, 'getCategories')
    return (data ?? []) as CategoryRow[]
  }

  /**
   * Get paginated products with filtering.
   */
  async getProductsPaginated(
    filters?: {
      branch_id?: string
      category_id?: string
      search?: string
      status?: string
      page?: number
      pageSize?: number
    },
  ): Promise<PaginatedResult<ProductRow>> {
    const page = filters?.page ?? 1
    const pageSize = filters?.pageSize ?? 50
    const offset = (page - 1) * pageSize

    let query = this.client
      .from('products')
      .select('*', { count: 'exact', head: false })

    if (filters?.branch_id) query = query.eq('branch_id', filters.branch_id)
    if (filters?.category_id) query = query.eq('category_id', filters.category_id)
    if (filters?.status) query = query.eq('status', filters.status)
    if (filters?.search) {
      query = query.or(`name.ilike.%${filters.search}%,sku.ilike.%${filters.search}%`)
    }

    query = query.order('name', { ascending: true })

    const { data, error, count } = await query.range(offset, offset + pageSize - 1)

    if (error) throw this._toError(error, 'getProductsPaginated')
    return {
      data: (data ?? []) as ProductRow[],
      total: count ?? 0,
      page,
      pageSize,
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Private helpers
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Ensure an inventory record exists for a product+branch combo.
   */
  private async _ensureInventoryRecord(
    productId: string,
    branchId: string,
    initialQuantity = 0,
  ): Promise<void> {
    const existing = await this.getByProductAndBranch(productId, branchId)
    if (existing) return

    const { error } = await this.client
      .from('inventory')
      .insert({
        product_id: productId,
        branch_id: branchId,
        quantity: initialQuantity,
      })

    if (error) {
      console.error('[InventoryRepo] Failed to create inventory record:', error.message)
    }
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

/** Shared inventory repository instance. */
export const inventoryRepo = new InventoryRepository()
