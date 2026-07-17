'use server'

import { authenticateServerAction } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

export async function getSystemHealth() {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return null

    // Database health
    const { count: userCount } = await supabaseAdmin
      .from('users').select('*', { count: 'exact', head: true })

    const { count: saleCount } = await supabaseAdmin
      .from('sales').select('*', { count: 'exact', head: true })

    const { count: productCount } = await supabaseAdmin
      .from('products').select('*', { count: 'exact', head: true })

    // Offline registers
    const { data: registers } = await supabaseAdmin
      .from('registers').select('id, status, health_score, battery_level, last_login')

    const offlineRegisters = registers?.filter(r => r.status === 'offline').length || 0
    const onlineRegisters = registers?.filter(r => r.status === 'online').length || 0

    // Pending sync items (check for transactions without sync)
    const today = new Date().toISOString().split('T')[0]
    const { data: todaySales } = await supabaseAdmin
      .from('sales')
      .select('id, total_amount, created_at')
      .eq('payment_status', 'completed')
      .neq('sale_status', 'returned')
      .gte('created_at', `${today}T00:00:00.000Z`)

    // Error rate (last 24h from audit log)
    const yesterday = new Date(Date.now() - 86400000).toISOString()
    const { data: recentErrors } = await supabaseAdmin
      .from('system_audit_log')
      .select('id')
      .gte('created_at', yesterday)
      .eq('severity', 'error')

    const { data: recentWarnings } = await supabaseAdmin
      .from('system_audit_log')
      .select('id')
      .gte('created_at', yesterday)
      .eq('severity', 'warning')

    // Average sale time (last 50 sales)
    const { data: recentSales } = await supabaseAdmin
      .from('sales')
      .select('created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(50)

    let avgCheckoutTime = 0
    if (recentSales && recentSales.length > 0) {
      const times = recentSales.map(s => {
        if (!s.updated_at || !s.created_at) return NaN
        return (new Date(s.updated_at).getTime() - new Date(s.created_at).getTime()) / 1000
      }).filter(t => t > 0 && t < 3600) // filter outliers
      avgCheckoutTime = times.length > 0
        ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
        : 0
    }

    return {
      database: {
        users: userCount || 0,
        sales: saleCount || 0,
        products: productCount || 0,
      },
      registers: {
        total: registers?.length || 0,
        online: onlineRegisters,
        offline: offlineRegisters,
      },
      today: {
        sales: todaySales?.length || 0,
        revenue: todaySales?.reduce((s, r) => s + (r.total_amount || 0), 0) || 0,
      },
      errors: {
        last24h: recentErrors?.length || 0,
        warnings24h: recentWarnings?.length || 0,
      },
      performance: {
        avgCheckoutTimeSeconds: avgCheckoutTime,
      },
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    logger.error('Error fetching system health:', error)
    return null
  }
}

export async function getSystemAuditLog(limit = 100) {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile || !['super_admin', 'admin'].includes(auth.profile.role)) return []

    const { data, error } = await supabaseAdmin
      .from('system_audit_log')
      .select(`
        *,
        user:users!user_id(id, full_name, role),
        branch:branches!branch_id(id, name)
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  } catch (error) {
    logger.error('Error fetching audit log:', error)
    return []
  }
}

export async function getLaunchReadiness(branchId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('launch_checklists')
      .select('*')
      .eq('branch_id', branchId)
      .single()

    if (error && error.code !== 'PGRST116') throw error

    if (!data) {
      // Return default checklist
      return {
        branch_id: branchId,
        status: 'incomplete',
        items: {
          products_imported: false,
          taxes_configured: false,
          users_assigned: false,
          receipt_printer_connected: false,
          barcode_scanner_tested: false,
          cash_drawer_tested: false,
          payment_methods_enabled: false,
          backup_verified: false,
          branch_hours_set: false,
          loyalty_rules_configured: false,
          first_float_prepared: false,
          register_configured: false,
          internet_health_check: false,
        },
      }
    }

    return data
  } catch (error) {
    logger.error('Error fetching launch readiness:', error)
    return null
  }
}

export async function updateLaunchChecklistItem(
  branchId: string,
  itemKey: string,
  value: boolean
) {
  try {
    const existing = await getLaunchReadiness(branchId)
    if (!existing) return { success: false, error: 'Not found' }

    const items = { ...(existing as { items: Record<string, boolean> }).items, [itemKey]: value }
    const allPassed = Object.values(items).every(Boolean)
    const status = allPassed ? 'passed' : 'in_progress'

    const { error } = await supabaseAdmin.from('launch_checklists').upsert({
      branch_id: branchId,
      status,
      items,
      last_checked_at: new Date().toISOString(),
    })

    if (error) {
      if (error) logger.error('Operation failed', { error: error })
      throw new Error('Operation failed')
    }
    return { success: true, status }
  } catch (error) {
    logger.error('Operation failed', { error: error })
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}
