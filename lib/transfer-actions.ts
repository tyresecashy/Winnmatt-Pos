'use server'

import {
  authenticateServerAction,
  authorizeTransferProfile,
  resolveAuthorizedBranchId,
} from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'

interface ProductRow {
  productId: string
  product: {
    id: string
    sku: string
    name: string
    category_id?: string
    category?: { id: string; name: string } | null
  } | null
  availableQuantity: number
}

/**
 * Get all branches for selection
 */
export async function getAllBranches() {
  try {
    const authResult = await authenticateServerAction()
    if (!authResult.success || !authResult.profile) {
      throw new Error(authResult.error || 'Unauthorized')
    }

    const transferAccess = authorizeTransferProfile(authResult.profile)
    if (!transferAccess.authorized) {
      throw new Error(transferAccess.error || 'Access denied')
    }

    const { data, error } = await supabaseAdmin
      .from('branches')
      .select('id, name, code')
      .order('name')

    if (error) {
      throw error
    }

    if (!data) {
      return []
    }

    return data || []
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error('[TRANSFER] Failed to fetch branches:', errorMsg)
    throw new Error(`Failed to fetch branches: ${errorMsg}`)
  }
}

/**
 * Get available stock for a product at a specific branch
 */
export async function getStockAtBranch(productId: string, branchId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('inventory')
      .select('quantity')
      .eq('product_id', productId)
      .eq('branch_id', branchId)
      .single()

    if (error && error.code === 'PGRST116') {
      // No inventory record exists for this product at this branch
      return { quantity: 0, exists: false }
    }

    if (error) throw error
    return { quantity: data?.quantity || 0, exists: true }
  } catch (error) {
    console.error('Error fetching stock:', error)
    return { quantity: 0, exists: false }
  }
}

/**
 * Get products with their current stock at the source branch
 */
export async function getProductsAtBranch(branchId: string) {
  try {
    const authResult = await authenticateServerAction()
    if (!authResult.success || !authResult.profile) {
      throw new Error(authResult.error || 'Unauthorized')
    }

    const transferAccess = authorizeTransferProfile(authResult.profile)
    if (!transferAccess.authorized) {
      throw new Error(transferAccess.error || 'Access denied')
    }

    const branchScope = resolveAuthorizedBranchId(authResult.profile, branchId)
    if (!branchScope.authorized || !branchScope.branchId) {
      throw new Error(branchScope.error || 'Access denied')
    }

    const effectiveBranchId = branchScope.branchId

    const { data, error } = await supabaseAdmin
      .from('inventory')
      .select(`
        product_id,
        quantity,
        product:products(id, sku, name, category_id, category:categories(id, name))
      `)
      .eq('branch_id', effectiveBranchId)
      .gt('quantity', 0)
      .order('product(name)')

    if (error) {
      // APPROACH 2: Fallback - fetch without category relation
      const { data: data2, error: error2 } = await supabaseAdmin
        .from('inventory')
        .select(`
          product_id,
          quantity,
          product:products(id, sku, name, category_id)
        `)
        .eq('branch_id', effectiveBranchId)
        .gt('quantity', 0)
        .order('product(name)')

      if (error2) {
        // APPROACH 3: Last resort - fetch inventory and products separately then merge
        const { data: inventoryRows, error: error3 } = await supabaseAdmin
          .from('inventory')
          .select('product_id, quantity')
          .eq('branch_id', effectiveBranchId)
          .gt('quantity', 0)
          .order('product_id')

        if (error3) {
          throw new Error(`Failed to fetch inventory for branch ${effectiveBranchId}: ${error3.message}`)
        }

        if (!inventoryRows || inventoryRows.length === 0) {
          return []
        }

        // Fetch all products referenced by these inventory rows
        const productIds = inventoryRows.map((row) => row.product_id)
        const { data: products, error: productError } = await supabaseAdmin
          .from('products')
          .select('id, sku, name, category_id, category:categories(id, name)')
          .in('id', productIds)

        if (productError) {
          throw new Error(`Failed to fetch products: ${productError.message}`)
        }

        // Merge products back into inventory rows
        const productMap: Record<string, { id: string; sku: string; name: string; category_id: string; category: { id: string; name: string } | null }> = Object.fromEntries(
          (products || []).map((p) => [p.id, p])
        )

        const result = inventoryRows.map((invRow) => ({
          productId: invRow.product_id,
          product: productMap[invRow.product_id] || null,
          availableQuantity: invRow.quantity,
        }))

        return result
      }

      // Approach 2 succeeded
      const approach2Products: ProductRow[] = (data2 || []).map((row) => {
        const product = Array.isArray(row.product) ? row.product[0] : row.product
        const rawCategory = (product as Record<string, unknown>)?.category
        const category = Array.isArray(rawCategory) ? rawCategory[0] : (rawCategory ?? null)
        return {
          productId: row.product_id,
          product: product ? {
            id: (product as Record<string, unknown>).id as string,
            sku: (product as Record<string, unknown>).sku as string,
            name: (product as Record<string, unknown>).name as string,
            category_id: (product as Record<string, unknown>).category_id as string | undefined,
            category: category as { id: string; name: string } | null,
          } : null,
          availableQuantity: row.quantity,
        }
      })

      return approach2Products
    }

    // Approach 1 succeeded
    const approach1Products: ProductRow[] = (data || []).map((row) => {
      const product = Array.isArray(row.product) ? row.product[0] : row.product
      const rawCategory = (product as Record<string, unknown>)?.category
      const category = Array.isArray(rawCategory) ? rawCategory[0] : (rawCategory ?? null)
      return {
        productId: row.product_id,
        product: product ? {
          id: (product as Record<string, unknown>).id as string,
          sku: (product as Record<string, unknown>).sku as string,
          name: (product as Record<string, unknown>).name as string,
          category_id: (product as Record<string, unknown>).category_id as string | undefined,
          category: category as { id: string; name: string } | null,
        } : null,
        availableQuantity: row.quantity,
      }
    })

    return approach1Products
  } catch (error) {
    // Handle both Error instances and Supabase error objects
    let errorMsg: string
    if (error instanceof Error) {
      errorMsg = error.message
    } else if (error && typeof error === 'object' && 'message' in error) {
      errorMsg = (error as { message?: string }).message || 'Unknown error'
    } else {
      errorMsg = 'Unknown error occurred'
    }
    
    console.error('[TRANSFER] Failed to load products for transfer:', {
      branchId,
      error: errorMsg,
    })
    throw new Error(`Failed to load products for branch: ${errorMsg}`)
  }
}

