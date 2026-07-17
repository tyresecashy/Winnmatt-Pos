'use server'

import { authenticateServerAction } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

export interface ExecutiveKPI {
  today_revenue: number
  today_transactions: number
  today_avg_basket: number
  today_customers_served: number
  today_refunds: number
  today_discounts: number
  today_gross_profit: number
  today_margin_pct: number
  stock_value: number
  cash_in_drawers: number
  outstanding_credit: number
  pending_pos: number
  transfers_in_transit: number
  employees_clocked_in: number
  total_inventory_items: number
  critical_stock_count: number
}

export interface BranchPerformance {
  id: string
  name: string
  code: string
  today_sales: number
  today_transactions: number
  sales_pct: number
  avg_basket: number
}

export interface SalesHourly {
  hour: number
  sales: number
  transactions: number
}

export interface TopProduct {
  id: string
  name: string
  sku: string
  quantity: number
  revenue: number
  profit: number
}

export interface SupplierPerformance {
  id: string
  name: string
  total_purchases: number
  on_time_rate: number
  quality_score: number
  lead_time_days: number
}

export interface AIInsight {
  type: 'positive' | 'negative' | 'info' | 'warning'
  message: string
  metric?: string
  change?: number
}

/**
 * Aggregate executive dashboard KPI from all branches (today)
 */
