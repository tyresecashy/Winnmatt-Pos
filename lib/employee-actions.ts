'use server'

import { authenticateServerAction } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

export interface EmployeeProfile {
  id: string
  user_id: string
  employee_id: string | null
  staff_number: string | null
  national_id: string | null
  kra_pin: string | null
  nhif_number: string | null
  nssf_number: string | null
  department_id: string | null
  position: string | null
  hire_date: string | null
  employment_type: string
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  emergency_contact_relation: string | null
  photo_url: string | null
  digital_signature_url: string | null
  employment_status: string
  created_at: string
  updated_at: string
  user?: {
    id: string
    full_name: string
    email: string
    role: string
    branch_id: string
    branch?: { id: string; name: string; code: string } | null
  } | null
  department?: { id: string; name: string } | null
}

interface EmployeeWithUser extends EmployeeProfile {
  user: NonNullable<EmployeeProfile['user']>
}

export async function getEmployees(branchId?: string): Promise<EmployeeProfile[]> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return []

    let query = supabaseAdmin
      .from('employee_profiles')
      .select(`
        *,
        user:users!user_id(id, full_name, email, role, branch_id, branch:branches!branch_id(id, name, code)),
        department:departments(id, name)
      `)

    if (branchId) {
      query = query.eq('user.branch_id', branchId)
    }

    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) throw error
    return (data || []) as unknown as EmployeeProfile[]
  } catch (error) {
    logger.error('Error fetching employees:', error)
    return []
  }
}

export async function getEmployeeById(id: string) {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return null

    const { data, error } = await supabaseAdmin
      .from('employee_profiles')
      .select(`
        *,
        user:users!user_id(id, full_name, email, role, branch_id, branch:branches!branch_id(id, name, code)),
        department:departments(id, name),
        goals:employee_goals(*),
        documents:employee_documents(*)
      `)
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  } catch (error) {
    logger.error('Error fetching employee:', error)
    return null
  }
}

export async function createEmployeeProfile(data: {
  user_id: string
  employee_id?: string
  staff_number?: string
  national_id?: string
  kra_pin?: string
  nhif_number?: string
  nssf_number?: string
  department_id?: string
  position?: string
  hire_date?: string
  employment_type?: string
  emergency_contact_name?: string
  emergency_contact_phone?: string
  emergency_contact_relation?: string
}) {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile || !['super_admin', 'admin'].includes(auth.profile.role)) {
      return { success: false, error: 'Unauthorized' }
    }

    // Auto-generate employee_id if not provided
    const empId = data.employee_id || `EMP-${Date.now().toString().slice(-6)}`

    const { data: result, error } = await supabaseAdmin
      .from('employee_profiles')
      .insert({ ...data, employee_id: empId })
      .select()
      .single()

    if (error) throw new Error(error.message)

    // Audit log
    await supabaseAdmin.from('system_audit_log').insert({
      user_id: auth.profile.id,
      branch_id: auth.profile.branch_id,
      action: 'employee_created',
      entity_type: 'employee_profile',
      entity_id: result.id,
      details: { employee_id: empId, user_id: data.user_id },
    })

    return { success: true, data: result }
  } catch (error) {
    logger.error('Error creating employee:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create employee' }
  }
}

export async function updateEmployeeProfile(
  id: string,
  data: Partial<{
    employee_id: string
    staff_number: string
    national_id: string
    kra_pin: string
    nhif_number: string
    nssf_number: string
    department_id: string
    position: string
    hire_date: string
    employment_type: string
    employment_status: string
    emergency_contact_name: string
    emergency_contact_phone: string
    emergency_contact_relation: string
    photo_url: string
    digital_signature_url: string
  }>
) {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile || !['super_admin', 'admin'].includes(auth.profile.role)) {
      return { success: false, error: 'Unauthorized' }
    }

    const { data: result, error } = await supabaseAdmin
      .from('employee_profiles')
      .update(data)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(error.message)

    await supabaseAdmin.from('system_audit_log').insert({
      user_id: auth.profile.id,
      branch_id: auth.profile.branch_id,
      action: 'employee_updated',
      entity_type: 'employee_profile',
      entity_id: id,
      details: { updated_fields: Object.keys(data) },
    })

    return { success: true, data: result }
  } catch (error) {
    logger.error('Error updating employee:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update employee' }
  }
}

export async function getDepartments(branchId?: string) {
  try {
    let query = supabaseAdmin.from('departments').select('*')
    if (branchId) query = query.eq('branch_id', branchId)
    const { data, error } = await query.order('name')
    if (error) throw error
    return data || []
  } catch (error) {
    logger.error('Error fetching departments:', error)
    return []
  }
}

