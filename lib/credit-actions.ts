'use server'

import { authenticateServerAction } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────

export interface CreditPaymentRecord {
  id: string
  customer_id: string
  customer_name?: string
  amount_cents: number
  payment_date: string
  payment_method: string
  reference_number: string | null
  notes: string | null
  recorded_by: string
  recorded_by_name?: string
  created_at: string
}

export interface CustomerCreditSummary {
  customer_id: string
  customer_name: string
  phone: string | null
  credit_limit: number
  credit_balance: number
  credit_usage_pct: number | null
  credit_status: string
  total_credit_sales: number
  total_payments: number
  last_payment_date: string | null
  last_credit_sale_date: string | null
}

export interface CreditAgingBucket {
  label: string
  range_days: string
  total_cents: number
  customer_count: number
}

// ─── Record a payment against customer credit ──────────────────────────────

export async function recordCreditPayment(formData: FormData) {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return { error: 'Not authenticated' }

    const customer_id = formData.get('customer_id') as string
    const amount_cents = parseInt(formData.get('amount_cents') as string)
    const payment_date = formData.get('payment_date') as string
    const payment_method = formData.get('payment_method') as string
    const reference_number = formData.get('reference_number') as string | null
    const notes = formData.get('notes') as string | null

    if (!customer_id || !amount_cents || amount_cents <= 0) {
      return { error: 'Customer ID and valid amount are required' }
    }

    // 1. Insert payment record
    const { error: insertErr } = await supabaseAdmin.from('credit_payments').insert({
      customer_id,
      amount_cents,
      payment_date: payment_date || new Date().toISOString().split('T')[0],
      payment_method: payment_method || 'cash',
      reference_number: reference_number || null,
      notes: notes || null,
      recorded_by: auth.profile.id,
    })

    if (insertErr) return { error: insertErr.message }

    // 2. RPC backup (trigger handles this automatically, but RPC with SECURITY DEFINER is a safety net)
    const { error: rpcErr } = await supabaseAdmin.rpc('update_customer_credit_balance', {
      p_customer_id: customer_id,
      p_amount_cents: amount_cents,
    })

    // 3. If both trigger and RPC failed, update directly
    if (rpcErr) {
      logger.warn('[recordCreditPayment] RPC backup failed, using direct update', { error: rpcErr.message })
      const { data: customer } = await supabaseAdmin
        .from('customers')
        .select('credit_balance')
        .eq('id', customer_id)
        .single()
      if (customer) {
        await supabaseAdmin
          .from('customers')
          .update({ credit_balance: Math.max(0, (customer.credit_balance || 0) - amount_cents) })
          .eq('id', customer_id)
      }
    }

    revalidatePath('/customer-credit')
    revalidatePath('/customers')
    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Failed to record payment' }
  }
}

// ─── List payments for a customer ──────────────────────────────────────────

export async function getCustomerPayments(customerId: string) {
  const { data, error } = await supabaseAdmin
    .from('credit_payments')
    .select(`
      *,
      recorded_by_user:users!recorded_by(full_name)
    `)
    .eq('customer_id', customerId)
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data || []).map(p => ({
    ...p,
    recorded_by_name: (p as any).recorded_by_user?.full_name || 'Unknown',
  }))
}

// ─── List all recent credit payments ───────────────────────────────────────

export async function getAllCreditPayments(limit = 50) {
  const { data, error } = await supabaseAdmin
    .from('credit_payments')
    .select(`
      *,
      customer:customers(name),
      recorded_by_user:users!recorded_by(full_name)
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return (data || []).map(p => ({
    ...p,
    customer_name: (p as any).customer?.name || 'Deleted Customer',
    recorded_by_name: (p as any).recorded_by_user?.full_name || 'Unknown',
  }))
}

// ─── Customer credit summaries (from view) ─────────────────────────────────

export async function getCreditSummaries() {
  const { data, error } = await supabaseAdmin
    .from('customer_credit_summary')
    .select('*')
    .order('credit_balance', { ascending: false })

  if (error) throw new Error(error.message)
  return (data || []) as CustomerCreditSummary[]
}

// ─── Single customer credit summary ────────────────────────────────────────

export async function getCustomerCreditSummary(customerId: string) {
  const { data, error } = await supabaseAdmin
    .from('customer_credit_summary')
    .select('*')
    .eq('customer_id', customerId)
    .single()

  if (error) throw new Error(error.message)
  return data as CustomerCreditSummary
}

// ─── Credit aging report ───────────────────────────────────────────────────

export async function getCreditAging() {
  const { data: summaries } = await supabaseAdmin
    .from('customer_credit_summary')
    .select('*')
    .gt('credit_balance', 0)
    .order('credit_balance', { ascending: false })

  if (!summaries) return []

  const buckets: CreditAgingBucket[] = [
    { label: 'Current (0-30 days)', range_days: '0-30', total_cents: 0, customer_count: 0 },
    { label: '31-60 days', range_days: '31-60', total_cents: 0, customer_count: 0 },
    { label: '61-90 days', range_days: '61-90', total_cents: 0, customer_count: 0 },
    { label: '90+ days', range_days: '90+', total_cents: 0, customer_count: 0 },
  ]

  const now = new Date()

  for (const s of summaries as CustomerCreditSummary[]) {
    const daysSinceLastSale = s.last_credit_sale_date
      ? Math.floor((now.getTime() - new Date(s.last_credit_sale_date).getTime()) / (1000 * 60 * 60 * 24))
      : 999

    if (daysSinceLastSale <= 30) {
      buckets[0].total_cents += s.credit_balance
      buckets[0].customer_count += 1
    } else if (daysSinceLastSale <= 60) {
      buckets[1].total_cents += s.credit_balance
      buckets[1].customer_count += 1
    } else if (daysSinceLastSale <= 90) {
      buckets[2].total_cents += s.credit_balance
      buckets[2].customer_count += 1
    } else {
      buckets[3].total_cents += s.credit_balance
      buckets[3].customer_count += 1
    }
  }

  return buckets
}

// ─── Update customer credit limit ──────────────────────────────────────────

export async function updateCreditLimit(customerId: string, newLimitCents: number) {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return { error: 'Not authenticated' }

    const { error } = await supabaseAdmin
      .from('customers')
      .update({ credit_limit: newLimitCents })
      .eq('id', customerId)

    if (error) return { error: error.message }

    revalidatePath('/customer-credit')
    revalidatePath('/customers')
    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Failed to update credit limit' }
  }
}

// ─── Top credit customers (for dashboard cards) ────────────────────────────

export async function getTopCreditCustomers(limit = 5) {
  const { data, error } = await supabaseAdmin
    .from('customer_credit_summary')
    .select('*')
    .gt('credit_balance', 0)
    .order('credit_balance', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return (data || []) as CustomerCreditSummary[]
}
