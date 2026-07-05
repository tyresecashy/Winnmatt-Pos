'use server'
import { logger } from '@/lib/logger'
import { supabaseAdmin } from '@/lib/supabase-server'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ProfitSummary {
  totalRevenue: number
  totalCOGS: number
  grossProfit: number
  marginPercent: number
  transactionCount: number
  averageProfit: number
}

export interface DailyProfit {
  date: string
  revenue: number
  cogs: number
  profit: number
  marginPercent: number
}

export interface CategoryProfit {
  category: string
  revenue: number
  cogs: number
  profit: number
  marginPercent: number
  itemCount: number
}

export interface ProductProfit {
  productId: string
  name: string
  category: string
  unitsSold: number
  revenue: number
  cogs: number
  profit: number
  marginPercent: number
}

export interface CashierPerformance {
  cashierId: string
  cashierName: string
  totalSales: number
  transactionCount: number
  averageTransaction: number
  totalItems: number
  itemsPerSale: number
  ranking: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function zeroProfitSummary(): ProfitSummary {
  return {
    totalRevenue: 0,
    totalCOGS: 0,
    grossProfit: 0,
    marginPercent: 0,
    transactionCount: 0,
    averageProfit: 0,
  }
}

/**
 * Get IDs of active (non-voided, non-held) sales in a date range for a branch.
 */
async function getActiveSaleIds(branchId: string, startDate: string, endDate: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from('sales')
    .select('id')
    .eq('branch_id', branchId)
    .not('sale_status', 'in', '("voided","returned","on_hold")')
    .gte('created_at', startDate)
    .lte('created_at', endDate)

  return data?.map((s) => s.id) || []
}

/**
 * Build a product → purchase_price lookup map.
 */
async function buildCostMap(productIds: string[]): Promise<Record<string, number>> {
  if (productIds.length === 0) return {}
  const { data: products } = await supabaseAdmin
    .from('products')
    .select('id, purchase_price')
    .in('id', productIds)

  const map: Record<string, number> = {}
  products?.forEach((p) => {
    map[p.id] = p.purchase_price || 0
  })
  return map
}

/**
 * Build a product → category name lookup map using the categories FK.
 */
async function buildCategoryMap(productIds: string[]): Promise<Record<string, string>> {
  if (productIds.length === 0) return {}
  // PostgREST embedding: products.category_id → categories.id
  const { data: products } = await supabaseAdmin
    .from('products')
    .select('id, categories!inner(name)')
    .in('id', productIds)

  const map: Record<string, string> = {}
  products?.forEach((p: any) => {
    map[p.id] = p.categories?.name || 'Other'
  })
  return map
}

/**
 * Build a product → { name, category } lookup map.
 */
async function buildProductMetaMap(
  productIds: string[]
): Promise<Record<string, { name: string; category: string }>> {
  if (productIds.length === 0) return {}
  const { data: products } = await supabaseAdmin
    .from('products')
    .select('id, name, categories(name)')
    .in('id', productIds)

  const map: Record<string, { name: string; category: string }> = {}
  products?.forEach((p: any) => {
    map[p.id] = {
      name: p.name || 'Unknown',
      category: p.categories?.name || 'Other',
    }
  })
  return map
}

// ─── Public Actions ──────────────────────────────────────────────────────────

/**
 * Get profit summary (revenue, COGS, gross profit, margin %) for a period.
 */
export async function getProfitSummary(
  branchId: string,
  startDate: string,
  endDate: string
): Promise<ProfitSummary> {
  try {
    const saleIds = await getActiveSaleIds(branchId, startDate, endDate)
    if (saleIds.length === 0) return zeroProfitSummary()

    const { data: items } = await supabaseAdmin
      .from('sale_items')
      .select('product_id, quantity, line_total')
      .in('sale_id', saleIds)

    const itemList = items || []
    if (itemList.length === 0) return zeroProfitSummary()

    const productIds = [...new Set(itemList.map((i) => i.product_id))]
    const costMap = await buildCostMap(productIds)

    let totalRevenue = 0
    let totalCOGS = 0

    itemList.forEach((item) => {
      totalRevenue += item.line_total
      totalCOGS += item.quantity * (costMap[item.product_id] || 0)
    })

    const grossProfit = totalRevenue - totalCOGS
    const marginPercent =
      totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 10000) / 100 : 0

    return {
      totalRevenue: Math.round(totalRevenue),
      totalCOGS: Math.round(totalCOGS),
      grossProfit: Math.round(grossProfit),
      marginPercent,
      transactionCount: saleIds.length,
      averageProfit: saleIds.length > 0 ? Math.round(grossProfit / saleIds.length) : 0,
    }
  } catch (error) {
    logger.error('Error fetching profit summary:', error)
    return zeroProfitSummary()
  }
}

