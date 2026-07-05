'use server'
import { logger } from '@/lib/logger';

import { authenticateServerAction, authorizePOSProfile, resolveAuthorizedBranchId } from '@/lib/auth-helpers'
import { getNairobiDateKey, getNairobiDayRange, getNairobiWeekdayLabel } from '@/lib/date-time'
import { supabaseAdmin } from '@/lib/supabase-server'

async function getAuthorizedDashboardBranch(branchId: string) {
  const authResult = await authenticateServerAction()
  if (!authResult.success || !authResult.profile) {
    logger.warn('[DASHBOARD] Branch-scoped query denied:', { error: authResult.error })
    return null
  }

  const posAccess = authorizePOSProfile(authResult.profile)
  if (!posAccess.authorized) {
    logger.warn('[DASHBOARD] Branch-scoped POS access denied:', { error: posAccess.error })
    return null
  }

  const branchScope = resolveAuthorizedBranchId(authResult.profile, branchId)
  if (!branchScope.authorized || !branchScope.branchId) {
    logger.warn('[DASHBOARD] Branch-scoped branch denied:', { error: branchScope.error })
    return null
  }

  return {
    profile: authResult.profile,
    branchId: branchScope.branchId,
  }
}

/**
 * Get today's sales stats
 */
export async function getTodayDashboardStats(branchId: string) {
  try {
    const authorized = await getAuthorizedDashboardBranch(branchId)
    if (!authorized) {
      return {
        totalSales: 0,
        transactionCount: 0,
        averageBasket: 0,
        activeCustomers: 0,
      }
    }

    const { start, end } = getNairobiDayRange()

    const { data: sales, error } = await supabaseAdmin
      .from('sales')
      .select('id, total_amount, customer_id')
      .eq('branch_id', authorized.branchId)
      .neq('payment_status', 'failed')
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString())

    if (error) throw error

    const salesData = sales || []
    const totalSales = salesData.reduce((sum, s) => sum + s.total_amount, 0)
    const transactionCount = salesData.length
    const averageBasket = transactionCount > 0 ? Math.round(totalSales / transactionCount) : 0
    const activeCustomers = new Set(
      salesData
        .map((sale) => sale.customer_id)
        .filter((customerId): customerId is string => Boolean(customerId))
    ).size

    return {
      totalSales,
      transactionCount,
      averageBasket,
      activeCustomers,
    }
  } catch (error) {
    logger.error('Error fetching today dashboard stats:', error)
    return {
      totalSales: 0,
      transactionCount: 0,
      averageBasket: 0,
      activeCustomers: 0,
    }
  }
}

/**
 * Get weekly sales trend (last 7 days)
 */
export async function getWeeklySalesTrend(branchId: string) {
  try {
    const authorized = await getAuthorizedDashboardBranch(branchId)
    if (!authorized) {
      return []
    }

    const { start: todayStart, end: tomorrowStart } = getNairobiDayRange()
    const sevenDaysAgoStart = new Date(todayStart)
    sevenDaysAgoStart.setUTCDate(sevenDaysAgoStart.getUTCDate() - 6)

    const { data: sales, error } = await supabaseAdmin
      .from('sales')
      .select('created_at, total_amount')
      .eq('branch_id', authorized.branchId)
      .neq('payment_status', 'failed')
      .gte('created_at', sevenDaysAgoStart.toISOString())
      .lt('created_at', tomorrowStart.toISOString())
      .order('created_at', { ascending: true })

    if (error) throw error

    const salesData = sales || []
    const dailyMap: Record<string, { sales: number; count: number }> = {}

    salesData.forEach((s) => {
      const dateStr = getNairobiDateKey(s.created_at)

      if (!dailyMap[dateStr]) {
        dailyMap[dateStr] = { sales: 0, count: 0 }
      }
      dailyMap[dateStr].sales += s.total_amount
      dailyMap[dateStr].count += 1
    })

    // Generate last 7 days with 0 if no sales
    const trendData = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date(todayStart)
      date.setUTCDate(date.getUTCDate() - i)
      const dateStr = getNairobiDateKey(date)
      const dayLabel = getNairobiWeekdayLabel(date)

      const dayData = dailyMap[dateStr] || { sales: 0, count: 0 }
      trendData.push({
        day: dayLabel,
        sales: dayData.sales,
        transactions: dayData.count,
      })
    }

    return trendData
  } catch (error) {
    logger.error('Error fetching weekly sales trend:', error)
    return []
  }
}