export async function getEmployeeStats(employeeProfileId: string) {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return null

    const { data: profile, error: pError } = await supabaseAdmin
      .from('employee_profiles')
      .select('user_id')
      .eq('id', employeeProfileId)
      .single()

    if (pError || !profile) return null
    const userId = profile.user_id

    // Get today's sales for this user
    const today = new Date().toISOString().split('T')[0]

    const { data: todaySales } = await supabaseAdmin
      .from('sales')
      .select('total_amount, id')
      .eq('cashier_id', userId)
      .gte('created_at', today)
      .lte('created_at', `${today}T23:59:59.999Z`)

    // Get current month sales
    const monthStart = new Date()
    monthStart.setDate(1)
    const monthStartStr = monthStart.toISOString().split('T')[0]

    const { data: monthSales } = await supabaseAdmin
      .from('sales')
      .select('total_amount, id, sale_status')
      .eq('cashier_id', userId)
      .gte('created_at', `${monthStartStr}T00:00:00.000Z`)

    const totalMonthSales = monthSales?.reduce((sum, s) => sum + (s.total_amount || 0), 0) || 0
    const refundCount = monthSales?.filter(s => s.sale_status === 'returned').length || 0
    const voidCount = monthSales?.filter(s => s.sale_status === 'voided').length || 0

    // Get attendance for today
    const { data: todayClock } = await supabaseAdmin
      .from('clock_events')
      .select('*')
      .eq('user_id', userId)
      .gte('timestamp', today)

    const clockedIn = todayClock?.some(e => e.event_type === 'clock_in') || false
    const onBreak = todayClock?.some(e => e.event_type === 'break_start') &&
      !todayClock?.some(e => e.event_type === 'break_end' && (e.created_at > todayClock.filter(ev => ev.event_type === 'break_start').pop()?.created_at || ''))

    return {
      todaySalesCount: todaySales?.length || 0,
      todaySalesTotal: todaySales?.reduce((sum, s) => sum + (s.total_amount || 0), 0) || 0,
      monthSalesCount: monthSales?.length || 0,
      monthSalesTotal: totalMonthSales,
      refundCount,
      voidCount,
      clockedIn,
      onBreak,
    }
  } catch (error) {
    logger.error('Error fetching employee stats:', error)
    return null
  }
}

// ─── Document Management ──────────────────────────────────────────────────

export async function addEmployeeDocument(data: {
  employee_profile_id: string
  document_type: string
  document_name: string
  file_url?: string
}) {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return { success: false, error: 'Unauthorized' }

    const { data: result, error } = await supabaseAdmin
      .from('employee_documents')
      .insert({
        employee_profile_id: data.employee_profile_id,
        document_type: data.document_type,
        document_name: data.document_name,
        file_url: data.file_url || null,
        uploaded_by: auth.profile.id,
      })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to add document' }
  }
}

export async function deleteEmployeeDocument(documentId: string) {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return { success: false, error: 'Unauthorized' }

    const { error } = await supabaseAdmin
      .from('employee_documents')
      .delete()
      .eq('id', documentId)

    if (error) throw new Error(error.message)
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to delete document' }
  }
}

// ─── Goal Management ───────────────────────────────────────────────────────

export async function addEmployeeGoal(data: {
  employee_profile_id: string
  title: string
  description?: string
  target_value?: number
  metric?: string
  start_date?: string
  end_date?: string
}) {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return { success: false, error: 'Unauthorized' }

    const { data: result, error } = await supabaseAdmin
      .from('employee_goals')
      .insert({
        employee_profile_id: data.employee_profile_id,
        title: data.title,
        description: data.description || null,
        target_value: data.target_value || null,
        metric: data.metric || 'sales_count',
        start_date: data.start_date || null,
        end_date: data.end_date || null,
      })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to add goal' }
  }
}

export async function updateGoalProgress(goalId: string, currentValue: number) {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return { success: false, error: 'Unauthorized' }

    const { data: goal } = await supabaseAdmin
      .from('employee_goals')
      .select('target_value, status')
      .eq('id', goalId)
      .single()

    const newStatus = goal?.target_value && currentValue >= goal.target_value ? 'completed' : 'active'

    const { error } = await supabaseAdmin
      .from('employee_goals')
      .update({ current_value: currentValue, status: newStatus })
      .eq('id', goalId)

    if (error) throw new Error(error.message)
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update goal' }
  }
}

export async function deleteGoal(goalId: string) {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return { success: false, error: 'Unauthorized' }

    const { error } = await supabaseAdmin
      .from('employee_goals')
      .delete()
      .eq('id', goalId)

    if (error) throw new Error(error.message)
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to delete goal' }
  }
}
