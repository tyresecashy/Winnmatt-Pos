/**
 * Branch Repository — Enterprise Core Data Access for Branches
 *
 * Encapsulates direct Supabase access for the branches and users tables.
 * Callers (module facade, server actions) use this repository
 * instead of calling supabase directly.
 *
 * Constitution Reference: §5 (Module Architecture), §9 (Transaction & Event Rules)
 */

import { BaseRepository } from '@/lib/modules/core/repository'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BranchRow {
  id: string
  name: string
  code: string
  location: string | null
  phone: string | null
  email: string | null
  latitude: number | null
  longitude: number | null
  open_time: string | null
  close_time: string | null
  tax_id: string | null
  tax_rate: number | null
  manager_id: string | null
  manager_name: string | null
  timezone: string
  type: 'main' | 'branch' | 'warehouse'
  status: 'active' | 'inactive'
  is_main: boolean
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface BranchManagerRow {
  id: string
  full_name: string
}

// ─── Mapping helper ─────────────────────────────────────────────────────────

/**
 * Maps a raw Supabase row (potentially with joined manager) to a typed BranchRow.
 */
export function mapBranch(raw: Record<string, unknown>): BranchRow {
  const manager = raw.manager as { full_name?: string } | null | undefined
  return {
    id: raw.id as string,
    name: raw.name as string,
    code: raw.code as string,
    location: (raw.location as string) ?? null,
    phone: (raw.phone as string) ?? null,
    email: (raw.email as string) ?? null,
    latitude: (raw.latitude as number) ?? null,
    longitude: (raw.longitude as number) ?? null,
    open_time: (raw.open_time as string) ?? null,
    close_time: (raw.close_time as string) ?? null,
    tax_id: (raw.tax_id as string) ?? null,
    tax_rate: (raw.tax_rate as number) ?? null,
    manager_id: (raw.manager_id as string) ?? null,
    manager_name: manager?.full_name ?? null,
    timezone: (raw.timezone as string) ?? 'Africa/Nairobi',
    type: (raw.type as 'main' | 'branch' | 'warehouse') ?? 'branch',
    status: (raw.status as 'active' | 'inactive') ?? 'active',
    is_main: (raw.is_main as boolean) ?? false,
    created_at: raw.created_at as string,
    updated_at: (raw.updated_at as string) ?? raw.created_at as string,
  }
}

// ─── Repository ─────────────────────────────────────────────────────────────

export class BranchRepository extends BaseRepository<BranchRow> {
  constructor() {
    super('branches', {
      audit: { eventType: 'branch.*', aggregateType: 'branch' },
      lock: { resourcePrefix: 'branch:' },
    })
  }

  /**
   * Get all branches with manager join, ordered by name.
   */
  async getBranches(): Promise<BranchRow[]> {
    const { data, error } = await this.client
      .from('branches')
      .select('*, manager:users!manager_id(full_name)')
      .order('name')

    if (error) throw this._toError(error, 'getBranches')
    return ((data ?? []) as Record<string, unknown>[]).map(mapBranch)
  }

  /**
   * Get a single branch by ID with manager join.
   */
  async getBranchById(id: string): Promise<BranchRow | null> {
    const { data, error } = await this.client
      .from('branches')
      .select('*, manager:users!manager_id(full_name)')
      .eq('id', id)
      .single()

    if (error) {
      const errObj = error as { code?: string }
      if (errObj.code === 'PGRST116') return null
      throw this._toError(error, 'getBranchById')
    }
    return data ? mapBranch(data as Record<string, unknown>) : null
  }

  /**
   * Get active users eligible to be branch managers.
   */
  async getBranchManagers(): Promise<BranchManagerRow[]> {
    const { data, error } = await this.client
      .from('users')
      .select('id, full_name')
      .in('role', ['super_admin', 'admin', 'manager'])
      .eq('status', 'active')
      .order('full_name')

    if (error) throw this._toError(error, 'getBranchManagers')
    return (data ?? []) as BranchManagerRow[]
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

export const branchRepo = new BranchRepository()
