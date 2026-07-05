'use server'

import { authenticateServerAction } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

export async function getRegisters(branchId?: string) {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return []

    let query = supabaseAdmin.from('registers').select(`
      *,
      branch:branches!branch_id(id, name, code),
      current_cashier:users!current_cashier_id(id, full_name)
    `)

    if (branchId) query = query.eq('branch_id', branchId)
    const { data, error } = await query.order('register_name')
    if (error) throw error
    return data || []
  } catch (error) {
    logger.error('Error fetching registers:', error)
    return []
  }
}

export async function createRegister(data: {
  register_name: string
  branch_id: string
  serial_number?: string
  register_type?: string
}) {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile || !['super_admin', 'admin'].includes(auth.profile.role)) {
      return { success: false, error: 'Unauthorized' }
    }

    const { data: result, error } = await supabaseAdmin
      .from('registers')
      .insert(data)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create register' }
  }
}

export async function updateRegister(id: string, data: Record<string, unknown>) {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile || !['super_admin', 'admin'].includes(auth.profile.role)) {
      return { success: false, error: 'Unauthorized' }
    }

    const { error } = await supabaseAdmin.from('registers').update(data).eq('id', id)
    if (error) throw new Error(error.message)
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update register' }
  }
}

export async function getCashDrawers(branchId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('cash_drawers')
      .select(`
        *,
        register:registers!cash_drawers_register_id_fkey(id, register_name, status)
      `)
      .eq('branch_id', branchId)
      .order('drawer_name')

    if (error) throw error
    return data || []
  } catch (error) {
    logger.error('Error fetching cash drawers:', error)
    return []
  }
}

export async function createCashDrawer(data: {
  drawer_name: string
  branch_id: string
  register_id?: string
}) {
  try {
    const { data: result, error } = await supabaseAdmin
      .from('cash_drawers')
      .insert(data)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create drawer' }
  }
}

export async function getCashEvents(
  branchId: string,
  opts?: { drawerId?: string; limit?: number; eventType?: string }
) {
  try {
    let query = supabaseAdmin
      .from('cash_events')
      .select(`
        *,
        performer:users!performed_by(id, full_name),
        approver:users!approved_by(id, full_name)
      `)
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })
      .limit(opts?.limit || 50)

    if (opts?.drawerId) query = query.eq('drawer_id', opts.drawerId)
    if (opts?.eventType) query = query.eq('event_type', opts.eventType)

    const { data, error } = await query
    if (error) throw error
    return data || []
  } catch (error) {
    logger.error('Error fetching cash events:', error)
    return []
  }
}

export async function recordCashEvent(data: {
  register_id?: string
  drawer_id?: string
  branch_id: string
  event_type: string
  amount: number
  balance_before?: number
  balance_after?: number
  reference_type?: string
  reference_id?: string
  reason: string
  performed_by: string
  notes?: string
}) {
  try {
    const { data: result, error } = await supabaseAdmin
      .from('cash_events')
      .insert(data)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to record event' }
  }
}

export async function getCashSummary(branchId: string) {
  try {
    const today = new Date().toISOString().split('T')[0]

    const { data: todayEvents } = await supabaseAdmin
      .from('cash_events')
      .select('event_type, amount')
      .eq('branch_id', branchId)
      .gte('created_at', `${today}T00:00:00.000Z`)

    const { data: drawers } = await supabaseAdmin
      .from('cash_drawers')
      .select('*')
      .eq('branch_id', branchId)

    const totalCashIn = todayEvents?.filter(e => ['cash_sale', 'paid_in', 'opening_float'].includes(e.event_type))
      .reduce((s, e) => s + Math.abs(e.amount), 0) || 0
    const totalCashOut = todayEvents?.filter(e => ['cash_refund', 'paid_out', 'safe_drop', 'cash_pickup'].includes(e.event_type))
      .reduce((s, e) => s + Math.abs(e.amount), 0) || 0
    const openDrawers = drawers?.filter(d => d.status === 'open').length || 0
    const totalVariance = drawers?.reduce((s, d) => s + (d.last_variance || 0), 0) || 0

    return {
      totalCashIn,
      totalCashOut,
      netCash: totalCashIn - totalCashOut,
      openDrawers,
      totalDrawers: drawers?.length || 0,
      totalVariance,
      eventCount: todayEvents?.length || 0,
    }
  } catch (error) {
    logger.error('Error fetching cash summary:', error)
    return null
  }
}