/**
 * Get branch performance for dashboard
 */
export async function getBranchPerformanceToday(startDate?: Date, endDate?: Date) {
  try {
    const authResult = await authenticateServerAction()
    if (!authResult.success || !authResult.profile) {
      logger.warn('[DASHBOARD] Branch performance denied:', { error: authResult.error })
      return []
    }

    const posAccess = authorizePOSProfile(authResult.profile)
    if (!posAccess.authorized) {
      logger.warn('[DASHBOARD] Branch performance POS access denied:', { error: posAccess.error })
      return []
    }

    const { start: todayStart, end: tomorrowStart } = getNairobiDayRange()

    const start = startDate ? startDate.toISOString() : todayStart.toISOString()
    const end = endDate ? endDate.toISOString() : tomorrowStart.toISOString()

    // Get all branches
    const branchQuery = supabaseAdmin
      .from('branches')
      .select('id, name')

    const { data: branches, error: branchesError } =
      authResult.profile.role === 'super_admin'
        ? await branchQuery
        : await branchQuery.eq('id', authResult.profile.branch_id || '')

    if (branchesError) throw branchesError

    const branchList = branches || []
    if (branchList.length === 0) {
      return []
    }

    const branchIds = branchList.map((branch) => branch.id)
    const { data: sales, error: salesError } = await supabaseAdmin
      .from('sales')
      .select('branch_id, total_amount')
      .in('branch_id', branchIds)
      .neq('payment_status', 'failed')
      .gte('created_at', start)
      .lt('created_at', end)

    if (salesError) throw salesError

    const branchSalesMap = new Map<string, { sales: number; transactions: number }>()
    for (const branch of branchList) {
      branchSalesMap.set(branch.id, { sales: 0, transactions: 0 })
    }

    for (const sale of sales || []) {
      const current = branchSalesMap.get(sale.branch_id)
      if (!current) {
        continue
      }

      current.sales += sale.total_amount || 0
      current.transactions += 1
    }

    const branchSales = branchList.map((branch) => {
      const totals = branchSalesMap.get(branch.id) || { sales: 0, transactions: 0 }
      return {
        id: branch.id,
        name: branch.name,
        sales: totals.sales,
        transactions: totals.transactions,
      }
    })

    const totalSales = branchSales.reduce((sum, b) => sum + b.sales, 0)

    return branchSales.map((b) => ({
      ...b,
      percentage: totalSales > 0 ? (b.sales / totalSales) * 100 : 0,
    }))
  } catch (error) {
    logger.error('Error fetching branch performance:', error)
    return []
  }
}

/**
 * Get top selling products for today
 */
export async function getTopProductsToday(branchId: string, limit: number = 5) {
  try {
    const authorized = await getAuthorizedDashboardBranch(branchId)
    if (!authorized) {
      return []
    }

    const { start, end } = getNairobiDayRange()

    // Get sales for today
    const { data: salesIds } = await supabaseAdmin
      .from('sales')
      .select('id')
      .eq('branch_id', authorized.branchId)
      .neq('payment_status', 'failed')
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString())

    const saleIds = (salesIds || []).map((s) => s.id)
    if (saleIds.length === 0) return []

    // Get sale items
    const { data: items } = await supabaseAdmin
      .from('sale_items')
      .select('product_id, quantity, line_total')
      .in('sale_id', saleIds)

    const itemList = items || []

    // Get product names
    const productIds = [...new Set(itemList.map((i) => i.product_id))]
    const { data: products } = await supabaseAdmin
      .from('products')
      .select('id, name')
      .in('id', productIds)

    const productMap: Record<string, string> = {}
    products?.forEach((p) => {
      productMap[p.id] = p.name
    })

    // Group by product
    const productStats: Record<string, { product: string; unitsSold: number; revenue: number }> = {}
    itemList.forEach((item) => {
      if (!productStats[item.product_id]) {
        productStats[item.product_id] = {
          product: productMap[item.product_id] || 'Unknown',
          unitsSold: 0,
          revenue: 0,
        }
      }
      productStats[item.product_id].unitsSold += item.quantity
      productStats[item.product_id].revenue += item.line_total
    })

    return Object.values(productStats)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit)
  } catch (error) {
    logger.error('Error fetching top products:', error)
    return []
  }
}

/**
 * Get payment method breakdown for today
 */
