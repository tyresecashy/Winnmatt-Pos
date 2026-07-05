'use server'
import { logger } from '@/lib/logger';

import {
  authenticateServerAction,
  authorizeInventoryControlProfile,
  authorizePOSProfile,
  resolveAuthorizedBranchId,
} from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'
import { emitEvent } from '@/lib/automation/events'

/** Minimal product row shape for inventory/display. */
interface ProductRow {
  id: string
  sku: string
  name: string
  selling_price?: number
  purchase_price?: number
  reorder_level?: number
  category_id?: string
  category?: { id: string; name: string; icon?: string } | null
  inventory?: Array<{ quantity: number }>
  quantity?: number
}

/** Minimal inventory row shape. */
interface InventoryRow {
  id: string
  product_id: string
  branch_id: string
  quantity: number
  min_stock?: number
  max_stock?: number
  reorder_point?: number
  created_at?: string
  updated_at?: string
  product?: ProductRow | null
}

export async function getCategories() {
  try {
    const { data, error } = await supabaseAdmin
      .from('categories')
      .select('*')
      .order('name')

    if (error) throw error
    return data || []
  } catch (error) {
    logger.error('Error fetching categories:', error)
    return []
  }
}

export async function getProductsForPOS(branchId: string) {
  try {
    const authResult = await authenticateServerAction()
    if (!authResult.success || !authResult.profile) {
      logger.warn('[POS] Product fetch denied:', { error: authResult.error })
      return []
    }

    const profile = authResult.profile
    let effectiveBranchId =
      profile.role === 'super_admin' || profile.role === 'admin' ? branchId || profile.branch_id : profile.branch_id

    // For admin users without a branch, find the first available branch
    if (!effectiveBranchId && (profile.role === 'super_admin' || profile.role === 'admin')) {
      const { data: firstBranch } = await supabaseAdmin
        .from('branches')
        .select('id')
        .eq('status', 'active')
        .limit(1)
        .single()
      effectiveBranchId = firstBranch?.id || null
    }

    if (!effectiveBranchId) {
      logger.warn('[POS] No branch available')
      return []
    }

    if (profile.role !== 'super_admin' && branchId && branchId !== profile.branch_id) {
      logger.warn('[POS] Ignoring mismatched branch id for product fetch', {
        userId: profile.id,
        requestedBranchId: branchId,
        authenticatedBranchId: profile.branch_id,
      })
    }

    const { data, error } = await supabaseAdmin
      .from('products')
      .select(`
        id,
        sku,
        name,
        selling_price,
        purchase_price,
        reorder_level,
        category_id,
        category:categories(id, name, icon),
        inventory!inner(branch_id, quantity)
      `)
      .eq('inventory.branch_id', effectiveBranchId)
      .order('name')

    if (error) throw error
    
    // Transform the data to normalize category
    return (data || []).map((product) => {
      const category = Array.isArray(product.category)
        ? product.category[0] ?? null
        : (product.category ?? null)
      return {
        ...product,
        quantity: Array.isArray(product.inventory) ? (product.inventory[0]?.quantity || 0) : ((product.inventory as any)?.quantity || 0),
        category,
      }
    })
  } catch (error) {
    logger.error('Error fetching products for POS:', error)
    return []
  }
}

export async function getProductById(productId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('products')
      .select(`
        *,
        category:categories(id, name, icon)
      `)
      .eq('id', productId)
      .single()

    if (error) throw error
    return data
  } catch (error) {
    logger.error('Error fetching product:', error)
    return null
  }
}

