/**
 * Branch Repository Tests
 *
 * Tests for BranchRepository enterprise core data access layer.
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

import { BranchRepository, branchRepo, mapBranch, type BranchRow, type BranchManagerRow } from '@/lib/modules/branches/repository'

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface MockQuery {
  then: (resolve: (v: unknown) => void) => void
  _terminalData: { data: unknown; error: unknown; count: number }
  select: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  in: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
}

function createMockQuery(): MockQuery {
  const _terminalData = { data: null, error: null, count: 0 }

  const methods = ['select', 'eq', 'order', 'in', 'single'] as const

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

let repo: BranchRepository
let query: MockQuery

beforeEach(() => {
  vi.clearAllMocks()
  query = createMockQuery()
  mockFrom.mockReturnValue(query)
  repo = new BranchRepository()
})

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('BranchRepository', () => {
  describe('constructor', () => {
    it('initializes with correct table name and options', () => {
      expect(repo).toBeInstanceOf(BranchRepository)
      expect(mockFrom).not.toHaveBeenCalled()
    })

    it('exports a singleton instance', () => {
      expect(branchRepo).toBeInstanceOf(BranchRepository)
    })
  })

  describe('getBranches', () => {
    it('returns all branches ordered by name with manager join mapped', async () => {
      const rawData = [
        {
          id: 'b-1',
          name: 'Main Branch',
          code: 'M',
          location: 'Nairobi',
          manager: { full_name: 'Alice' },
          timezone: 'Africa/Nairobi',
          type: 'main',
          status: 'active',
          is_main: true,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
        {
          id: 'b-2',
          name: 'West Branch',
          code: 'W',
          location: null,
          manager: null,
          created_at: '2026-01-02T00:00:00Z',
        },
      ]
      query._terminalData = { data: rawData, error: null, count: 0 }

      const result = await repo.getBranches()

      expect(mockFrom).toHaveBeenCalledWith('branches')
      expect(query.select).toHaveBeenCalledWith('*, manager:users!manager_id(full_name)')
      expect(query.order).toHaveBeenCalledWith('name')
      expect(result).toHaveLength(2)
      expect(result[0].manager_name).toBe('Alice')
      expect(result[1].manager_name).toBeNull()
    })

    it('returns empty array on null data', async () => {
      query._terminalData = { data: null, error: null, count: 0 }

      const result = await repo.getBranches()
      expect(result).toEqual([])
    })

    it('throws on database error', async () => {
      query._terminalData = { data: null, error: { code: 'PGRST301', message: 'Database error' }, count: 0 }

      await expect(repo.getBranches()).rejects.toThrow()
    })
  })

  describe('getBranchById', () => {
    it('returns a single branch by ID with manager join mapped', async () => {
      const rawData = {
        id: 'b-1',
        name: 'Main Branch',
        code: 'M',
        manager: { full_name: 'Alice' },
        timezone: 'Africa/Nairobi',
        type: 'main',
        status: 'active',
        is_main: true,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      }
      query._terminalData = { data: rawData, error: null, count: 0 }

      const result = await repo.getBranchById('b-1')

      expect(mockFrom).toHaveBeenCalledWith('branches')
      expect(query.eq).toHaveBeenCalledWith('id', 'b-1')
      expect(query.single).toHaveBeenCalled()
      expect(result).not.toBeNull()
      expect(result!.manager_name).toBe('Alice')
    })

    it('returns null when branch not found (PGRST116)', async () => {
      query._terminalData = { data: null, error: { code: 'PGRST116', message: 'Not found' }, count: 0 }

      const result = await repo.getBranchById('nonexistent')
      expect(result).toBeNull()
    })

    it('throws on non-PGRST116 database error', async () => {
      query._terminalData = { data: null, error: { code: 'PGRST301', message: 'Database error' }, count: 0 }

      await expect(repo.getBranchById('b-1')).rejects.toThrow()
    })
  })

  describe('getBranchManagers', () => {
    it('returns active managers with admin/manager/super_admin roles', async () => {
      const managers: Partial<BranchManagerRow>[] = [
        { id: 'u-1', full_name: 'Alice' },
        { id: 'u-2', full_name: 'Bob' },
      ]
      query._terminalData = { data: managers, error: null, count: 0 }

      const result = await repo.getBranchManagers()

      expect(mockFrom).toHaveBeenCalledWith('users')
      expect(query.select).toHaveBeenCalledWith('id, full_name')
      expect(query.in).toHaveBeenCalledWith('role', ['super_admin', 'admin', 'manager'])
      expect(query.eq).toHaveBeenCalledWith('status', 'active')
      expect(query.order).toHaveBeenCalledWith('full_name')
      expect(result).toEqual(managers)
    })

    it('returns empty array on null data', async () => {
      query._terminalData = { data: null, error: null, count: 0 }

      const result = await repo.getBranchManagers()
      expect(result).toEqual([])
    })
  })

  describe('mapBranch', () => {
    it('maps raw record with manager to BranchRow', () => {
      const raw = {
        id: 'b-1',
        name: 'Main',
        code: 'M',
        manager: { full_name: 'Alice' },
        timezone: 'Africa/Nairobi',
        type: 'main',
        status: 'active',
        is_main: true,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      }

      const result = mapBranch(raw)

      expect(result.id).toBe('b-1')
      expect(result.manager_name).toBe('Alice')
      expect(result.type).toBe('main')
      expect(result.status).toBe('active')
      expect(result.is_main).toBe(true)
    })

    it('provides defaults for missing fields', () => {
      const raw: Record<string, unknown> = {
        id: 'b-1',
        name: 'Main',
        code: 'M',
        created_at: '2026-01-01T00:00:00Z',
      }

      const result = mapBranch(raw)

      expect(result.location).toBeNull()
      expect(result.manager_name).toBeNull()
      expect(result.timezone).toBe('Africa/Nairobi')
      expect(result.type).toBe('branch')
      expect(result.status).toBe('active')
      expect(result.is_main).toBe(false)
    })
  })

  describe('exists (inherited)', () => {
    it('returns true when a record matches the filter', async () => {
      query._terminalData = { data: [], error: null, count: 1 }
      const result = await repo.exists({ code: 'M' })
      expect(result).toBe(true)
    })

    it('returns false when no records match', async () => {
      query._terminalData = { data: [], error: null, count: 0 }
      const result = await repo.exists({ code: 'NONEXISTENT' })
      expect(result).toBe(false)
    })
  })
})
