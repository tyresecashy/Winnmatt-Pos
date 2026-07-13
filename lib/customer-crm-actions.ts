'use server'

import { logger } from '@/lib/logger'
import { pointsToKSh } from '@/lib/currency'
import { authenticateServerAction } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CustomerCRMDetail {
  id: string
  name: string
  phone: string | null
  email: string | null
  type: string
  tier: string | null
  tags: string[] | null
  notes: string | null
  birthday: string | null
  created_at: string
  loyalty_points: number
  credit_limit: number
  credit_balance: number
  total_spent_cents: number
  purchase_count: number
  total_visits: number
  last_purchase_date: string | null
  total_lifetime_spend_cents: number
  lifetime_value_cents: number
  average_basket_cents: number
  return_rate: number
  days_since_last_purchase: number | null
  total_returned_cents: number
  segment_names: string[]
}

export interface CustomerActivity {
  id: string
  type: 'purchase' | 'return' | 'loyalty_earn' | 'loyalty_redeem' | 'payment'
  description: string
  amount_cents: number
  created_at: string
  reference: string | null
}

export interface CustomerSaleItem {
  id: string
  receipt_number: string
  created_at: string
  total_amount: number
  payment_method: string
  item_count: number
  discount_amount: number
}

// ─── Server Actions ─────────────────────────────────────────────────────────

export async function getCustomerCRMDetail(customerId: string): Promise<CustomerCRMDetail | null> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return null

    // Get customer base info
    const { data: customer, error: custError } = await supabaseAdmin
      .from('customers')
      .select(`
        id, name, phone, email, type, tier, tags, notes, birthday,
        created_at, loyalty_points, credit_limit, credit_balance
      `)
      .eq('id', customerId)
      .single()

    if (custError) throw custError
    if (!customer) return null

    // Get aggregated stats from sales
    const { data: salesStats } = await supabaseAdmin
      .from('sales')
      .select('total_amount, discount_amount, created_at, sale_status')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })

    const completedSales = (salesStats || []).filter(s => s.sale_status !== 'voided')
    const returnedSales = (salesStats || []).filter(
      s => s.sale_status === 'returned' || s.sale_status === 'partially_returned'
    )

    const totalSpentCents = completedSales.reduce((sum, s) => sum + Number(s.total_amount), 0)
    const totalReturnedCents = returnedSales.reduce(
      (sum, s) => sum + (s.sale_status === 'returned' ? Number(s.total_amount) : 0), 0
    )
    const purchaseCount = completedSales.length
    const avgBasketCents = purchaseCount > 0 ? Math.round(totalSpentCents / purchaseCount) : 0
    const returnRate = completedSales.length > 0
      ? Math.round((returnedSales.length / completedSales.length) * 100)
      : 0

    const lastSaleDate = completedSales[0]?.created_at
    const daysSinceLastPurchase = lastSaleDate
      ? Math.floor((Date.now() - new Date(lastSaleDate).getTime()) / (1000 * 60 * 60 * 24))
      : null

    // Get total visits (unique dates)
    const visitDates = new Set(
      (completedSales || []).map(s => new Date(s.created_at ?? '').toISOString().split('T')[0])
    )

    // Get segments
    let segmentNames: string[] = []
    try {
      const { data: segData } = await supabaseAdmin
        .from('customer_segment_members')
        .select('segment:segment_id(name)')
        .eq('customer_id', customerId)

      segmentNames = ((segData || []) as unknown as Array<Record<string, unknown>>)
        .map((s) => (s.segment as unknown as Record<string, unknown>)?.name as string | undefined)
        .filter((n): n is string => !!n)
    } catch {
      // segments table may not exist
    }

    // Lifetime value: total spent minus returns
    const lifetimeValueCents = totalSpentCents - totalReturnedCents

    return {
      ...customer,
      total_spent_cents: totalSpentCents,
      purchase_count: purchaseCount,
      total_visits: visitDates.size,
      last_purchase_date: completedSales[0]?.created_at || null,
      total_lifetime_spend_cents: totalSpentCents,
      lifetime_value_cents: lifetimeValueCents,
      average_basket_cents: avgBasketCents,
      return_rate: returnRate,
      days_since_last_purchase: daysSinceLastPurchase,
      total_returned_cents: totalReturnedCents,
      segment_names: segmentNames,
    } as unknown as CustomerCRMDetail
  } catch (error) {
    logger.error('[CRM] Failed to load customer detail:', error)
    return null
  }
}

