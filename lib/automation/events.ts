'use server'

/**
 * Event Dispatcher — logs events and triggers the automation engine.
 *
 * This is the single entry point for all automation events.
 * Server actions call emitEvent() after completing their primary operation.
 * The engine processes events synchronously for critical paths.
 */

import { logger } from '@/lib/logger'
import { supabaseAdmin } from '@/lib/supabase-server'
import type { EventType, EventSource, EmitEventOptions, ProcessEventResult } from './types'
import { evaluateConditions } from './conditions'
import { executeAction } from './actions'

/**
 * Emit an automation event.
 * This is the main function that server actions call to trigger automations.
 *
 * @example
 * await emitEvent({
 *   eventType: 'sale.completed',
 *   source: 'pos',
 *   entityType: 'sale',
 *   entityId: saleId,
 *   payload: { sale_id: saleId, total: 265, ... }
 * })
 */
export async function emitEvent(options: EmitEventOptions): Promise<ProcessEventResult> {
  const startTime = Date.now()

  try {
    const { eventType, source = 'app', entityType, entityId, payload } = options

    // 1. Log the event to database
    const { data: event, error: insertErr } = await supabaseAdmin
      .from('automation_events')
      .insert({
        event_type: eventType,
        source,
        entity_type: entityType || null,
        entity_id: entityId || null,
        payload,
        processed: false,
      })
      .select('id')
      .single()

    if (insertErr) {
      logger.error('[Automation] Failed to log event:', { eventType, error: insertErr.message })
      return { eventId: '', rulesEvaluated: 0, actionsExecuted: 0, durationMs: Date.now() - startTime }
    }

    logger.info('[Automation] Event emitted', { eventType, eventId: event.id, source })

    // 2. Process the event through the rule engine
    const result = await processEvent(event.id, eventType, payload)

    return {
      eventId: event.id,
      rulesEvaluated: result.rulesEvaluated,
      actionsExecuted: result.actionsExecuted,
      durationMs: Date.now() - startTime,
    }
  } catch (error) {
    logger.error('[Automation] emitEvent failed:', error)
    return { eventId: '', rulesEvaluated: 0, actionsExecuted: 0, durationMs: Date.now() - startTime }
  }
}

/**
 * Process a single event through matching rules.
 * Called internally by emitEvent and can be called directly for reprocessing.
 */
async function processEvent(
  eventId: string,
  eventType: EventType,
  payload: Record<string, unknown>
): Promise<{ rulesEvaluated: number; actionsExecuted: number }> {
  let rulesEvaluated = 0
  let actionsExecuted = 0

  try {
    // 1. Load all active rules for this event type
    const { data: rules, error: rulesErr } = await supabaseAdmin
      .from('automation_rules')
      .select('*')
      .eq('trigger_event', eventType)
      .eq('is_active', true)
      .order('priority', { ascending: false })

    if (rulesErr || !rules || rules.length === 0) {
      // Mark event as processed even if no rules match
      await supabaseAdmin
        .from('automation_events')
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq('id', eventId)
      return { rulesEvaluated: 0, actionsExecuted: 0 }
    }

    // 2. Evaluate each rule
    for (const rule of rules) {
      rulesEvaluated++

      // Check cooldown
      if (rule.cooldown_ms > 0) {
        const { data: recentLog } = await supabaseAdmin
          .from('automation_logs')
          .select('id')
          .eq('rule_id', rule.id)
          .eq('status', 'success')
          .gt('created_at', new Date(Date.now() - rule.cooldown_ms).toISOString())
          .limit(1)

        if (recentLog && recentLog.length > 0) {
          logger.info('[Automation] Rule skipped (cooldown)', { ruleId: rule.id, ruleName: rule.name })
          continue
        }
      }

      // Check daily limit
      if (rule.max_daily) {
        const startOfDay = new Date()
        startOfDay.setHours(0, 0, 0, 0)

        const { count } = await supabaseAdmin
          .from('automation_logs')
          .select('id', { count: 'exact', head: true })
          .eq('rule_id', rule.id)
          .eq('status', 'success')
          .gte('created_at', startOfDay.toISOString())

        if (count && count >= rule.max_daily) {
          logger.info('[Automation] Rule skipped (daily limit)', { ruleId: rule.id, count, max: rule.max_daily })
          continue
        }
      }

      // 3. Load and evaluate conditions
      const { data: conditions } = await supabaseAdmin
        .from('automation_conditions')
        .select('*')
        .eq('rule_id', rule.id)
        .order('sort_order')

      const conditionsMet = evaluateConditions(conditions || [], payload)

      if (!conditionsMet) {
        logger.info('[Automation] Rule conditions not met', { ruleId: rule.id, ruleName: rule.name })
        continue
      }

      // 4. Load and execute actions
      const { data: actions } = await supabaseAdmin
        .from('automation_actions')
        .select('*')
        .eq('rule_id', rule.id)
        .order('sort_order')

      if (actions && actions.length > 0) {
        for (const action of actions) {
          const actionStart = Date.now()

          try {
            await executeAction(action.action_type, action.params, payload)

            // Log success
            await supabaseAdmin.from('automation_logs').insert({
              rule_id: rule.id,
              event_id: eventId,
              action_type: action.action_type,
              status: 'success',
              duration_ms: Date.now() - actionStart,
              input: { params: action.params, payload },
            })

            actionsExecuted++
          } catch (actionError) {
            // Log failure (but don't block other actions)
            logger.error('[Automation] Action failed:', { action: action.action_type, error: String(actionError) })

            await supabaseAdmin.from('automation_logs').insert({
              rule_id: rule.id,
              event_id: eventId,
              action_type: action.action_type,
              status: 'failed',
              error_msg: String(actionError),
              duration_ms: Date.now() - actionStart,
              input: { params: action.params, payload },
            })
          }
        }
      }

      logger.info('[Automation] Rule processed', {
        ruleId: rule.id,
        ruleName: rule.name,
        actionsExecuted: actions?.length || 0,
      })
    }

    // 5. Mark event as processed
    await supabaseAdmin
      .from('automation_events')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('id', eventId)

    return { rulesEvaluated, actionsExecuted }
  } catch (error) {
    logger.error('[Automation] processEvent failed:', error)
    return { rulesEvaluated, actionsExecuted }
  }
}