export async function getExecutiveKPI(dateFilter?: string): Promise<ExecutiveKPI> {
  const defaults: ExecutiveKPI = {
    today_revenue: 0, today_transactions: 0, today_avg_basket: 0,
    today_customers_served: 0, today_refunds: 0, today_discounts: 0,
    today_gross_profit: 0, today_margin_pct: 0,
    stock_value: 0, cash_in_drawers: 0, outstanding_credit: 0,
    pending_pos: 0, transfers_in_transit: 0, employees_clocked_in: 0,
    total_inventory_items: 0, critical_stock_count: 0,
  }

  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return defaults

    const today = dateFilter || new Date().toISOString().split('T')[0]

    // ── Today's sales & transactions ──
    const { data: todaySales } = await supabaseAdmin
      .from('sales')
      .select('id, subtotal, discount_amount, tax_amount, total_amount, payment_method, sale_status, created_at, customer_id, items:sale_items(product_id, quantity, unit_price, discount_percent, line_total, product:products(id, purchase_price))')
      .eq('payment_status', 'completed')
      .neq('sale_status', 'voided')
      .neq('sale_status', 'returned')
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`)

    const salesRows = (todaySales || []) as unknown as Array<Record<string, unknown>>
    const activeSales = salesRows.filter(s => s.sale_status !== 'voided' && s.sale_status !== 'returned')
    const refunds = salesRows.filter(s => s.sale_status === 'returned')
    const totalRevenue = activeSales.reduce((sum, s) => sum + ((s.total_amount as number) || 0), 0)
    const totalRefunds = refunds.reduce((sum, s) => sum + ((s.total_amount as number) || 0), 0)
    const totalDiscounts = activeSales.reduce((sum, s) => sum + ((s.discount_amount as number) || 0), 0)
    const totalTransactions = activeSales.length

    // Calculate gross profit
    let totalCost = 0
    for (const sale of activeSales) {
      const items = Array.isArray(sale.items) ? (sale.items as Array<Record<string, unknown>>) : []
      for (const item of items) {
        const product = item.product as { id: string; purchase_price: number } | null
        const purchasePrice = product?.purchase_price || 0
        const qty = (item.quantity as number) || 0
        totalCost += purchasePrice * qty
      }
    }
    const grossProfit = totalRevenue - totalCost
    const marginPct = totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 10000) / 100 : 0

    // Unique customers — select customer_id in query above doesn't exist, count distinct
    const customerIds = new Set(activeSales.map(s => s.customer_id as string).filter(Boolean))

    // ── Stock value ──
    const { data: inventoryData } = await supabaseAdmin
      .from('inventory')
      .select('quantity, product:products(purchase_price)')

    const inventoryRows = (inventoryData || []) as unknown as Array<Record<string, unknown>>

    let stockValue = 0
    let criticalCount = 0
    for (const row of inventoryRows) {
      const product = row.product as { purchase_price: number } | null
      const pp = product?.purchase_price || 0
      const qty = (row.quantity as number) || 0
      stockValue += pp * qty
    }

    // Critical stock count
    const { data: criticalProducts } = await supabaseAdmin
      .from('products')
      .select('id, safety_stock')
      .eq('status', 'active')

    const criticalRows = (criticalProducts || []) as unknown as Array<Record<string, unknown>>

    for (const p of criticalRows) {
      const { data: inv } = await supabaseAdmin
        .from('inventory')
        .select('quantity')
        .eq('product_id', p.id as string)
      const totalQty = (inv || []).reduce((s: number, r: Record<string, unknown>) => s + ((r.quantity as number) || 0), 0)
      if (totalQty <= ((p.safety_stock as number) || 0)) criticalCount++
    }

    // ── Cash in drawers ──
    const { data: drawers } = await supabaseAdmin
      .from('cash_drawers')
      .select('current_balance')
    const drawerRows = (drawers || []) as unknown as Array<Record<string, unknown>>
    const cashInDrawers = drawerRows.reduce((s, d) => s + ((d.current_balance as number) || 0), 0)

    // ── Outstanding credit ──
    const { data: creditData } = await supabaseAdmin
      .from('customers')
      .select('credit_balance')
    const creditRows = (creditData || []) as unknown as Array<Record<string, unknown>>
    const outstandingCredit = creditRows.reduce((s, c) => s + ((c.credit_balance as number) || 0), 0)

    // ── Pending purchase orders ──
    const { data: pendingPOs } = await supabaseAdmin
      .from('purchase_orders')
      .select('id')
      .in('status', ['draft', 'pending'])

    // ── Transfers in transit ──
    const { data: inTransit } = await supabaseAdmin
      .from('stock_transfers')
      .select('id')
      .eq('status', 'in_transit')

    // ── Employees clocked in today ──
    const { data: clockedIn } = await supabaseAdmin
      .from('clock_events')
      .select('employee_id')
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`)
      .is('clock_out', null)

    const pendingPOCount = pendingPOs?.length ?? 0
    const inTransitCount = inTransit?.length ?? 0
    const clockedInCount = clockedIn?.length ?? 0

    return {
      today_revenue: totalRevenue,
      today_transactions: totalTransactions,
      today_avg_basket: totalTransactions > 0 ? Math.round(totalRevenue / totalTransactions) : 0,
      today_customers_served: customerIds.size,
      today_refunds: totalRefunds,
      today_discounts: totalDiscounts,
      today_gross_profit: grossProfit,
      today_margin_pct: marginPct,
      stock_value: stockValue,
      cash_in_drawers: cashInDrawers,
      outstanding_credit: outstandingCredit,
      pending_pos: pendingPOCount,
      transfers_in_transit: inTransitCount,
      employees_clocked_in: clockedInCount,
      total_inventory_items: inventoryRows.length || 0,
      critical_stock_count: criticalCount,
    }
  } catch (error) {
    logger.error('Error fetching executive KPI:', error)
    return defaults
  }
}

/**
 * Branch performance comparison (today)
 */
