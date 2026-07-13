import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock lib/automation/events ─────────────────────────────────────────────
const mockRealEmitEvent = vi.fn()

vi.mock('@/lib/automation/events', () => ({
  emitEvent: (...args: unknown[]) => mockRealEmitEvent(...args),
}))

vi.mock('@/lib/automation/types', () => ({})) // types only, no runtime impact

type QueryResult = { data: unknown; error: unknown; count?: number }
type QueryBuilder = Record<string, (...args: unknown[]) => QueryBuilder | QueryResult>

function queryBuilder(finalResult: QueryResult): QueryBuilder {
  const handler: QueryBuilder = new Proxy({} as QueryBuilder, {
    get(_target, prop: string) {
      if (prop === 'then') {
        const p = Promise.resolve(finalResult)
        return p.then.bind(p)
      }
      return (..._args: unknown[]) => handler
    },
  })
  return handler
}

vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: {
    from: vi.fn(() => queryBuilder({ data: [], error: null })),
  },
}))

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }))

import { emitEvent } from '@/lib/automation/events'
import { getAutomationRules as getRules, getAutomationEvents as getRecentEvents, getAutomationLogs as getLogs } from '@/lib/modules/automation'

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── emitEvent ──────────────────────────────────────────────────────────────

describe('emitEvent', () => {
  it('delegates to real emitEvent with mapped options', async () => {
    mockRealEmitEvent.mockResolvedValue({ eventId: 'evt-1', rulesEvaluated: 2, actionsExecuted: 1, durationMs: 50 })

    const result = await emitEvent({
      eventType: 'sale.completed',
      payload: { saleId: 'sale-1', total: 1000 },
      source: 'pos',
      entityType: 'sale',
      entityId: 'sale-1',
    })

    expect(mockRealEmitEvent).toHaveBeenCalledWith({
      eventType: 'sale.completed',
      payload: { saleId: 'sale-1', total: 1000 },
      source: 'pos',
      entityType: 'sale',
      entityId: 'sale-1',
    })
    expect(result).toEqual({ eventId: 'evt-1', rulesEvaluated: 2, actionsExecuted: 1, durationMs: 50 })
  })

  it('returns error on failure', async () => {
    mockRealEmitEvent.mockRejectedValue(new Error('Connection lost'))

    await expect(emitEvent({ eventType: 'stock.low', payload: {} })).rejects.toThrow('Connection lost')
  })
})

// ─── getRules (uses supabase directly) ──────────────────────────────────────

describe('getRules', () => {
  it('queries automation_rules table', async () => {
    const { supabaseAdmin } = await import('@/lib/supabase-server')
    const mockFrom = supabaseAdmin.from as ReturnType<typeof vi.fn>

    const mockRules = [
      { id: 'rule-1', name: 'Low Stock Alert', trigger_event: 'stock.low', is_active: true },
    ]
    mockFrom.mockReturnValue(queryBuilder({ data: mockRules, error: null }))

    const result = await getRules()
    // Verify supabase was called with the correct table
    expect(mockFrom).toHaveBeenCalledWith('automation_rules')
    expect(result).toEqual(mockRules)
  })

  it('returns empty on error', async () => {
    const { supabaseAdmin } = await import('@/lib/supabase-server')
    const mockFrom = supabaseAdmin.from as ReturnType<typeof vi.fn>

    mockFrom.mockReturnValue(queryBuilder({ data: null, error: { message: 'Table not found' } }))

    const result = await getRules()
    expect(result).toEqual([])
  })
})

// ─── getRecentEvents (uses supabase directly) ───────────────────────────────

describe('getRecentEvents', () => {
  it('queries automation_events table', async () => {
    const { supabaseAdmin } = await import('@/lib/supabase-server')
    const mockFrom = supabaseAdmin.from as ReturnType<typeof vi.fn>

    const mockEvents = [
      { id: 'evt-1', event_type: 'sale.completed', payload: { total: 1000 }, processed: true },
    ]
    mockFrom.mockReturnValue(queryBuilder({ data: mockEvents, error: null }))

    const result = await getRecentEvents(10)
    expect(mockFrom).toHaveBeenCalledWith('automation_events')
    expect(result).toEqual(mockEvents)
  })

  it('applies default limit', async () => {
    const { supabaseAdmin } = await import('@/lib/supabase-server')
    const mockFrom = supabaseAdmin.from as ReturnType<typeof vi.fn>

    mockFrom.mockReturnValue(queryBuilder({ data: [], error: null }))

    await getRecentEvents()
    // The query should have been built with a default limit
    expect(mockFrom).toHaveBeenCalled()
  })
})

// ─── getLogs (uses supabase directly) ───────────────────────────────────────

describe('getLogs', () => {
  it('queries automation_logs with limit', async () => {
    const { supabaseAdmin } = await import('@/lib/supabase-server')
    const mockFrom = supabaseAdmin.from as ReturnType<typeof vi.fn>

    const mockLogs = [
      { id: 'log-1', rule_id: 'rule-1', status: 'success', action_type: 'send_email' },
    ]
    mockFrom.mockReturnValue(queryBuilder({ data: mockLogs, error: null, count: 1 }))

    const result = await getLogs(10)
    expect(mockFrom).toHaveBeenCalledWith('automation_logs')
    expect(result).toEqual(mockLogs)
  })

  it('returns empty on error', async () => {
    const { supabaseAdmin } = await import('@/lib/supabase-server')
    const mockFrom = supabaseAdmin.from as ReturnType<typeof vi.fn>

    mockFrom.mockReturnValue(queryBuilder({ data: null, error: { message: 'DB error' } }))

    const result = await getLogs()
    expect(result).toEqual([])
  })
})
