'use server'

/**
 * Automation Center — Server Actions
 * CRUD operations for rules, conditions, actions, and logs.
 */

import { logger } from '@/lib/logger'
import { supabaseAdmin } from '@/lib/supabase-server'
import { authenticateServerAction } from '@/lib/auth-helpers'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface AutomationRule {
  id: string
  name: string
  description: string | null
  is_active: boolean
  priority: number
  cooldown_ms: number
  max_daily: number | null
  trigger_event: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface AutomationCondition {
  id: string
  rule_id: string
  parent_id: string | null
  logic_gate: 'AND' | 'OR' | 'NOT' | 'LEAF'
  field: string | null
  operator: string | null
  value: string | null
  sort_order: number
}

export interface AutomationAction {
  id: string
  rule_id: string
  action_type: string
  params: Record<string, unknown>
  sort_order: number
  is_async: boolean
}

export interface AutomationEvent {
  id: string
  event_type: string
  source: string
  entity_type: string | null
  entity_id: string | null
  payload: Record<string, unknown>
  processed: boolean
  processed_at: string | null
  created_at: string
}

export interface AutomationLog {
  id: string
  rule_id: string | null
  event_id: string | null
  action_type: string
  status: 'success' | 'failed' | 'skipped'
  error_msg: string | null
  duration_ms: number | null
  input: Record<string, unknown> | null
  output: Record<string, unknown> | null
  created_at: string
  rule?: AutomationRule
}

// ─── Rules CRUD ────────────────────────────────────────────────────────────

export async function getAutomationRules(): Promise<AutomationRule[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('automation_rules')
      .select('*')
      .order('priority', { ascending: false })
      .order('name')

    if (error) throw error
    return (data || []) as AutomationRule[]
  } catch (error) {
    logger.error('[Automation] Failed to fetch rules:', error)
    return []
  }
}

export async function getAutomationRule(ruleId: string): Promise<{
  rule: AutomationRule | null
  conditions: AutomationCondition[]
  actions: AutomationAction[]
}> {
  try {
    const [ruleResult, conditionsResult, actionsResult] = await Promise.all([
      supabaseAdmin.from('automation_rules').select('*').eq('id', ruleId).single(),
      supabaseAdmin.from('automation_conditions').select('*').eq('rule_id', ruleId).order('sort_order'),
      supabaseAdmin.from('automation_actions').select('*').eq('rule_id', ruleId).order('sort_order'),
    ])

    return {
      rule: ruleResult.data as AutomationRule | null,
      conditions: (conditionsResult.data || []) as AutomationCondition[],
      actions: (actionsResult.data || []) as AutomationAction[],
    }
  } catch (error) {
    logger.error('[Automation] Failed to fetch rule:', error)
    return { rule: null, conditions: [], actions: [] }
  }
}

