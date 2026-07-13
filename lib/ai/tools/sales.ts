import type { ToolDefinition, ToolContext } from '../types'
import { logger } from '@/lib/logger'
import { supabaseAdmin } from '@/lib/supabase-server'

/**
 * Sales and transactions tools for the AI assistant
 */

export const salesTools: ToolDefinition[] = [
  {
    name: 'searchSales',
    description: 'Search for sales transactions by receipt number, date range, or payment method',
    parameters: {
      type: 'object',
      properties: {
        receipt_number: { type: 'string', description: 'Receipt number to search for' },
        date_from: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        date_to: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        payment_method: { type: 'string', enum: ['cash', 'card', 'bank_transfer', 'cheque', 'credit', 'mpesa'], description: 'Filter by payment method' },
        limit: { type: 'number', description: 'Maximum results (default 20)' },
      },
    },
    isWrite: false,
    handler: async (args) => {
      const limit = (args.limit as number) || 20

      let query = supabaseAdmin
        .from('sales')
        .select(`
          id, receipt_number, total_amount, payment_method, payment_status,
          created_at,
          customer:customers(id, name, phone),
          branch:branches(id, name),
          cashier:users!sales_cashier_id_fkey(id, full_name)
        `)

      if (args.receipt_number) {
        query = query.ilike('receipt_number', `%${args.receipt_number}%`)
      }
      if (args.date_from) {
        query = query.gte('created_at', `${args.date_from}T00:00:00`)
      }
      if (args.date_to) {
        query = query.lte('created_at', `${args.date_to}T23:59:59`)
      }
      if (args.payment_method) {
        query = query.eq('payment_method', args.payment_method as string)
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(limit)

      logger.error('Operation failed', { error: error })
      if (error) return { success: false, error: 'Operation failed. Please try again.' }

      const totalRevenue = (data || []).reduce((sum, s) => sum + (s.total_amount || 0), 0)

      return {
        success: true,
        data: data || [],
        summary: `Found ${(data || []).length} sale(s). Total revenue: KSh ${totalRevenue.toLocaleString()}.`,
      }
    },
  },

  {
    name: 'getSaleDetails',
    description: 'Get full details of a specific sale including all items sold',
    parameters: {
      type: 'object',
      properties: {
        sale_id: { type: 'string', description: 'Sale UUID' },
        receipt_number: { type: 'string', description: 'Receipt number (alternative to sale_id)' },
      },
    },
    isWrite: false,
    handler: async (args) => {
      const saleId = args.sale_id as string | undefined
      const receiptNumber = args.receipt_number as string | undefined

      let query = supabaseAdmin
        .from('sales')
        .select(`
          id, receipt_number, total_amount, subtotal, discount_amount,
          payment_method, payment_status, notes,
          created_at,
          customer:customers(id, name, phone),
          branch:branches(id, name),
          cashier:users!sales_cashier_id_fkey(id, full_name),
          items:sale_items(id, product_id, quantity, unit_price, discount_percent, subtotal, products(id, name, sku))
        `)

      if (saleId) query = query.eq('id', saleId)
      else if (receiptNumber) query = query.eq('receipt_number', receiptNumber)
      else return { success: false, error: 'Either sale_id or receipt_number is required' }

      const { data, error } = await query.single()
      logger.error('Operation failed', { error: error })
      if (error) return { success: false, error: 'Operation failed. Please try again.' }
      if (!data) return { success: false, error: 'Sale not found' }

      return {
        success: true,
        data,
        summary: `Sale #${data.receipt_number} — KSh ${data.total_amount} via ${data.payment_method}. ${data.items?.length || 0} item(s). ${data.customer ? `Customer: ${data.customer.name}.` : ''}`,
      }
    },
  },

  {
    name: 'voidSale',
    description: 'Void/cancel a sale transaction. Requires a reason.',
    parameters: {
      type: 'object',
      properties: {
        sale_id: { type: 'string', description: 'Sale UUID to void' },
        reason: { type: 'string', description: 'Reason for voiding the sale' },
      },
      required: ['sale_id', 'reason'],
    },
    isWrite: true,
    handler: async (args, context) => {
      const saleId = args.sale_id as string
      const reason = args.reason as string

      // Delegate to the proper module layer which handles events, inventory, etc.
      const { voidSale } = await import('@/lib/modules/sales')
      const result = await voidSale(saleId, reason, context.userId)

      if (!result.success) return { success: false, error: result.error }

      return {
        success: true,
        summary: `Sale ${saleId} has been voided. Reason: ${reason}`,
      }
    },
  },

  {
    name: 'getSalesSummary',
    description: 'Get a summary of sales for today, this week, or a custom period',
    parameters: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['today', 'yesterday', 'this_week', 'this_month', 'custom'],
          description: 'Time period for the summary',
        },
        date_from: { type: 'string', description: 'Custom start date (YYYY-MM-DD), required if period=custom' },
        date_to: { type: 'string', description: 'Custom end date (YYYY-MM-DD), required if period=custom' },
      },
      required: ['period'],
    },
    isWrite: false,
    handler: async (args, context) => {
      const now = new Date()
      const today = now.toISOString().split('T')[0]
      let fromDate: string
      let toDate: string

      switch (args.period) {
        case 'today':
          fromDate = `${today}T00:00:00`
          toDate = `${today}T23:59:59`
          break
        case 'yesterday': {
          const yesterday = new Date(now)
          yesterday.setDate(yesterday.getDate() - 1)
          const yd = yesterday.toISOString().split('T')[0]
          fromDate = `${yd}T00:00:00`
          toDate = `${yd}T23:59:59`
          break
        }
        case 'this_week': {
          const startOfWeek = new Date(now)
          startOfWeek.setDate(now.getDate() - now.getDay())
          const sw = startOfWeek.toISOString().split('T')[0]
          fromDate = `${sw}T00:00:00`
          toDate = `${today}T23:59:59`
          break
        }
        case 'this_month': {
          const sm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
          fromDate = `${sm}T00:00:00`
          toDate = `${today}T23:59:59`
          break
        }
        case 'custom': {
          if (!args.date_from || !args.date_to) {
            return { success: false, error: 'date_from and date_to are required for custom period' }
          }
          fromDate = `${args.date_from}T00:00:00`
          toDate = `${args.date_to}T23:59:59`
          break
        }
        default:
          return { success: false, error: 'Invalid period' }
      }

      const { data: sales, error } = await supabaseAdmin
        .from('sales')
        .select('id, total_amount, payment_method, payment_status, created_at')
        .gte('created_at', fromDate)
        .lte('created_at', toDate)
        .eq('payment_status', 'completed')

      logger.error('Operation failed', { error: error })
      if (error) return { success: false, error: 'Operation failed. Please try again.' }

      const totalRevenue = (sales || []).reduce((sum, s) => sum + (s.total_amount || 0), 0)
      const transactionCount = (sales || []).length
      const avgOrderValue = transactionCount > 0 ? totalRevenue / transactionCount : 0

      // Payment method breakdown
      const byMethod = new Map<string, { count: number; total: number }>()
      for (const sale of sales || []) {
        const m = sale.payment_method || 'unknown'
        const entry = byMethod.get(m) || { count: 0, total: 0 }
        entry.count++
        entry.total += sale.total_amount || 0
        byMethod.set(m, entry)
      }

      return {
        success: true,
        data: {
          period: args.period,
          fromDate: fromDate.split('T')[0],
          toDate: toDate.split('T')[0],
          totalRevenue,
          transactionCount,
          avgOrderValue: Math.round(avgOrderValue * 100) / 100,
          byMethod: Object.fromEntries(byMethod),
        },
        summary: `${args.period.replace('_', ' ')}: KSh ${totalRevenue.toLocaleString()} revenue from ${transactionCount} transaction(s). Avg: KSh ${Math.round(avgOrderValue).toLocaleString()}.`,
      }
    },
  },
]