export async function getPaymentBreakdownToday(branchId: string) {
  try {
    const authorized = await getAuthorizedDashboardBranch(branchId)
    if (!authorized) {
      return []
    }

    const { start, end } = getNairobiDayRange()

    const { data: sales } = await supabaseAdmin
      .from('sales')
      .select('payment_method, total_amount')
      .eq('branch_id', authorized.branchId)
      .neq('payment_status', 'failed')
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString())

    const paymentMap: Record<string, number> = {
      cash: 0,
      card: 0,
      bank_transfer: 0,
      cheque: 0,
      credit: 0,
    }

    const salesList = (sales || []) as Array<{ payment_method: string; total_amount: number }>
    salesList.forEach((s) => {
      const method = s.payment_method as string
      if (method in paymentMap) {
        paymentMap[method] += s.total_amount
      }
    })

    const paymentLabels: Record<string, string> = {
      cash: 'Cash',
      card: 'Card',
      bank_transfer: 'Bank Transfer',
      cheque: 'Cheque',
      credit: 'Credit',
    }

    return Object.entries(paymentMap)
      .filter(([_, amount]) => amount > 0)
      .map(([method, amount]) => ({
        name: paymentLabels[method] || method,
        value: amount,
      }))
  } catch (error) {
    logger.error('Error fetching payment breakdown:', error)
    return []
  }
}

/**
 * Get low stock alerts for a branch
 */
export async function getLowStockAlertsForBranch(branchId: string, limit: number = 5) {
  try {
    const authorized = await getAuthorizedDashboardBranch(branchId)
    if (!authorized) {
      return []
    }

    const { data: inventory } = await supabaseAdmin
      .from('inventory')
      .select('product_id, quantity')
      .eq('branch_id', authorized.branchId)
      .order('quantity', { ascending: true })
      .limit(limit * 2)

    const items = inventory || []

    // Get product and branch details
    const productIds = items.map((i) => i.product_id)
    const { data: products } = await supabaseAdmin
      .from('products')
      .select('id, name, reorder_level')
      .in('id', productIds)

    const { data: branch } = await supabaseAdmin
      .from('branches')
      .select('name')
      .eq('id', authorized.branchId)
      .single()

    const productMap: Record<string, { name: string; reorder_level: number }> = {}
    products?.forEach((p) => {
      productMap[p.id] = { name: p.name, reorder_level: p.reorder_level || 10 }
    })

    const alerts = items
      .filter((item) => {
        const product = productMap[item.product_id]
        return !product || item.quantity <= product.reorder_level
      })
      .slice(0, limit)
      .map((item) => ({
        product: productMap[item.product_id]?.name || 'Unknown',
        branch: branch?.name || 'Unknown',
        currentStock: item.quantity,
      }))

    return alerts
  } catch (error) {
    logger.error('Error fetching low stock alerts:', error)
    return []
  }
}

/**
 * Get recent transactions for a branch
 */
export async function getRecentTransactions(branchId: string, limit: number = 5) {
  try {
    const authorized = await getAuthorizedDashboardBranch(branchId)
    if (!authorized) {
      return []
    }

    const { data: sales, error } = await supabaseAdmin
      .from('sales')
      .select('id, receipt_number, total_amount, payment_method, created_at, customer_id, payment_status')
      .eq('branch_id', authorized.branchId)
      .neq('payment_status', 'failed')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    const salesData = (sales || []) as Array<{ id: string; receipt_number: string; total_amount: number; payment_method: string; created_at: string; customer_id: string | null; payment_status: string }>

    if (salesData.length === 0) {
      return []
    }

    // Get customer info
    const customerIds = [...new Set(salesData.map((s) => s.customer_id).filter(Boolean))]
    const { data: customers } =
      customerIds.length > 0
        ? await supabaseAdmin
            .from('customers')
            .select('id, name, type')
            .in('id', customerIds)
        : { data: [] as Array<{ id: string; name: string; type?: string }> }

    const customerMap: Record<string, { name: string; type?: string }> = {}
    customers?.forEach((c) => {
      customerMap[c.id] = { name: c.name, type: c.type }
    })

    // Get sale items count for each sale
    const saleIds = salesData.map((s) => s.id)
    const { data: saleItems } =
      saleIds.length > 0
        ? await supabaseAdmin
            .from('sale_items')
            .select('sale_id, quantity')
            .in('sale_id', saleIds)
        : { data: [] as Array<{ sale_id: string; quantity: number }> }

    const itemMap: Record<string, number> = {}
    saleItems?.forEach((item: { sale_id: string; quantity: number }) => {
      itemMap[item.sale_id] = (itemMap[item.sale_id] || 0) + (item.quantity || 0)
    })

    const paymentMethodLabels: Record<string, string> = {
      cash: 'Cash',
      card: 'Card',
      bank_transfer: 'Bank Transfer',
      cheque: 'Cheque',
      credit: 'Credit',
      mpesa: 'M-Pesa',
      paybill: 'Paybill',
    }

    return salesData.map((sale) => ({
      id: sale.id,
      receiptNo: sale.receipt_number || `RCP-${sale.id.slice(0, 8)}`,
      customer: sale.customer_id && customerMap[sale.customer_id] ? customerMap[sale.customer_id].name : 'Walk-in Customer',
      items: itemMap[sale.id] || 0,
      total: sale.total_amount,
      paymentMethod: paymentMethodLabels[sale.payment_method as string] || sale.payment_method,
      timestamp: sale.created_at,
    }))
  } catch (error) {
    logger.error('Error fetching recent transactions:', error)
    return []
  }
}

