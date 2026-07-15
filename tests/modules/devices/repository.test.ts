/**
 * Device Repository Tests
 *
 * Tests for DeviceRepository enterprise core data access layer.
 * All Supabase calls are mocked to test only business logic
 * (query construction, error handling, data shaping).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock Supabase client (hoisted) ─────────────────────────────────────────

const { mockFrom, mockSupabaseAdmin } = vi.hoisted(() => {
  const _mockFrom = vi.fn()
  return { mockFrom: _mockFrom, mockSupabaseAdmin: { from: _mockFrom } }
})

vi.mock('@/lib/supabase-server', () => ({
  getSupabaseAdmin: () => mockSupabaseAdmin,
}))

import { DeviceRepository, deviceRepo, type DeviceRow } from '@/lib/modules/devices/repository'

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface MockQuery {
  then: (resolve: (v: unknown) => void) => void
  _terminalData: { data: unknown; error: unknown; count: number }
  select: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
}

function createMockQuery(): MockQuery {
  const _terminalData = { data: null, error: null, count: 0 }

  const methods = ['select', 'eq', 'order', 'single'] as const

  const query: Record<string, unknown> = {
    then: function (this: Record<string, unknown>, resolve: (value: unknown) => void) {
      return resolve(this._terminalData as { data: unknown; error: unknown; count: number })
    },
    _terminalData,
  }

  for (const method of methods) {
    const spy = vi.fn((..._args: unknown[]) => query)
    query[method] = spy
  }

  return query as unknown as MockQuery
}

let repo: DeviceRepository
let query: MockQuery

beforeEach(() => {
  vi.clearAllMocks()
  query = createMockQuery()
  mockFrom.mockReturnValue(query)
  repo = new DeviceRepository()
})

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('DeviceRepository', () => {
  describe('constructor', () => {
    it('initializes with correct table name and options', () => {
      expect(repo).toBeInstanceOf(DeviceRepository)
      expect(mockFrom).not.toHaveBeenCalled()
    })

    it('exports a singleton instance', () => {
      expect(deviceRepo).toBeInstanceOf(DeviceRepository)
    })
  })

  describe('getDevices', () => {
    it('returns all devices ordered by last_seen_at descending', async () => {
      const devices: Partial<DeviceRow>[] = [
        { id: 'dev-1', name: 'POS-1', status: 'online', last_seen_at: '2026-07-14T10:00:00Z' },
        { id: 'dev-2', name: 'POS-2', status: 'offline', last_seen_at: '2026-07-13T10:00:00Z' },
      ]
      query._terminalData = { data: devices, error: null, count: 0 }

      const result = await repo.getDevices()

      expect(mockFrom).toHaveBeenCalledWith('devices')
      expect(query.select).toHaveBeenCalledWith('*')
      expect(query.order).toHaveBeenCalledWith('last_seen_at', { ascending: false, nullsFirst: false })
      expect(result).toEqual(devices)
    })

    it('filters by branch when branchId is provided', async () => {
      query._terminalData = { data: [], error: null, count: 0 }

      await repo.getDevices('branch-1')

      expect(query.eq).toHaveBeenCalledWith('branch_id', 'branch-1')
    })

    it('does not filter by branch when branchId is omitted', async () => {
      query._terminalData = { data: [], error: null, count: 0 }

      await repo.getDevices()

      expect(query.eq).not.toHaveBeenCalled()
    })

    it('returns empty array on null data', async () => {
      query._terminalData = { data: null, error: null, count: 0 }

      const result = await repo.getDevices()
      expect(result).toEqual([])
    })

    it('throws on database error', async () => {
      query._terminalData = { data: null, error: { code: 'PGRST301', message: 'Database error' }, count: 0 }

      await expect(repo.getDevices()).rejects.toThrow()
    })
  })

  describe('getDevice', () => {
    it('returns a single device by ID', async () => {
      const device: Partial<DeviceRow> = { id: 'dev-1', name: 'POS-1', status: 'online' }
      query._terminalData = { data: device, error: null, count: 0 }

      const result = await repo.getDevice('dev-1')

      expect(mockFrom).toHaveBeenCalledWith('devices')
      expect(query.select).toHaveBeenCalledWith('*')
      expect(query.eq).toHaveBeenCalledWith('id', 'dev-1')
      expect(query.single).toHaveBeenCalled()
      expect(result).toEqual(device)
    })

    it('returns null when device not found (PGRST116)', async () => {
      query._terminalData = { data: null, error: { code: 'PGRST116', message: 'Not found' }, count: 0 }

      const result = await repo.getDevice('nonexistent')
      expect(result).toBeNull()
    })

    it('throws on non-PGRST116 database error', async () => {
      query._terminalData = { data: null, error: { code: 'PGRST301', message: 'Database error' }, count: 0 }

      await expect(repo.getDevice('dev-1')).rejects.toThrow()
    })
  })

  describe('exists (inherited)', () => {
    it('returns true when a record matches the filter', async () => {
      query._terminalData = { data: [], error: null, count: 1 }
      const result = await repo.exists({ device_id: 'dev-1' })
      expect(result).toBe(true)
    })

    it('returns false when no records match', async () => {
      query._terminalData = { data: [], error: null, count: 0 }
      const result = await repo.exists({ device_id: 'nonexistent' })
      expect(result).toBe(false)
    })
  })
})