export async function getBranchPerformance(): Promise<BranchPerformance[]> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return []

    const { data: branches } = await supabaseAdmin
      .from('branches')
      .select('id, name, code')
      .eq('status', 'active')

    const today = new Date().toISOString().split('T')[0]
    const results: BranchPerformance[] = []

    let grandTotal = 0
    const perBranch: BranchPerformance[] = []

    for (const branch of branches || []) {
      const { data: sales } = await supabaseAdmin
        .from('sales')
        .select('id, total_amount')
        .eq('branch_id', branch.id)
      .eq('payment_status', 'completed')
      .neq('sale_status', 'voided')
      .neq('sale_status', 'returned')
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`)


      const branchSalesRows = (sales || []) as unknown as Array<Record<string, unknown>>
      const totalSales = branchSalesRows.reduce((s, r) => s + ((r.total_amount as number) || 0), 0)
      const txCount = branchSalesRows.length || 0
      grandTotal += totalSales

      perBranch.push({
        id: branch.id,
        name: branch.name,
        code: branch.code,
        today_sales: totalSales,
        today_transactions: txCount,
        sales_pct: 0, // calculated after loop
        avg_basket: txCount > 0 ? Math.round(totalSales / txCount) : 0,
      })
    }

    for (const b of perBranch) {
      b.sales_pct = grandTotal > 0 ? Math.round((b.today_sales / grandTotal) * 10000) / 100 : 0
    }

    return perBranch.sort((a, b) => b.today_sales - a.today_sales)
  } catch (error) {
    logger.error('Error fetching branch performance:', error)
    return []
  }
}

/**
 * Hourly sales breakdown (today)
 */
export async function getHourlySales(dateFilter?: string): Promise<SalesHourly[]> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return []

    const today = dateFilter || new Date().toISOString().split('T')[0]

    const { data: sales } = await supabaseAdmin
      .from('sales')
      .select('total_amount, created_at')
      .eq('payment_status', 'completed')
      .neq('sale_status', 'voided')
      .neq('sale_status', 'returned')
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`)

    const hourly: Record<number, { sales: number; tx: number }> = {}
    for (let h = 0; h < 24; h++) hourly[h] = { sales: 0, tx: 0 }

    const hourlySalesRows = (sales || []) as unknown as Array<Record<string, unknown>>

    for (const s of hourlySalesRows) {
      const hour = new Date(s.created_at as string).getHours()
      hourly[hour].sales += (s.total_amount as number) || 0
      hourly[hour].tx++
    }

    return Object.entries(hourly).map(([hour, data]) => ({
      hour: parseInt(hour),
      sales: data.sales,
      transactions: data.tx,
    }))
  } catch (error) {
    logger.error('Error fetching hourly sales:', error)
    return []
  }
}

/**
 * Top revenue-generating products (today)
 */
export async function getTopProducts(limit = 10, dateFilter?: string): Promise<TopProduct[]> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return []

    const today = dateFilter || new Date().toISOString().split('T')[0]

    const { data: items } = await supabaseAdmin
      .from('sale_items')
      .select(`
        quantity, unit_price, line_total, product_id,
        sale:sales!inner(created_at, sale_status, payment_status),
        product:products(name, sku, purchase_price)
      `)
      .gte('sale.created_at', `${today}T00:00:00`)
      .lte('sale.created_at', `${today}T23:59:59`)
      .neq('sale.sale_status', 'voided')
      .neq('sale.sale_status', 'returned')
      .eq('sale.payment_status', 'completed')

    const productMap: Record<string, { name: string; sku: string; qty: number; revenue: number; cost: number }> = {}

    for (const row of items || []) {
      const item = row as Record<string, unknown>
      const product = item.product as { name: string; sku: string; purchase_price: number } | null
      if (!product) continue
      const pid = item.product_id as string
      if (!productMap[pid]) {
        productMap[pid] = { name: product.name, sku: product.sku, qty: 0, revenue: 0, cost: 0 }
      }
      const qty = (item.quantity as number) || 0
      const lineTotal = (item.line_total as number) || 0
      productMap[pid].qty += qty
      productMap[pid].revenue += lineTotal
      productMap[pid].cost += qty * (product.purchase_price || 0)
    }

    return Object.entries(productMap)
      .map(([id, p]) => ({ id, name: p.name, sku: p.sku, quantity: p.qty, revenue: p.revenue, profit: p.revenue - p.cost }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit)
  } catch (error) {
    logger.error('Error fetching top products:', error)
    return []
  }
}

/**
 * AI-generated business insights based on data analysis
 */
