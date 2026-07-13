import type { ToolDefinition, ToolContext } from '../types'
import { logger } from '@/lib/logger'
import { supabaseAdmin } from '@/lib/supabase-server'

/**
 * Inventory and stock management tools for the AI assistant
 */

export const inventoryTools: ToolDefinition[] = [
  {
    name: 'getStockLevel',
    description: 'Get current stock level for a specific product across all branches',
    parameters: {
      type: 'object',
      properties: {
        product_id: { type: 'string', description: 'Product UUID' },
        sku: { type: 'string', description: 'Product SKU (alternative to product_id)' },
        product_name: { type: 'string', description: 'Product name to search (alternative to product_id)' },
      },
    },
    isWrite: false,
    handler: async (args) => {
      let productId = args.product_id as string | undefined

      // Resolve product by SKU or name
      if (!productId && args.sku) {
        const { data } = await supabaseAdmin
          .from('products')
          .select('id')
          .eq('sku', args.sku as string)
          .maybeSingle()
        if (data) productId = data.id
        else return { success: false, error: `No product found with SKU "${args.sku}"` }
      }
      if (!productId && args.product_name) {
        const { data } = await supabaseAdmin
          .from('products')
          .select('id')
          .ilike('name', args.product_name as string)
          .maybeSingle()
        if (data) productId = data.id
        else return { success: false, error: `No product found with name "${args.product_name}"` }
      }

      if (!productId) {
        return { success: false, error: 'Provide one of: product_id, sku, or product_name' }
      }

      const [productRes, inventoryRes] = await Promise.all([
        supabaseAdmin.from('products').select('id, name, sku, reorder_level').eq('id', productId).single(),
        supabaseAdmin.from('inventory')
          .select('quantity, branch_id, branch:branches(name)')
          .eq('product_id', productId),
      ])

      if (productRes.error) {
        logger.error('Operation failed', { error: productRes.error })
        return { success: false, error: 'Operation failed. Please try again.' }
      }

      const product = productRes.data
      const stock = inventoryRes.data || []
      const totalStock = stock.reduce((sum, s) => sum + (s.quantity || 0), 0)
      const isLow = product.reorder_level > 0 && totalStock <= product.reorder_level

      return {
        success: true,
        data: { product, stock, totalStock, isLow },
        summary: `${product.name} (SKU: ${product.sku}): ${totalStock} unit(s) total. ${isLow ? `⚠ BELOW reorder level (${product.reorder_level}).` : `Reorder at: ${product.reorder_level}.`} ${stock.map(s => `${s.branch?.name || 'Unknown'}: ${s.quantity || 0}`).join(', ')}`,
      }
    },
  },

  {
    name: 'getLowStockAlerts',
    description: 'Get all products that are at or below their reorder level',
    parameters: {
      type: 'object',
      properties: {
        branch_id: { type: 'string', description: 'Optional: limit to a specific branch' },
        limit: { type: 'number', description: 'Maximum results (default 50)' },
      },
    },
    isWrite: false,
    handler: async (args) => {
      const branchId = args.branch_id as string | undefined
      const limit = (args.limit as number) || 50

      let invQuery = supabaseAdmin
        .from('inventory')
        .select(`
          product_id, quantity, branch_id,
          product:products(id, name, sku, selling_price, reorder_level),
          branch:branches(id, name)
        `)
        .not('product', 'is', null)

      if (branchId) invQuery = invQuery.eq('branch_id', branchId)

      const { data: inventory, error } = await invQuery
        .order('quantity', { ascending: true })
        .limit(limit * 5) // Get more than needed since we filter

      logger.error('Operation failed', { error: error })
      if (error) return { success: false, error: 'Operation failed. Please try again.' }

      // Filter: quantity <= reorder_level AND reorder_level > 0
      const lowStock = (inventory || []).filter(
        (i: Record<string, unknown>) => {
          const p = i.product as Record<string, unknown> | null
          return p && (p.reorder_level as number) > 0 && (i.quantity as number) <= (p.reorder_level as number)
        }
      ).slice(0, limit)

      return {
        success: true,
        data: lowStock,
        summary: `${lowStock.length} product(s) at or below reorder level. ${branchId ? 'Filtered by branch.' : 'Across all branches.'}`,
      }
    },
  },

  {
    name: 'transferStock',
    description: 'Transfer stock from one branch to another',
    parameters: {
      type: 'object',
      properties: {
        product_id: { type: 'string', description: 'Product UUID' },
        from_branch_id: { type: 'string', description: 'Source branch UUID' },
        to_branch_id: { type: 'string', description: 'Destination branch UUID' },
        quantity: { type: 'number', description: 'Quantity to transfer' },
        notes: { type: 'string', description: 'Optional notes for the transfer' },
      },
      required: ['product_id', 'from_branch_id', 'to_branch_id', 'quantity'],
    },
    isWrite: true,
    handler: async (args) => {
      const productId = args.product_id as string
      const fromBranchId = args.from_branch_id as string
      const toBranchId = args.to_branch_id as string
      const quantity = args.quantity as number
      const notes = (args.notes as string) || 'AI-initiated transfer'

      if (quantity <= 0) return { success: false, error: 'Quantity must be positive' }

      // Check source has enough stock
      const { data: sourceInv } = await supabaseAdmin
        .from('inventory')
        .select('quantity')
        .eq('product_id', productId)
        .eq('branch_id', fromBranchId)
        .maybeSingle()

      if (!sourceInv) return { success: false, error: 'Source branch has no stock of this product' }
      if (sourceInv.quantity < quantity) {
        return { success: false, error: `Insufficient stock. Available: ${sourceInv.quantity}, requested: ${quantity}` }
      }

      // Get product name for summary
      const { data: product } = await supabaseAdmin
        .from('products')
        .select('name')
        .eq('id', productId)
        .single()

      // Get branch names (try-catch, non-fatal)
      const getBranchName = async (id: string, fallback: string) => {
        try {
          const { data } = await supabaseAdmin.from('branches').select('name').eq('id', id).single()
          return data?.name || fallback
        } catch { return fallback }
      }
      const [fromBranch, toBranch] = await Promise.all([
        getBranchName(fromBranchId, 'Source'),
        getBranchName(toBranchId, 'Destination'),
      ])

      // Delegate to the proper module layer for atomic transfer creation
      const { createStockTransfer } = await import('@/lib/modules/transfers')
      const transferResult = await createStockTransfer({
        from_branch_id: fromBranchId,
        to_branch_id: toBranchId,
        items: [{ product_id: productId, quantity_requested: quantity, notes }],
      })

      if (!transferResult.success) {
        return { success: false, error: transferResult.error }
      }

      // Log stock movement (non-fatal)
      try {
        await supabaseAdmin.from('stock_movements').insert({
          product_id: productId,
          branch_id: fromBranchId,
          quantity,
          type: 'transfer',
          notes,
          created_by: 'ai_assistant',
        })
      } catch { /* non-fatal */ }

      return {
        success: true,
        summary: `${quantity} unit(s) of ${product?.name || 'product'} transfer requested from ${fromBranch} to ${toBranch}. Awaiting approval.`,
      }

      return {
        success: true,
        summary: `${quantity} unit(s) of ${product?.name || 'product'} transferred from ${fromBranch} to ${toBranch}.`,
      }
    },
  },

  {
    name: 'adjustInventory',
    description: 'Manually adjust stock count for a product at a branch (e.g. after counting)',
    parameters: {
      type: 'object',
      properties: {
        product_id: { type: 'string', description: 'Product UUID' },
        branch_id: { type: 'string', description: 'Branch UUID' },
        new_quantity: { type: 'number', description: 'New stock quantity after adjustment' },
        reason: { type: 'string', description: 'Reason for the adjustment' },
      },
      required: ['product_id', 'branch_id', 'new_quantity', 'reason'],
    },
    isWrite: true,
    handler: async (args) => {
      const productId = args.product_id as string
      const branchId = args.branch_id as string
      const newQty = args.new_quantity as number
      const reason = args.reason as string

      // Get current quantity
      const { data: existing } = await supabaseAdmin
        .from('inventory')
        .select('quantity')
        .eq('product_id', productId)
        .eq('branch_id', branchId)
        .maybeSingle()

      const previousQty = existing?.quantity || 0

      if (existing) {
        const { error } = await supabaseAdmin
          .from('inventory')
          .update({ quantity: newQty })
          .eq('product_id', productId)
          .eq('branch_id', branchId)
        logger.error('Operation failed', { error: error })
        if (error) return { success: false, error: 'Operation failed. Please try again.' }
      } else {
        const { error } = await supabaseAdmin
          .from('inventory')
          .insert({ product_id: productId, branch_id: branchId, quantity: newQty })
        logger.error('Operation failed', { error: error })
        if (error) return { success: false, error: 'Operation failed. Please try again.' }
      }

      // Log the adjustment
      await supabaseAdmin.from('stock_movements').insert({
        product_id: productId,
        branch_id: branchId,
        quantity: newQty - previousQty,
        type: 'adjustment',
        notes: `AI adjustment: ${reason}. Previous: ${previousQty}, New: ${newQty}`,
        created_by: 'ai_assistant',
      })

      return {
        success: true,
        summary: `Stock adjusted to ${newQty} units. Change: ${newQty - previousQty} units. Reason: ${reason}.`,
      }
    },
  },
]