/**
 * Get daily profit trend for charting.
 */
export async function getDailyProfitTrend(
  branchId: string,
  startDate: string,
  endDate: string
): Promise<DailyProfit[]> {
  try {
    const saleIds = await getActiveSaleIds(branchId, startDate, endDate)
    if (saleIds.length === 0) return []

    // Get sales with dates
    const { data: sales } = await supabaseAdmin
      .from('sales')
      .select('id, created_at, total_amount')
      .in('id', saleIds)
      .order('created_at', { ascending: true })

    if (!sales || sales.length === 0) return []

    // Get all sale items with product cost
    const { data: items } = await supabaseAdmin
      .from('sale_items')
      .select('sale_id, product_id, quantity, line_total')
      .in('sale_id', saleIds)

    const itemList = items || []

    const productIds = [...new Set(itemList.map((i) => i.product_id))]
    const costMap = await buildCostMap(productIds)

    // Build sale_id → items lookup
    const saleItemsMap: Record<string, typeof itemList> = {}
    itemList.forEach((item) => {
      if (!saleItemsMap[item.sale_id]) saleItemsMap[item.sale_id] = []
      saleItemsMap[item.sale_id].push(item)
    })

    // Group by date
    const dateMap: Record<
      string,
      { revenue: number; cogs: number }
    > = {}

    sales.forEach((sale) => {
      const date = sale.created_at?.split('T')[0] || 'Unknown'
      if (!dateMap[date]) dateMap[date] = { revenue: 0, cogs: 0 }

      dateMap[date].revenue += sale.total_amount || 0

      const saleItems = saleItemsMap[sale.id] || []
      saleItems.forEach((item) => {
        dateMap[date].cogs += item.quantity * (costMap[item.product_id] || 0)
      })
    })

    return Object.entries(dateMap)
      .map(([date, { revenue, cogs }]) => {
        const profit = revenue - cogs
        return {
          date,
          revenue: Math.round(revenue),
          cogs: Math.round(cogs),
          profit: Math.round(profit),
          marginPercent:
            revenue > 0 ? Math.round((profit / revenue) * 10000) / 100 : 0,
        }
      })
      .sort((a, b) => a.date.localeCompare(b.date))
  } catch (error) {
    logger.error('Error fetching daily profit trend:', error)
    return []
  }
}

/**
 * Get profit breakdown by product category.
 */