export async function createAutomationRule(rule: {
  name: string
  description?: string
  trigger_event: string
  priority?: number
  cooldown_ms?: number
  max_daily?: number
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) {
      return { success: false, error: auth.error || 'Unauthorized' }
    }

    const { data, error } = await supabaseAdmin
      .from('automation_rules')
      .insert({
        name: rule.name,
        description: rule.description || null,
        trigger_event: rule.trigger_event,
        priority: rule.priority || 0,
        cooldown_ms: rule.cooldown_ms || 0,
        max_daily: rule.max_daily || null,
        created_by: auth.profile.id,
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

export async function updateAutomationRule(
  ruleId: string,
  updates: Partial<{
    name: string
    description: string
    trigger_event: string
    priority: number
    cooldown_ms: number
    max_daily: number
    is_active: boolean
  }>
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) {
      return { success: false, error: auth.error || 'Unauthorized' }
    }

    const { error } = await supabaseAdmin
      .from('automation_rules')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', ruleId)

    if (error) throw error
    return { success: true }
  } catch (error) {
    logger.error('Operation failed', { error: error })
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function toggleAutomationRule(ruleId: string): Promise<{ success: boolean; is_active?: boolean; error?: string }> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) {
      return { success: false, error: auth.error || 'Unauthorized' }
    }

    // Get current state
    const { data: rule } = await supabaseAdmin
      .from('automation_rules')
      .select('is_active')
      .eq('id', ruleId)
      .single()

    if (!rule) return { success: false, error: 'Rule not found' }

    const newState = !rule.is_active
    const { error } = await supabaseAdmin
      .from('automation_rules')
      .update({ is_active: newState, updated_at: new Date().toISOString() })
      .eq('id', ruleId)

    if (error) throw error
    return { success: true, is_active: newState }
  } catch (error) {
    logger.error('Operation failed', { error: error })
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function deleteAutomationRule(ruleId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) {
      return { success: false, error: auth.error || 'Unauthorized' }
    }

    const { error } = await supabaseAdmin
      .from('automation_rules')
      .delete()
      .eq('id', ruleId)

    if (error) throw error
    return { success: true }
  } catch (error) {
    logger.error('Operation failed', { error: error })
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Conditions CRUD ───────────────────────────────────────────────────────

export async function upsertCondition(condition: {
  id?: string
  rule_id: string
  parent_id?: string
  logic_gate?: string
  field?: string
  operator?: string
  value?: string
  sort_order?: number
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) {
      return { success: false, error: auth.error || 'Unauthorized' }
    }

    if (condition.id) {
      const { error } = await supabaseAdmin
        .from('automation_conditions')
        .update({
          parent_id: condition.parent_id || null,
          logic_gate: condition.logic_gate || 'LEAF',
          field: condition.field || null,
          operator: condition.operator || null,
          value: condition.value || null,
          sort_order: condition.sort_order || 0,
        })
        .eq('id', condition.id)

      if (error) throw error
      return { success: true, id: condition.id }
    } else {
      const { data, error } = await supabaseAdmin
        .from('automation_conditions')
        .insert({
          rule_id: condition.rule_id,
          parent_id: condition.parent_id || null,
          logic_gate: condition.logic_gate || 'LEAF',
          field: condition.field || null,
          operator: condition.operator || null,
          value: condition.value || null,
          sort_order: condition.sort_order || 0,
        })
        .select('id')
        .single()

      if (error) throw error
      return { success: true, id: data.id }
    }
  } catch (error) {
    logger.error('Operation failed', { error: error })
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function deleteCondition(conditionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) {
      return { success: false, error: auth.error || 'Unauthorized' }
    }

    const { error } = await supabaseAdmin
      .from('automation_conditions')
      .delete()
      .eq('id', conditionId)

    if (error) throw error
    return { success: true }
  } catch (error) {
    logger.error('Operation failed', { error: error })
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Actions CRUD ──────────────────────────────────────────────────────────

export async function upsertAction(action: {
  id?: string
  rule_id: string
  action_type: string
  params?: Record<string, unknown>
  sort_order?: number
  is_async?: boolean
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) {
      return { success: false, error: auth.error || 'Unauthorized' }
    }

    if (action.id) {
      const { error } = await supabaseAdmin
        .from('automation_actions')
        .update({
          action_type: action.action_type,
          params: action.params || {},
          sort_order: action.sort_order || 0,
          is_async: action.is_async || false,
        } as any)
        .eq('id', action.id)

      if (error) throw error
      return { success: true, id: action.id }
    } else {
      const { data, error } = await supabaseAdmin
        .from('automation_actions')
        .insert({
          rule_id: action.rule_id,
          action_type: action.action_type,
          params: action.params || {},
          sort_order: action.sort_order || 0,
          is_async: action.is_async || false,
        } as any)
        .select('id')
        .single()

      if (error) throw error
      return { success: true, id: data.id }
    }
  } catch (error) {
    logger.error('Operation failed', { error: error })
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function deleteAction(actionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) {
      return { success: false, error: auth.error || 'Unauthorized' }
    }

    const { error } = await supabaseAdmin
      .from('automation_actions')
      .delete()
      .eq('id', actionId)

    if (error) throw error
    return { success: true }
  } catch (error) {
    logger.error('Operation failed', { error: error })
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Event Logs ────────────────────────────────────────────────────────────

export async function getAutomationEvents(limit = 100): Promise<AutomationEvent[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('automation_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return (data || []) as AutomationEvent[]
  } catch (error) {
    logger.error('[Automation] Failed to fetch events:', error)
    return []
  }
}

// ─── Action Logs ───────────────────────────────────────────────────────────

export async function getAutomationLogs(limit = 100): Promise<AutomationLog[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('automation_logs')
      .select('*, rule:automation_rules(name, trigger_event)')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return (data || []) as AutomationLog[]
  } catch (error) {
    logger.error('[Automation] Failed to fetch logs:', error)
    return []
  }
}

// ─── Stats ─────────────────────────────────────────────────────────────────

export async function getAutomationStats(): Promise<{
  totalRules: number
  activeRules: number
  totalEvents: number
  totalActionsExecuted: number
  failedActions: number
  recentEvents: AutomationEvent[]
}> {
  try {
    const [rulesResult, eventsResult, logsResult, failedResult] = await Promise.all([
      supabaseAdmin.from('automation_rules').select('id, is_active', { count: 'exact' }),
      supabaseAdmin.from('automation_events').select('id', { count: 'exact' }),
      supabaseAdmin.from('automation_logs').select('id', { count: 'exact' }).eq('status', 'success'),
      supabaseAdmin.from('automation_logs').select('id', { count: 'exact' }).eq('status', 'failed'),
    ])

    const { data: recentEvents } = await supabaseAdmin
      .from('automation_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)

    return {
      totalRules: rulesResult.count || 0,
      activeRules: (rulesResult.data || []).filter(r => r.is_active).length,
      totalEvents: eventsResult.count || 0,
      totalActionsExecuted: logsResult.count || 0,
      failedActions: failedResult.count || 0,
      recentEvents: (recentEvents || []) as AutomationEvent[],
    }
  } catch (error) {
    logger.error('[Automation] Failed to fetch stats:', error)
    return {
      totalRules: 0,
      activeRules: 0,
      totalEvents: 0,
      totalActionsExecuted: 0,
      failedActions: 0,
      recentEvents: [],
    }
  }
}
