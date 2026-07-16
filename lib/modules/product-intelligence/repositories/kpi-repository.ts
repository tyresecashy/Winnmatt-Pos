/**
 * KPI Repository — Data access layer for kpi_snapshots and kpi_targets tables.
 *
 * Sprint 11A: Infrastructure scaffolding.
 * Sprint 11F: Full implementation replacing throw-stubs. Cache integration,
 *             column selection, resilient wrappers.
 *
 * Tables: kpi_snapshots, kpi_targets
 */

import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import type { KPIId, KPISnapshot, KPIStatus, KPITarget, KPIQuery } from '../types'
import { piCache, kpiKey } from '../cache'
import { PICache } from '../cache'
import { resilientCall } from '../reliability'

// PI tables not in auto-generated Supabase types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const piDb = supabaseAdmin as any

// ─── Column Selectors ────────────────────────────────────────────

const KPI_SNAPSHOT_COLUMNS = `
  id,
  kpi_id,
  branch_id,
  value,
  target,
  status,
  computed_at,
  metadata
` as const

const KPI_TARGET_COLUMNS = `
  kpi_id,
  branch_id,
  target_value,
  threshold,
  set_by,
  set_at,
  notes
` as const

// ─── Row Mappers ──────────────────────────────────────────────────

interface SnapshotRow {
  id: string
  kpi_id: string
  branch_id: string | null
  value: number
  target: number | null
  status: string
  computed_at: string
  metadata: Record<string, unknown> | null
}

interface TargetRow {
  kpi_id: string
  branch_id: string | null
  target_value: number
  threshold: { critical: number; warning: number }
  set_by: string
  set_at: string
  notes: string | null
}

function rowToSnapshot(row: SnapshotRow): KPISnapshot {
  return {
    id: row.id,
    kpiId: row.kpi_id as KPIId,
    branchId: row.branch_id,
    value: row.value,
    target: row.target,
    status: row.status as KPIStatus,
    computedAt: row.computed_at,
    metadata: row.metadata,
  }
}

function rowToTarget(row: TargetRow): KPITarget {
  return {
    kpiId: row.kpi_id as KPIId,
    branchId: row.branch_id,
    targetValue: row.target_value,
    threshold: row.threshold,
    setBy: row.set_by,
    setAt: row.set_at,
    notes: row.notes ?? undefined,
  }
}

/**
 * KPI Repository handles CRUD for KPI snapshots and targets.
 *
 * Tables:
 * - kpi_snapshots: Time-series KPI measurements
 * - kpi_targets: Configurable KPI targets and thresholds
 */
export class KPIRepository {
  /**
   * Insert a KPI snapshot.
   */
  async insertSnapshot(params: {
    kpiId: KPIId
    branchId: string | null
    value: number
    target: number | null
    status: KPIStatus
    metadata?: Record<string, unknown>
  }): Promise<KPISnapshot> {
    return resilientCall(async () => {
      const { data, error } = await piDb
        .from('kpi_snapshots')
        .insert({
          kpi_id: params.kpiId,
          branch_id: params.branchId,
          value: params.value,
          target: params.target,
          status: params.status,
          metadata: params.metadata ?? null,
        })
        .select(KPI_SNAPSHOT_COLUMNS)
        .single()

      if (error) throw error
      // Invalidate cache for this KPI
      piCache.del(kpiKey(params.kpiId, params.branchId ?? undefined))
      return rowToSnapshot(data as unknown as SnapshotRow)
    }, { label: 'kpi.insertSnapshot', timeoutMs: 5000 }) as Promise<KPISnapshot>
  }

