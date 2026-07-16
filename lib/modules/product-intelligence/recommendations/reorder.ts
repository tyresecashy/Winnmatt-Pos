/**
 * Reorder Engine — Smart reorder suggestion engine (EOQ + ROP + Safety Stock).
 *
 * Replaces the existing basic reorder logic in inventory-analytics-actions.ts.
 *
 * Formulas (Sprint 11D):
 * - EOQ: √(2DS/H) where D=annualized demand, S=setup cost, H=holding cost per unit/year
 * - ROP: avg_daily_demand × lead_time + safety_stock
 * - Safety Stock: z × σ × √L where z=service level Z-score, σ=demand stddev, L=lead time
 * - Days until stockout: current_stock / forecast_daily_demand
 *
 * Sprint 11D: Full implementation replacing Sprint 11A stub.
 *
 * @see ../../../../docs/16_PRODUCT_INTELLIGENCE.md (Section 9.2)
 */

import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import { recommendationsRepository } from '../repositories/recommendations-repository'
import type { ReorderSuggestion, RecommendationQuery } from '../types'
import { createRecommendationGeneratedEvent } from '../events'
import { publish } from '@/lib/realtime/event-bus'

// PI tables not in auto-generated Supabase types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const piDb = supabaseAdmin as any

// ─── Constants ──────────────────────────────────────────────────

const DEFAULT_SETUP_COST = 50        // Fixed cost per order (KES) — configurable
const DEFAULT_HOLDING_COST_PCT = 0.20 // Annual holding cost as % of unit cost
const DEFAULT_SERVICE_LEVEL = 0.95
const DEFAULT_LEAD_TIME_DAYS = 7
const DEFAULT_MIN_STOCK = 1           // Minimum stock before immediate urgency

// Z-scores for service levels (one-tailed)
const SERVICE_LEVEL_Z: Record<number, number> = {
  0.90: 1.282,
  0.95: 1.645,
  0.975: 1.960,
  0.99: 2.326,
}

