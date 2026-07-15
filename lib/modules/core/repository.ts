/**
 * Base Repository — Enterprise Core Data Access Layer
 *
 * Every domain repository extends this class to get automatic wiring of:
 *   - Correlation IDs (traceability)
 *   - Identity context (who/what/where)
 *   - Audit logging (before/after snapshots)
 *   - Lock management (concurrency protection)
 *   - Idempotency (duplicate prevention)
 *
 * Constitution Reference: §5 (Module Architecture), §9 (Transaction & Event Rules)
 *
 * Usage:
 *   class SalesRepo extends BaseRepository<'sales', SaleRow> {
 *     constructor(client: SupabaseClient) { super(client, 'sales', { audit: { eventType: 'sale.*', aggregateType: 'sale' } }); }
 *     async findByReceipt(receiptNumber: string) { return this.findOne('receipt_number', receiptNumber); }
 *   }
 */

import { getCorrelationId, generateCorrelationId } from './correlation-id'
import { recordAudit, createDiff } from './audit-engine'
import { acquireLock, releaseLock, withLock } from './lock-manager'
import { getCurrentUserId, getCurrentBranchId, getCurrentRole, getCurrentDeviceId } from './identity-context'
import { now } from './business-clock'
import { createId } from '@paralleldrive/cuid2'
import { getSupabaseAdmin } from '@/lib/supabase-server'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RepositoryOptions {
  /** Auto-audit every insert/update/delete */
  audit?: {
    eventType: string    // e.g. 'sale.*', 'product.*'
    aggregateType: string // e.g. 'sale', 'product'
  }
  /** Auto-acquire a lock before mutations */
  lock?: {
    resourcePrefix: string // e.g. 'sale:', 'product:'
  }
}

export interface PaginationParams {
  page?: number
  pageSize?: number
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}

export interface RepositoryError extends Error {
  code: string
  details?: unknown
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function repoError(code: string, message: string, details?: unknown): RepositoryError {
  const err = new Error(message) as RepositoryError
  err.code = code
  err.details = details
  return err
}

// ─── Base Repository ─────────────────────────────────────────────────────────

export class BaseRepository<TTable extends Record<string, unknown>> {
  private _client: { from: (table: string) => Record<string, any> } | null = null

  constructor(
    protected readonly tableName: string,
    protected readonly options?: RepositoryOptions,
  ) {}

  /**
   * Lazily acquired Supabase client — never called during module evaluation.
   * Subclasses MUST NOT call getSupabaseAdmin() in constructors, default
   * parameter values, property initializers, or top-level singletons.
   */
  protected get client(): { from: (table: string) => Record<string, any> } {
    if (!this._client) {
      // Lazy: first access triggers the call, not module evaluation.
      // Import at top of file is safe — only the call here is deferred.
      this._client = getSupabaseAdmin()
    }
    return this._client
  }

  // ── Core CRUD ───────────────────────────────────────────────────────────

  /**
   * Find a record by its `id` column.
   */
  async findById(id: string): Promise<TTable | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw this._toError(error, 'findById')
    return (data ?? null) as TTable | null
  }

  /**
   * Find a single record by an equality filter.
   */
  async findOne(column: string, value: unknown): Promise<TTable | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq(column, value)
      .maybeSingle()

