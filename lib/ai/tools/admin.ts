import type { ToolDefinition, ToolContext } from '../types'
import { logger } from '@/lib/logger'
import { supabaseAdmin } from '@/lib/supabase-server'

/**
 * Admin/System management tools for the AI assistant.
 * These are restricted to super_admin and admin roles only.
 */

function isAdmin(context: ToolContext): boolean {
  return context.profile.role === 'super_admin' || context.profile.role === 'admin'
}

export const adminTools: ToolDefinition[] = [
  {
    name: 'createUser',
    description: 'Create a new system user with email, password, role, and branch assignment',
    parameters: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'User email address (used for login)' },
        password: { type: 'string', description: 'Initial password (min 8 characters)' },
        full_name: { type: 'string', description: 'Full display name' },
        role: { type: 'string', enum: ['super_admin', 'admin', 'manager', 'cashier'], description: 'System role' },
        branch_id: { type: 'string', description: 'Assigned branch UUID (null for super_admin)' },
        phone: { type: 'string', description: 'Phone number (optional)' },
      },
      required: ['email', 'password', 'full_name', 'role'],
    },
    isWrite: true,
    handler: async (args, context) => {
      if (!isAdmin(context)) {
        return { success: false, error: 'Admin access required. Only super_admin and admin can create users.' }
      }

      const email = args.email as string
      const password = args.password as string
      const fullName = args.full_name as string
      const role = args.role as 'super_admin' | 'admin' | 'manager' | 'cashier'
      const branchId = (args.branch_id as string) || null

      const { createUser } = await import('@/lib/user-management')
      try {
        const result = await createUser(
          context.profile.role,
          email,
          fullName,
          role,
          branchId,
          password
        )
        return {
          success: true,
          data: result.user,
          summary: `User "${fullName}" (${email}) created with role "${role}".`,
        }
      } catch (error) {
        logger.error('Operation failed', { error: error })
        return {
          success: false,
          error: 'Operation failed. Please try again.',
        }
      }
    },
  },

  {
    name: 'assignRole',
    description: 'Change a user\'s role in the system',
    parameters: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'User UUID' },
        new_role: { type: 'string', enum: ['super_admin', 'admin', 'manager', 'cashier'], description: 'New role to assign' },
      },
      required: ['user_id', 'new_role'],
    },
    isWrite: true,
    handler: async (args, context) => {
      if (!isAdmin(context)) {
        return { success: false, error: 'Admin access required. Only admins can change roles.' }
      }

      const userId = args.user_id as string
      const newRole = args.new_role as string

      // Prevent changing own role
      if (userId === context.userId) {
        return { success: false, error: 'You cannot change your own role. Ask another admin to do this.' }
      }

      const { error } = await supabaseAdmin
        .from('users')
        .update({ role: newRole })
        .eq('id', userId)

      logger.error('Operation failed', { error: error })
      if (error) return { success: false, error: 'Operation failed. Please try again.' }

      return {
        success: true,
        summary: `User role updated to "${newRole}".`,
      }
    },
  },

  {
    name: 'getBranchDetails',
    description: 'Get details and summary stats for a branch',
    parameters: {
      type: 'object',
      properties: {
        branch_id: { type: 'string', description: 'Branch UUID (defaults to current branch)' },
        name: { type: 'string', description: 'Branch name to search (alternative to branch_id)' },
      },
    },
    isWrite: false,
    handler: async (args, context) => {
      let branchId = args.branch_id as string | undefined

      if (!branchId && args.name) {
        const { data } = await supabaseAdmin
          .from('branches')
          .select('id')
          .ilike('name', args.name as string)
          .maybeSingle()
        if (data) branchId = data.id
        else return { success: false, error: `Branch "${args.name}" not found` }
      }

      if (!branchId) branchId = context.branchId
      if (!branchId) return { success: false, error: 'No branch specified or found for your profile' }

      const { data: branchRaw, error } = await supabaseAdmin
        .from('branches')
        .select('id, name, code, phone, email, created_at, manager_id')
        .eq('id', branchId)
        .single()

      logger.error('Operation failed', { error: error })
      if (error) return { success: false, error: 'Operation failed. Please try again.' }
      const branch = branchRaw as unknown as Record<string, unknown>

      // Get summary stats
      const today = new Date().toISOString().split('T')[0]
      const [salesToday, productCount, employeeCount] = await Promise.all([
        supabaseAdmin
          .from('sales')
          .select('total_amount')
          .eq('branch_id', branchId)
          .gte('created_at', `${today}T00:00:00`)
          .eq('payment_status', 'completed'),
        supabaseAdmin
          .from('inventory')
          .select('product_id', { count: 'exact', head: true })
          .eq('branch_id', branchId),
        supabaseAdmin
          .from('employee_profiles')
          .select('id', { count: 'exact', head: true }),
      ])

      const todayRevenue = (salesToday.data || []).reduce((s: number, r: Record<string, unknown>) => s + ((r.total_amount as number) || 0), 0)

      const employeeProfiles = employeeCount as unknown as { count?: number }
      const inventoryCount = productCount as unknown as { count?: number }

      return {
        success: true,
        data: {
          ...branch,
          todayRevenue: Math.round(todayRevenue),
          productCount: inventoryCount.count || 0,
          employeeCount: employeeProfiles.count || 0,
        },
        summary: `${branch.name} — KSh ${Math.round(todayRevenue).toLocaleString()} today, ${inventoryCount.count || 0} products, ${employeeProfiles.count || 0} employees.`,
      }
    },
  },

  {
    name: 'getSystemAuditLog',
    description: 'Search the system audit log for recent activity',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'Filter by action type (e.g. user.create, sale.void, product.update)' },
        user_id: { type: 'string', description: 'Filter by user who performed the action' },
        date_from: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        date_to: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        limit: { type: 'number', description: 'Maximum results (default 20)' },
      },
    },
    isWrite: false,
    handler: async (args, context) => {
      if (!isAdmin(context)) {
        return { success: false, error: 'Admin access required to view audit logs.' }
      }

      const limit = (args.limit as number) || 20

      // Try system_audit_log first, fall back to audit_log
      let query = supabaseAdmin
        .from('system_audit_log')
        .select('id, action, entity_type, entity_id, user_id, details, created_at')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (args.action) query = query.eq('action', args.action as string)
      if (args.user_id) query = query.eq('user_id', args.user_id as string)
      if (args.date_from) query = query.gte('created_at', `${args.date_from}T00:00:00`)
      if (args.date_to) query = query.lte('created_at', `${args.date_to}T23:59:59`)

      let { data, error } = await query

      // Fallback to audit_log table
      if (error) {
        const result = await supabaseAdmin
          .from('audit_log')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit)

        const fallbackData = (result.data || []) as unknown as Array<Record<string, unknown>>
        data = fallbackData.map((r) => ({
          id: r.id,
          action: r.action,
          entity_type: r.table_name || r.entity_type,
          entity_id: r.record_id || r.entity_id,
          user_id: r.actor_id || r.user_id,
          created_at: r.created_at,
          details: r.description || r.details,
        })) as typeof data
        error = result.error
      }

      logger.error('Operation failed', { error: error })
      if (error && !data) return { success: false, error: 'Operation failed. Please try again.' }

      return {
        success: true,
        data: data || [],
        summary: `Found ${(data || []).length} audit log entr${(data || []).length === 1 ? 'y' : 'ies'}.`,
      }
    },
  },

  {
    name: 'listBranches',
    description: 'List all branches in the system',
    parameters: {
      type: 'object',
      properties: {
        include_inactive: { type: 'boolean', description: 'Include inactive branches (default false)' },
      },
    },
    isWrite: false,
    handler: async (args) => {
      let query = supabaseAdmin
        .from('branches')
        .select('id, name, code, address, phone, is_active, created_at')

      if (!args.include_inactive) {
        query = query.eq('status', 'active')
      }

      const { data, error } = await query.order('name')
      logger.error('Operation failed', { error: error })
      if (error) return { success: false, error: 'Operation failed. Please try again.' }

      return {
        success: true,
        data: data || [],
        summary: `${(data || []).length} branch(es) found.`,
      }
    },
  },
]
