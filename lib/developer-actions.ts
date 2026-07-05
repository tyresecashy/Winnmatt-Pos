'use server'

import { createClient } from '@supabase/supabase-js'
import { authenticateServerAction } from './auth-helpers'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Get real record counts for all major tables in the database.
 */
export async function getDatabaseTableCounts() {
  await authenticateServerAction()

  const tables = [
    'users', 'branches', 'products', 'categories', 'customers',
    'sales', 'sale_items', 'inventory', 'suppliers', 'purchases',
    'purchase_items', 'cash_registers', 'cash_drawers', 'cash_events',
    'notifications', 'notification_rules', 'expenses', 'expense_categories',
    'employee_profiles', 'attendance_events', 'leave_requests',
    'credit_payments', 'invoices', 'invoice_items',
    'loyalty_accounts', 'loyalty_transactions',
    'promotions', 'returns', 'return_items',
  ]

  const counts: Array<{ table: string; count: number }> = []

  for (const table of tables) {
    try {
      const { count, error } = await supabaseAdmin
        .from(table)
        .select('*', { count: 'exact', head: true })

      if (!error) {
        counts.push({ table, count: count ?? 0 })
      }
    } catch {
      // Skip tables that don't exist
    }
  }

  return counts.filter(c => c.count > 0).sort((a, b) => b.count - a.count)
}

/**
 * Get system health summary: total records, active users, recent sales.
 */
export async function getSystemHealth() {
  await authenticateServerAction()

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [totalProducts, totalCustomers, totalSales, todaySales, activeUsers] = await Promise.all([
    supabaseAdmin.from('products').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('customers').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('sales').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('sales').select('*', { count: 'exact', head: true }).gte('created_at', todayStart),
    supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).eq('status', 'active'),
  ])

  return {
    totalProducts: totalProducts.count ?? 0,
    totalCustomers: totalCustomers.count ?? 0,
    totalSales: totalSales.count ?? 0,
    todaySales: todaySales.count ?? 0,
    activeUsers: activeUsers.count ?? 0,
  }
}
