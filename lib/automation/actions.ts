/**
 * Action Executor — executes automation actions based on type and params.
 *
 * Action Types:
 * - notify: Send in-app notification
 * - audit: Write to audit log
 * - notify_target: Notify specific user/role (future: SMS, email)
 */

import { logger } from '@/lib/logger'
import { supabaseAdmin } from '@/lib/supabase-server'

/**
 * Execute an automation action.
 * Each action type has its own handler that performs the actual work.
 */
export async function executeAction(
  actionType: string,
  params: Record<string, unknown>,
  payload: Record<string, unknown>
): Promise<void> {
  switch (actionType) {
    case 'notify':
      await executeNotify(params, payload)
      break

    case 'audit':
      await executeAudit(params, payload)
      break

    default:
      logger.warn('[Automation] Unknown action type:', { actionType })
  }
}

/**
 * Execute a notification action.
 * Creates in-app notifications for users based on target (role or user_id).
 */
async function executeNotify(
  params: Record<string, unknown>,
  payload: Record<string, unknown>
): Promise<void> {
  const target = String(params.target || '')
  const title = interpolate(String(params.title || 'Notification'), payload)
  const body = interpolate(String(params.body || ''), payload)
  const severity = String(params.severity || 'info')
  const url = params.url ? String(params.url) : undefined
  const referenceType = params.reference_type ? String(params.reference_type) : undefined
  const referenceId = params.reference_id
    ? String(params.reference_id)
    : payload.entity_id
      ? String(payload.entity_id)
      : undefined

  // Determine recipient user IDs
  let userIds: string[] = []

  if (target.startsWith('role:')) {
    // Notify all users with this role
    const role = target.replace('role:', '')
    const { data: users } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('role', role)
      .eq('status', 'active')

    if (users) {
      userIds = users.map(u => u.id)
    }
  } else if (target === 'customer' && payload.customer_id) {
    // Notify the customer (if they have an account)
    userIds = [String(payload.customer_id)]
  } else if (target.startsWith('user:')) {
    // Notify a specific user
    userIds = [target.replace('user:', '')]
  }

  // Create notifications for each recipient
  for (const userId of userIds) {
    try {
      await supabaseAdmin.from('notifications').insert({
        user_id: userId,
        title,
        body,
        event_type: 'automation',
        severity,
        reference_type: referenceType || null,
        reference_id: referenceId || null,
        action_url: url || null,
        is_read: false,
      })
    } catch (err) {
      logger.error('[Automation] Failed to create notification:', { userId, error: String(err) })
    }
  }

  if (userIds.length > 0) {
    logger.info('[Automation] Notifications sent', { title, recipients: userIds.length, severity })
  }
}

/**
 * Execute an audit log action.
 * Writes to the system_audit_log table for compliance and tracking.
 */
async function executeAudit(
  params: Record<string, unknown>,
  payload: Record<string, unknown>
): Promise<void> {
  const action = String(params.action || 'automation_event')
  const entityType = String(params.entity_type || payload.entity_type || 'unknown')
  const entityId = payload.entity_id ? String(payload.entity_id) : null

  try {
    await supabaseAdmin.from('system_audit_log').insert({
      action,
      entity_type: entityType,
      entity_id: entityId,
      details: {
        payload,
        automated: true,
        timestamp: new Date().toISOString(),
      },
      severity: 'info',
    } as any)

    logger.info('[Automation] Audit log written', { action, entityType, entityId })
  } catch (err) {
    logger.error('[Automation] Failed to write audit log:', { action, error: String(err) })
  }
}

/**
 * Interpolate template variables in a string.
 * Uses {{variable}} syntax and replaces with values from the payload.
 *
 * @example
 * interpolate("Product {{product_name}} has {{quantity}} units", { product_name: "Milk", quantity: 5 })
 * → "Product Milk has 5 units"
 */
function interpolate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = data[key]
    if (value === undefined || value === null) return match
    return String(value)
  })
}
