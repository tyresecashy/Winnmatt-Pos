'use server'

/**
 * Scheduler — manages scheduled automation tasks.
 *
 * Instead of pg_cron (not available), this uses:
 * 1. An RPC function `run_scheduled_automation_tasks()` that checks for due tasks
 * 2. App-level polling: dashboard calls `checkScheduledTasks()` periodically
 * 3. Server-side trigger: can be called from any server action
 */

import { logger } from '@/lib/logger'
import { supabaseAdmin } from '@/lib/supabase-server'
import type { Json } from '@/lib/types/database'

// Lazy-imported: recoverPendingPayments is only loaded when its task runs
async function runPendingPaymentRecovery(): Promise<void> {
  const { recoverPendingPayments } = await import('@/lib/modules/payments')
  const result = await recoverPendingPayments()
  if (!result.success || result.errors.length > 0) {
    logger.warn('[Scheduler] Pending payment recovery completed with issues', {
      recovered: result.recovered,
      errors: result.errors,
    })
  } else {
    logger.info('[Scheduler] Pending payment recovery completed', {
      recovered: result.recovered,
    })
  }
}

export interface ScheduledTask {
  id: string
  name: string
  rule_id: string | null
  cron_expr: string
  last_run: string | null
  next_run: string | null
  is_active: boolean
  payload: Record<string, unknown>
}

/**
 * Get all scheduled tasks.
 */
export async function getScheduledTasks(): Promise<ScheduledTask[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('automation_schedules')
      .select('*')
      .order('name')

    if (error) throw error
    return (data || []) as ScheduledTask[]
  } catch (error) {
    logger.error('[Scheduler] Failed to fetch tasks:', error)
    return []
  }
}

/**
 * Create a new scheduled task.
 */
