/**
 * Expense Repository — Enterprise Core Data Access for Expenses
 *
 * Encapsulates direct Supabase access for expense_categories, expenses,
 * and recurring_expenses tables. Callers (module facade, server actions)
 * use this repository instead of calling supabase directly.
 *
 * Constitution Reference: §5 (Module Architecture), §9 (Transaction & Event Rules)
 */

import { BaseRepository } from '@/lib/modules/core/repository'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ExpenseCategoryRow {
  id: string
  name: string
  description: string | null
  color: string
  icon: string
  sort_order: number
  is_active: boolean
  created_at: string
  [key: string]: unknown
}

export interface ExpenseRow {
  id: string
  branch_id: string
  category_id: string
  amount_cents: number
  description: string
  vendor: string | null
  expense_date: string
  payment_method: string
  reference_number: string | null
  receipt_url: string | null
  notes: string | null
  status: 'pending' | 'approved' | 'rejected'
  approved_by: string | null
  approved_at: string | null
  rejection_reason: string | null
  created_by: string
  is_recurring: boolean
  recurring_id: string | null
  created_at: string
  updated_at: string
  // joined relations (returned by Supabase when using select('*, category:...'))
  category?: ExpenseCategoryRow | null
  approver?: { id: string; full_name: string } | null
  creator?: { id: string; full_name: string } | null
  branch?: { id: string; name: string } | null
  [key: string]: unknown
}

export interface RecurringExpenseRow {
  id: string
  branch_id: string
  category_id: string
  amount_cents: number
  description: string
  vendor: string | null
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  next_date: string
  end_date: string | null
  payment_method: string
  notes: string | null
  is_active: boolean
  last_generated_date: string | null
  created_by: string
  created_at: string
  category?: ExpenseCategoryRow | null
  [key: string]: unknown
}

export interface PaginatedExpenses {
  data: ExpenseRow[]
  total: number
}

export interface ExpenseFilterOptions {
  branchId?: string
  categoryId?: string
  status?: string
  fromDate?: string
  toDate?: string
  vendor?: string
  search?: string
  limit?: number
  offset?: number
}

// ─── Repository ─────────────────────────────────────────────────────────────

export class ExpenseRepository extends BaseRepository<ExpenseRow> {
  constructor() {
    super('expenses', {
      audit: { eventType: 'expense.*', aggregateType: 'expense' },
      lock: { resourcePrefix: 'expense:' },
    })
  }

  /**
   * Get all expense categories ordered by sort_order.
   */
  async getExpenseCategories(): Promise<ExpenseCategoryRow[]> {
    const { data, error } = await this.client
      .from('expense_categories')
      .select('*')
      .order('sort_order', { ascending: true })

    if (error) throw this._toError(error, 'getExpenseCategories')
    return (data ?? []) as ExpenseCategoryRow[]
  }

  /**
   * Get expenses with optional filters, joins, and pagination.
   *
   * Supports filtering by branch, category, status, date range,
   * vendor (ILIKE), text search across description/vendor/reference,
   * and offset/limit pagination.
   */
  async getExpenses(opts?: ExpenseFilterOptions): Promise<PaginatedExpenses> {
    let query = this.client
      .from('expenses')
      .select(
        '*, category:category_id(*), creator:created_by(id, full_name), approver:approved_by(id, full_name), branch:branch_id(id, name)',
        { count: 'exact' },
      )

    if (opts?.branchId) query = query.eq('branch_id', opts.branchId)
    if (opts?.categoryId) query = query.eq('category_id', opts.categoryId)
    if (opts?.status) query = query.eq('status', opts.status)
    if (opts?.fromDate) query = query.gte('expense_date', opts.fromDate)
    if (opts?.toDate) query = query.lte('expense_date', opts.toDate)
    if (opts?.vendor) query = query.ilike('vendor', `%${opts.vendor}%`)
    if (opts?.search) {
      query = query.or(
        `description.ilike.%${opts.search}%,vendor.ilike.%${opts.search}%,reference_number.ilike.%${opts.search}%`,
      )
    }

    const limit = opts?.limit ?? 100
    const offset = opts?.offset ?? 0

    query = query
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)
      .range(offset, offset + limit - 1)

    const { data, error, count } = await query
    if (error) throw this._toError(error, 'getExpenses')
    return { data: (data ?? []) as ExpenseRow[], total: count ?? 0 }
  }

  /**
   * Get a single expense by ID with joins.
   */
  async getExpenseById(id: string): Promise<ExpenseRow | null> {
    const { data, error } = await this.client
      .from('expenses')
      .select(
        '*, category:category_id(*), creator:created_by(id, full_name), approver:approved_by(id, full_name)',
      )
      .eq('id', id)
      .single()

    if (error) {
      // single() returns PGRST116 when no rows match — treat as null
      const errObj = error as { code?: string }
      if (errObj.code === 'PGRST116') return null
      throw this._toError(error, 'getExpenseById')
    }
    return (data ?? null) as ExpenseRow | null
  }

  /**
   * Get all active recurring expenses for a branch, ordered by next_date ascending.
   */
  async getRecurringExpenses(branchId: string): Promise<RecurringExpenseRow[]> {
    const { data, error } = await this.client
      .from('recurring_expenses')
      .select('*, category:category_id(*)')
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .order('next_date', { ascending: true })

    if (error) throw this._toError(error, 'getRecurringExpenses')
    return (data ?? []) as RecurringExpenseRow[]
  }

  /**
   * Create an expense category.
   */
  async createExpenseCategory(
    values: Partial<ExpenseCategoryRow>,
  ): Promise<ExpenseCategoryRow> {
    let query = this.client
      .from('expense_categories')
      .insert(values)
      .select()
      .single()

    const { data, error } = await query
    if (error) throw this._toError(error, 'createExpenseCategory')
    return data as ExpenseCategoryRow
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

export const expenseRepo = new ExpenseRepository()