export async function getInventoryForBranch(branchId: string) {
  try {
    const authResult = await authenticateServerAction()
    if (!authResult.success || !authResult.profile) {
      logger.warn('[INVENTORY] Inventory fetch denied:', { error: authResult.error })
      return []
    }

    const posAccess = authorizePOSProfile(authResult.profile)
    if (!posAccess.authorized) {
      logger.warn('[INVENTORY] Inventory fetch POS access denied:', { error: posAccess.error })
      return []
    }

    const branchScope = resolveAuthorizedBranchId(authResult.profile, branchId)
    if (!branchScope.authorized || !branchScope.branchId) {
      logger.warn('[INVENTORY] Inventory fetch branch denied:', { error: branchScope.error })
      return []
    }

    const effectiveBranchId = branchScope.branchId

    const { data, error } = await supabaseAdmin
      .from('inventory')
      .select(`
        id,
        quantity,
        branch_id,
        product_id,
        created_at,
        updated_at,
        product:products(
          id, 
          sku, 
          name, 
          selling_price, 
          purchase_price, 
          reorder_level, 
          category_id,
          category:categories(id, name, icon)
        )
      `)
      .eq('branch_id', effectiveBranchId)
      .order('product(name)')

    if (error) {
      logger.warn('[INVENTORY] Attempt 1 failed:', { error: error.message })
      
      // APPROACH 2: Fallback - fetch without category relation
      const { data: data2, error: error2 } = await supabaseAdmin
        .from('inventory')
        .select(`
          id,
          quantity,
          branch_id,
          product_id,
          created_at,
          updated_at,
          product:products(
            id, 
            sku, 
            name, 
            selling_price, 
            purchase_price, 
            reorder_level, 
            category_id
          )
        `)
        .eq('branch_id', effectiveBranchId)

      if (error2) {
        logger.error('[INVENTORY] Attempt 2 also failed:', error2.message)
        
        // APPROACH 3: Last resort - fetch raw inventory, then products separately
        const { data: inventoryRows, error: error3 } = await supabaseAdmin
          .from('inventory')
          .select('*')
          .eq('branch_id', effectiveBranchId)
          .order('product_id')

        if (error3) {
          logger.error('[INVENTORY] Attempt 3 failed:', error3.message)
          logger.error('[INVENTORY] Error details:', { code: error3.code, message: error3.message, details: error3.details })
          return []
        }

        if (!inventoryRows || inventoryRows.length === 0) {
          return []
        }

        // Fetch all products referenced by these inventory rows
        const productIds = inventoryRows.map(row => row.product_id)
        const { data: products, error: productError } = await supabaseAdmin
          .from('products')
          .select('id, sku, name, selling_price, purchase_price, reorder_level, category_id, category:categories(id, name, icon)')
          .in('id', productIds)

        if (productError) {
          logger.error('[INVENTORY] Failed to fetch products:', productError.message)
          // Return inventory without product details as fallback
          return (inventoryRows as InventoryRow[]).map(row => ({ ...row, product: null }))
        }

        // Merge products back into inventory rows
        const productMap = Object.fromEntries(
          (products || []).map((p) => [p.id, p as unknown as ProductRow])
        )

        const result = inventoryRows.map((invRow: InventoryRow) => ({
          ...invRow,
          product: productMap[invRow.product_id] || null,
        }))

        return result
      }

      return data2 || []
    }

    return data || []
  } catch (error) {
    logger.error('[INVENTORY] Unexpected error:', error)
    return []
  }
}

export async function getInventoryForProduct(productId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('inventory')
      .select(`
        *,
        branch:branches!branch_id(id, name, code)
      `)
      .eq('product_id', productId)

    if (error) throw error
    return data || []
  } catch (error) {
    logger.error('Error fetching inventory for product:', error)
    return []
  }
}

export async function updateInventory(productId: string, branchId: string, quantity: number) {
  try {
    const { data, error } = await supabaseAdmin
      .from('inventory')
      .update({ quantity })
      .eq('product_id', productId)
      .eq('branch_id', branchId)
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    logger.error('Error updating inventory:', error)
    return null
  }
}

export async function createStockMovement(
  productId: string,
  branchId: string,
  type: 'sale' | 'receipt' | 'transfer' | 'adjustment' | 'damage',
  quantity: number,
  referenceId?: string,
  notes?: string
) {
  try {
    const { data, error } = await supabaseAdmin
      .from('stock_movements')
      .insert({
        product_id: productId,
        branch_id: branchId,
        type,
        quantity,
        reference_id: referenceId,
        notes,
      })
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    logger.error('Error creating stock movement:', error)
    return null
  }
}

/**
 * Get all products with category info (for product management page)
 */
export async function getAllProducts() {
  try {
    const { data, error } = await supabaseAdmin
      .from('products')
      .select(`
        id,
        sku,
        name,
        description,
        selling_price,
        purchase_price,
        reorder_level,
        category_id,
        created_at,
        updated_at,
        category:categories(id, name, icon)
      `)
      .order('name')

    if (error) throw error
    
    return data || []
  } catch (error) {
    logger.error('Error fetching all products:', error)
    return []
  }
}

/**
 * Create a new product with inventory row for the specified branch
 * This ensures the product appears in POS for that branch immediately
 */
export async function createProduct(
  sku: string,
  name: string,
  description: string,
  categoryId: string,
  purchasePrice: number,
  sellingPrice: number,
  reorderLevel: number,
  branchId: string,
  initialStock: number = 0
) {
  try {
    // Step 1: Create the product
    const { data: productData, error: productError } = await supabaseAdmin
      .from('products')
      .insert({
        sku,
        name,
        description,
        category_id: categoryId,
        purchase_price: purchasePrice,
        selling_price: sellingPrice,
        reorder_level: reorderLevel,
      })
      .select(`
        id,
        sku,
        name,
        description,
        selling_price,
        purchase_price,
        reorder_level,
        category_id,
        created_at,
        updated_at,
        category:categories(id, name, icon)
      `)
      .single()

    if (productError) {
      logger.error('[Phase1] Error creating product in DB:', { sku, name, categoryId, error: productError })
      throw new Error(`Database error creating product: ${productError.message} (sku=${sku})`)
    }

    // Step 2: Validate branchId is not empty
    if (!branchId || branchId.trim() === '') {
      logger.error('[Phase1] Error: branchId is required for inventory creation')
      return { success: false, error: 'Branch ID is required to create product inventory' }
    }

    // Step 3: Create inventory row for this branch with the initial stock quantity
    const { error: inventoryError } = await supabaseAdmin
      .from('inventory')
      .insert({
        product_id: productData.id,
        branch_id: branchId,
        quantity: initialStock,
      })

    if (inventoryError) {
      logger.error('Error creating inventory row:', inventoryError)
      return { success: false, error: 'Product created but inventory row could not be created' }
    }

    // Emit product.created event
    await emitEvent('product.created', {
      product_id: productData.id,
      name: productData.name,
      sku: productData.sku,
      branch_id: branchId,
    }, { source: 'inventory', entity_type: 'product', entity_id: productData.id })

    return { success: true, data: productData }
  } catch (error) {
    logger.error('Error creating product:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create product' }
  }
}