export async function createScheduledTask(task: {
  name: string
  rule_id?: string
  cron_expr: string
  payload?: Record<string, unknown>
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const nextRun = calculateNextRun(task.cron_expr)

    const { data, error } = await supabaseAdmin
      .from('automation_schedules')
      .insert({
        name: task.name,
        rule_id: task.rule_id || null,
        cron_expr: task.cron_expr,
        next_run: nextRun,
        is_active: true,
        payload: (task.payload || {}) as Json,
      })
      .select('id')
      .single()

    if (error) throw error
    return { success: true, id: data.id }
  } catch (error) {
    logger.error('Operation failed', { error: error })
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

/**
 * Update a scheduled task.
 */
export async function updateScheduledTask(
  taskId: string,
  updates: Partial<{
    name: string
    cron_expr: string
    is_active: boolean
    payload: Record<string, unknown>
  }>
): Promise<{ success: boolean; error?: string }> {
  try {
    const updateData: Record<string, unknown> = { ...updates }

    // Recalculate next_run if cron_expr changed
    if (updates.cron_expr) {
      updateData.next_run = calculateNextRun(updates.cron_expr)
    }

    const { error } = await supabaseAdmin
      .from('automation_schedules')
      .update(updateData)
      .eq('id', taskId)

    if (error) throw error
    return { success: true }
  } catch (error) {
    logger.error('Operation failed', { error: error })
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

/**
 * Delete a scheduled task.
 */
export async function deleteScheduledTask(taskId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from('automation_schedules')
      .delete()
      .eq('id', taskId)

    if (error) throw error
    return { success: true }
  } catch (error) {
    logger.error('Operation failed', { error: error })
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

/**
 * Check for due scheduled tasks and execute them.
 * This is the main scheduler entry point — call from dashboard or server actions.
 */
export async function checkScheduledTasks(): Promise<{
  checked: number
  executed: number
  errors: string[]
}> {
  const result = { checked: 0, executed: 0, errors: [] as string[] }

  try {
    // Find all active tasks where next_run is in the past
    const { data: dueTasks, error } = await supabaseAdmin
      .from('automation_schedules')
      .select('*')
      .eq('is_active', true)
      .lte('next_run', new Date().toISOString())

    if (error) throw error
    if (!dueTasks || dueTasks.length === 0) return result

    result.checked = dueTasks.length

    for (const task of dueTasks) {
      try {
        // Execute the task based on its name/payload
        await executeScheduledTask(task)

        // Update last_run and calculate next_run
        const nextRun = calculateNextRun(task.cron_expr)
        await supabaseAdmin
          .from('automation_schedules')
          .update({
            last_run: new Date().toISOString(),
            next_run: nextRun,
          })
          .eq('id', task.id)

        result.executed++
        logger.info('[Scheduler] Task executed', { taskId: task.id, name: task.name })
      } catch (taskError) {
        const errMsg = taskError instanceof Error ? taskError.message : 'Unknown error'
        result.errors.push(`${task.name}: ${errMsg}`)
        logger.error('[Scheduler] Task failed:', { taskId: task.id, name: task.name, error: errMsg })
      }
    }
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Scheduler check failed')
  }

  return result
}

/**
 * Execute a single scheduled task.
 */
async function executeScheduledTask(task: Record<string, unknown>): Promise<void> {
  const name = String(task.name || '')
  const payload = (task.payload || {}) as Record<string, unknown>

  switch (name) {
    case 'Daily Promo Expiry Check':
      await runPromoExpiryCheck()
      break
    case 'Daily Recurring Expenses':
      await runRecurringExpenses()
      break
    case 'Daily Overdue Invoice Check':
      await runOverdueInvoiceCheck()
      break
    case 'Daily Inventory Check':
      await runInventoryCheck()
      break
    case 'Weekly Loyalty Expiry':
      await runLoyaltyExpiry()
      break
    case 'Daily Batch Expiry Check':
      await runBatchExpiryCheck()
      break
    case 'Pending Payment Recovery':
      await runPendingPaymentRecovery()
      break
    default:
      // Custom task — emit a scheduler event
      const { emitEvent } = await import('./events')
      await emitEvent({
        eventType: 'scheduler.custom',
        source: 'scheduler',
        entityType: 'schedule',
        entityId: String(task.id || ''),
        payload: { taskName: name, ...payload },
      })
  }
}

// ─── Scheduled Task Implementations ────────────────────────────────────────

async function runPromoExpiryCheck(): Promise<void> {
  const now = new Date().toISOString()
  const { data: expired } = await supabaseAdmin
    .from('promotions')
    .select('id, name')
    .eq('is_active', true)
    .lt('end_date', now)

  if (expired && expired.length > 0) {
    // Deactivate expired promos
    await supabaseAdmin
      .from('promotions')
      .update({ is_active: false })
      .in('id', expired.map(p => p.id))

    logger.info('[Scheduler] Deactivated expired promotions', { count: expired.length })
  }
}

async function runRecurringExpenses(): Promise<void> {
  // Check for recurring expenses that are due today
  const today = new Date().toISOString().split('T')[0]
  const { data: due } = await supabaseAdmin
    .from('recurring_expenses')
    .select('*')
    .eq('is_active', true)
    .lte('next_date', today)

  if (due && due.length > 0) {
    for (const exp of due) {
      // Create the expense record
      await supabaseAdmin.from('expenses').insert({
        description: exp.description,
        amount_cents: exp.amount_cents,
        category_id: exp.category_id,
        branch_id: exp.branch_id,
        created_by: exp.created_by,
        vendor: exp.vendor,
        expense_date: today,
        payment_method: exp.payment_method || 'bank_transfer',
        notes: `Auto-generated from recurring expense: ${exp.description}`,
      })

      // Update next_date
      const nextDate = calculateNextDate(today, exp.frequency)
      await supabaseAdmin
        .from('recurring_expenses')
        .update({ last_generated: today, next_date: nextDate })
        .eq('id', exp.id)
    }

    logger.info('[Scheduler] Generated recurring expenses', { count: due.length })
  }
}

async function runOverdueInvoiceCheck(): Promise<void> {
  const today = new Date().toISOString().split('T')[0]
  const { data: overdue } = await supabaseAdmin
    .from('invoices')
    .select('id, invoice_number, customer_id, total_amount_cents, due_date')
    .eq('status', 'sent')
    .lt('due_date', today)

  if (overdue && overdue.length > 0) {
    // Update status to overdue
    await supabaseAdmin
      .from('invoices')
      .update({ status: 'overdue' })
      .in('id', overdue.map(i => i.id))

    logger.info('[Scheduler] Marked invoices as overdue', { count: overdue.length })
  }
}

async function runInventoryCheck(): Promise<void> {
  // Check for products below safety stock
  const { data: products } = await supabaseAdmin
    .from('products')
    .select('id, name, safety_stock')
    .eq('status', 'active')

  if (!products) return

  const lowStock: string[] = []
  for (const product of products) {
    const { data: stock } = await supabaseAdmin
      .from('inventory')
      .select('quantity')
      .eq('product_id', product.id)

    const totalQty = (stock || []).reduce((sum, s) => sum + (s.quantity || 0), 0)
    if (totalQty <= (product.safety_stock || 0)) {
      lowStock.push(product.name)
    }
  }

  if (lowStock.length > 0) {
    logger.info('[Scheduler] Low stock detected', { products: lowStock.length })
  }
}

async function runLoyaltyExpiry(): Promise<void> {
  // Check for loyalty points that have expired (based on loyalty_settings)
  const { data: settings } = await supabaseAdmin
    .from('loyalty_settings')
    .select('points_expiry_months')
    .single() as unknown as { data: { points_expiry_months?: number } | null; error: null }

  if (!settings?.points_expiry_months) return

  const expiryDate = new Date()
  expiryDate.setMonth(expiryDate.getMonth() - (settings.points_expiry_months as number))
  const expiryStr = expiryDate.toISOString()

  // Find customers with points earned before expiry date
  const { data: expiredCustomers } = await supabaseAdmin
    .from('customers')
    .select('id, loyalty_points')
    .gt('loyalty_points', 0)

  // This is a simplified check — in production you'd check loyalty_transactions
  if (expiredCustomers && expiredCustomers.length > 0) {
    logger.info('[Scheduler] Loyalty expiry check completed', { customersChecked: expiredCustomers.length })
  }
}

async function runBatchExpiryCheck(): Promise<void> {
  // Mark batches as expired if past their expiry date
  const today = new Date().toISOString().split('T')[0]

  const { data: expiredBatches, error } = await supabaseAdmin
    .from('batch_tracking')
    .select('id, batch_number, product_id, expiry_date, quantity')
    .lte('expiry_date', today)
    .neq('status', 'expired')
    .neq('status', 'depleted')
    .neq('status', 'disposed')

  if (error) {
    logger.error('[Scheduler] Failed to fetch expired batches:', error)
    return
  }

  if (!expiredBatches || expiredBatches.length === 0) return

  // Mark batches as expired
  const expiredIds = expiredBatches.map(b => b.id)
  const { error: updateError } = await supabaseAdmin
    .from('batch_tracking')
    .update({
      status: 'expired',
      notes: 'Auto-marked expired by daily expiry check',
      updated_at: new Date().toISOString(),
    })
    .in('id', expiredIds)

  if (updateError) {
    logger.error('[Scheduler] Failed to update expired batches:', updateError)
    return
  }

  logger.info(`[Scheduler] Marked ${expiredBatches.length} batches as expired`)

  // Emit events for expired batches (for notification/webhook)
  const { emitEvent } = await import('./events')
  for (const batch of expiredBatches) {
    await emitEvent({
      eventType: 'scheduler.batch_expiry',
      source: 'scheduler',
      entityType: 'batch_tracking',
      entityId: batch.id,
      payload: {
        batch_number: batch.batch_number,
        product_id: batch.product_id,
        expiry_date: batch.expiry_date,
        quantity: batch.quantity,
        description: `Batch ${batch.batch_number} expired on ${batch.expiry_date}`,
      },
    }).catch(() => {})
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Calculate next run time from a simple cron expression.
 * Supports: "daily", "weekly", "monthly", or "HH:MM" format.
 */
function calculateNextRun(cronExpr: string): string {
  const now = new Date()

  if (cronExpr === 'daily') {
    const next = new Date(now)
    next.setDate(next.getDate() + 1)
    next.setHours(0, 0, 0, 0)
    return next.toISOString()
  }

  if (cronExpr === 'weekly') {
    const next = new Date(now)
    next.setDate(next.getDate() + (7 - next.getDay()))
    next.setHours(0, 0, 0, 0)
    return next.toISOString()
  }

  if (cronExpr === 'monthly') {
    const next = new Date(now)
    next.setMonth(next.getMonth() + 1, 1)
    next.setHours(0, 0, 0, 0)
    return next.toISOString()
  }

  // HH:MM format — next occurrence today or tomorrow
  if (/^\d{2}:\d{2}$/.test(cronExpr)) {
    const [hours, minutes] = cronExpr.split(':').map(Number)
    const next = new Date(now)
    next.setHours(hours, minutes, 0, 0)
    if (next <= now) {
      next.setDate(next.getDate() + 1)
    }
    return next.toISOString()
  }

  // Default: 1 hour from now
  return new Date(now.getTime() + 3600000).toISOString()
}

/**
 * Calculate next date for recurring expenses.
 */
function calculateNextDate(currentDate: string, frequency: string): string {
  const date = new Date(currentDate)

  switch (frequency) {
    case 'daily':
      date.setDate(date.getDate() + 1)
      break
    case 'weekly':
      date.setDate(date.getDate() + 7)
      break
    case 'monthly':
      date.setMonth(date.getMonth() + 1)
      break
    case 'quarterly':
      date.setMonth(date.getMonth() + 3)
      break
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1)
      break
    default:
      date.setMonth(date.getMonth() + 1)
  }

  return date.toISOString().split('T')[0]
}
