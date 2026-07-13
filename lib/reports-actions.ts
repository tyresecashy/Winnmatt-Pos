'use server'
import { logger } from '@/lib/logger';

import { supabaseAdmin } from '@/lib/supabase-server'

/**
 * Get sales summary stats for a date range
 */
export async function getSalesStats(branchId: string, startDate: string, endDate: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('sales')
      .select('id, total_amount, payment_method, created_at')
      .eq('branch_id', branchId)
      .neq('sale_status', 'voided') // Exclude voided sales from stats
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false })

    if (error) throw error

    const sales = data || []
    const totalSales = sales.reduce((sum, s) => sum + s.total_amount, 0)
    const transactionCount = sales.length
    const averageTransaction = transactionCount > 0 ? Math.round(totalSales / transactionCount) : 0

    // Payment method breakdown
    const paymentMethods: Record<string, { amount: number; count: number }> = {
      cash: { amount: 0, count: 0 },
      card: { amount: 0, count: 0 },
      bank_transfer: { amount: 0, count: 0 },
      cheque: { amount: 0, count: 0 },
      credit: { amount: 0, count: 0 },
    }

    sales.forEach((sale) => {
      const method = sale.payment_method as string
      if (paymentMethods[method]) {
        paymentMethods[method].amount += sale.total_amount
        paymentMethods[method].count += 1
      }
    })

    return {
      totalSales,
      transactionCount,
      averageTransaction,
      paymentMethods,
    }
  } catch (error) {
    logger.error('Error fetching sales stats:', error)
    return {
      totalSales: 0,
      transactionCount: 0,
      averageTransaction: 0,
      paymentMethods: {},
    }
  }
}

/**
 * Get top selling products for a date range
 */
export async function getTopSellingProducts(branchId: string, startDate: string, endDate: string, limit: number = 10) {
  try {
    // Get sales for this branch and date range (exclude voided)
    const { data: salesData } = await supabaseAdmin
      .from('sales')
      .select('id')
      .eq('branch_id', branchId)
      .neq('sale_status', 'voided') // Exclude voided sales
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    const saleIds = salesData?.map((s) => s.id) || []

    if (saleIds.length === 0) return []

    // Get sale items with product data
    const { data: items, error } = await supabaseAdmin
      .from('sale_items')
      .select('product_id, quantity, line_total')
      .in('sale_id', saleIds)

    if (error) throw error

    const itemList = items || []

    // Get all products in one query
    const productIds = [...new Set(itemList.map((i) => i.product_id))]
    const { data: products } = await supabaseAdmin
      .from('products')
      .select('id, name, category_id')
      .in('id', productIds)

    const productMap: Record<string, { id: string; name: string; category_id: string | null }> = {}
    products?.forEach((p: { id: string; name: string; category_id: string | null }) => {
      productMap[p.id] = p
    })

    // Group items by product
    const topMap: Record<
      string,
      { product_id: string; name: string; category: string; units_sold: number; revenue: number }
    > = {}

    itemList.forEach((item) => {
      if (!topMap[item.product_id]) {
        const product = productMap[item.product_id]
        topMap[item.product_id] = {
          product_id: item.product_id,
          name: product?.name || 'Unknown',
          category: product?.category_id || 'Other',
          units_sold: 0,
          revenue: 0,
        }
      }
      topMap[item.product_id].units_sold += item.quantity
      topMap[item.product_id].revenue += item.line_total
    })

    // Sort by revenue and limit
    const topProducts = Object.values(topMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit)

    return topProducts
  } catch (error) {
    logger.error('Error fetching top selling products:', error)
    return []
  }
}

/**
 * Get slow moving products (not sold recently)
 */