/**
 * Get seasonal insights and retail vs wholesale breakdown
 */
export async function getSeasonalInsights(branchId: string) {
  try {
    const today = new Date()
    const currentMonth = today.toLocaleDateString('en-US', { month: 'long' })
    const currentYear = today.getFullYear()
    const monthStart = new Date(currentYear, today.getMonth(), 1)

    // Get this month's sales
    const { data: monthSales } = await supabaseAdmin
      .from('sales')
      .select('id, total_amount, customer_id')
      .eq('branch_id', branchId)
      .gte('created_at', monthStart.toISOString())
      .lt('created_at', today.toISOString())

    const monthSalesData = monthSales || []
    const monthTotal = monthSalesData.reduce((sum, s) => sum + s.total_amount, 0)
    const daysInMonth = new Date(currentYear, today.getMonth() + 1, 0).getDate()
    const daysElapsed = today.getDate()

    // Project to end of month
    const monthProjection = daysElapsed > 0 ? Math.round(monthTotal * (daysInMonth / daysElapsed)) : monthTotal

    // Get customer types for retail vs wholesale
    const customerIds = [...new Set(monthSalesData.map((s) => s.customer_id).filter(Boolean))]
    const { data: customers } = await supabaseAdmin
      .from('customers')
      .select('id, type')
      .in('id', customerIds)

    const customerTypeMap: Record<string, string> = {}
    customers?.forEach((c) => {
      customerTypeMap[c.id] = c.type
    })

    // Calculate retail vs wholesale
    const retailVsWholesale = { retail: 0, wholesale: 0 }
    monthSalesData.forEach((sale) => {
      const customerType = customerTypeMap[sale.customer_id] || 'retail'
      if (customerType === 'wholesale') {
        retailVsWholesale.wholesale += sale.total_amount
      } else {
        retailVsWholesale.retail += sale.total_amount
      }
    })

    // Calculate months to December peak (simplified: December is a strong month)
    const monthsUntilDecember = (12 - today.getMonth() - 1 + 12) % 12 || 12

    // Get average sales for the year to estimate December peak
    const { data: yearSales } = await supabaseAdmin
      .from('sales')
      .select('total_amount')
      .eq('branch_id', branchId)
      .gte('created_at', new Date(currentYear, 0, 1).toISOString())
      .lt('created_at', new Date(currentYear + 1, 0, 1).toISOString())

    const yearTotal = (yearSales || []).reduce((sum, s) => sum + s.total_amount, 0)
    const avgMonthly = yearTotal / 12
    const decemberPeak = Math.round(avgMonthly * 1.5) // Assume December is ~1.5x average

    return {
      currentMonth,
      projection: monthProjection,
      decemberPeak,
      monthsUntilPeak: monthsUntilDecember,
      recommendation: `Plan for ${monthsUntilDecember} months until December peak. Focus on inventory optimization for holiday season.`,
      retailVsWholesale,
    }
  } catch (error) {
    logger.error('Error fetching seasonal insights:', error)
    return {
      currentMonth: new Date().toLocaleDateString('en-US', { month: 'long' }),
      projection: 0,
      decemberPeak: 0,
      monthsUntilPeak: 0,
      recommendation: 'Unable to load seasonal data',
      retailVsWholesale: { retail: 0, wholesale: 0 },
    }
  }
}
