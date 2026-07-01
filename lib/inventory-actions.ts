'use server'
import { logger } from '@/lib/logger';

import {
  authenticateServerAction,
  authorizePOSProfile,
  resolveAuthorizedBranchId,
} from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'

/**
 * Get all stock movements for a product at a branch
 */
export async function getStockMovements(productId: string, branchId: string, limit: number = 20) {
  try {
    const authResult = await authenticateServerAction()
    if (!authResult.success || !authResult.profile) {
      logger.warn('[INVENTORY] Stock movement fetch denied:', { error: authResult.error })
      return []
    }

    const posAccess = authorizePOSProfile(authResult.profile)
    if (!posAccess.authorized) {
      logger.warn('[INVENTORY] Stock movement fetch POS access denied:', { error: posAccess.error })
      return []
    }

    const branchScope = resolveAuthorizedBranchId(authResult.profile, branchId)
    if (!branchScope.authorized || !branchScope.branchId) {
      logger.warn('[INVENTORY] Stock movement fetch branch denied:', { error: branchScope.error })
      return []
    }

    const safeLimit = Math.max(1, Math.min(limit, 100))

    const { data, error } = await supabaseAdmin
      .from('stock_movements')
      .select('id, type, quantity, reference_id, notes, created_at')
      .eq('product_id', productId)
      .eq('branch_id', branchScope.branchId)
      .order('created_at', { ascending: false })
      .limit(safeLimit)

    if (error) throw error
    return data || []
  } catch (error) {
    logger.error('Error fetching stock movements:', error)
    return []
  }
}

/**
 * Server action to adjust stock quantity
 * Calls adjustStockQuantity from products-actions
 */
export async function adjustInventoryStock(
  inventoryId: string,
  productId: string,
  branchId: string,
  adjustmentQuantity: number,
  reason: string
) {
  try {
    // Import the function locally to avoid circular dependencies
    const { adjustStockQuantity } = await import('@/lib/products-actions')
    
    const result = await adjustStockQuantity(
      inventoryId,
      productId,
      branchId,
      adjustmentQuantity,
      reason
    )

    return result
  } catch (error) {
    logger.error('Error adjusting inventory:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to adjust inventory',
    }
  }
}