export async function getSlowMovingProducts(branchId: string, daysSinceSale: number = 7, limit: number = 10) {
  try {
    // Get all products for this branch
    const { data: allProducts, error: productsError } = await supabaseAdmin
      .from('inventory')
      .select('product_id, quantity')
      .eq('branch_id', branchId)
      .gt('quantity', 0)

    if (productsError) throw productsError

    const products = allProducts || []

    // Get product names
    const productIds = products.map((p) => p.product_id)
    const { data: productDetails } = await supabaseAdmin
      .from('products')
      .select('id, name')
      .in('id', productIds)

    const productMap: Record<string, string> = {}
    productDetails?.forEach((p) => {
      productMap[p.id] = p.name
    })

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysSinceSale)

    // For each product, find last sale date
    const slowMoving = []

    for (const inv of products) {
      const { data: lastSale } = await supabaseAdmin
        .from('sale_items')
        .select('created_at', { count: 'exact' })
        .eq('product_id', inv.product_id)
        .in(
          'sale_id',
          await supabaseAdmin
            .from('sales')
            .select('id')
            .eq('branch_id', branchId)
            .then((res) => res.data?.map((s) => s.id) || [])
        )
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      const daysWithoutSale = lastSale?.created_at
        ? Math.floor((new Date().getTime() - new Date(lastSale.created_at).getTime()) / (1000 * 60 * 60 * 24))
        : 999

      if (daysWithoutSale >= daysSinceSale) {
        slowMoving.push({
          product_id: inv.product_id,
          product: productMap[inv.product_id] || 'Unknown',
          days_since_last_sale: daysWithoutSale,
          stock: inv.quantity,
        })
      }
    }

    return slowMoving.sort((a, b) => b.days_since_last_sale - a.days_since_last_sale).slice(0, limit)
  } catch (error) {
    logger.error('Error fetching slow moving products:', error)
    return []
  }
}

/**
 * Get inventory value by category
 */
export async function getInventoryValueByCategory(branchId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('inventory')
      .select('product_id, quantity')
      .eq('branch_id', branchId)

    if (error) throw error

    const items = data || []

    // Get product details
    const productIds = items.map((i) => i.product_id)
    const { data: products } = await supabaseAdmin
      .from('products')
      .select('id, name, category_id, purchase_price')
      .in('id', productIds)

    const productMap: Record<string, { id: string; name: string; category_id: string | null; purchase_price: number }> = {}
    products?.forEach((p) => {
      productMap[p.id as string] = p as { id: string; name: string; category_id: string | null; purchase_price: number }
    })

    const categoryMap: Record<string, { value: number; count: number }> = {}

    items.forEach((item) => {
      const product = productMap[item.product_id]
      const category = product?.category_id || 'Other'
      const itemValue = (item.quantity * (product?.purchase_price || 0)) || 0

      if (!categoryMap[category]) {
        categoryMap[category] = { value: 0, count: 0 }
      }
      categoryMap[category].value += itemValue
      categoryMap[category].count += item.quantity
    })

    const totalValue = Object.values(categoryMap).reduce((sum, cat) => sum + cat.value, 0)

    const categoryData = Object.entries(categoryMap)
      .map(([name, data]) => ({
        category: name,
        value: Math.round(data.value),
        percentage: totalValue > 0 ? Math.round((data.value / totalValue) * 100) : 0,
      }))
      .sort((a, b) => b.value - a.value)

    return {
      categories: categoryData,
      totalValue: Math.round(totalValue),
    }
  } catch (error) {
    logger.error('Error fetching inventory value by category:', error)
    return { categories: [], totalValue: 0 }
  }
}

/**
 * Get branch performance stats
 */
export async function getBranchPerformanceStats(startDate: string, endDate: string) {
  try {
    // Get all branches
    const { data: branches, error: branchesError } = await supabaseAdmin
      .from('branches')
      .select('id, name')

    if (branchesError) throw branchesError

    const branchList = branches || []
    const branchStats = []

    for (const branch of branchList) {
      const { data: sales } = await supabaseAdmin
        .from('sales')
        .select('id, total_amount')
        .eq('branch_id', branch.id)
        .neq('sale_status', 'voided') // Exclude voided sales from branch stats
        .gte('created_at', startDate)
        .lte('created_at', endDate)

      const salesData = sales || []
      const totalSales = salesData.reduce((sum, s) => sum + s.total_amount, 0)
      const transactionCount = salesData.length

      branchStats.push({
        branch_id: branch.id,
        branch_name: branch.name,
        sales: totalSales,
        transactions: transactionCount,
      })
    }

    return branchStats.sort((a, b) => b.sales - a.sales)
  } catch (error) {
    logger.error('Error fetching branch performance stats:', error)
    return []
  }
}

/**
 * Get cashier performance stats
 */
