/**
 * Security Repository Tests
 *
 * Tests for SecurityRepository and PermissionRepository enterprise core data access layers.
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

import { SecurityRepository, PermissionRepository, securityRepo as exportedSecurityRepo, permissionRepo as exportedPermissionRepo, type LoginHistoryRow, type PermissionDefinitionRow, type RolePermissionRow, type UserPermissionRow } from '@/lib/modules/security/repository'

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface MockQuery {
  then: (resolve: (v: unknown) => void) => void
  _terminalData: { data: unknown; error: unknown; count: number }
  select: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  ilike: ReturnType<typeof vi.fn>
  range: ReturnType<typeof vi.fn>
}

function createMockQuery(): MockQuery {
  const _terminalData = { data: null, error: null, count: 0 }

  const methods = ['select', 'eq', 'order', 'ilike', 'range'] as const

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

let securityRepo: SecurityRepository
let permissionRepo: PermissionRepository
let query: MockQuery

beforeEach(() => {
  vi.clearAllMocks()
  query = createMockQuery()
  mockFrom.mockReturnValue(query)
  securityRepo = new SecurityRepository()
  permissionRepo = new PermissionRepository()
})

// ─── Tests: SecurityRepository ──────────────────────────────────────────────

describe('SecurityRepository', () => {
  describe('constructor', () => {
    it('initializes with correct table name', () => {
      expect(securityRepo).toBeInstanceOf(SecurityRepository)
      expect(mockFrom).not.toHaveBeenCalled()
    })

    it('exports a singleton instance', () => {
      expect(exportedSecurityRepo).toBeInstanceOf(SecurityRepository)
    })
  })

  describe('getLoginHistory', () => {
    it('returns paginated login history ordered by created_at descending', async () => {
      const rows: Partial<LoginHistoryRow>[] = [
        { id: 'log-1', user_id: 'u-1', ip_address: '192.168.1.1', status: 'success', created_at: '2026-07-14T10:00:00Z' },
        { id: 'log-2', user_id: 'u-2', ip_address: '192.168.1.2', status: 'failed', created_at: '2026-07-13T10:00:00Z' },
      ]
      query._terminalData = { data: rows, error: null, count: 2 }

      const result = await securityRepo.getLoginHistory({ limit: 50, offset: 0 })

      expect(mockFrom).toHaveBeenCalledWith('login_history')
      expect(query.select).toHaveBeenCalledWith('*', { count: 'exact' })
      expect(query.order).toHaveBeenCalledWith('created_at', { ascending: false })
      expect(query.range).toHaveBeenCalledWith(0, 49)
      expect(result.data).toEqual(rows)
      expect(result.count).toBe(2)
    })

    it('applies search filter on ip_address via ILIKE', async () => {
      query._terminalData = { data: [], error: null, count: 0 }

      await securityRepo.getLoginHistory({ search: '192.168', limit: 10, offset: 0 })

      expect(query.ilike).toHaveBeenCalledWith('ip_address', '%192.168%')
    })

    it('uses default limit of 50 when not provided', async () => {
      query._terminalData = { data: [], error: null, count: 0 }

      await securityRepo.getLoginHistory()

      expect(query.range).toHaveBeenCalledWith(0, 49)
    })

    it('returns empty data on null result', async () => {
      query._terminalData = { data: null, error: null, count: 0 }

      const result = await securityRepo.getLoginHistory()
      expect(result.data).toEqual([])
      expect(result.count).toBe(0)
    })

    it('throws on database error', async () => {
      query._terminalData = { data: null, error: { code: 'PGRST301', message: 'Database error' }, count: 0 }

      await expect(securityRepo.getLoginHistory()).rejects.toThrow()
    })
  })
})

// ─── Tests: PermissionRepository ─────────────────────────────────────────────

describe('PermissionRepository', () => {
  describe('constructor', () => {
    it('initializes with correct table name', () => {
      expect(permissionRepo).toBeInstanceOf(PermissionRepository)
    })

    it('exports a singleton instance', () => {
      expect(exportedPermissionRepo).toBeInstanceOf(PermissionRepository)
    })
  })

  describe('getPermissionDefinitions', () => {
    it('returns all definitions ordered by category then label', async () => {
      const rows: Partial<PermissionDefinitionRow>[] = [
        { code: 'sales.create', label: 'Create Sales', category: 'Sales' },
        { code: 'inv.view', label: 'View Inventory', category: 'Inventory' },
      ]
      query._terminalData = { data: rows, error: null, count: 0 }

      const result = await permissionRepo.getPermissionDefinitions()

      expect(mockFrom).toHaveBeenCalledWith('permission_definitions')
      expect(query.select).toHaveBeenCalledWith('*')
      expect(query.order).toHaveBeenCalledWith('category')
      expect(query.order).toHaveBeenCalledWith('label')
      expect(result).toEqual(rows)
    })

    it('returns empty array on null data', async () => {
      query._terminalData = { data: null, error: null, count: 0 }

      const result = await permissionRepo.getPermissionDefinitions()
      expect(result).toEqual([])
    })

    it('throws on database error', async () => {
      query._terminalData = { data: null, error: { code: 'PGRST301', message: 'Database error' }, count: 0 }

      await expect(permissionRepo.getPermissionDefinitions()).rejects.toThrow()
    })
  })

  describe('getRolePermissions', () => {
    it('returns role permissions with permission join', async () => {
      const rows: Partial<RolePermissionRow>[] = [
        { id: 'rp-1', role: 'admin', permission_code: 'sales.create', grant_type: 'allow' },
      ]
      query._terminalData = { data: rows, error: null, count: 0 }

      const result = await permissionRepo.getRolePermissions()

      expect(mockFrom).toHaveBeenCalledWith('role_permissions')
      expect(query.select).toHaveBeenCalledWith('*, permission:permission_definitions!permission_code(code, label, category)')
      expect(result).toEqual(rows)
    })

    it('filters by role when provided', async () => {
      query._terminalData = { data: [], error: null, count: 0 }

      await permissionRepo.getRolePermissions('admin')

      expect(query.eq).toHaveBeenCalledWith('role', 'admin')
    })

    it('does not filter by role when omitted', async () => {
      query._terminalData = { data: [], error: null, count: 0 }

      await permissionRepo.getRolePermissions()

      expect(query.eq).not.toHaveBeenCalled()
    })
  })

  describe('getUserPermissions', () => {
    it('returns user permissions with permission join filtered by userId', async () => {
      const rows: Partial<UserPermissionRow>[] = [
        { id: 'up-1', user_id: 'u-1', permission_code: 'sales.create', grant_type: 'allow' },
      ]
      query._terminalData = { data: rows, error: null, count: 0 }

      const result = await permissionRepo.getUserPermissions('u-1')

      expect(mockFrom).toHaveBeenCalledWith('user_permissions')
      expect(query.select).toHaveBeenCalledWith('*, permission:permission_definitions!permission_code(code, label, category)')
      expect(query.eq).toHaveBeenCalledWith('user_id', 'u-1')
      expect(result).toEqual(rows)
    })

    it('returns empty array on null data', async () => {
      query._terminalData = { data: null, error: null, count: 0 }

      const result = await permissionRepo.getUserPermissions('u-nonexistent')
      expect(result).toEqual([])
    })
  })

  describe('PermissionRepository — exists (inherited)', () => {
    it('returns true when a record matches the filter', async () => {
      query._terminalData = { data: [], error: null, count: 1 }
      const result = await permissionRepo.exists({ code: 'sales.create' })
      expect(result).toBe(true)
    })

    it('returns false when no records match', async () => {
      query._terminalData = { data: [], error: null, count: 0 }
      const result = await permissionRepo.exists({ code: 'nonexistent' })
      expect(result).toBe(false)
    })
  })
})

describe('SecurityRepository — exists (inherited)', () => {
  it('returns true when a record matches the filter', async () => {
    query._terminalData = { data: [], error: null, count: 1 }
    const result = await securityRepo.exists({ user_id: 'u-1' })
    expect(result).toBe(true)
  })

  it('returns false when no records match', async () => {
    query._terminalData = { data: [], error: null, count: 0 }
    const result = await securityRepo.exists({ user_id: 'nonexistent' })
    expect(result).toBe(false)
  })
})