export async function getCustomerActivity(
  customerId: string,
  limit = 50
): Promise<CustomerActivity[]> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return []

    const { data: sales } = await supabaseAdmin
      .from('sales')
      .select('id, receipt_number, created_at, total_amount, sale_status, payment_method')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (!sales) return []

    const activities: CustomerActivity[] = []

    const rawSales = sales as unknown as Array<Record<string, unknown>>
    for (const sale of rawSales) {
      // Purchase event
      if (sale.sale_status === 'completed' || sale.sale_status === null) {
        activities.push({
          id: `sale_${sale.id as string}`,
          type: 'purchase',
          description: `Purchase at ${(sale.receipt_number as string) || 'POS'}`,
          amount_cents: Number(sale.total_amount),
          created_at: sale.created_at as string,
          reference: sale.receipt_number as string | null,
        })
      }

      // Return event
      if (sale.sale_status === 'returned' || sale.sale_status === 'partially_returned') {
        activities.push({
          id: `return_${sale.id as string}`,
          type: 'return',
          description: `Return on ${(sale.receipt_number as string) || 'sale'}`,
          amount_cents: Number(sale.total_amount),
          created_at: sale.created_at as string,
          reference: sale.receipt_number as string | null,
        })
      }
    }

    // Get loyalty transactions
    try {
      const { data: loyaltyTxnsRaw } = await supabaseAdmin
        .from('loyalty_transactions')
        .select('id, type, points, description, created_at, reference_id')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(20)

      const loyaltyTxns = (loyaltyTxnsRaw || []) as unknown as Array<Record<string, unknown>>
      for (const txn of loyaltyTxns) {
        if (txn.type === 'earn_sale' || txn.type === 'earn_admin' || txn.type === 'earn_bonus') {
          activities.push({
            id: `loyalty_${txn.id as string}`,
            type: 'loyalty_earn',
            description: (txn.description as string) || 'Loyalty points earned',
            amount_cents: pointsToKSh(Number(txn.points)),
            created_at: txn.created_at as string,
            reference: txn.reference_id as string | null,
          })
        } else if (txn.type === 'redeem_sale' || txn.type === 'reverse_void' || txn.type === 'reverse_return') {
          activities.push({
            id: `redeem_${txn.id as string}`,
            type: 'loyalty_redeem',
            description: (txn.description as string) || 'Loyalty points redeemed',
            amount_cents: -pointsToKSh(Number(txn.points)),
            created_at: txn.created_at as string,
            reference: txn.reference_id as string | null,
          })
        }
      }
    } catch {
      // loyalty table may not exist
    }

    // Sort all activities by date desc
    activities.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    return activities.slice(0, limit)
  } catch (error) {
    logger.error('[CRM] Failed to load customer activity:', error)
    return []
  }
}

export async function getCustomerSalesHistory(
  customerId: string,
  limit = 20
): Promise<CustomerSaleItem[]> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return []

    const { data: sales } = await supabaseAdmin
      .from('sales')
      .select('id, receipt_number, created_at, total_amount, payment_method, discount_amount')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (!sales) return []

    // Get item counts per sale
    const result: CustomerSaleItem[] = []
    for (const sale of sales) {
      const { count } = await supabaseAdmin
        .from('sale_items')
        .select('*', { count: 'exact', head: true })
        .eq('sale_id', sale.id)

      result.push({
        id: sale.id,
        receipt_number: sale.receipt_number as string,
        created_at: sale.created_at as string,
        total_amount: Number(sale.total_amount),
        payment_method: sale.payment_method as string,
        item_count: count || 0,
        discount_amount: Number(sale.discount_amount || 0),
      })
    }

    return result
  } catch (error) {
    logger.error('[CRM] Failed to load sales history:', error)
    return []
  }
}
