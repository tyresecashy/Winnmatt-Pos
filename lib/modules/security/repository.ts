/**
 * Security Repository — Enterprise Core Data Access for Security & Permissions
 *
 * Encapsulates direct Supabase access for login_history, permission_definitions,
 * role_permissions, and user_permissions tables. Callers (module facade, server
 * actions) use this repository instead of calling supabase directly.
 *
 * Constitution Reference: §5 (Module Architecture), §9 (Transaction & Event Rules)
 */

import { BaseRepository } from '@/lib/modules/core/repository'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface LoginHistoryRow {
  id: string
  user_id: string
  ip_address: string | null
  user_agent: string | null
  device_info: string | null
  location: string | null
  status: 'success' | 'failed'
  failure_reason: string | null
  created_at: string
  [key: string]: unknown
}

export interface PaginatedLoginHistory {
  data: LoginHistoryRow[]
  count: number
}

export interface LoginHistoryFilterOptions {
  limit?: number
  offset?: number
  search?: string
}

export interface PermissionDefinitionRow {
  code: string
  label: string
  category: string
  description?: string | null
  [key: string]: unknown
}

export interface RolePermissionRow {
  id: string
  role: string
  permission_code: string
  grant_type: 'allow' | 'deny'
  branch_id?: string | null
  max_value?: number | null
  expires_at?: string | null
  requires_approval?: boolean
  created_by?: string | null
  created_at?: string
  permission?: { code: string; label: string; category: string } | null
  [key: string]: unknown
}

export interface UserPermissionRow {
  id: string
  user_id: string
  permission_code: string
  grant_type: 'allow' | 'deny'
  branch_id?: string | null
  max_value?: number | null
  expires_at?: string | null
  requires_approval?: boolean
  granted_by?: string | null
  created_at?: string
  permission?: { code: string; label: string; category: string } | null
  [key: string]: unknown
}

// ─── Repository ─────────────────────────────────────────────────────────────

export class SecurityRepository extends BaseRepository<LoginHistoryRow> {
  constructor() {
    super('login_history', {
      audit: { eventType: 'security.*', aggregateType: 'login_history' },
      lock: { resourcePrefix: 'security:' },
    })
  }

  /**
   * Fetch login history with pagination and optional search.
   */
  async getLoginHistory(options?: LoginHistoryFilterOptions): Promise<PaginatedLoginHistory> {
    const limit = options?.limit ?? 50
    const offset = options?.offset ?? 0

    let query = this.client
      .from('login_history')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (options?.search) {
      query = query.ilike('ip_address', `%${options.search}%`)
    }

    const { data, error, count } = await query
    if (error) throw this._toError(error, 'getLoginHistory')
    return { data: (data ?? []) as LoginHistoryRow[], count: count ?? 0 }
  }
}

// ─── Permission Repository ──────────────────────────────────────────────────

export class PermissionRepository extends BaseRepository<PermissionDefinitionRow> {
  constructor() {
    super('permission_definitions', {
      audit: { eventType: 'permission.*', aggregateType: 'permission' },
      lock: { resourcePrefix: 'permission:' },
    })
  }

  /**
   * Get all permission definitions ordered by category then label.
   */
  async getPermissionDefinitions(): Promise<PermissionDefinitionRow[]> {
    const { data, error } = await this.client
      .from('permission_definitions')
      .select('*')
      .order('category')
      .order('label')

    if (error) throw this._toError(error, 'getPermissionDefinitions')
    return (data ?? []) as PermissionDefinitionRow[]
  }

  /**
   * Get role permissions with permission definition join, optionally filtered by role.
   */
  async getRolePermissions(role?: string): Promise<RolePermissionRow[]> {
    let query = this.client
      .from('role_permissions')
      .select('*, permission:permission_definitions!permission_code(code, label, category)')

    if (role) query = query.eq('role', role)

    const { data, error } = await query
    if (error) throw this._toError(error, 'getRolePermissions')
    return (data ?? []) as RolePermissionRow[]
  }

  /**
   * Get user permissions with permission definition join, filtered by user ID.
   */
  async getUserPermissions(userId: string): Promise<UserPermissionRow[]> {
    const { data, error } = await this.client
      .from('user_permissions')
      .select('*, permission:permission_definitions!permission_code(code, label, category)')
      .eq('user_id', userId)

    if (error) throw this._toError(error, 'getUserPermissions')
    return (data ?? []) as UserPermissionRow[]
  }
}

// ─── Singletons ─────────────────────────────────────────────────────────────

export const securityRepo = new SecurityRepository()
export const permissionRepo = new PermissionRepository()
