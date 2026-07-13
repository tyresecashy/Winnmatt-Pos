import type { ToolDefinition, ToolContext } from '../types'
import { logger } from '@/lib/logger'
import { supabaseAdmin } from '@/lib/supabase-server'

/**
 * Product management tools for the AI assistant
 */

export const productTools: ToolDefinition[] = [
  {
    name: 'addProduct',
    description: 'Add a new product to the inventory catalog with optional initial stock',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Product display name' },
        sku: { type: 'string', description: 'Unique stock keeping unit code' },
        description: { type: 'string', description: 'Product description' },
        category: { type: 'string', description: 'Category name (e.g. Dairy, Electronics). Will auto-resolve to ID.' },
        purchase_price: { type: 'number', description: 'Unit purchase/cost price in KSh' },
        selling_price: { type: 'number', description: 'Unit selling price in KSh' },
        reorder_level: { type: 'number', description: 'Low stock threshold quantity' },
        initial_stock: { type: 'number', description: 'Starting inventory quantity for this branch' },
      },
      required: ['name', 'sku', 'selling_price'],
    },
    isWrite: true,
    handler: async (args, context) => {
      const name = args.name as string
      const sku = args.sku as string
      const description = (args.description as string) || ''
      const sellingPrice = args.selling_price as number
      const purchasePrice = (args.purchase_price as number) || 0
      const reorderLevel = (args.reorder_level as number) || 0
      const initialStock = (args.initial_stock as number) || 0
      let categoryId: string | null = null

      // Resolve category name to ID if provided
      if (args.category) {
        const categoryName = args.category as string
        const { data: cat } = await supabaseAdmin
          .from('categories')
          .select('id')
          .ilike('name', categoryName)
          .maybeSingle()
        if (cat) {
          categoryId = cat.id
        }
        // If not found, we'll leave it null — the product is created without a category
      }

      // Call existing createProduct function
      const { createProduct } = await import('@/lib/products-actions')
      const result = await createProduct(
        sku,
        name,
        description,
        categoryId,
        purchasePrice,
        sellingPrice,
        reorderLevel,
        context.branchId,
        initialStock
      )

      if (result.success) {
        return {
          success: true,
          data: result as any,
          summary: `Product "${name}" (SKU: ${sku}) created successfully at KSh ${sellingPrice}. ${initialStock > 0 ? `Stock: ${initialStock} units.` : ''}`,
        }
      }
      return { success: false, error: result.error || 'Failed to create product' }
    },
  },

  {
    name: 'updateProduct',
    description: 'Update an existing product\'s details (price, description, reorder level, etc.)',
    parameters: {
      type: 'object',
      properties: {
        product_id: { type: 'string', description: 'Product UUID' },
        name: { type: 'string', description: 'New product name' },
        sku: { type: 'string', description: 'New SKU code' },
        selling_price: { type: 'number', description: 'New selling price in KSh' },
        purchase_price: { type: 'number', description: 'New purchase price in KSh' },
        reorder_level: { type: 'number', description: 'New reorder threshold' },
        description: { type: 'string', description: 'New product description' },
      },
      required: ['product_id'],
    },
    isWrite: true,
    handler: async (args) => {
      const updates: Record<string, unknown> = {}
      if (args.name) updates.name = args.name
      if (args.sku) updates.sku = args.sku
      if (args.selling_price !== undefined) updates.selling_price = args.selling_price
      if (args.purchase_price !== undefined) updates.purchase_price = args.purchase_price
      if (args.reorder_level !== undefined) updates.reorder_level = args.reorder_level
      if (args.description !== undefined) updates.description = args.description

      const { data, error } = await supabaseAdmin
        .from('products')
        .update(updates)
        .eq('id', args.product_id as string)
        .select('id, name, sku, selling_price, purchase_price, reorder_level')
        .single()

      logger.error('Operation failed', { error: error })
      if (error) return { success: false, error: 'Operation failed. Please try again.' }
      return {
        success: true,
        data,
        summary: `Product "${data.name}" updated successfully.`,
      }
    },
  },

  {
    name: 'searchProducts',
    description: 'Search for products by name or SKU code',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term to match against product name or SKU' },
        limit: { type: 'number', description: 'Maximum number of results (default 20)' },
      },
      required: ['query'],
    },
    isWrite: false,
    handler: async (args) => {
      const query = args.query as string
      const limit = (args.limit as number) || 20

      const { searchProducts } = await import('@/lib/products-actions')
      const results = await searchProducts(query)

      const limited = results.slice(0, limit)
      return {
        success: true,
        data: limited,
        summary: `Found ${limited.length} product(s) matching "${query}".`,
      }
    },
  },

  {
    name: 'getProductDetails',
    description: 'Get full details of a specific product including current stock levels',
    parameters: {
      type: 'object',
      properties: {
        product_id: { type: 'string', description: 'Product UUID' },
        sku: { type: 'string', description: 'Product SKU code (alternative to product_id)' },
      },
    },
    isWrite: false,
    handler: async (args) => {
      const productId = args.product_id as string | undefined
      const sku = args.sku as string | undefined

      let query = supabaseAdmin
        .from('products')
        .select(`
          id, sku, name, description, selling_price, purchase_price, reorder_level,
          category:categories(id, name),
          created_at, updated_at
        `)

      if (productId) query = query.eq('id', productId)
      else if (sku) query = query.eq('sku', sku)
      else return { success: false, error: 'Either product_id or sku is required' }

      const { data: product, error } = await query.single()
      logger.error('Operation failed', { error: error })
      if (error) return { success: false, error: 'Operation failed. Please try again.' }
      if (!product) return { success: false, error: 'Product not found' }

      // Get stock across all branches
      const { data: stock } = await supabaseAdmin
        .from('inventory')
        .select('branch_id, quantity, branch:branches(name)')
        .eq('product_id', product.id)

      return {
        success: true,
        data: { ...product, stock: stock || [] },
        summary: `${product.name} (SKU: ${product.sku}) — KSh ${product.selling_price}. ${stock && stock.length > 0 ? `Total stock: ${stock.reduce((s, i) => s + (i.quantity || 0), 0)} units across ${stock.length} branch(es).` : 'No stock records found.'}`,
      }
    },
  },

  {
    name: 'setReorderLevel',
    description: 'Set or update the reorder threshold for a product',
    parameters: {
      type: 'object',
      properties: {
        product_id: { type: 'string', description: 'Product UUID' },
        level: { type: 'number', description: 'New reorder threshold quantity' },
      },
      required: ['product_id', 'level'],
    },
    isWrite: true,
    handler: async (args) => {
      const { data, error } = await supabaseAdmin
        .from('products')
        .update({ reorder_level: args.level as number })
        .eq('id', args.product_id as string)
        .select('id, name, reorder_level')
        .single()

      logger.error('Operation failed', { error: error })
      if (error) return { success: false, error: 'Operation failed. Please try again.' }
      return {
        success: true,
        data,
        summary: `Reorder level for "${data.name}" set to ${data.reorder_level} units.`,
      }
    },
  },
]
