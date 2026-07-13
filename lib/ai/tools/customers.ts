import type { ToolDefinition, ToolContext } from '../types'
import { logger } from '@/lib/logger'
import { supabaseAdmin } from '@/lib/supabase-server'

/**
 * Customer management tools for the AI assistant
 */

export const customerTools: ToolDefinition[] = [
  {
    name: 'createCustomer',
    description: 'Create a new customer record',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Customer full name or business name' },
        phone: { type: 'string', description: 'Customer phone number' },
        email: { type: 'string', description: 'Customer email address' },
        type: { type: 'string', enum: ['retail', 'wholesale', 'business'], description: 'Customer type' },
        credit_limit: { type: 'number', description: 'Credit limit in KSh' },
        notes: { type: 'string', description: 'Notes or tags about this customer' },
      },
      required: ['name'],
    },
    isWrite: true,
    handler: async (args) => {
      const name = args.name as string
      const phone = args.phone as string | undefined
      const email = args.email as string | undefined
      const type = (args.type as 'retail' | 'wholesale' | 'business') || 'retail'
      const creditLimit = (args.credit_limit as number) || 0
      const notes = args.notes as string | undefined

      const { createCustomer } = await import('@/lib/modules/customers')
      const result = await createCustomer({
        name,
        type,
        phone,
        email,
        credit_limit: creditLimit,
        notes: notes || null,
      })

      if (result.success) {
        return {
          success: true,
          data: { id: result.id, name },
          summary: `Customer "${name}" created successfully.`,
        }
      }

      return { success: false, error: result.error || 'Failed to create customer' }
    },
  },

  {
    name: 'searchCustomers',
    description: 'Search for customers by name, phone, or email',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term to match against customer name, phone, or email' },
        limit: { type: 'number', description: 'Maximum results (default 20)' },
      },
      required: ['query'],
    },
    isWrite: false,
    handler: async (args) => {
      const query = args.query as string
      const limit = (args.limit as number) || 20

      const { data, error } = await supabaseAdmin
        .from('customers')
        .select('id, name, phone, email, type, total_visits, total_spent, credit_balance, last_purchase_date, created_at')
        .or(`name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`)
        .order('name')
        .limit(limit)

      logger.error('Operation failed', { error: error })
      if (error) return { success: false, error: 'Operation failed. Please try again.' }

      return {
        success: true,
        data: data || [],
        summary: `Found ${(data || []).length} customer(s) matching "${query}".`,
      }
    },
  },

  {
    name: 'getCustomerHistory',
    description: 'Get purchase history and details for a specific customer',
    parameters: {
      type: 'object',
      properties: {
        customer_id: { type: 'string', description: 'Customer UUID' },
        limit: { type: 'number', description: 'Maximum number of past purchases to show (default 10)' },
      },
      required: ['customer_id'],
    },
    isWrite: false,
    handler: async (args) => {
      const customerId = args.customer_id as string
      const limit = (args.limit as number) || 10

      // Get customer details
      const { data: customer, error: custErr } = await supabaseAdmin
        .from('customers')
        .select('id, name, phone, email, type, total_visits, total_lifetime_spend_cents, credit_balance, last_purchase_date, created_at')
        .eq('id', customerId)
        .single()

      logger.error('Operation failed', { error: custErr })
      if (custErr) return { success: false, error: 'Operation failed. Please try again.' }
      if (!customer) return { success: false, error: 'Customer not found' }

      // Get recent purchases
      const { data: purchases } = await supabaseAdmin
        .from('sales')
        .select('id, receipt_number, total_amount, payment_method, created_at, items:sale_items(product_id, quantity, unit_price, products(name))')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(limit)

      return {
        success: true,
        data: { customer, recentPurchases: purchases || [] },
        summary: `${customer.name} — ${customer.total_visits || 0} visits, KSh ${customer.total_lifetime_spend_cents || 0} total spend. ${purchases?.length || 0} recent purchase(s).`,
      }
    },
  },

  {
    name: 'updateCustomer',
    description: 'Update an existing customer\'s details',
    parameters: {
      type: 'object',
      properties: {
        customer_id: { type: 'string', description: 'Customer UUID' },
        name: { type: 'string', description: 'New name' },
        phone: { type: 'string', description: 'New phone number' },
        email: { type: 'string', description: 'New email address' },
        credit_limit: { type: 'number', description: 'New credit limit in KSh' },
        notes: { type: 'string', description: 'Notes or tags' },
      },
      required: ['customer_id'],
    },
    isWrite: true,
    handler: async (args) => {
      const updates: Record<string, unknown> = {}
      if (args.name) updates.name = args.name
      if (args.phone) updates.phone = args.phone
      if (args.email) updates.email = args.email
      if (args.credit_limit !== undefined) updates.credit_limit = args.credit_limit

      const { data, error } = await supabaseAdmin
        .from('customers')
        .update(updates)
        .eq('id', args.customer_id as string)
        .select('id, name, phone, email')
        .single()

      logger.error('Operation failed', { error: error })
      if (error) return { success: false, error: 'Operation failed. Please try again.' }
      return {
        success: true,
        data,
        summary: `Customer "${data.name}" updated successfully.`,
      }
    },
  },
]
