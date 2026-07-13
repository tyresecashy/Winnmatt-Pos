'use server'

import { logger } from '@/lib/logger'
import { authenticateServerAction } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'
import { emitEvent } from '@/lib/automation/events'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ExpenseCategory {
  id: string
  name: string
  description: string | null
  color: string
  icon: string
  sort_order: number
  is_active: boolean
  created_at: string
}

export interface Expense {
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
  // joined
  category?: ExpenseCategory
  approver?: { id: string; full_name: string }
  creator?: { id: string; full_name: string }
  branch?: { id: string; name: string }
}

export interface RecurringExpense {
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
  category?: ExpenseCategory
}

export interface ExpenseStats {
  total_expenses_cents: number
  expense_count: number
  pending_count: number
  approved_count: number
  rejected_count: number
  category_breakdown: { category_name: string; total_cents: number; color: string; count: number; percentage: number }[]
  monthly_totals: { year: number; month: number; month_name: string; total_cents: number; expense_count: number }[]
  top_vendors: { vendor: string; total_cents: number; count: number }[]
}

// ─── Categories CRUD ─────────────────────────────────────────────────────────

export async function getExpenseCategories(): Promise<ExpenseCategory[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('expense_categories')
      .select('*')
      .order('sort_order', { ascending: true })
    if (error) throw error
    return (data || []) as unknown as ExpenseCategory[]
  } catch (error) {
    logger.error('[EXP] Failed to fetch categories:', error)
    return []
  }
}

export async function createExpenseCategory(
  input: Pick<ExpenseCategory, 'name' | 'description' | 'color' | 'icon'>
): Promise<ExpenseCategory | null> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !['super_admin', 'admin'].includes(auth.profile?.role || '')) {
      throw new Error('Unauthorized')
    }
    const { data, error } = await supabaseAdmin
      .from('expense_categories')
      .insert({ name: input.name, description: input.description, color: input.color, icon: input.icon })
      .select()
      .single()
    if (error) throw error
    return data as unknown as ExpenseCategory
  } catch (error) {
    logger.error('[EXP] Failed to create category:', error)
    return null
  }
}

export async function updateExpenseCategory(
  id: string,
  input: Partial<Pick<ExpenseCategory, 'name' | 'description' | 'color' | 'icon' | 'sort_order' | 'is_active'>>
): Promise<boolean> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !['super_admin', 'admin'].includes(auth.profile?.role || '')) {
      throw new Error('Unauthorized')
    }
    const { error } = await supabaseAdmin
      .from('expense_categories')
      .update(input)
      .eq('id', id)
    if (error) throw error
    return true
  } catch (error) {
    logger.error('[EXP] Failed to update category:', error)
    return false
  }
}

export async function deleteExpenseCategory(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !['super_admin', 'admin'].includes(auth.profile?.role || '')) {
      throw new Error('Unauthorized')
    }
    // Check if any expenses use this category
    const { count } = await supabaseAdmin
      .from('expenses')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', id)
    if (count && count > 0) {
      return { success: false, error: `Cannot delete: ${count} expense(s) use this category. Archive it instead.` }
    }
    const { error } = await supabaseAdmin
      .from('expense_categories')
      .delete()
      .eq('id', id)
    if (error) throw error
    return { success: true }
  } catch (error) {
    logger.error('[EXP] Failed to delete category:', error)
    return { success: false, error: 'Failed to delete category' }
  }
}

// ─── Expenses CRUD ───────────────────────────────────────────────────────────

export async function getExpenses(opts?: {
  branchId?: string
  categoryId?: string
  status?: string
  fromDate?: string
  toDate?: string
  vendor?: string
  search?: string
  limit?: number
  offset?: number
}): Promise<{ data: Expense[]; total: number }> {
  try {
    let query = supabaseAdmin
      .from('expenses')
      .select('*, category:category_id(*), creator:created_by(id, full_name), approver:approved_by(id, full_name), branch:branch_id(id, name)', { count: 'exact' })

    if (opts?.branchId) query = query.eq('branch_id', opts.branchId)
    if (opts?.categoryId) query = query.eq('category_id', opts.categoryId)
    if (opts?.status) query = query.eq('status', opts.status)
    if (opts?.fromDate) query = query.gte('expense_date', opts.fromDate)
    if (opts?.toDate) query = query.lte('expense_date', opts.toDate)
    if (opts?.vendor) query = query.ilike('vendor', `%${opts.vendor}%`)
    if (opts?.search) {
      query = query.or(
        `description.ilike.%${opts.search}%,vendor.ilike.%${opts.search}%,reference_number.ilike.%${opts.search}%`
      )
    }

    query = query
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(opts?.limit || 100)
      .range(opts?.offset || 0, (opts?.offset || 0) + (opts?.limit || 100) - 1)

    const { data, error, count } = await query
    if (error) throw error
    return { data: (data || []) as unknown as Expense[], total: count || 0 }
  } catch (error) {
    logger.error('[EXP] Failed to fetch expenses:', error)
    return { data: [], total: 0 }
  }
}

