import type { ToolDefinition, ToolContext } from '../types'
import { logger } from '@/lib/logger'
import { supabaseAdmin } from '@/lib/supabase-server'

/**
 * Finance and accounting tools for the AI assistant
 */

export const financeTools: ToolDefinition[] = [
  {
    name: 'getRevenueReport',
    description: 'Get revenue report for a specified period',
    parameters: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['today', 'this_week', 'this_month', 'this_quarter', 'this_year', 'custom'],
          description: 'Time period for the report',
        },
        date_from: { type: 'string', description: 'Custom start date (YYYY-MM-DD), required if period=custom' },
        date_to: { type: 'string', description: 'Custom end date (YYYY-MM-DD), required if period=custom' },
      },
      required: ['period'],
    },
    isWrite: false,
    handler: async (args) => {
      const now = new Date()
      const today = now.toISOString().split('T')[0]
      let fromDate: string
      let toDate = `${today}T23:59:59`

      switch (args.period) {
        case 'today':
          fromDate = `${today}T00:00:00`
          break
        case 'this_week': {
          const startOfWeek = new Date(now)
          startOfWeek.setDate(now.getDate() - now.getDay())
          fromDate = `${startOfWeek.toISOString().split('T')[0]}T00:00:00`
          break
        }
        case 'this_month':
          fromDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01T00:00:00`
          break
        case 'this_quarter': {
          const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
          fromDate = `${qStart.toISOString().split('T')[0]}T00:00:00`
          break
        }
        case 'this_year':
          fromDate = `${now.getFullYear()}-01-01T00:00:00`
          break
        case 'custom':
          if (!args.date_from || !args.date_to) {
            return { success: false, error: 'date_from and date_to required for custom period' }
          }
          fromDate = `${args.date_from}T00:00:00`
          toDate = `${args.date_to}T23:59:59`
          break
        default:
          return { success: false, error: 'Invalid period' }
      }

      const { data: sales, error } = await supabaseAdmin
        .from('sales')
        .select('id, total_amount, payment_method, created_at, subtotal, discount_amount')
        .gte('created_at', fromDate)
        .lte('created_at', toDate)
        .eq('payment_status', 'completed')
        .neq('sale_status', 'returned')

      logger.error('Operation failed', { error: error })
      if (error) return { success: false, error: 'Operation failed. Please try again.' }

      const totalRevenue = (sales || []).reduce((sum, s) => sum + (s.total_amount || 0), 0)
      const totalDiscounts = (sales || []).reduce((sum, s) => sum + (s.discount_amount || 0), 0)
      const transactionCount = (sales || []).length

      // Method breakdown
      const byMethod = new Map<string, number>()
      for (const s of sales || []) {
        const m = s.payment_method || 'unknown'
        byMethod.set(m, (byMethod.get(m) || 0) + (s.total_amount || 0))
      }

      return {
        success: true,
        data: {
          period: args.period,
          fromDate: fromDate.split('T')[0],
          toDate: toDate.split('T')[0],
          totalRevenue,
          totalDiscounts,
          transactionCount,
          byMethod: Object.fromEntries(byMethod),
        },
        summary: `${args.period.replace('_', ' ')} revenue: KSh ${totalRevenue.toLocaleString()} from ${transactionCount} transaction(s). Discounts: KSh ${totalDiscounts.toLocaleString()}.`,
      }
    },
  },

  {
    name: 'getExpenseReport',
    description: 'Get expense summary for a specified period',
    parameters: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['this_month', 'last_month', 'this_quarter', 'this_year', 'custom'],
          description: 'Time period for the report',
        },
        date_from: { type: 'string', description: 'Custom start date (YYYY-MM-DD), required if period=custom' },
        date_to: { type: 'string', description: 'Custom end date (YYYY-MM-DD), required if period=custom' },
      },
      required: ['period'],
    },
    isWrite: false,
    handler: async (args) => {
      const now = new Date()
      const today = now.toISOString().split('T')[0]
      let fromDate: string
      let toDate = `${today}T23:59:59`

      switch (args.period) {
        case 'this_month':
          fromDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01T00:00:00`
          break
        case 'last_month': {
          const firstOfLast = new Date(now.getFullYear(), now.getMonth() - 1, 1)
          fromDate = `${firstOfLast.toISOString().split('T')[0]}T00:00:00`
          const lastOfLast = new Date(now.getFullYear(), now.getMonth(), 0)
          toDate = `${lastOfLast.toISOString().split('T')[0]}T23:59:59`
          break
        }
        case 'this_quarter': {
          const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
          fromDate = `${qStart.toISOString().split('T')[0]}T00:00:00`
          break
        }
        case 'this_year':
          fromDate = `${now.getFullYear()}-01-01T00:00:00`
          break
        case 'custom':
          if (!args.date_from || !args.date_to) {
            return { success: false, error: 'date_from and date_to required for custom period' }
          }
          fromDate = `${args.date_from}T00:00:00`
          toDate = `${args.date_to}T23:59:59`
          break
        default:
          return { success: false, error: 'Invalid period' }
      }

      const { data: expenses, error } = await supabaseAdmin
        .from('expenses')
        .select('id, amount, category, description, created_at')
        .gte('created_at', fromDate)
        .lte('created_at', toDate)

      logger.error('Operation failed', { error: error })
      if (error) return { success: false, error: 'Operation failed. Please try again.' }

      const typedExpenses = (expenses || []) as unknown as Array<{ id: string; amount: number; category: string; description: string; created_at: string }>

      const totalExpenses = typedExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)

      // Category breakdown
      const byCategory = new Map<string, number>()
      for (const e of typedExpenses) {
        const cat = e.category || 'uncategorized'
        byCategory.set(cat, (byCategory.get(cat) || 0) + (e.amount || 0))
      }

      return {
        success: true,
        data: {
          period: args.period,
          fromDate: fromDate.split('T')[0],
          toDate: toDate.split('T')[0],
          totalExpenses,
          expenseCount: typedExpenses.length,
          byCategory: Object.fromEntries(byCategory),
        },
        summary: `${args.period.replace('_', ' ')} expenses: KSh ${totalExpenses.toLocaleString()} across ${typedExpenses.length} entries.`,
      }
    },
  },

  {
    name: 'getAccountBalance',
    description: 'Get current balance for a chart of accounts or bank account',
    parameters: {
      type: 'object',
      properties: {
        account_name: { type: 'string', description: 'Account name or number to look up' },
        account_id: { type: 'string', description: 'Account UUID (alternative to name)' },
      },
    },
    isWrite: false,
    handler: async (args) => {
      const accountName = args.account_name as string | undefined
      const accountId = args.account_id as string | undefined

      if (!accountId && !accountName) return { success: false, error: 'Provide account_name or account_id' }

      const db = supabaseAdmin as unknown as { from: (table: string) => { select: (cols: string) => { eq: (col: string, val: string) => { order: (c: string) => { limit: (n: number) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }> } }; ilike: (col: string, val: string) => { order: (c: string) => { limit: (n: number) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }> } } } } }

      const baseQuery = db.from('chart_of_accounts').select('id, account_number, name, type, normal_balance, balance, description')
      const q = accountId ? baseQuery.eq('id', accountId) : baseQuery.ilike('name', `%${accountName}%`)
      const { data, error } = await q.order('account_number').limit(10)
      logger.error('Operation failed', { error: error })
      if (error) return { success: false, error: 'Operation failed. Please try again.' }

      const results = (data || []) as Array<{ id: string; account_number: string; name: string; type: string; normal_balance: string; balance: number; description: string }>
      if (results.length === 0) return { success: false, error: 'No accounts found' }

      return {
        success: true,
        data: results,
        summary: results.map(a => `${a.name} (${a.account_number}): KSh ${(a.balance || 0).toLocaleString()} ${a.normal_balance}`).join('\n'),
      }
    },
  },
]
