import type { ToolDefinition, ToolContext } from '../types'
import { logger } from '@/lib/logger'
import { supabaseAdmin } from '@/lib/supabase-server'

/**
 * Employee management tools for the AI assistant
 */

export const employeeTools: ToolDefinition[] = [
  {
    name: 'searchEmployees',
    description: 'Search for employees by name, staff number, or department',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term to match against employee name, staff number, or email' },
        limit: { type: 'number', description: 'Maximum results (default 20)' },
      },
      required: ['query'],
    },
    isWrite: false,
    handler: async (args, context) => {
      const query = args.query as string
      const limit = (args.limit as number) || 20

      const { data, error } = await supabaseAdmin
        .from('employee_profiles')
        .select(`
          id, employee_id, staff_number, national_id,
          user:users!employee_profiles_user_id_fkey(id, full_name, email, phone, role)
        `)
        .or(
          `user.full_name.ilike.%${query}%,employee_id.ilike.%${query}%,staff_number.ilike.%${query}%`
        )
        .limit(limit)

      logger.error('Operation failed', { error: error })
      if (error) return { success: false, error: 'Operation failed. Please try again.' }

      const results = (data || []).map((e: Record<string, unknown>) => {
        const u = e.user as Record<string, unknown> | null
        return {
          id: e.id,
          employeeId: e.employee_id,
          staffNumber: e.staff_number,
          name: u?.full_name || 'Unknown',
          email: u?.email || '',
          role: u?.role || '',
        }
      })

      return {
        success: true,
        data: results,
        summary: `Found ${results.length} employee(s) matching "${query}".`,
      }
    },
  },

  {
    name: 'getEmployeePerformance',
    description: 'Get performance metrics for an employee (sales, tasks, attendance)',
    parameters: {
      type: 'object',
      properties: {
        employee_id: { type: 'string', description: 'Employee profile UUID' },
        period: { type: 'string', enum: ['this_month', 'last_month', 'this_quarter'], description: 'Analysis period' },
      },
      required: ['employee_id'],
    },
    isWrite: false,
    handler: async (args) => {
      const employeeId = args.employee_id as string
      const period = (args.period as string) || 'this_month'

      const now = new Date()
      let fromDate: string
      switch (period) {
        case 'this_month': {
          const sm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
          fromDate = `${sm}T00:00:00`
          break
        }
        case 'last_month': {
          const firstOfLast = new Date(now.getFullYear(), now.getMonth() - 1, 1)
          const fl = firstOfLast.toISOString().split('T')[0]
          fromDate = `${fl}T00:00:00`
          break
        }
        case 'this_quarter': {
          const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
          const qs = qStart.toISOString().split('T')[0]
          fromDate = `${qs}T00:00:00`
          break
        }
        default:
          fromDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01T00:00:00`
      }

      // Get employee info
      const { data: emp } = await supabaseAdmin
        .from('employee_profiles')
        .select('id, employee_id, user:users!employee_profiles_user_id_fkey(id, full_name)')
        .eq('id', employeeId)
        .single()

      if (!emp) return { success: false, error: 'Employee not found' }

      const userId = (emp.user as Record<string, unknown>)?.id as string
      const empName = (emp.user as Record<string, unknown>)?.full_name || 'Employee'

      // Get sales made by this user
      const { data: sales } = await supabaseAdmin
        .from('sales')
        .select('id, total_amount, created_at')
        .eq('cashier_id', userId)
        .gte('created_at', fromDate)

      const totalSales = (sales || []).reduce((sum, s) => sum + (s.total_amount || 0), 0)
      const saleCount = (sales || []).length

      // Get task completion
      const { count: tasksCompleted } = await supabaseAdmin
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', userId)
        .eq('status', 'completed')
        .gte('updated_at', fromDate)

      return {
        success: true,
        data: {
          employee: empName,
          period,
          totalSales: Math.round(totalSales),
          transactionCount: saleCount,
          tasksCompleted: tasksCompleted || 0,
        },
        summary: `${empName} — KSh ${Math.round(totalSales).toLocaleString()} in sales (${saleCount} transactions), ${tasksCompleted || 0} tasks completed this ${period.replace('_', ' ')}.`,
      }
    },
  },
]
