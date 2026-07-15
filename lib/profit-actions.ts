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
  for (const p of (products as Record<string, unknown>[] || [])) {
    map[p.id as string] = ((p.categories as Record<string, unknown>)?.name as string) || 'Other'
  }
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
  for (const p of (products as Record<string, unknown>[] || [])) {
    map[p.id as string] = {
      name: (p.name as string) || 'Unknown',
      category: ((p.categories as Record<string, unknown>)?.name as string) || 'Other',
    }
  }
  return map
}

// ─── Public Actions ──────────────────────────────────────────────────────────