/**
 * Normalize a raw Supabase movement row — unwrap embedded arrays from joins.
 */
function normalizeMovement(row: Record<string, unknown>): StockMovement {
  return {
    id: row.id as string,
    product_id: row.product_id as string,
    branch_id: row.branch_id as string,
    type: row.type as string,
    quantity: row.quantity as number,
    reference_id: row.reference_id as string,
    notes: row.notes as string | null,
    created_at: row.created_at as string,
    product: Array.isArray(row.product) ? (row.product[0] as StockMovement['product']) : (row.product as StockMovement['product']),
    branch: Array.isArray(row.branch) ? (row.branch[0] as StockMovement['branch']) : (row.branch as StockMovement['branch']),
  }
}

/**
 * Get all transfers (real database records)
 */
export async function getTransfers(limit: number = 50) {
  try {
    const authResult = await authenticateServerAction()
    if (!authResult.success || !authResult.profile) {
      console.warn('[TRANSFER] Transfer history denied:', authResult.error)
      return []
    }

    const transferAccess = authorizeTransferProfile(authResult.profile)
    if (!transferAccess.authorized) {
      console.warn('[TRANSFER] Transfer history access denied:', transferAccess.error)
      return []
    }

    const safeLimit = Math.max(1, Math.min(limit, 100))
    let movementList: StockMovement[] = []

    if (authResult.profile.role === 'owner') {
      const { data: movements, error } = await supabaseAdmin
        .from('stock_movements')
        .select(`
          id,
          product_id,
          branch_id,
          type,
          quantity,
          reference_id,
          notes,
          created_at,
          product:products(id, sku, name),
          branch:branches(id, name, code)
        `)
        .eq('type', 'transfer')
        .order('created_at', { ascending: false })
        .limit(safeLimit)

      if (error) throw error
      movementList = (movements || []).map(normalizeMovement)
    } else {
      const { data: scopedMovements, error: scopedError } = await supabaseAdmin
        .from('stock_movements')
        .select('id, reference_id, created_at')
        .eq('type', 'transfer')
        .eq('branch_id', authResult.profile.branch_id)
        .order('created_at', { ascending: false })
        .limit(safeLimit)

      if (scopedError) throw scopedError

      const referenceIds = Array.from(
        new Set(
          (scopedMovements || [])
            .map((movement) => movement.reference_id || movement.id)
            .filter(Boolean)
        )
      )

      if (referenceIds.length === 0) {
        return []
      }

      const { data: movements, error } = await supabaseAdmin
        .from('stock_movements')
        .select(`
          id,
          product_id,
          branch_id,
          type,
          quantity,
          reference_id,
          notes,
          created_at,
          product:products(id, sku, name),
          branch:branches(id, name, code)
        `)
        .eq('type', 'transfer')
        .in('reference_id', referenceIds)
        .order('created_at', { ascending: false })

      if (error) throw error
      movementList = (movements || []).map(normalizeMovement)
    }

    // Group by reference_id to get transfer pairs
    const transferMap: Record<string, TransferGroup> = {}

    movementList.forEach((movement) => {
      const refId = movement.reference_id || movement.id

      if (!transferMap[refId]) {
        transferMap[refId] = {
          id: refId,
          createdAt: movement.created_at,
          transfers: [],
          notes: movement.notes,
        }
      }

      transferMap[refId].transfers.push({
        id: movement.id,
        product: movement.product,
        branch: movement.branch,
        quantity: Math.abs(movement.quantity),
        direction: movement.quantity < 0 ? 'out' : 'in',
      })
    })

    // Format transfers for display
    return Object.values(transferMap)
      .map((transfer) => {
        const outTransfer = transfer.transfers.find((t) => t.direction === 'out')
        const inTransfer = transfer.transfers.find((t) => t.direction === 'in')

        return {
          id: transfer.id,
          product: outTransfer?.product?.name || 'Unknown Product',
          quantity: outTransfer?.quantity || 0,
          fromBranch: outTransfer?.branch?.name || 'Unknown',
          toBranch: inTransfer?.branch?.name || 'Unknown',
          createdAt: transfer.createdAt,
          notes: transfer.notes,
          status: 'completed', // In real app with approvals, this could vary
        }
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, safeLimit)
  } catch (error) {
    console.error('Error fetching transfers:', error)
    return []
  }
}

interface StockMovement {
  id: string
  product_id: string
  branch_id: string
  type: string
  quantity: number
  reference_id: string
  notes: string | null
  created_at: string
  product: { id: string; sku: string; name: string } | null
  branch: { id: string; name: string; code: string } | null
}

interface TransferGroup {
  id: string
  createdAt: string
  transfers: Array<{
    id: string
    product: { id: string; sku: string; name: string } | null
    branch: { id: string; name: string; code: string } | null
    quantity: number
    direction: 'out' | 'in'
  }>
  notes: string | null
}

export interface TransferItem {
  productId: string
  quantity: number
}

/**
 * Create a stock transfer between branches
 * Creates audit trail with matched movements for both source and destination
 */
export async function createStockTransfer(
  sourceBranchId: string,
  destinationBranchId: string,
  items: TransferItem[],
  notes?: string
) {
  try {
    const authResult = await authenticateServerAction()
    if (!authResult.success || !authResult.profile) {
      return {
        success: false,
        error: authResult.error || 'Unauthorized',
      }
    }

    const transferAccess = authorizeTransferProfile(authResult.profile)
    if (!transferAccess.authorized) {
      return {
        success: false,
        error: transferAccess.error || 'Access denied',
      }
    }

    const branchScope = resolveAuthorizedBranchId(authResult.profile, sourceBranchId)
    if (!branchScope.authorized || !branchScope.branchId) {
      return {
        success: false,
        error: branchScope.error || 'Access denied',
      }
    }

    const effectiveSourceBranchId = branchScope.branchId

    // Validation 1: Source and destination must be different
    if (effectiveSourceBranchId === destinationBranchId) {
      return {
        success: false,
        error: 'Source and destination branches must be different',
      }
    }

    // Validation 2: Must have at least one item
    if (!items || items.length === 0) {
      return {
        success: false,
        error: 'Must select at least one product to transfer',
      }
    }

    // Validation 3: All quantities must be positive integers
    for (const item of items) {
      if (!item.quantity || item.quantity <= 0) {
        return {
          success: false,
          error: `Invalid quantity for product. Must be greater than 0.`,
        }
      }
      if (!Number.isInteger(item.quantity)) {
        return {
          success: false,
          error: `Quantities must be whole numbers`,
        }
      }
    }

    const { data: destinationBranch, error: destinationError } = await supabaseAdmin
      .from('branches')
      .select('id')
      .eq('id', destinationBranchId)
      .maybeSingle()

    if (destinationError) {
      return {
        success: false,
        error: 'Failed to validate destination branch',
      }
    }

    if (!destinationBranch) {
      return {
        success: false,
        error: 'Destination branch not found',
      }
    }

    // Use a transaction-like approach with reference ID to link movements
    const transferId = `TRANSFER-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const createdMovements = []
    const errors = []

    for (const item of items) {
      try {
        // Step 1: Verify source has enough stock
        const { data: sourceInventory, error: sourceError } = await supabaseAdmin
          .from('inventory')
          .select('id, quantity')
          .eq('product_id', item.productId)
          .eq('branch_id', effectiveSourceBranchId)
          .maybeSingle()

        if (sourceError && sourceError.code !== 'PGRST116') {
          throw sourceError
        }

        if (!sourceInventory || sourceInventory.quantity < item.quantity) {
          const available = sourceInventory?.quantity || 0
          errors.push(
            `Insufficient stock: Product requires ${item.quantity} units but only ${available} available at source`
          )
          continue
        }

        // Step 2: Deduct from source branch inventory
        const newSourceQuantity = sourceInventory.quantity - item.quantity
        const { error: sourceUpdateError } = await supabaseAdmin
          .from('inventory')
          .update({ quantity: newSourceQuantity })
          .eq('id', sourceInventory.id)

        if (sourceUpdateError) throw sourceUpdateError

        // Step 3: Create stock_movements entry for source (negative quantity = out)
        const { data: sourceMovement, error: sourceMovementError } = await supabaseAdmin
          .from('stock_movements')
          .insert({
            product_id: item.productId,
            branch_id: effectiveSourceBranchId,
            type: 'transfer',
            quantity: -item.quantity,
            reference_id: transferId,
            notes: notes ? `Transfer out: ${notes}` : `Transfer out`,
          })
          .select()
          .single()

        if (sourceMovementError) throw sourceMovementError
        createdMovements.push(sourceMovement)

        // Step 4: Get or create inventory row for destination branch
        const { data: destInventory, error: destFetchError } = await supabaseAdmin
          .from('inventory')
          .select('id, quantity')
          .eq('product_id', item.productId)
          .eq('branch_id', destinationBranchId)
          .maybeSingle()

        if (destFetchError && destFetchError.code !== 'PGRST116') {
          throw destFetchError
        }

        let destInventoryId = destInventory?.id

        // If destination doesn't have this product, create it
        if (!destInventory) {
          const { data: newDestInventory, error: createDestError } = await supabaseAdmin
            .from('inventory')
            .insert({
              product_id: item.productId,
              branch_id: destinationBranchId,
              quantity: 0,
            })
            .select('id')
            .single()

          if (createDestError) throw createDestError
          destInventoryId = newDestInventory.id
        }

        // Step 5: Add to destination inventory
        const destQuantity = (destInventory?.quantity || 0) + item.quantity
        const { error: destUpdateError } = await supabaseAdmin
          .from('inventory')
          .update({ quantity: destQuantity })
          .eq('id', destInventoryId)

        if (destUpdateError) throw destUpdateError

        // Step 6: Create stock_movements entry for destination (positive quantity = in)
        const { data: destMovement, error: destMovementError } = await supabaseAdmin
          .from('stock_movements')
          .insert({
            product_id: item.productId,
            branch_id: destinationBranchId,
            type: 'transfer',
            quantity: item.quantity,
            reference_id: transferId,
            notes: notes ? `Transfer in: ${notes}` : `Transfer in`,
          })
          .select()
          .single()

        if (destMovementError) throw destMovementError
        createdMovements.push(destMovement)
      } catch (itemError) {
        errors.push(
          `Error processing product: ${itemError instanceof Error ? itemError.message : 'Unknown error'}`
        )
      }
    }

    // Return success only if all items were processed
    if (errors.length > 0 && createdMovements.length === 0) {
      return {
        success: false,
        error: errors.join('; '),
      }
    }

    return {
      success: true,
      transferId,
      processedItems: createdMovements.length / 2, // Divided by 2 because each transfer creates 2 movements
      errors: errors.length > 0 ? errors : undefined,
      message: `Transfer completed for ${createdMovements.length / 2} product(s)`,
    }
  } catch (error) {
    console.error('Error creating stock transfer:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create transfer',
    }
  }
}