export async function getCategoryProfit(
  branchId: string,
  startDate: string,
  endDate: string
): Promise<CategoryProfit[]> {
  try {
    const saleIds = await getActiveSaleIds(branchId, startDate, endDate)
    if (saleIds.length === 0) return []

    const { data: items } = await supabaseAdmin
      .from('sale_items')
      .select('product_id, quantity, line_total')
      .in('sale_id', saleIds)

    const itemList = items || []
    if (itemList.length === 0) return []

    const productIds = [...new Set(itemList.map((i) => i.product_id))]
    const [costMap, categoryMap] = await Promise.all([
      buildCostMap(productIds),
      buildCategoryMap(productIds),
    ])

    const aggMap: Record<
      string,
      { revenue: number; cogs: number; count: number }
    > = {}

    itemList.forEach((item) => {
      const cat = categoryMap[item.product_id] || 'Other'
      if (!aggMap[cat]) aggMap[cat] = { revenue: 0, cogs: 0, count: 0 }
      aggMap[cat].revenue += item.line_total
      aggMap[cat].cogs += item.quantity * (costMap[item.product_id] || 0)
      aggMap[cat].count += item.quantity
    })

    return Object.entries(aggMap)
      .map(([category, { revenue, cogs, count }]) => {
        const profit = revenue - cogs
        return {
          category,
          revenue: Math.round(revenue),
          cogs: Math.round(cogs),
          profit: Math.round(profit),
          marginPercent:
            revenue > 0 ? Math.round((profit / revenue) * 10000) / 100 : 0,
          itemCount: count,
        }
      })
      .sort((a, b) => b.profit - a.profit)
  } catch (error) {
    logger.error('Error fetching category profit:', error)
    return []
  }
}

/**
 * Get top N products ranked by gross profit.
 */
export async function getTopProfitProducts(
  branchId: string,
  startDate: string,
  endDate: string,
  limit: number = 10
): Promise<ProductProfit[]> {
  try {
    const saleIds = await getActiveSaleIds(branchId, startDate, endDate)
    if (saleIds.length === 0) return []

    const { data: items } = await supabaseAdmin
      .from('sale_items')
      .select('product_id, quantity, line_total')
      .in('sale_id', saleIds)

    const itemList = items || []
    if (itemList.length === 0) return []

    const productIds = [...new Set(itemList.map((i) => i.product_id))]
    const [costMap, metaMap] = await Promise.all([
      buildCostMap(productIds),
      buildProductMetaMap(productIds),
    ])

    const aggMap: Record<
      string,
      { unitsSold: number; revenue: number; cogs: number }
    > = {}

    itemList.forEach((item) => {
      if (!aggMap[item.product_id])
        aggMap[item.product_id] = { unitsSold: 0, revenue: 0, cogs: 0 }
      aggMap[item.product_id].unitsSold += item.quantity
      aggMap[item.product_id].revenue += item.line_total
      aggMap[item.product_id].cogs += item.quantity * (costMap[item.product_id] || 0)
    })

    return Object.entries(aggMap)
      .map(([productId, { unitsSold, revenue, cogs }]) => {
        const profit = revenue - cogs
        const meta = metaMap[productId]
        return {
          productId,
          name: meta?.name || 'Unknown',
          category: meta?.category || 'Other',
          unitsSold,
          revenue: Math.round(revenue),
          cogs: Math.round(cogs),
          profit: Math.round(profit),
          marginPercent:
            revenue > 0 ? Math.round((profit / revenue) * 10000) / 100 : 0,
        }
      })
      .sort((a, b) => b.profit - a.profit)
      .slice(0, limit)
  } catch (error) {
    logger.error('Error fetching top profit products:', error)
    return []
  }
}

/**
 * Get products with low or negative margins (warning list).
 */
export async function getLowMarginProducts(
  branchId: string,
  startDate: string,
  endDate: string,
  thresholdPercent: number = 10,
  limit: number = 20
): Promise<ProductProfit[]> {
  try {
    const all = await getTopProfitProducts(branchId, startDate, endDate, 200)
    return all
      .filter((p) => p.marginPercent < thresholdPercent)
      .slice(0, limit)
  } catch (error) {
    logger.error('Error fetching low margin products:', error)
    return []
  }
}

/**
 * Get cashier sales performance with ranking.
 */