export async function getExpenseById(id: string): Promise<Expense | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('expenses')
      .select('*, category:category_id(*), creator:created_by(id, full_name), approver:approved_by(id, full_name)')
      .eq('id', id)
      .single()
    if (error) throw error
    return data as unknown as Expense
  } catch (error) {
    logger.error('[EXP] Failed to fetch expense:', error)
    return null
  }
}

export async function createExpense(
  input: Omit<Expense, 'id' | 'created_at' | 'updated_at' | 'approved_by' | 'approved_at' | 'category' | 'approver' | 'creator' | 'branch'>
): Promise<{ success: boolean; data?: Expense; error?: string }> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) {
      return { success: false, error: 'Authentication required' }
    }

    const { data, error } = await supabaseAdmin
      .from('expenses')
      .insert({
        branch_id: input.branch_id,
        category_id: input.category_id,
        amount_cents: input.amount_cents,
        description: input.description,
        vendor: input.vendor || null,
        expense_date: input.expense_date,
        payment_method: input.payment_method || 'cash',
        reference_number: input.reference_number || null,
        receipt_url: input.receipt_url || null,
        notes: input.notes || null,
        status: input.status || 'approved',
        created_by: auth.profile.id,
        is_recurring: input.is_recurring || false,
        recurring_id: input.recurring_id || null,
      })
      .select('*, category:category_id(*)')
      .single()

    if (error) throw error
    return { success: true, data: data as unknown as Expense }
  } catch (error) {
    logger.error('[EXP] Failed to create expense:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function updateExpense(
  id: string,
  input: Partial<Pick<Expense, 'amount_cents' | 'description' | 'vendor' | 'expense_date' | 'payment_method' | 'reference_number' | 'receipt_url' | 'notes' | 'category_id'>>
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) {
      return { success: false, error: 'Authentication required' }
    }

    const { error } = await supabaseAdmin
      .from('expenses')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error
    return { success: true }
  } catch (error) {
    logger.error('[EXP] Failed to update expense:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function deleteExpense(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) {
      return { success: false, error: 'Authentication required' }
    }

    const { error } = await supabaseAdmin
      .from('expenses')
      .delete()
      .eq('id', id)

    if (error) throw error
    return { success: true }
  } catch (error) {
    logger.error('[EXP] Failed to delete expense:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function approveExpense(
  id: string,
  action: 'approved' | 'rejected',
  rejectionReason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !['super_admin', 'admin'].includes(auth.profile?.role || '')) {
      return { success: false, error: 'Only admins can approve/reject expenses' }
    }

    const update: Partial<Expense> = {
      status: action,
      approved_by: auth.profile!.id,
      approved_at: new Date().toISOString(),
      rejection_reason: action === 'rejected' ? (rejectionReason || null) : null,
    }

    const { error } = await supabaseAdmin
      .from('expenses')
      .update(update)
      .eq('id', id)

    if (error) throw error

    // Emit expense.approved or expense.rejected event
    const eventType = action === 'approved' ? 'expense.approved' : 'expense.rejected'
    await emitEvent({
      eventType,
      payload: {
        expense_id: id,
        action,
        rejection_reason: rejectionReason || null,
        approved_by: auth.profile!.id,
      },
      source: 'finance',
      entityType: 'expense',
      entityId: id,
    })

    return { success: true }
  } catch (error) {
    logger.error('[EXP] Failed to approve/reject expense:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Stats & Reports ─────────────────────────────────────────────────────────

export async function getExpenseStats(
  branchId: string,
  months?: number
): Promise<ExpenseStats> {
  try {
    const now = new Date()
    const fromDate = new Date(now.getFullYear(), now.getMonth() - (months || 12), 1).toISOString()

    const { data: allExpenses, error } = await supabaseAdmin
      .from('expenses')
      .select('*, category:category_id(name, color)')
      .eq('branch_id', branchId)
      .gte('expense_date', fromDate)
      .order('expense_date', { ascending: false })

    if (error) throw error
    const exps = (allExpenses || []) as unknown as { status: string; amount_cents: number; category_id: string; category?: { name: string; color: string }; expense_date: string; vendor: string | null }[]

    const approved = exps.filter(e => e.status === 'approved')
    const pending = exps.filter(e => e.status === 'pending')
    const rejected = exps.filter(e => e.status === 'rejected')

    const totalCents = approved.reduce((s: number, e) => s + Number(e.amount_cents), 0)

    // Category breakdown
    const catMap = new Map<string, { name: string; color: string; total: number; count: number }>()
    for (const e of approved) {
      const catId = e.category_id
      const existing = catMap.get(catId) || {
        name: e.category?.name || 'Unknown',
        color: e.category?.color || '#94a3b8',
        total: 0,
        count: 0,
      }
      existing.total += Number(e.amount_cents)
      existing.count++
      catMap.set(catId, existing)
    }

    const categoryBreakdown = Array.from(catMap.entries())
      .map(([_, v]) => ({
        category_name: v.name,
        total_cents: v.total,
        color: v.color,
        count: v.count,
        percentage: totalCents > 0 ? Math.round((v.total / totalCents) * 100) : 0,
      }))
      .sort((a, b) => b.total_cents - a.total_cents)

    // Monthly totals
    const monthMap = new Map<string, { year: number; month: number; month_name: string; total_cents: number; expense_count: number }>()
    for (const e of approved) {
      const d = new Date(e.expense_date)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      const existing = monthMap.get(key) || {
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        month_name: d.toLocaleString('en-US', { month: 'short' }),
        total_cents: 0,
        expense_count: 0,
      }
      existing.total_cents += Number(e.amount_cents)
      existing.expense_count++
      monthMap.set(key, existing)
    }

    const monthlyTotals = Array.from(monthMap.values())
      .sort((a, b) => b.year - a.year || b.month - a.month)

    // Top vendors
    const vendorMap = new Map<string, { total: number; count: number }>()
    for (const e of approved) {
      if (e.vendor) {
        const existing = vendorMap.get(e.vendor) || { total: 0, count: 0 }
        existing.total += Number(e.amount_cents)
        existing.count++
        vendorMap.set(e.vendor, existing)
      }
    }

    const topVendors = Array.from(vendorMap.entries())
      .map(([vendor, v]) => ({ vendor, total_cents: v.total, count: v.count }))
      .sort((a, b) => b.total_cents - a.total_cents)
      .slice(0, 10)

    return {
      total_expenses_cents: totalCents,
      expense_count: approved.length,
      pending_count: pending.length,
      approved_count: approved.length,
      rejected_count: rejected.length,
      category_breakdown: categoryBreakdown,
      monthly_totals: monthlyTotals,
      top_vendors: topVendors,
    }
  } catch (error) {
    logger.error('[EXP] Failed to get expense stats:', error)
    return {
      total_expenses_cents: 0, expense_count: 0, pending_count: 0,
      approved_count: 0, rejected_count: 0, category_breakdown: [],
      monthly_totals: [], top_vendors: [],
    }
  }
}

// ─── Recurring Expenses ──────────────────────────────────────────────────────

export async function getRecurringExpenses(branchId: string): Promise<RecurringExpense[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('recurring_expenses')
      .select('*, category:category_id(*)')
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .order('next_date', { ascending: true })

    if (error) throw error
    return (data || []) as unknown as RecurringExpense[]
  } catch (error) {
    logger.error('[EXP] Failed to fetch recurring expenses:', error)
    return []
  }
}

export async function createRecurringExpense(
  input: Omit<RecurringExpense, 'id' | 'created_at' | 'last_generated_date' | 'category'>
): Promise<{ success: boolean; data?: RecurringExpense; error?: string }> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) {
      return { success: false, error: 'Authentication required' }
    }

    const { data, error } = await supabaseAdmin
      .from('recurring_expenses')
      .insert({
        branch_id: input.branch_id,
        category_id: input.category_id,
        amount_cents: input.amount_cents,
        description: input.description,
        vendor: input.vendor || null,
        frequency: input.frequency,
        next_date: input.next_date,
        end_date: input.end_date || null,
        payment_method: input.payment_method || 'bank_transfer',
        notes: input.notes || null,
        created_by: auth.profile.id,
      })
      .select('*, category:category_id(*)')
      .single()

    if (error) throw error
    return { success: true, data: data as unknown as RecurringExpense }
  } catch (error) {
    logger.error('[EXP] Failed to create recurring expense:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function toggleRecurringExpense(
  id: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) {
      return { success: false, error: 'Authentication required' }
    }

    const { error } = await supabaseAdmin
      .from('recurring_expenses')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
    return { success: true }
  } catch (error) {
    logger.error('[EXP] Failed to toggle recurring expense:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function deleteRecurringExpense(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) {
      return { success: false, error: 'Authentication required' }
    }

    const { error } = await supabaseAdmin
      .from('recurring_expenses')
      .delete()
      .eq('id', id)
    if (error) throw error
    return { success: true }
  } catch (error) {
    logger.error('[EXP] Failed to delete recurring expense:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}
