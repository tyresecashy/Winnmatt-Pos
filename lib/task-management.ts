'use server'

import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

// ─── Types ──────────────────────────────────────────────────────────────────

export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent'
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'overdue' | 'blocked'
export type TaskRecurrence = 'none' | 'daily' | 'weekly' | 'monthly'

export interface WorkerRole {
  id: string
  name: string
  code: string
  description: string | null
  department: string | null
  color: string
  icon: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface TaskCategory {
  id: string
  name: string
  code: string
  description: string | null
  department: string | null
  color: string
  icon: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface TaskTemplate {
  id: string
  category_id: string
  name: string
  description: string | null
  instructions: string | null
  estimated_minutes: number | null
  priority: TaskPriority
  recurrence: TaskRecurrence
  recurrence_days: number[] | null
  requires_photo: boolean
  requires_signature: boolean
  applicable_roles: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  template_id: string | null
  category_id: string | null
  title: string
  description: string | null
  instructions: string | null
  branch_id: string
  assigned_to: string | null
  assigned_by: string | null
  status: TaskStatus
  priority: TaskPriority
  due_date: string | null
  started_at: string | null
  completed_at: string | null
  estimated_minutes: number | null
  actual_minutes: number | null
  location: string | null
  area: string | null
  notes: string | null
  completion_notes: string | null
  photo_url: string | null
  signature_url: string | null
  blocked_reason: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  // Joined fields
  category?: TaskCategory
  assignee?: {
    first_name: string
    last_name: string
    staff_number: string
  }
  checklist_items?: TaskChecklistItem[]
}

export interface TaskChecklistItem {
  id: string
  task_id: string
  template_id: string | null
  title: string
  description: string | null
  is_required: boolean
  is_completed: boolean
  completed_by: string | null
  completed_at: string | null
  sort_order: number
  created_at: string
}

export interface WorkerAssignment {
  id: string
  employee_id: string
  role_id: string
  branch_id: string
  start_date: string
  end_date: string | null
  is_primary: boolean
  notes: string | null
  created_at: string
  // Joined fields
  role?: WorkerRole
  employee?: {
    first_name: string
    last_name: string
    staff_number: string
  }
}

export interface WorkerShift {
  id: string
  employee_id: string
  branch_id: string
  shift_date: string
  start_time: string
  end_time: string
  role_id: string | null
  area: string | null
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
  notes: string | null
  created_at: string
  updated_at: string
}

export interface WorkerAttendance {
  id: string
  employee_id: string
  branch_id: string
  clock_in: string
  clock_out: string | null
  status: 'active' | 'on_break' | 'completed'
  break_start: string | null
  break_end: string | null
  total_break_minutes: number
  notes: string | null
  created_at: string
}

export interface WorkerPerformance {
  employee_id: string
  branch_id: string
  metric_date: string
  tasks_assigned: number
  tasks_completed: number
  tasks_on_time: number
  tasks_late: number
  avg_completion_minutes: number | null
  total_work_minutes: number
  total_break_minutes: number
  efficiency_score: number | null
  quality_score: number | null
  attendance_score: number | null
}

// ─── Worker Role Service ────────────────────────────────────────────────────

/**
 * Get all worker roles
 */
export async function getWorkerRoles(): Promise<WorkerRole[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('worker_roles')
      .select('*')
      .order('name')

    if (error) throw error
    return (data || []) as WorkerRole[]
  } catch (error) {
    logger.error('[TaskManagement] Failed to get worker roles:', error)
    return []
  }
}

/**
 * Create a worker role
 */
export async function createWorkerRole(
  name: string,
  code: string,
  description?: string,
  department?: string,
  color?: string,
  icon?: string
): Promise<{ success: boolean; data?: WorkerRole; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin
      .from('worker_roles')
      .insert({
        name,
        code: code.toUpperCase(),
        description,
        department,
        color: color || '#3b82f6',
        icon: icon || 'briefcase',
      })
      .select()
      .single()

    if (error) throw error
    return { success: true, data: data as WorkerRole }
  } catch (error) {
    logger.error('[TaskManagement] Failed to create worker role:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Task Category Service ──────────────────────────────────────────────────

/**
 * Get all task categories
 */
export async function getTaskCategories(): Promise<TaskCategory[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('task_categories')
      .select('*')
      .order('name')

    if (error) throw error
    return (data || []) as TaskCategory[]
  } catch (error) {
    logger.error('[TaskManagement] Failed to get task categories:', error)
    return []
  }
}

// ─── Task Template Service ──────────────────────────────────────────────────

/**
 * Get all task templates
 */
export async function getTaskTemplates(): Promise<TaskTemplate[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('task_templates')
      .select('*')
      .order('name')

    if (error) throw error
    return (data || []) as TaskTemplate[]
  } catch (error) {
    logger.error('[TaskManagement] Failed to get task templates:', error)
    return []
  }
}

/**
 * Create a task from template
 */
export async function createTaskFromTemplate(
  templateId: string,
  branchId: string,
  assignedTo?: string,
  dueDate?: string,
  location?: string
): Promise<{ success: boolean; data?: Task; error?: string }> {
  try {
    // Get template
    const { data: template, error: templateError } = await supabaseAdmin
      .from('task_templates')
      .select('*')
      .eq('id', templateId)
      .single()

    if (templateError || !template) {
      return { success: false, error: 'Template not found' }
    }

    // Create task
    const { data: task, error: taskError } = await supabaseAdmin
      .from('tasks')
      .insert({
        template_id: templateId,
        category_id: template.category_id,
        title: template.name,
        description: template.description,
        instructions: template.instructions,
        branch_id: branchId,
        assigned_to: assignedTo || null,
        status: 'pending',
        priority: template.priority,
        due_date: dueDate || new Date().toISOString(),
        estimated_minutes: template.estimated_minutes,
        location,
      })
      .select()
      .single()

    if (taskError) throw taskError

    // Create checklist items if template has them
    if (template.instructions) {
      const steps = template.instructions.split('\n').filter(s => s.trim())
      if (steps.length > 0) {
        const checklistItems = steps.map((step, index) => ({
          task_id: task.id,
          template_id: templateId,
          title: step.replace(/^\d+\.\s*/, ''),
          is_required: index < steps.length - 1, // All except last are required
          is_completed: false,
          sort_order: index,
        }))

        await supabaseAdmin
          .from('task_checklist_items')
          .insert(checklistItems)
      }
    }

    return { success: true, data: task as Task }
  } catch (error) {
    logger.error('[TaskManagement] Failed to create task from template:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Task Service ───────────────────────────────────────────────────────────

/**
 * Get tasks with filters
 */
export async function getTasks(filters: {
  branchId?: string
  assignedTo?: string
  status?: TaskStatus
  category?: string
  priority?: TaskPriority
  startDate?: string
  endDate?: string
  limit?: number
  offset?: number
} = {}): Promise<{ tasks: Task[]; total: number }> {
  try {
    const { branchId, assignedTo, status, category, priority, startDate, endDate, limit = 50, offset = 0 } = filters

    let query = supabaseAdmin
      .from('tasks')
      .select(`
        *,
        category:task_categories(*),
        assignee:employee_profiles(staff_number, user:users!employee_profiles_user_id_fkey(full_name)),
        checklist_items:task_checklist_items(*)
      `, { count: 'exact' })

    if (branchId) query = query.eq('branch_id', branchId)
    if (assignedTo) query = query.eq('assigned_to', assignedTo)
    if (status) query = query.eq('status', status)
    if (category) query = query.eq('category_id', category)
    if (priority) query = query.eq('priority', priority)
    if (startDate) query = query.gte('due_date', startDate)
    if (endDate) query = query.lte('due_date', endDate)

    const { data, error, count } = await query
      .order('due_date', { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) throw error
    return { tasks: (data || []) as unknown as Task[], total: count || 0 }
  } catch (error) {
    logger.error('[TaskManagement] Failed to get tasks:', error)
    return { tasks: [], total: 0 }
  }
}

/**
 * Get tasks for a specific worker
 */
export async function getWorkerTasks(
  employeeId: string,
  date?: string
): Promise<Task[]> {
  try {
    const targetDate = date || new Date().toISOString().split('T')[0]

    const { data, error } = await supabaseAdmin
      .rpc('get_worker_tasks' as never, {
        p_employee_id: employeeId,
        p_date: targetDate,
      } as never)

    if (error) throw error
    return (data || []) as unknown as Task[]
  } catch (error) {
    logger.error('[TaskManagement] Failed to get worker tasks:', error)
    return []
  }
}

/**
 * Create a new task
 */
export async function createTask(
  title: string,
  branchId: string,
  options: {
    description?: string
    instructions?: string
    categoryId?: string
    assignedTo?: string
    assignedBy?: string
    priority?: TaskPriority
    dueDate?: string
    estimatedMinutes?: number
    location?: string
    area?: string
    notes?: string
  } = {}
): Promise<{ success: boolean; data?: Task; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin
      .from('tasks')
      .insert({
        title,
        description: options.description,
        instructions: options.instructions,
        category_id: options.categoryId,
        branch_id: branchId,
        assigned_to: options.assignedTo,
        assigned_by: options.assignedBy,
        status: 'pending',
        priority: options.priority || 'normal',
        due_date: options.dueDate || new Date().toISOString(),
        estimated_minutes: options.estimatedMinutes,
        location: options.location,
        area: options.area,
        notes: options.notes,
      })
      .select()
      .single()

    if (error) throw error
    return { success: true, data: data as Task }
  } catch (error) {
    logger.error('[TaskManagement] Failed to create task:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

/**
 * Update task status
 */
export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus,
  options: {
    completionNotes?: string
    photoUrl?: string
    blockedReason?: string
  } = {}
): Promise<{ success: boolean; error?: string }> {
  try {
    const updates: Record<string, unknown> = { status }

    if (status === 'in_progress') {
      updates.started_at = new Date().toISOString()
    } else if (status === 'completed') {
      updates.completed_at = new Date().toISOString()
      updates.completion_notes = options.completionNotes
      updates.photo_url = options.photoUrl
    } else if (status === 'blocked') {
      updates.blocked_reason = options.blockedReason
    }

    const { error } = await supabaseAdmin
      .from('tasks')
      .update(updates)
      .eq('id', taskId)

    if (error) throw error
    return { success: true }
  } catch (error) {
    logger.error('[TaskManagement] Failed to update task status:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

/**
 * Assign task to worker
 */
export async function assignTask(
  taskId: string,
  employeeId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from('tasks')
      .update({ assigned_to: employeeId, status: 'pending' })
      .eq('id', taskId)

    if (error) throw error
    return { success: true }
  } catch (error) {
    logger.error('[TaskManagement] Failed to assign task:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

/**
 * Auto-assign task to available worker
 */
export async function autoAssignTask(
  taskId: string,
  branchId: string
): Promise<{ success: boolean; assignedTo?: string; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin
      .rpc('auto_assign_task' as never, {
        p_task_id: taskId,
        p_branch_id: branchId,
      } as never)

    if (error) throw error
    return { success: true, assignedTo: String(data) }
  } catch (error) {
    logger.error('[TaskManagement] Failed to auto-assign task:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Checklist Service ──────────────────────────────────────────────────────

/**
 * Get checklist items for a task
 */
export async function getTaskChecklist(taskId: string): Promise<TaskChecklistItem[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('task_checklist_items')
      .select('*')
      .eq('task_id', taskId)
      .order('sort_order')

    if (error) throw error
    return (data || []) as TaskChecklistItem[]
  } catch (error) {
    logger.error('[TaskManagement] Failed to get task checklist:', error)
    return []
  }
}

/**
 * Toggle checklist item completion
 */
export async function toggleChecklistItem(
  itemId: string,
  completedBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get current state
    const { data: item } = await supabaseAdmin
      .from('task_checklist_items')
      .select('is_completed')
      .eq('id', itemId)
      .single()

    if (!item) {
      return { success: false, error: 'Item not found' }
    }

    // Toggle
    const { error } = await supabaseAdmin
      .from('task_checklist_items')
      .update({
        is_completed: !item.is_completed,
        completed_by: !item.is_completed ? completedBy : null,
        completed_at: !item.is_completed ? new Date().toISOString() : null,
      })
      .eq('id', itemId)

    if (error) throw error
    return { success: true }
  } catch (error) {
    logger.error('[TaskManagement] Failed to toggle checklist item:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Time Tracking Service ──────────────────────────────────────────────────

/**
 * Log task time event
 */
export async function logTaskTime(
  taskId: string,
  userId: string,
  action: 'start' | 'pause' | 'resume' | 'end' | 'break_start' | 'break_end',
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get last time log for this task
    const { data: lastLog } = await supabaseAdmin
      .from('task_time_logs')
      .select('*')
      .eq('task_id', taskId)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single()

    let durationMinutes = 0

    // Calculate duration if resuming or ending
    if (lastLog && (action === 'resume' || action === 'end' || action === 'break_end')) {
      const startTime = new Date(lastLog.timestamp ?? new Date().toISOString())
      const endTime = new Date()
      durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000)
    }

    // Log the event
    const { error } = await supabaseAdmin
      .from('task_time_logs')
      .insert({
        task_id: taskId,
        user_id: userId,
        action,
        duration_minutes: durationMinutes > 0 ? durationMinutes : null,
        notes,
      })

    if (error) throw error

    // Update task if starting or ending
    if (action === 'start') {
      await supabaseAdmin
        .from('tasks')
        .update({ started_at: new Date().toISOString(), status: 'in_progress' })
        .eq('id', taskId)
    } else if (action === 'end') {
      // Calculate total actual minutes
      const { data: allLogs } = await supabaseAdmin
        .from('task_time_logs')
        .select('duration_minutes')
        .eq('task_id', taskId)
        .eq('action', 'end')

      const totalMinutes = (allLogs || []).reduce((sum, log) => sum + (log.duration_minutes || 0), 0)

      await supabaseAdmin
        .from('tasks')
        .update({
          completed_at: new Date().toISOString(),
          actual_minutes: totalMinutes,
          status: 'completed',
        })
        .eq('id', taskId)
    }

    return { success: true }
  } catch (error) {
    logger.error('[TaskManagement] Failed to log task time:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Worker Assignment Service ──────────────────────────────────────────────

/**
 * Assign worker to role
 */
export async function assignWorkerRole(
  employeeId: string,
  roleId: string,
  branchId: string,
  isPrimary: boolean = false,
  notes?: string
): Promise<{ success: boolean; data?: WorkerAssignment; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin
      .from('worker_assignments')
      .insert({
        employee_id: employeeId,
        role_id: roleId,
        branch_id: branchId,
        is_primary: isPrimary,
        notes,
      })
      .select()
      .single()

    if (error) throw error
    return { success: true, data: data as WorkerAssignment }
  } catch (error) {
    logger.error('[TaskManagement] Failed to assign worker role:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

/**
 * Get worker assignments
 */
export async function getWorkerAssignments(branchId?: string): Promise<WorkerAssignment[]> {
  try {
    // Query employee_profiles with users join
    // employee_profiles has: id, user_id, staff_number, position, department_id, employment_status
    // Users table has: id, email, full_name, branch_id
    let query = supabaseAdmin
      .from('employee_profiles')
      .select(`
        id,
        staff_number,
        position,
        department_id,
        employment_status,
        user:users!employee_profiles_user_id_fkey(id, email, full_name, branch_id)
      `)

    // Filter by employment_status instead of is_active (which doesn't exist)
    query = query.eq('employment_status', 'active')

    // Filter by branch through users table (employee_profiles has no branch_id)
    if (branchId) {
      query = query.eq('user.branch_id', branchId)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw error

    // Map employee_profiles to WorkerAssignment format
    const assignments = ((data || []) as Record<string, unknown>[]).map((emp: Record<string, unknown>) => ({
      id: emp.id as string,
      employee_id: emp.id as string,
      role_id: '',
      branch_id: branchId || ((emp.user as Record<string, unknown>)?.branch_id as string) || '',
      start_date: (emp.created_at as string) || new Date().toISOString(),
      end_date: null,
      is_active: true,
      created_at: (emp.created_at as string) || new Date().toISOString(),
      updated_at: (emp.updated_at as string) || new Date().toISOString(),
      role: null,
      employee: {
        first_name: ((emp.user as Record<string, unknown>)?.full_name as string)?.split(' ')[0] || ((emp.user as Record<string, unknown>)?.email as string)?.split('@')[0] || 'Unknown',
        last_name: ((emp.user as Record<string, unknown>)?.full_name as string)?.split(' ').slice(1).join(' ') || '',
        staff_number: (emp.staff_number as string) || '',
      },
    })) as unknown as WorkerAssignment[]

    return assignments
  } catch (error) {
    logger.error('[TaskManagement] Failed to get worker assignments:', error)
    return []
  }
}

// ─── Worker Shift Service ───────────────────────────────────────────────────

/**
 * Get worker shifts within a date range for a branch.
 */
export async function getWorkerShifts(
  branchId: string,
  startDate: string,
  endDate: string
): Promise<any[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('worker_shifts')
      .select(`
        *,
        employee:employee_profiles(first_name, last_name, staff_number),
        role:worker_roles(*)
      `)
      .eq('branch_id', branchId)
      .gte('shift_date', startDate)
      .lte('shift_date', endDate)
      .order('shift_date')

    if (error) throw error
    return data || []
  } catch (error) {
    logger.error('[TaskManagement] Failed to get worker shifts:', error)
    return []
  }
}

/**
 * Create a worker shift.
 */
export async function createWorkerShift(data: {
  employee_id: string
  branch_id: string
  shift_date: string
  start_time: string
  end_time: string
  role_id?: string | null
  area?: string | null
  notes?: string | null
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from('worker_shifts')
      .insert({
        employee_id: data.employee_id,
        branch_id: data.branch_id,
        shift_date: data.shift_date,
        start_time: data.start_time,
        end_time: data.end_time,
        role_id: data.role_id || null,
        area: data.area || null,
        notes: data.notes || null,
      })

    if (error) throw error
    return { success: true }
  } catch (error) {
    logger.error('[TaskManagement] Failed to create worker shift:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

/**
 * Delete a worker shift.
 */
export async function deleteWorkerShift(shiftId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from('worker_shifts')
      .delete()
      .eq('id', shiftId)

    if (error) throw error
    return { success: true }
  } catch (error) {
    logger.error('[TaskManagement] Failed to delete worker shift:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Worker Performance Service ─────────────────────────────────────────────

/**
 * Get worker performance metrics
 */
export async function getWorkerPerformance(
  employeeId: string,
  startDate?: string,
  endDate?: string
): Promise<WorkerPerformance | null> {
  try {
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const end = endDate || new Date().toISOString().split('T')[0]

    const { data, error } = await supabaseAdmin
      .rpc('get_worker_performance' as never, {
        p_employee_id: employeeId,
        p_start_date: start,
        p_end_date: end,
      } as never)

    if (error) throw error
    return (data as unknown as WorkerPerformance[])?.[0] || null
  } catch (error) {
    logger.error('[TaskManagement] Failed to get worker performance:', error)
    return null
  }
}

/**
 * Get team performance summary
 */
export async function getTeamPerformance(
  branchId: string,
  startDate?: string,
  endDate?: string
): Promise<WorkerPerformance[]> {
  try {
    // Get all workers in branch
    const { data: workers } = await supabaseAdmin
      .from('worker_assignments')
      .select('employee_id')
      .eq('branch_id', branchId)
      .is('end_date', null)

    if (!workers || workers.length === 0) return []

    const performances: WorkerPerformance[] = []

    for (const worker of workers) {
      const perf = await getWorkerPerformance(worker.employee_id, startDate, endDate)
      if (perf) {
        performances.push(perf)
      }
    }

    return performances
  } catch (error) {
    logger.error('[TaskManagement] Failed to get team performance:', error)
    return []
  }
}