  /**
   * Get the latest snapshot for a KPI.
   */
  async getLatestSnapshot(kpiId: KPIId, branchId: string | null): Promise<KPISnapshot | null> {
    const cacheKey = kpiKey(kpiId, branchId ?? undefined)
    const cached = piCache.get<KPISnapshot>(cacheKey, {
      label: 'kpi.getLatestSnapshot',
      ttlSeconds: PICache.TTL.KPI_SNAPSHOT,
    })
    if (cached) return cached

    const data = await resilientCall(async () => {
      const { data: row, error } = await piDb
        .from('kpi_snapshots')
        .select(KPI_SNAPSHOT_COLUMNS)
        .eq('kpi_id', kpiId)
        .eq('branch_id', branchId)
        .order('computed_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) throw error
      return row
    }, { label: 'kpi.getLatestSnapshot', timeoutMs: 5000 })

    if (!data) return null
    const snapshot = rowToSnapshot(data as unknown as SnapshotRow)
    piCache.set(cacheKey, snapshot, { ttlSeconds: PICache.TTL.KPI_SNAPSHOT })
    return snapshot
  }

  /**
   * Query snapshots with filters.
   */
  async querySnapshots(query: KPIQuery): Promise<KPISnapshot[]> {
    return (await resilientCall(async () => {
      let dbQuery = piDb
        .from('kpi_snapshots')
        .select(KPI_SNAPSHOT_COLUMNS)
        .order('computed_at', { ascending: false })

      if (query.kpiIds && query.kpiIds.length > 0) dbQuery = dbQuery.in('kpi_id', query.kpiIds)
      if (query.branchId) dbQuery = dbQuery.eq('branch_id', query.branchId)
      if (query.status) dbQuery = dbQuery.eq('status', query.status)
      if (query.startDate) dbQuery = dbQuery.gte('computed_at', query.startDate)
      if (query.endDate) dbQuery = dbQuery.lte('computed_at', query.endDate)
      if (query.limit) dbQuery = dbQuery.limit(query.limit)
      if (query.offset) dbQuery = dbQuery.range(query.offset, query.offset + (query.limit || 50) - 1)

      const { data, error } = await dbQuery
      if (error) throw error
      return (data ?? []).map((row: unknown) => rowToSnapshot(row as SnapshotRow))
    }, { label: 'kpi.querySnapshots', timeoutMs: 10000 })) ?? []
  }

  /**
   * Upsert a KPI target.
   */
  async upsertTarget(target: KPITarget): Promise<void> {
    await resilientCall(async () => {
      const { error } = await piDb
        .from('kpi_targets')
        .upsert({
          kpi_id: target.kpiId,
          branch_id: target.branchId,
          target_value: target.targetValue,
          threshold: target.threshold,
          set_by: target.setBy,
          notes: target.notes ?? null,
        }, { onConflict: 'kpi_id,branch_id' })

      if (error) throw error
      piCache.del(kpiKey(target.kpiId, target.branchId ?? undefined))
      return null
    }, { label: 'kpi.upsertTarget', timeoutMs: 5000 })
  }

  /**
   * Get target for a KPI.
   */
  async getTarget(kpiId: KPIId, branchId: string | null): Promise<KPITarget | null> {
    const cacheKey = `${kpiKey(kpiId, branchId ?? undefined)}:target`
    const cached = piCache.get<KPITarget>(cacheKey, {
      label: 'kpi.getTarget',
      ttlSeconds: PICache.TTL.KPI_SNAPSHOT,
    })
    if (cached) return cached

    const data = await resilientCall(async () => {
      const { data: row, error } = await piDb
        .from('kpi_targets')
        .select(KPI_TARGET_COLUMNS)
        .eq('kpi_id', kpiId)
        .eq('branch_id', branchId)
        .maybeSingle()

      if (error) throw error
      return row
    }, { label: 'kpi.getTarget', timeoutMs: 5000 })

    if (!data) return null
    const target = rowToTarget(data as unknown as TargetRow)
    piCache.set(cacheKey, target, { ttlSeconds: PICache.TTL.KPI_SNAPSHOT })
    return target
  }

  /**
   * Get all targets.
   */
  async getAllTargets(branchId: string | null): Promise<KPITarget[]> {
    return (await resilientCall(async () => {
      let query = piDb
        .from('kpi_targets')
        .select(KPI_TARGET_COLUMNS)

      if (branchId !== null && branchId !== undefined) {
        query = query.eq('branch_id', branchId)
      }

      const { data, error } = await query
      if (error) throw error
      return (data ?? []).map((row: unknown) => rowToTarget(row as TargetRow))
    }, { label: 'kpi.getAllTargets', timeoutMs: 10000 })) ?? []
  }

  /**
   * Delete a target.
   */
  async deleteTarget(kpiId: KPIId, branchId: string | null): Promise<void> {
    await resilientCall(async () => {
      const { error } = await piDb
        .from('kpi_targets')
        .delete()
        .eq('kpi_id', kpiId)
        .eq('branch_id', branchId)

      if (error) throw error
      piCache.del(kpiKey(kpiId, branchId ?? undefined))
      return null
    }, { label: 'kpi.deleteTarget', timeoutMs: 5000 })
  }

  /**
   * Delete snapshots older than the retention period.
   */
  async pruneOldSnapshots(retentionDays: number): Promise<number> {
    const cutoff = new Date(Date.now() - retentionDays * 86400000).toISOString()
    const count = await resilientCall(async () => {
      const { data, error } = await piDb
        .from('kpi_snapshots')
        .delete()
        .lt('computed_at', cutoff)
        .select('id')

      if (error) throw error
      return (data ?? []).length
    }, { label: 'kpi.pruneOldSnapshots', timeoutMs: 30000 }) ?? 0

    if (count > 0) {
      piCache.delByPrefix('kpi:')
      logger.info('[KPIRepo] pruned old KPI snapshots', { retentionDays, deleted: count })
    }
    return count
  }
}

export const kpiRepository = new KPIRepository()