function zScore(serviceLevel: number): number {
  const levels = Object.keys(SERVICE_LEVEL_Z).map(Number).sort((a, b) => a - b)
  for (const level of levels) {
    if (serviceLevel <= level) return SERVICE_LEVEL_Z[level]
  }
  return SERVICE_LEVEL_Z[0.99] // Cap at 99%
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

// ─── Reorder Engine ─────────────────────────────────────────────

export class ReorderEngine {
  /**
   * Evaluate a single product for reorder need.
   * Uses forecast daily demand, current inventory, lead time, and service level.
   */
  async evaluateProduct(
    productId: string,
    branchId?: string,
    options?: {
      forecastDailyDemand?: number
      demandStdDev?: number
      leadTimeDays?: number
      serviceLevel?: number
      unitCost?: number
      setupCost?: number
    },
  ): Promise<ReorderSuggestion> {
    try {
      // Fetch inventory, product details, and lead time in parallel
      const [inventoryResult, productResult, leadTimeResult] = await Promise.all([
        this.getInventory(productId, branchId),
        this.getProduct(productId),
        this.getLeadTime(productId),
      ])

      const currentStock = inventoryResult ?? 0
      const unitCost = options?.unitCost ?? productResult?.purchase_price ?? 0
      const leadTimeDays = options?.leadTimeDays ?? leadTimeResult ?? DEFAULT_LEAD_TIME_DAYS
      const serviceLevel = options?.serviceLevel ?? DEFAULT_SERVICE_LEVEL

      // Use provided forecast or fetch from inventory default
      const forecastDailyDemand = options?.forecastDailyDemand ?? productResult?.avg_daily_sales ?? 0
      const demandStdDev = options?.demandStdDev ?? 0

      // Compute safety stock
      const z = zScore(serviceLevel)
      const safetyStock = Math.round(z * demandStdDev * Math.sqrt(leadTimeDays))

      // Compute reorder point
      const reorderPoint = Math.round(forecastDailyDemand * leadTimeDays + safetyStock)

      // Compute EOQ (Economic Order Quantity)
      const annualDemand = forecastDailyDemand * 365
      const setupCost = options?.setupCost ?? DEFAULT_SETUP_COST
      const holdingCostPerUnit = unitCost * DEFAULT_HOLDING_COST_PCT
      const economicOrderQty = annualDemand > 0 && holdingCostPerUnit > 0
        ? Math.round(Math.sqrt((2 * annualDemand * setupCost) / holdingCostPerUnit))
        : 0

      // Days until stockout
      const daysUntilStockout = forecastDailyDemand > 0
        ? currentStock / forecastDailyDemand
        : Infinity

      // Urgency
      const urgency = this.classifyUrgency(currentStock, reorderPoint, daysUntilStockout, leadTimeDays)

      // Suggested order quantity
      const suggestedOrderQty = urgency === 'immediate' || urgency === 'soon'
        ? Math.max(economicOrderQty, reorderPoint - currentStock)
        : 0

      // Estimated cost
      const numOrders = annualDemand > 0 && economicOrderQty > 0
        ? Math.ceil(annualDemand / economicOrderQty)
        : 0
      const annualOrderCost = numOrders * setupCost
      const avgInventory = safetyStock + (economicOrderQty / 2)
      const annualHoldingCost = avgInventory * holdingCostPerUnit
      const estimatedCost = Math.round(annualOrderCost + annualHoldingCost)

      const suggestion: ReorderSuggestion = {
        productId,
        productName: productResult?.name ?? 'Unknown',
        currentStock,
        forecastDailyDemand,
        demandStdDev,
        leadTimeDays,
        serviceLevel,
        safetyStock,
        reorderPoint,
        economicOrderQty,
        suggestedOrderQty,
        daysUntilStockout: daysUntilStockout === Infinity ? Infinity : Math.round(daysUntilStockout * 10) / 10,
        urgency,
        estimatedCost,
        preferredSupplierId: null,
      }

      // Persist to DB
      await recommendationsRepository.upsertReorderSuggestion({
        ...suggestion,
        branchId: branchId ?? null,
      })

      return suggestion
    } catch (error) {
      logger.error('[ReorderEngine] evaluateProduct failed', { productId, error })
      throw error
    }
  }

  /**
   * Evaluate all products for reorder need.
   * Fetches inventory data in bulk, computes reorder suggestions for each product.
   */
  async evaluateAllProducts(branchId?: string, batchSize = 500): Promise<ReorderSuggestion[]> {
    try {
      // Fetch all inventory records with product details
      const { data: inventoryData } = await supabaseAdmin
        .from('inventory')
        .select(`
          product_id,
          quantity,
          product:products(id, name, purchase_price, avg_daily_sales)
        `)
        .limit(batchSize)

      if (!inventoryData || inventoryData.length === 0) return []

      const suggestions: ReorderSuggestion[] = []

      for (const inv of inventoryData) {
        try {
          const product = (inv as Record<string, unknown>).product as {
            id: string; name: string; purchase_price: number | null; avg_daily_sales: number | null
          } | null

          const productId = inv.product_id
          const currentStock = inv.quantity ?? 0

          if (!productId) continue

          // Get lead time from DB or default
          const leadTimeResult = await this.getLeadTime(productId)
          const leadTimeDays = leadTimeResult ?? DEFAULT_LEAD_TIME_DAYS

          // Parse product details
          const forecastDailyDemand = product?.avg_daily_sales ?? 0
          const unitCost = product?.purchase_price ?? 0
          const productName = product?.name ?? 'Unknown'
          const serviceLevel = DEFAULT_SERVICE_LEVEL
          const z = zScore(serviceLevel)
          const demandStdDev = Math.max(1, forecastDailyDemand * 0.3) // Estimate stddev as 30% of mean

          // Compute metrics
          const safetyStock = Math.round(z * demandStdDev * Math.sqrt(leadTimeDays))
          const reorderPoint = Math.round(forecastDailyDemand * leadTimeDays + safetyStock)
          const annualDemand = forecastDailyDemand * 365
          const holdingCostPerUnit = unitCost * DEFAULT_HOLDING_COST_PCT
          const economicOrderQty = annualDemand > 0 && holdingCostPerUnit > 0
            ? Math.round(Math.sqrt((2 * annualDemand * DEFAULT_SETUP_COST) / holdingCostPerUnit))
            : 0

          const daysUntilStockout = forecastDailyDemand > 0
            ? currentStock / forecastDailyDemand
            : Infinity

          const urgency = this.classifyUrgency(currentStock, reorderPoint, daysUntilStockout, leadTimeDays)

          const suggestedOrderQty = urgency === 'immediate' || urgency === 'soon'
            ? Math.max(economicOrderQty, reorderPoint - currentStock)
            : 0

          const suggestion: ReorderSuggestion = {
            productId,
            productName,
            currentStock,
            forecastDailyDemand,
            demandStdDev,
            leadTimeDays,
            serviceLevel,
            safetyStock,
            reorderPoint,
            economicOrderQty,
            suggestedOrderQty,
            daysUntilStockout: daysUntilStockout === Infinity ? Infinity : Math.round(daysUntilStockout * 10) / 10,
            urgency,
            estimatedCost: Math.round(
              (annualDemand > 0 && economicOrderQty > 0
                ? Math.ceil(annualDemand / economicOrderQty) * DEFAULT_SETUP_COST
                : 0) +
              ((safetyStock + (economicOrderQty / 2)) * holdingCostPerUnit)
            ),
            preferredSupplierId: null,
          }

          suggestions.push(suggestion)
        } catch (innerErr) {
          logger.warn('[ReorderEngine] Skipping product in batch evaluation', { productId: inv.product_id, error: innerErr })
        }
      }

      // Persist batch to DB
      await recommendationsRepository.upsertReorderBatch(
        suggestions.map(s => ({ ...s, branchId: branchId ?? null })),
      )

      // Publish event
      if (suggestions.length > 0) {
        publish(createRecommendationGeneratedEvent('reorder', 'batch', branchId ?? null))
      }

      logger.info('[ReorderEngine] Batch evaluation complete', { count: suggestions.length, branchId })
      return suggestions
    } catch (error) {
      logger.error('[ReorderEngine] evaluateAllProducts failed', { error })
      throw error
    }
  }

  /**
   * Get reorder suggestions from the persisted DB.
   */
  async getSuggestions(query: RecommendationQuery): Promise<ReorderSuggestion[]> {
    return recommendationsRepository.getReorderSuggestions(query)
  }

  // ─── Private Helpers ──────────────────────────────────────────

  private classifyUrgency(
    currentStock: number,
    reorderPoint: number,
    daysUntilStockout: number,
    leadTimeDays: number,
  ): ReorderSuggestion['urgency'] {
    if (currentStock <= DEFAULT_MIN_STOCK) return 'immediate'
    if (currentStock < reorderPoint * 0.5) return 'immediate'
    if (daysUntilStockout <= leadTimeDays) return 'immediate'
    if (currentStock < reorderPoint) return 'soon'
    if (daysUntilStockout <= leadTimeDays * 2) return 'soon'
    if (daysUntilStockout <= leadTimeDays * 3) return 'normal'
    return 'sufficient'
  }

  private async getInventory(productId: string, branchId?: string): Promise<number | null> {
    let query = supabaseAdmin
      .from('inventory')
      .select('quantity')
      .eq('product_id', productId)
      .limit(1)

    if (branchId) {
      query = query.eq('branch_id', branchId) as typeof query
    }

    const { data } = await query.single() as { data: { quantity: number } | null }
    return data?.quantity ?? null
  }

  private async getProduct(productId: string): Promise<{ name: string; purchase_price: number | null; avg_daily_sales: number | null } | null> {
    const { data } = await supabaseAdmin
      .from('products')
      .select('name, purchase_price, avg_daily_sales')
      .eq('id', productId)
      .single()

    return data as unknown as { name: string; purchase_price: number | null; avg_daily_sales: number | null } | null
  }

  /**
   * Get lead time for a product-supplier pair.
   * Looks up the product_supplier_lead_times table.
   */
  private async getLeadTime(productId: string): Promise<number | null> {
    const { data } = await piDb
      .from('product_supplier_lead_times')
      .select('lead_time_days')
      .eq('product_id', productId)
      .order('lead_time_days', { ascending: true })
      .limit(1)

    if (data && data.length > 0) {
      return (data[0] as { lead_time_days: number }).lead_time_days
    }

    return null
  }
}

export const reorderEngine = new ReorderEngine()
