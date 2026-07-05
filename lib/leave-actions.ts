'use server'

import { authenticateServerAction } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

export interface LeaveRequest {
  id: string
  employee_profile_id: string
  employee_name?: string
  employee_photo?: string
  leave_type: string
  start_date: string
  end_date: string
  reason: string | null
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  approved_by: string | null
  approved_by_name?: string | null
  approved_at: string | null
  created_at: string
}

// ─── Apply for leave ───────────────────────────────────────────────────────

export async function applyForLeave(formData: FormData) {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return { error: 'Not authenticated' }

    const leave_type = formData.get('leave_type') as string
    const start_date = formData.get('start_date') as string
    const end_date = formData.get('end_date') as string
    const reason = formData.get('reason') as string

    if (!leave_type || !start_date || !end_date) {
      return { error: 'Leave type, start date, and end date are required' }
    }
    if (new Date(end_date) < new Date(start_date)) {
      return { error: 'End date must be after start date' }
    }

    // Get employee profile for current user
    const { data: profile } = await supabaseAdmin
      .from('employee_profiles')
      .select('id')
      .eq('user_id', auth.profile.id)
      .single()

    if (!profile) return { error: 'No employee profile found. Contact admin.' }

    const { error } = await supabaseAdmin.from('leave_requests').insert({
      employee_profile_id: profile.id,
      leave_type,
      start_date,
      end_date,
      reason: reason || null,
      status: 'pending',
    })

    if (error) return { error: error.message }

    revalidatePath('/leaves')
    revalidatePath('/employees')
    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Failed to apply for leave' }
  }
}

// ─── Approve / Reject leave ────────────────────────────────────────────────

export async function updateLeaveStatus(leaveId: string, status: 'approved' | 'rejected') {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return { error: 'Not authenticated' }

    const { error } = await supabaseAdmin
      .from('leave_requests')
      .update({
        status,
        approved_by: auth.profile.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', leaveId)

    if (error) return { error: error.message }

    revalidatePath('/leaves')
    revalidatePath('/employees')
    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Failed to update leave status' }
  }
}

// ─── Cancel own leave ──────────────────────────────────────────────────────

export async function cancelLeave(leaveId: string) {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return { error: 'Not authenticated' }

    const { error } = await supabaseAdmin
      .from('leave_requests')
      .update({ status: 'cancelled' })
      .eq('id', leaveId)
      .eq('status', 'pending') // only pending leaves can be cancelled

    if (error) return { error: error.message }

    revalidatePath('/leaves')
    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Failed to cancel leave' }
  }
}

// ─── List leaves (with optional filters) ───────────────────────────────────

export async function getLeaves(options?: {
  status?: string
  employeeProfileId?: string
  limit?: number
}) {
  let query = supabaseAdmin
    .from('leave_requests')
    .select(`
      *,
      employee_profile:employee_profiles!inner(
        user_id,
        photo_url,
        employee_id
      ),
      approved_by_user:users!approved_by(full_name)
    `)
    .order('created_at', { ascending: false })

  if (options?.status && options.status !== 'all') {
    query = query.eq('status', options.status)
  }
  if (options?.employeeProfileId) {
    query = query.eq('employee_profile_id', options.employeeProfileId)
  }

  const { data, error } = await query.limit(options?.limit || 100)

  if (error) throw new Error(error.message)

  // Enrich with employee name from users table
  const enriched = await Promise.all(
    (data || []).map(async (lr: any) => {
      let employeeName = 'Unknown'
      let employeePhoto: string | null = null

      if (lr.employee_profile?.user_id) {
        const { data: u } = await supabaseAdmin
          .from('users')
          .select('full_name')
          .eq('id', lr.employee_profile.user_id)
          .single()
        if (u) employeeName = u.full_name
        employeePhoto = lr.employee_profile.photo_url
      }

      return {
        id: lr.id,
        employee_profile_id: lr.employee_profile_id,
        employee_name: employeeName,
        employee_photo: employeePhoto,
        leave_type: lr.leave_type,
        start_date: lr.start_date,
        end_date: lr.end_date,
        reason: lr.reason,
        status: lr.status,
        approved_by: lr.approved_by,
        approved_by_name: lr.approved_by_user?.full_name || null,
        approved_at: lr.approved_at,
        created_at: lr.created_at,
      } as LeaveRequest
    })
  )

  return enriched
}

// ─── Get leave stats ───────────────────────────────────────────────────────

export async function getLeaveStats() {
  const { data, error } = await supabaseAdmin
    .from('leave_requests')
    .select('status, leave_type')

  if (error) throw new Error(error.message)

  const statusBreakdown: Record<string, number> = {}
  const typeBreakdown: Record<string, number> = {}
  let pendingCount = 0

  for (const lr of data || []) {
    statusBreakdown[lr.status] = (statusBreakdown[lr.status] || 0) + 1
    typeBreakdown[lr.leave_type] = (typeBreakdown[lr.leave_type] || 0) + 1
    if (lr.status === 'pending') pendingCount++
  }

  return {
    total: (data || []).length,
    pending: pendingCount,
    approved: statusBreakdown.approved || 0,
    rejected: statusBreakdown.rejected || 0,
    cancelled: statusBreakdown.cancelled || 0,
    status_breakdown: statusBreakdown,
    type_breakdown: typeBreakdown,
  }
}

// ─── Get current user's pending leave ──────────────────────────────────────

export async function getMyPendingLeaves() {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return []

    const { data: profile } = await supabaseAdmin
      .from('employee_profiles')
      .select('id')
      .eq('user_id', auth.profile.id)
      .single()

    if (!profile) return []

    const { data } = await supabaseAdmin
      .from('leave_requests')
      .select('*')
      .eq('employee_profile_id', profile.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    return (data || []) as LeaveRequest[]
  } catch {
    return []
  }
}
