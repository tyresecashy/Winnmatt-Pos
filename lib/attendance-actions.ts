'use server'

import { authenticateServerAction } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

export async function clockEvent(data: {
  user_id: string
  branch_id: string
  event_type: 'clock_in' | 'clock_out' | 'break_start' | 'break_end'
  method?: string
  notes?: string
}) {
  try {
    const { data: result, error } = await supabaseAdmin
      .from('clock_events')
      .insert({
        user_id: data.user_id,
        branch_id: data.branch_id,
        event_type: data.event_type,
        method: data.method || 'manual',
        notes: data.notes || null,
      })
      .select()
      .single()

    if (error) {
      if (error) logger.error('Operation failed', { error: error })
      throw new Error('Operation failed')
    }
    return { success: true, data: result }
  } catch (error) {
    logger.error('Operation failed', { error: error })
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function getTodayClockEvents(userId: string) {
  try {
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabaseAdmin
      .from('clock_events')
      .select('*')
      .eq('user_id', userId)
      .gte('timestamp', `${today}T00:00:00.000Z`)
      .order('timestamp', { ascending: true })

    if (error) throw error
    return data || []
  } catch (error) {
    logger.error('Error fetching clock events:', error)
    return []
  }
}

export async function getAttendanceReport(branchId: string, date?: string) {
  try {
    const targetDate = date || new Date().toISOString().split('T')[0]

    const { data, error } = await supabaseAdmin
      .from('clock_events')
      .select(`
        *,
        user:users!user_id(id, full_name, role)
      `)
      .eq('branch_id', branchId)
      .gte('timestamp', `${targetDate}T00:00:00.000Z`)
      .lte('timestamp', `${targetDate}T23:59:59.999Z`)
      .order('timestamp')

    if (error) throw error

    // Group by user
    const grouped: Record<string, { user: Record<string, unknown>; events: Record<string, unknown>[] }> = {}
    for (const event of data || []) {
      const uid = event.user_id
      if (!grouped[uid]) {
        grouped[uid] = { user: event.user, events: [] }
      }
      grouped[uid].events.push(event)
    }

    // Compute status per user
    const report = Object.entries(grouped).map(([userId, info]) => {
      const events = info.events
      const hasClockIn = events.some(e => e.event_type === 'clock_in')
      const hasClockOut = events.some(e => e.event_type === 'clock_out')
      const breakStarts = events.filter(e => e.event_type === 'break_start').length
      const breakEnds = events.filter(e => e.event_type === 'break_end').length

      let status = 'absent'
      if (hasClockIn && hasClockOut) status = 'completed'
      else if (hasClockIn) status = 'on_shift'
      if (breakStarts > breakEnds) status = 'on_break'

      return {
        userId,
        user: info.user,
        status,
        events,
        totalBreaks: Math.min(breakStarts, breakEnds),
      }
    })

    return report
  } catch (error) {
    logger.error('Error fetching attendance:', error)
    return []
  }
}

export async function getShiftTemplates(branchId?: string) {
  try {
    let query = supabaseAdmin.from('shift_templates').select('*')
    if (branchId) query = query.eq('branch_id', branchId)
    const { data, error } = await query.order('name')
    if (error) throw error
    return data || []
  } catch (error) {
    logger.error('Error fetching shift templates:', error)
    return []
  }
}

/**
 * Create an employee schedule record.
 * This bridges the legacy employee_schedules system with the attendance display.
 * Note: Future consolidation will migrate to worker_shifts.
 */
export async function addEmployeeSchedule(data: {
  employee_profile_id: string
  branch_id: string
  date: string
  start_time: string
  end_time: string
}) {
  try {
    const { error } = await supabaseAdmin
      .from('employee_schedules')
      .insert({
        employee_profile_id: data.employee_profile_id,
        branch_id: data.branch_id,
        date: data.date,
        start_time: data.start_time,
        end_time: data.end_time,
      })

    if (error) throw error
    return { success: true }
  } catch (error) {
    logger.error('[Attendance] Failed to add schedule:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function getEmployeeSchedules(
  branchId: string,
  startDate: string,
  endDate: string
) {
  try {
    const { data, error } = await supabaseAdmin
      .from('employee_schedules')
      .select(`
        *,
        employee:employee_profiles!employee_profile_id(
          id, employee_id,
          user:users!user_id(id, full_name)
        ),
        shift_template:shift_templates(id, name, start_time, end_time)
      `)
      .eq('branch_id', branchId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date')
      .order('start_time')

    if (error) throw error
    return data || []
  } catch (error) {
    logger.error('Error fetching schedules:', error)
    return []
  }
}