/**
 * Update an existing product
 */
export async function updateProduct(
  productId: string,
  sku: string,
  name: string,
  description: string,
  categoryId: string,
  purchasePrice: number,
  sellingPrice: number,
  reorderLevel: number
) {
  try {
    const { data, error } = await supabaseAdmin
      .from('products')
      .update({
        sku,
        name,
        description,
        category_id: categoryId,
        purchase_price: purchasePrice,
        selling_price: sellingPrice,
        reorder_level: reorderLevel,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId)
      .select(`
        id,
        sku,
        name,
        description,
        selling_price,
        purchase_price,
        reorder_level,
        category_id,
        created_at,
        updated_at,
        category:categories(id, name, icon)
      `)
      .single()

    if (error) throw error
    return { success: true, data }
  } catch (error) {
    logger.error('Error updating product:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update product' }
  }
}

/**
 * Delete a product (safe delete - checks if product is used in sales)
 */
export async function deleteProduct(productId: string) {
  try {
    // Check if product is used in any sales
    const { data: saleItems, error: checkError } = await supabaseAdmin
      .from('sale_items')
      .select('id')
      .eq('product_id', productId)
      .limit(1)

    if (checkError) throw checkError

    if (saleItems && saleItems.length > 0) {
      return {
        success: false,
        error: 'Cannot delete product that has been used in sales. Mark as inactive instead.',
      }
    }

    // Safe to delete - remove inventory records first
    await supabaseAdmin
      .from('inventory')
      .delete()
      .eq('product_id', productId)

    // Then delete product
    const { error: deleteError } = await supabaseAdmin
      .from('products')
      .delete()
      .eq('id', productId)

    if (deleteError) throw deleteError
    return { success: true }
  } catch (error) {
    logger.error('Error deleting product:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to delete product' }
  }
}

/**
 * Adjust stock quantity for a product at a branch
 * Creates audit trail record (stock_movements) automatically
 * Updates last_counted_at timestamp
 */
export async function adjustStockQuantity(
  inventoryId: string,
  productId: string,
  branchId: string,
  adjustmentQuantity: number,
  reason: string
) {
  try {
    const authResult = await authenticateServerAction()
    if (!authResult.success || !authResult.profile) {
      return {
        success: false,
        error: authResult.error || 'Unauthorized',
      }
    }

    const inventoryAccess = authorizeInventoryControlProfile(authResult.profile)
    if (!inventoryAccess.authorized) {
      return {
        success: false,
        error: inventoryAccess.error || 'Access denied',
      }
    }

    const branchScope = resolveAuthorizedBranchId(authResult.profile, branchId)
    if (!branchScope.authorized || !branchScope.branchId) {
      return {
        success: false,
        error: branchScope.error || 'Access denied',
      }
    }

    const effectiveBranchId = branchScope.branchId

    // Step 1: Get current inventory
    const { data: currentInventory, error: fetchError } = await supabaseAdmin
      .from('inventory')
      .select('quantity')
      .eq('id', inventoryId)
      .eq('product_id', productId)
      .eq('branch_id', effectiveBranchId)
      .single()

    if (fetchError) throw fetchError
    if (!currentInventory) throw new Error('Inventory record not found')

    // Step 2: Calculate new quantity
    const newQuantity = Math.max(0, currentInventory.quantity + adjustmentQuantity)
    const appliedAdjustment = newQuantity - currentInventory.quantity

    // Step 3: Update inventory with new quantity and last_counted_at
    const { error: updateError } = await supabaseAdmin
      .from('inventory')
      .update({
        quantity: newQuantity,
        last_counted_at: new Date().toISOString(),
      })
      .eq('id', inventoryId)

    if (updateError) throw updateError

    // Step 4: Create stock movement record for audit trail
    const { error: movementError } = await supabaseAdmin
      .from('stock_movements')
      .insert({
        product_id: productId,
        branch_id: effectiveBranchId,
        type: 'adjustment',
        quantity: appliedAdjustment,
        notes: reason,
      })

    if (movementError) throw movementError

    return {
      success: true,
      newQuantity,
      message: `Stock adjusted by ${appliedAdjustment > 0 ? '+' : ''}${appliedAdjustment} units`,
    }
  } catch (error) {
    logger.error('Error adjusting stock:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to adjust stock',
    }
  }
}
