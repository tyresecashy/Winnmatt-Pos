import type { ToolDefinition, ToolContext } from '../types'
import { logger } from '@/lib/logger'
import { supabaseAdmin } from '@/lib/supabase-server'

/**
 * Supplier management tools for the AI assistant
 */

export const supplierTools: ToolDefinition[] = [
  {
    name: 'createSupplier',
    description: 'Create a new supplier/vendor record',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Supplier/business name' },
        contact_person: { type: 'string', description: 'Contact person name' },
        phone: { type: 'string', description: 'Phone number' },
        email: { type: 'string', description: 'Email address' },
        payment_terms: { type: 'string', description: 'Payment terms (e.g. Net 30, Cash on Delivery)' },
      },
      required: ['name', 'contact_person', 'phone'],
    },
    isWrite: true,
    handler: async (args) => {
      const name = args.name as string
      const contactPerson = args.contact_person as string
      const phone = args.phone as string
      const email = args.email as string | undefined
      const paymentTerms = (args.payment_terms as string) || 'Net 30'

      const { createSupplier } = await import('@/lib/modules/suppliers')
      const result = await createSupplier({ name, contact_person: contactPerson, phone, email, payment_terms: paymentTerms })

      if (result.success) {
        return {
          success: true,
          data: result.supplier,
          summary: result.message || `Supplier "${name}" created successfully.`,
        }
      }
      return { success: false, error: result.error || 'Failed to create supplier' }
    },
  },

  {
    name: 'searchSuppliers',
    description: 'Search for suppliers by name, contact person, or phone',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term' },
        limit: { type: 'number', description: 'Maximum results (default 20)' },
      },
      required: ['query'],
    },
    isWrite: false,
    handler: async (args) => {
      const query = args.query as string
      const limit = (args.limit as number) || 20

      const { data, error } = await supabaseAdmin
        .from('suppliers')
        .select('id, name, contact_person, phone, email, balance, payment_terms, created_at')
        .or(`name.ilike.%${query}%,contact_person.ilike.%${query}%,phone.ilike.%${query}%`)
        .order('name')
        .limit(limit)

      logger.error('Operation failed', { error: error })
      if (error) return { success: false, error: 'Operation failed. Please try again.' }
      return {
        success: true,
        data: data || [],
        summary: `Found ${(data || []).length} supplier(s) matching "${query}".`,
      }
    },
  },

  {
    name: 'getSupplierOrders',
    description: 'Get purchase orders for a specific supplier',
    parameters: {
      type: 'object',
      properties: {
        supplier_id: { type: 'string', description: 'Supplier UUID' },
        status: { type: 'string', enum: ['draft', 'pending', 'approved', 'sent', 'received', 'cancelled'], description: 'Filter by order status' },
        limit: { type: 'number', description: 'Maximum results (default 20)' },
      },
      required: ['supplier_id'],
    },
    isWrite: false,
    handler: async (args) => {
      const supplierId = args.supplier_id as string
      const limit = (args.limit as number) || 20

      let query = supabaseAdmin
        .from('purchase_orders')
        .select('id, order_number, status, total_amount, created_at, expected_date')
        .eq('supplier_id', supplierId)

      if (args.status) query = query.eq('status', args.status as string)

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(limit)

      logger.error('Operation failed', { error: error })
      if (error) return { success: false, error: 'Operation failed. Please try again.' }

      return {
        success: true,
        data: data || [],
        summary: `${(data || []).length} purchase order(s) for this supplier.`,
      }
    },
  },

  {
    name: 'createPurchaseOrder',
    description: 'Create a new purchase order for a supplier',
    parameters: {
      type: 'object',
      properties: {
        supplier_id: { type: 'string', description: 'Supplier UUID' },
        product_id: { type: 'string', description: 'Product UUID' },
        quantity: { type: 'number', description: 'Quantity to order' },
        unit_price: { type: 'number', description: 'Unit price in KSh' },
        expected_date: { type: 'string', description: 'Expected delivery date (YYYY-MM-DD)' },
        notes: { type: 'string', description: 'Order notes' },
      },
      required: ['supplier_id', 'product_id', 'quantity'],
    },
    isWrite: true,
    handler: async (args, context) => {
      const supplierId = args.supplier_id as string
      const productId = args.product_id as string
      const quantity = args.quantity as number
      const unitPrice = (args.unit_price as number) || 0
      const expectedDate = args.expected_date as string | undefined
      const notes = (args.notes as string) || ''

      const totalAmount = quantity * unitPrice

      const { data, error } = await supabaseAdmin
        .from('purchase_orders')
        .insert({
          supplier_id: supplierId,
          branch_id: context.branchId,
          status: 'draft',
          total_amount: totalAmount,
          expected_date: expectedDate || null,
          notes,
          created_by: context.userId,
        })
        .select('id, po_number, status, total_amount')
        .single()

      logger.error('Operation failed', { error: error })
      if (error) return { success: false, error: 'Operation failed. Please try again.' }

      // Add line item
      if (productId) {
        const { error: itemErr } = await supabaseAdmin
          .from('purchase_order_items')
          .insert({
            purchase_order_id: data.id,
            product_id: productId,
            quantity,
            unit_price: unitPrice,
            line_total: totalAmount,
          })

        if (itemErr) {
          // Log but don't fail — the PO exists
          console.error('[AI] Failed to add PO item:', itemErr)
        }
      }

      return {
        success: true,
        data,
        summary: `Purchase order #${data.po_number} created for KSh ${totalAmount.toLocaleString()} (${quantity} units). Status: draft.`,
      }
    },
  },
]