export async function getAIInsights(): Promise<AIInsight[]> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return []

    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

    const insights: AIInsight[] = []

    // Compare today vs yesterday revenue
    const { data: todaySales } = await supabaseAdmin
      .from('sales')
      .select('total_amount')
      .eq('payment_status', 'completed')
      .neq('sale_status', 'voided')
      .neq('sale_status', 'returned')
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`)

    const { data: yesterdaySales } = await supabaseAdmin
      .from('sales')
      .select('total_amount')
      .eq('payment_status', 'completed')
      .neq('sale_status', 'voided')
      .neq('sale_status', 'returned')
      .gte('created_at', `${yesterday}T00:00:00`)
      .lte('created_at', `${yesterday}T23:59:59`)

    const todaySalesRows = (todaySales || []) as unknown as Array<Record<string, unknown>>
    const yesterdaySalesRows = (yesterdaySales || []) as unknown as Array<Record<string, unknown>>

    const todayRev = todaySalesRows.reduce((s, r) => s + ((r.total_amount as number) || 0), 0)
    const yesterdayRev = yesterdaySalesRows.reduce((s, r) => s + ((r.total_amount as number) || 0), 0)

    if (yesterdayRev > 0) {
      const change = Math.round(((todayRev - yesterdayRev) / yesterdayRev) * 10000) / 100
      if (change > 5) {
        insights.push({ type: 'positive', message: `Sales increased ${change}% compared to yesterday.`, metric: 'Revenue', change })
      } else if (change < -5) {
        insights.push({ type: 'negative', message: `Sales dropped ${Math.abs(change)}% compared to yesterday.`, metric: 'Revenue', change })
      } else {
        insights.push({ type: 'info', message: `Sales are stable compared to yesterday (${change > 0 ? '+' : ''}${change}%).`, metric: 'Revenue', change })
      }
    }

    // Critical stock alerts
    const { data: criticalItems } = await supabaseAdmin
      .from('products')
      .select('id, name, safety_stock')
      .eq('status', 'active')

    const criticalItemRows = (criticalItems || []) as unknown as Array<Record<string, unknown>>
    let criticalList: Array<{ name: string; available: number }> = []
    for (const p of criticalItemRows) {
      const { data: inv } = await supabaseAdmin
        .from('inventory')
        .select('quantity')
        .eq('product_id', p.id as string)
      const total = (inv || []).reduce((s: number, r: Record<string, unknown>) => s + ((r.quantity as number) || 0), 0)
      if (total <= ((p.safety_stock as number) || 0) && total <= 5) {
        criticalList.push({ name: p.name as string, available: total })
      }
    }
    if (criticalList.length > 0) {
      const top3 = criticalList.slice(0, 3).map(p => p.name).join(', ')
      insights.push({
        type: 'warning',
        message: `Running out of: ${top3}${criticalList.length > 3 ? ` and ${criticalList.length - 3} more` : ''}. Consider urgent reorder.`,
        metric: 'Stock',
      })
    }

    // High refund activity
    const { data: refunds } = await supabaseAdmin
      .from('sales')
      .select('branch_id, total_amount')
      .eq('sale_status', 'returned')
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`)

    const refundRows = (refunds || []) as unknown as Array<Record<string, unknown>>
    const refundTotal = refundRows.reduce((s, r) => s + ((r.total_amount as number) || 0), 0)
    if (refundTotal > 0 && todayRev > 0) {
      const refundPct = Math.round((refundTotal / todayRev) * 10000) / 100
      if (refundPct > 10) {
        insights.push({
          type: 'negative',
          message: `Refunds are ${refundPct}% of today's revenue. Consider reviewing your return reasons.`,
          metric: 'Returns',
        })
      }
    }

    // Top product insight
    const topProducts = await getTopProducts(5)
    if (topProducts.length > 0) {
      const topRevenue = topProducts.reduce((s, p) => s + p.revenue, 0)
      if (topRevenue > 0 && todayRev > 0) {
        const pct = Math.round((topRevenue / todayRev) * 10000) / 100
        insights.push({
          type: 'positive',
          message: `Your top 5 products generated ${pct}% of today's revenue. "${topProducts[0].name}" leads.`,
          metric: 'Products',
        })
      }
    }

    // Average basket
    const txCount = todaySalesRows.length
    const avgBasket = txCount > 0 ? Math.round(todayRev / txCount) : 0
    if (avgBasket > 0) {
      insights.push({
        type: 'info',
        message: `Average basket today is KES ${avgBasket.toLocaleString()}.`,
        metric: 'Basket',
      })
    }

    return insights
  } catch (error) {
    logger.error('Error generating AI insights:', error)
    return []
  }
}