    if (error) throw this._toError(error, 'findOne')
    return (data ?? null) as TTable | null
  }

  /**
   * Find all records with optional filters, ordering, and pagination.
   */
  async findMany(
    filters?: Record<string, unknown>,
    options?: {
      orderBy?: string
      ascending?: boolean
      limit?: number
      offset?: number
    },
  ): Promise<TTable[]> {
    let query = this.client.from(this.tableName).select('*', { count: 'exact' })

    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value)
        }
      }
    }

    if (options?.orderBy) {
      query = query.order(options.orderBy, { ascending: options.ascending ?? false })
    }

    if (options?.limit) {
      query = query.limit(options.limit)
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit ?? 50) - 1)
    }

    const { data, error } = await query

    if (error) throw this._toError(error, 'findMany')
    return (data ?? []) as TTable[]
  }

  /**
   * Find records with full pagination metadata.
   */
  async findManyPaginated(
    filters?: Record<string, unknown>,
    pagination?: PaginationParams,
    options?: {
      orderBy?: string
      ascending?: boolean
    },
  ): Promise<PaginatedResult<TTable>> {
    const page = pagination?.page ?? 1
    const pageSize = pagination?.pageSize ?? 50
    const offset = (page - 1) * pageSize

    let query = this.client.from(this.tableName).select('*', { count: 'exact', head: false })

    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value)
        }
      }
    }

    if (options?.orderBy) {
      query = query.order(options.orderBy, { ascending: options.ascending ?? false })
    }

    const { data, error, count } = await query.range(offset, offset + pageSize - 1)

    if (error) throw this._toError(error, 'findManyPaginated')
    return {
      data: (data ?? []) as TTable[],
      total: count ?? 0,
      page,
      pageSize,
    }
  }

  /**
   * Insert a record with optional enterprise core wiring.
   *
   * When `options.audit` is set, automatically records an audit entry.
   * When `options.lock` is set, acquires a lock before inserting.
   */
  async insert(
    values: Partial<TTable>,
    context?: {
      lockId?: string
      idempotencyKey?: string
    },
  ): Promise<TTable> {
    // Acquire lock if configured
    if (this.options?.lock && context?.lockId) {
      await this._acquireLock(context.lockId)
    }

    // Check idempotency if key provided
    if (context?.idempotencyKey) {
      await this._checkIdempotency(context.idempotencyKey)
    }

    // Ensure timestamps
    const nowISO = now().toISOString()
    const insertValues = {
      ...values,
      created_at: values.created_at ?? nowISO,
      updated_at: values.updated_at ?? nowISO,
      id: (values as Record<string, unknown>).id ?? `id_${createId()}`,
    }

    const { data, error } = await this.client
      .from(this.tableName)
      .insert(insertValues)
      .select()
      .single()

    if (error) {
      if (this.options?.lock && context?.lockId) {
        await this._releaseLock(context.lockId).catch(() => {})
      }
      throw this._toError(error, 'insert')
    }

    // Audit after successful insert
    await this._recordAudit('create', data?.id as string, null, data as Record<string, unknown>)

    // Release lock
    if (this.options?.lock && context?.lockId) {
      await this._releaseLock(context.lockId).catch(() => {})
    }

    return data as TTable
  }

  /**
   * Update a record by ID with optional enterprise core wiring.
   * Automatically captures before/after state for audit.
   */
  async update(
    id: string,
    values: Partial<TTable>,
    context?: {
      lockId?: string
    },
  ): Promise<TTable> {
    // Acquire lock if configured
    if (this.options?.lock && context?.lockId) {
      await this._acquireLock(context.lockId)
    }

    // Capture before state for audit
    const before = this.options?.audit ? await this.findById(id) : null

    // Ensure updated_at
    const updateValues = {
      ...values,
      updated_at: (values as Record<string, unknown>).updated_at ?? now().toISOString(),
    }

    const { data, error } = await this.client
      .from(this.tableName)
      .update(updateValues)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (this.options?.lock && context?.lockId) {
        await this._releaseLock(context.lockId).catch(() => {})
      }
      throw this._toError(error, 'update')
    }

    // Audit with before/after diff
    if (before) {
      await this._recordAudit('update', id, before as Record<string, unknown>, data as Record<string, unknown>)
    }

    // Release lock
    if (this.options?.lock && context?.lockId) {
      await this._releaseLock(context.lockId).catch(() => {})
    }

    return data as TTable
  }

  /**
   * Delete a record by ID with optional audit trail.
   */
  async delete(
    id: string,
    context?: {
      lockId?: string
      reason?: string
    },
  ): Promise<void> {
    // Acquire lock if configured
    if (this.options?.lock && context?.lockId) {
      await this._acquireLock(context.lockId)
    }

    // Capture before state for audit
    const before = this.options?.audit ? await this.findById(id) : null

    const { error } = await this.client
      .from(this.tableName)
      .delete()
      .eq('id', id)

    if (error) {
      if (this.options?.lock && context?.lockId) {
        await this._releaseLock(context.lockId).catch(() => {})
      }
      throw this._toError(error, 'delete')
    }

    // Audit
    if (before) {
      await this._recordAudit('delete', id, before as Record<string, unknown>, null, context?.reason)
    }

    // Release lock
    if (this.options?.lock && context?.lockId) {
      await this._releaseLock(context.lockId).catch(() => {})
    }
  }

  /**
   * Count records matching an optional filter.
   */
  async count(filters?: Record<string, unknown>): Promise<number> {
    let query = this.client.from(this.tableName).select('*', { count: 'exact', head: true })

    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value)
        }
      }
    }

    const { count, error } = await query

    if (error) throw this._toError(error, 'count')
    return count ?? 0
  }

  /**
   * Check if any records match the given filters.
   */
  async exists(filters: Record<string, unknown>): Promise<boolean> {
    const count = await this.count(filters)
    return count > 0
  }

  // ── Enterprise Core Wiring (protected hooks) ──────────────────────────

  protected async _recordAudit(
    action: 'create' | 'update' | 'delete',
    aggregateId: string,
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
    reason?: string,
  ): Promise<void> {
    if (!this.options?.audit) return

    try {
      await recordAudit({
        eventType: this.options.audit.eventType,
        aggregateType: this.options.audit.aggregateType,
        aggregateId,
        action,
        before,
        after,
        performedBy: getCurrentUserId() || 'system',
        branchId: getCurrentBranchId() || 'unknown',
        deviceId: getCurrentDeviceId(),
        reason,
      })
    } catch (err) {
      // Audit failures must never block business operations
      console.error('[Repository] Audit failed:', err instanceof Error ? err.message : String(err))
    }
  }

  protected async _acquireLock(resourceId: string): Promise<void> {
    const resource = `${this.options?.lock?.resourcePrefix ?? ''}${resourceId}`
    const holder = getCurrentUserId() || 'system'
    try {
      await acquireLock(resource, holder)
    } catch (err) {
      throw repoError('LOCK_FAILED', `Could not acquire lock on ${resource}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  protected async _releaseLock(resourceId: string): Promise<void> {
    const resource = `${this.options?.lock?.resourcePrefix ?? ''}${resourceId}`
    const holder = getCurrentUserId() || 'system'
    try {
      await releaseLock(resource, holder)
    } catch {
      // Lock release failures are non-fatal
    }
  }

  protected async _checkIdempotency(key: string): Promise<void> {
    // In-memory idempotency check via the idempotency manager
    const { isIdempotent } = await import('./idempotency-manager')
    const idempotent = isIdempotent(key)
    if (idempotent) {
      throw repoError('IDEMPOTENT', `Operation with key ${key} has already been processed`)
    }
  }

  protected _toError(error: unknown, operation: string): RepositoryError {
    const message = error instanceof Error ? error.message : String(error)
    return repoError(
      'DB_ERROR',
      `[${this.tableName}] ${operation} failed: ${message}`,
      error,
    )
  }
}