export async function getCashierLeaderboard(
  branchId: string,
  startDate: string,
  endDate: string
): Promise<CashierPerformance[]> {
  try {
    const { data: sales } = await supabaseAdmin
      .from('sales')
      .select('id, cashier_id, total_amount')
      .eq('branch_id', branchId)
      .not('sale_status', 'in', '("voided","returned","on_hold")')
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    if (!sales || sales.length === 0) return []

    // Get cashier names from users table
    const cashierIds = [...new Set(sales.map((s) => s.cashier_id))]
    const { data: users } = await supabaseAdmin
      .from('users')
      .select('id, name')
      .in('id', cashierIds)

    const userNameMap: Record<string, string> = {}
    users?.forEach((u) => {
      userNameMap[u.id] = u.name || 'Unknown'
    })

    // Get sale item counts
    const saleIds = sales.map((s) => s.id)
    const { data: items } = await supabaseAdmin
      .from('sale_items')
      .select('sale_id, quantity')
      .in('sale_id', saleIds)

    const itemCountMap: Record<string, number> = {}
    items?.forEach((item) => {
      if (!itemCountMap[item.sale_id]) itemCountMap[item.sale_id] = 0
      itemCountMap[item.sale_id] += item.quantity
    })

    // Aggregate per cashier
    const cashierMap: Record<
      string,
      { totalSales: number; transactionCount: number; totalItems: number }
    > = {}

    sales.forEach((sale) => {
      if (!cashierMap[sale.cashier_id]) {
        cashierMap[sale.cashier_id] = { totalSales: 0, transactionCount: 0, totalItems: 0 }
      }
      cashierMap[sale.cashier_id].totalSales += sale.total_amount
      cashierMap[sale.cashier_id].transactionCount += 1
      cashierMap[sale.cashier_id].totalItems += itemCountMap[sale.id] || 0
    })

    // Build ranked list
    const entries = Object.entries(cashierMap)
      .map(([cashierId, data]) => ({
        cashierId,
        cashierName: userNameMap[cashierId] || 'Unknown',
        totalSales: Math.round(data.totalSales),
        transactionCount: data.transactionCount,
        averageTransaction: data.transactionCount > 0 ? Math.round(data.totalSales / data.transactionCount) : 0,
        totalItems: data.totalItems,
        itemsPerSale: data.transactionCount > 0 ? Math.round((data.totalItems / data.transactionCount) * 10) / 10 : 0,
        ranking: 0,
      }))
      .sort((a, b) => b.totalSales - a.totalSales)
      .map((entry, index) => ({ ...entry, ranking: index + 1 }))

    return entries
  } catch (error) {
    logger.error('Error fetching cashier leaderboard:', error)
    return []
  }
}

/**
 * Get comparison data for previous period (YoY / MoM).
 * Returns the profit summary for an earlier period of the same length.
 */
export async function getPreviousPeriodComparison(
  branchId: string,
  currentStartDate: string,
  currentEndDate: string
): Promise<{
  current: ProfitSummary
  previous: ProfitSummary
  changePercent: number
}> {
  try {
    const current = await getProfitSummary(branchId, currentStartDate, currentEndDate)

    const startDate = new Date(currentStartDate)
    const endDate = new Date(currentEndDate)
    const periodMs = endDate.getTime() - startDate.getTime()

    const prevEndDate = new Date(startDate.getTime() - 1) // day before current start
    const prevStartDate = new Date(prevEndDate.getTime() - periodMs)

    const previous = await getProfitSummary(
      branchId,
      prevStartDate.toISOString().split('T')[0],
      prevEndDate.toISOString().split('T')[0]
    )

    const changePercent =
      previous.grossProfit > 0
        ? Math.round(((current.grossProfit - previous.grossProfit) / previous.grossProfit) * 10000) / 100
        : current.grossProfit > 0
          ? 100
          : 0

    return { current, previous, changePercent }
  } catch (error) {
    logger.error('Error fetching period comparison:', error)
    return {
      current: zeroProfitSummary(),
      previous: zeroProfitSummary(),
      changePercent: 0,
    }
  }
}
