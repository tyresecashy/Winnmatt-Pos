/**
 * Condition Evaluator — evaluates rule conditions against event payload.
 *
 * Supports: =, !=, >, <, >=, <=, IN, NOT_IN, CONTAINS, EXISTS, NOT_EXISTS
 * Supports nested conditions with AND/OR/NOT logic gates.
 */

import type { AutomationCondition, LogicGate } from './types'

/**
 * Evaluate a set of conditions against an event payload.
 * Root conditions (parent_id IS NULL) are evaluated ANDed together.
 * Nested conditions use their logic_gate (AND/OR/NOT).
 */
export function evaluateConditions(
  conditions: AutomationCondition[],
  payload: Record<string, unknown>
): boolean {
  if (conditions.length === 0) return true // No conditions = always match

  // Get root-level conditions (no parent)
  const rootConditions = conditions
    .filter(c => !c.parent_id)
    .sort((a, b) => a.sort_order - b.sort_order)

  if (rootConditions.length === 0) return true

  // All root conditions must pass (AND logic at root level)
  return rootConditions.every(c => evaluateCondition(c, conditions, payload))
}

/**
 * Evaluate a single condition (or recursive tree of conditions).
 */
function evaluateCondition(
  condition: AutomationCondition,
  allConditions: AutomationCondition[],
  payload: Record<string, unknown>
): boolean {
  if (condition.logic_gate === 'LEAF') {
    return evaluateLeaf(condition, payload)
  }

  // Get child conditions
  const children = allConditions
    .filter(c => c.parent_id === condition.id)
    .sort((a, b) => a.sort_order - b.sort_order)

  if (children.length === 0) return true

  switch (condition.logic_gate) {
    case 'AND':
      return children.every(c => evaluateCondition(c, allConditions, payload))

    case 'OR':
      return children.some(c => evaluateCondition(c, allConditions, payload))

    case 'NOT':
      return !children.every(c => evaluateCondition(c, allConditions, payload))

    default:
      return true
  }
}

/**
 * Evaluate a LEAF condition against the payload.
 * Extracts the field value from the payload and compares it using the operator.
 */
function evaluateLeaf(
  condition: AutomationCondition,
  payload: Record<string, unknown>
): boolean {
  if (!condition.field || !condition.operator) return true

  // Extract value from payload (supports dot notation: 'sale.total')
  const actualValue = getNestedValue(payload, condition.field)
  const expectedValue = condition.value

  // Handle null/undefined
  if (actualValue === undefined || actualValue === null) {
    if (condition.operator === 'EXISTS') return false
    if (condition.operator === 'NOT_EXISTS') return true
    if (condition.operator === '=') return expectedValue === 'null' || expectedValue === 'undefined'
    if (condition.operator === '!=') return expectedValue !== 'null' && expectedValue !== 'undefined'
    return false
  }

  switch (condition.operator) {
    case '=':
      return String(actualValue) === String(expectedValue)

    case '!=':
      return String(actualValue) !== String(expectedValue)

    case '>':
      return Number(actualValue) > Number(expectedValue)

    case '<':
      return Number(actualValue) < Number(expectedValue)

    case '>=':
      return Number(actualValue) >= Number(expectedValue)

    case '<=':
      return Number(actualValue) <= Number(expectedValue)

    case 'IN': {
      const list = parseList(expectedValue)
      return list.includes(String(actualValue))
    }

    case 'NOT_IN': {
      const list = parseList(expectedValue)
      return !list.includes(String(actualValue))
    }

    case 'CONTAINS':
      return String(actualValue).includes(String(expectedValue))

    case 'NOT_CONTAINS':
      return !String(actualValue).includes(String(expectedValue))

    case 'EXISTS':
      return actualValue !== undefined && actualValue !== null

    case 'NOT_EXISTS':
      return actualValue === undefined || actualValue === null

    default:
      return true
  }
}

/**
 * Get a nested value from an object using dot notation.
 * e.g. getNestedValue({ sale: { total: 100 } }, 'sale.total') → 100
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = obj

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined
    }
    current = (current as Record<string, unknown>)[part]
  }

  return current
}

/**
 * Parse a comma-separated list string into an array.
 * e.g. "a,b,c" → ["a", "b", "c"]
 */
function parseList(value: string | null): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) return parsed.map(String)
  } catch {
    // Not JSON, try comma-separated
  }
  return value.split(',').map(v => v.trim())
}