export async function getCashierPerformanceStats(branchId: string, startDate: string, endDate: string) {
  try {
    const { data: sales, error } = await supabaseAdmin
      .from('sales')
      .select('id, cashier_id, total_amount')
      .eq('branch_id', branchId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    if (error) throw error

    const salesData = sales || []

    // Get cashier names
    const cashierIds = [...new Set(salesData.map((s) => s.cashier_id))]
    const { data: users } = await supabaseAdmin
      .from('users')
      .select('id, full_name')
      .in('id', cashierIds)

    const userMap: Record<string, string> = {}
    users?.forEach((u) => {
      userMap[u.id] = u.full_name
    })

    const cashierMap: Record<
      string,
      { cashier_id: string; cashier_name: string; sales: number; transactions: number }
    > = {}

    salesData.forEach((sale) => {
      if (!cashierMap[sale.cashier_id]) {
        cashierMap[sale.cashier_id] = {
          cashier_id: sale.cashier_id,
          cashier_name: userMap[sale.cashier_id] || 'Unknown',
          sales: 0,
          transactions: 0,
        }
      }
      cashierMap[sale.cashier_id].sales += sale.total_amount
      cashierMap[sale.cashier_id].transactions += 1
    })

    const cashierStats = Object.values(cashierMap).map((cashier) => ({
      ...cashier,
      avg_transaction: cashier.transactions > 0 ? Math.round(cashier.sales / cashier.transactions) : 0,
    }))

    return cashierStats.sort((a, b) => b.sales - a.sales)
  } catch (error) {
    logger.error('Error fetching cashier performance stats:', error)
    return []
  }
}

/**
 * Get daily sales trend for a date range (for charting)
 */
export async function getDailySalesTrend(branchId: string, startDate: string, endDate: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('sales')
      .select('created_at, total_amount')
      .eq('branch_id', branchId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: true })

    if (error) throw error

    const sales = data || []
    const dailyMap: Record<string, number> = {}

    sales.forEach((sale) => {
      const date = new Date(sale.created_at!).toISOString().split('T')[0]
      dailyMap[date] = (dailyMap[date] || 0) + sale.total_amount
    })

    const dailyData = Object.entries(dailyMap)
      .map(([date, amount]) => ({
        date,
        sales: amount,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return dailyData
  } catch (error) {
    logger.error('Error fetching daily sales trend:', error)
    return []
  }
}

/**
 * Get stock in vs stock out summary (purchases vs sales)
 */
export async function getStockMovementSummary(branchId: string, startDate: string, endDate: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('stock_movements')
      .select('type, quantity')
      .eq('branch_id', branchId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    if (error) throw error

    const movements = data || []
    const summary = {
      received: 0,
      sold: 0,
      transferred_in: 0,
      transferred_out: 0,
      adjustment: 0,
      damage: 0,
    }

    movements.forEach((movement) => {
      const type = movement.type as keyof typeof summary
      if (type in summary) {
        summary[type] += movement.quantity
      }
    })

    return summary
  } catch (error) {
    logger.error('Error fetching stock movement summary:', error)
    return {}
  }
}

/**
 * Get low stock / out of stock products for a branch
 */
export async function getLowStockProducts(branchId: string, limit: number = 10) {
  try {
    const { data, error } = await supabaseAdmin
      .from('inventory')
      .select('product_id, quantity')
      .eq('branch_id', branchId)
      .order('quantity', { ascending: true })
      .limit(limit)

    if (error) throw error

    const items = data || []

    // Get product details
    const productIds = items.map((i) => i.product_id)
    const { data: products } = await supabaseAdmin
      .from('products')
      .select('id, name, reorder_level')
      .in('id', productIds)

    const productMap: Record<string, { id: string; name: string; reorder_level: number }> = {}
    products?.forEach((p) => {
      productMap[p.id] = p
    })

    return items
      .map((item) => {
        const product = productMap[item.product_id]
        return {
          product_id: item.product_id,
          product_name: product?.name || 'Unknown',
          current_stock: item.quantity,
          reorder_level: product?.reorder_level || 10,
          status: item.quantity === 0 ? 'out_of_stock' : item.quantity <= (product?.reorder_level || 10) ? 'low_stock' : 'ok',
        }
      })
      .filter((p) => p.status !== 'ok')
  } catch (error) {
    logger.error('Error fetching low stock products:', error)
    return []
  }
}
