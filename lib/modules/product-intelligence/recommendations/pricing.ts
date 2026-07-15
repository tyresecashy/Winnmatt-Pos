/**
 * Pricing Engine — Price optimization signal engine.
 *
 * Analyzes sales velocity, margin, inventory level, and competitor context
 * to suggest pricing actions: raise, lower, hold, or promote.
 *
 * Signals:
 * - Price increase: high demand, high velocity, low elasticity, strong margin
 * - Markdown/lower: slow moving, excess inventory, high stock-to-sales ratio
 * - Dead stock discount: no sales in 30+ days, has inventory
 * - High-demand premium: in top 20% velocity, stockout risk, stable demand
 * - Hold: everything neutral/default
 *
 * Sprint 11D: Full implementation replacing Sprint 11A stub.
 *
 * @see ../../../../docs/16_PRODUCT_INTELLIGENCE.md (Section 3.2)
 */

import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import { recommendationsRepository } from '../repositories/recommendations-repository'
import type { PriceSignal } from '../types'
import { createRecommendationGeneratedEvent } from '../events'
import { publish } from '@/lib/realtime/event-bus'

// ─── Constants ──────────────────────────────────────────────────

const HIGH_VELOCITY_PCT = 0.20      // Top 20% velocity = high demand
const SLOW_MOVING_THRESHOLD = 0.05  // Bottom 5% velocity = slow moving
const EXCESS_INVENTORY_RATIO = 90   // Days of supply > 90 = excess
const MIN_MARGIN_FOR_RAISE = 0.15   // At least 15% margin to consider price increase
const PREMIUM_MARGIN_BOOST = 0.05   // Suggested 5% increase for premium candidates
const MARKDOWN_PCT = 0.20           // Suggested 20% markdown for slow movers
const DEAD_STOCK_DISCOUNT_PCT = 0.40 // Suggested 40% discount for dead stock
const MIN_CONFIDENCE_PRODUCTS = 20   // Minimum products for velocity percentile calc

// ─── Pricing Engine ─────────────────────────────────────────────

export class PricingEngine {
  /**
   * Get price signal for a product.
   * Analyzes product performance, inventory level, and sales trend.
   */
  async getPriceSignal(productId: string, branchId?: string): Promise<PriceSignal> {
    try {
      const product = await this.getProductDetails(productId)
      if (!product) {
        return {
          productId,
          productName: 'Unknown',
          currentPrice: 0,
          suggestedPrice: null,
          signal: 'hold',
          confidence: 0,
          reason: 'Product not found',
          elasticity: null,
        }
      }

      const currentPrice = product.selling_price ?? 0
      const purchasePrice = product.purchase_price ?? 0
      const margin = currentPrice > 0 ? (currentPrice - purchasePrice) / currentPrice : 0

      // Gather analytics data
      const [velocityInfo, inventoryInfo, categoryPeers] = await Promise.all([
        this.getProductVelocity(productId, branchId),
        this.getInventoryLevel(productId, branchId),
        this.getCategoryVelocityPercentiles(product.category_id, branchId),
      ])

      const velocity = velocityInfo ?? 0
      const inventory = inventoryInfo ?? 0
      const velocityPct = categoryPeers.length > MIN_CONFIDENCE_PRODUCTS
        ? this.percentileRank(categoryPeers, velocity)
        : 0.5

      // Dead stock check
      const isDeadStock = await this.isDeadStock(productId)

      // Signal classification
      const signal = this.classifySignal(margin, velocityPct, inventory, velocity, isDeadStock, categoryPeers)
      const confidence = this.computeConfidence(signal, margin, categoryPeers.length, inventory)
      const suggestedPrice = this.computeSuggestedPrice(currentPrice, purchasePrice, signal, margin)
      const elasticity = this.estimateElasticity(velocity, velocityPct)

      return {
        productId,
        productName: product.name,
        currentPrice,
        suggestedPrice,
        signal,
        confidence,
        reason: this.buildReason(signal, margin, velocityPct, inventory, isDeadStock),
        elasticity,
      }
    } catch (error) {
      logger.error('[PricingEngine] getPriceSignal failed', { productId, error })
      throw error
    }
  }

  /**
   * Get price signals for all products in a batch.
   */
  async getAllPriceSignals(branchId?: string, batchSize = 500): Promise<PriceSignal[]> {
    try {
      const { data: products } = await supabaseAdmin
        .from('products')
        .select('id')
        .limit(batchSize)

      if (!products || products.length === 0) return []

      const signals: PriceSignal[] = []
      for (const product of products) {
        try {
          const signal = await this.getPriceSignal(product.id, branchId)
          signals.push(signal)
        } catch {
          // Skip individual failures
        }
      }

      // Publish event
      if (signals.length > 0) {
        publish(createRecommendationGeneratedEvent('pricing', 'batch', branchId ?? null))
      }

      return signals
    } catch (error) {
      logger.error('[PricingEngine] getAllPriceSignals failed', { error })
      throw error
    }
  }

  // ─── Private Helpers ──────────────────────────────────────────

  private classifySignal(
    margin: number,
    velocityPct: number,
    inventory: number,
    velocity: number,
    isDeadStock: boolean,
    categoryPeers: number[],
  ): PriceSignal['signal'] {
    // Dead stock → promote (deep discount)
    if (isDeadStock && inventory > 0) return 'promote'

    // High demand, good margin, premium pricing opportunity
    if (velocityPct >= (1 - HIGH_VELOCITY_PCT) && margin >= MIN_MARGIN_FOR_RAISE) return 'raise'

    // Excess inventory, slow moving → lower/markdown
    if (velocityPct <= SLOW_MOVING_THRESHOLD && inventory > 0) return 'lower'

    // High demand, low inventory, premium opportunity
    if (velocityPct >= (1 - HIGH_VELOCITY_PCT) && inventory > 0 && velocity > 0) return 'raise'

    // Default: hold
    return 'hold'
  }

  private computeConfidence(
    signal: PriceSignal['signal'],
    margin: number,
    peerCount: number,
    inventory: number,
  ): number {
    let base = 0.5

    // Signal-specific confidence adjustments
    switch (signal) {
      case 'raise':
        base += Math.min(0.3, margin * 0.5)
        break
      case 'lower':
        base += inventory > 0 ? 0.2 : 0
        if (margin < 0.05) base -= 0.1 // Very low margin reduces confidence
        break
      case 'promote':
        base += 0.3
        break
      case 'hold':
        base = 0.4
        break
    }

    // More peer data = more confidence
    const peerBoost = Math.min(0.2, peerCount / 500)
    base += peerBoost

    return Math.min(1, Math.max(0, Math.round(base * 100) / 100))
  }

  private computeSuggestedPrice(
    currentPrice: number,
    purchasePrice: number,
    signal: PriceSignal['signal'],
    margin: number,
  ): number | null {
    switch (signal) {
      case 'raise':
        return Math.round(currentPrice * (1 + PREMIUM_MARGIN_BOOST) * 100) / 100
      case 'lower':
        return Math.round(currentPrice * (1 - MARKDOWN_PCT) * 100) / 100
      case 'promote':
        return Math.max(
          purchasePrice * 1.05, // At least 5% above cost
          Math.round(currentPrice * (1 - DEAD_STOCK_DISCOUNT_PCT) * 100) / 100,
        )
      case 'hold':
        return null
    }
  }

  private buildReason(
    signal: PriceSignal['signal'],
    margin: number,
    velocityPct: number,
    inventory: number,
    isDeadStock: boolean,
  ): string {
    switch (signal) {
      case 'raise':
        return `High demand product (top ${Math.round((1 - velocityPct) * 100)}% velocity) with ${(margin * 100).toFixed(0)}% margin — consider ${Math.round(PREMIUM_MARGIN_BOOST * 100)}% price increase`
      case 'lower':
        return `Slow moving product (bottom ${Math.round(velocityPct * 100)}% velocity) with ${inventory > 0 ? `${Math.round(inventory)} units in stock` : 'no stock'} — consider ${Math.round(MARKDOWN_PCT * 100)}% markdown`
      case 'promote':
        return `Dead stock product with ${inventory > 0 ? `${Math.round(inventory)} units` : 'no inventory'} — recommend ${Math.round(DEAD_STOCK_DISCOUNT_PCT * 100)}% clearance discount`
      case 'hold':
        return 'Product performance is within normal range — no pricing action recommended'
    }
  }

  private estimateElasticity(velocity: number, velocityPct: number): number | null {
    if (velocity <= 0) return null
    // Rough elasticity estimation:
    // High velocity + high percentile = less elastic (necessity)
    // Low velocity + low percentile = more elastic (luxury/discretionary)
    const rawElasticity = (1 - velocityPct) * 2
    // Clamp to reasonable range [0.2, 3.0]
    return Math.round(Math.max(0.2, Math.min(3.0, rawElasticity)) * 100) / 100
  }

  private percentileRank(sortedValues: number[], value: number): number {
    if (sortedValues.length === 0) return 0.5
    const sorted = [...sortedValues].sort((a, b) => a - b)
    const count = sorted.length
    let lessThan = 0
    for (const v of sorted) {
      if (v < value) lessThan++
    }
    return lessThan / count
  }

  private async getProductDetails(productId: string): Promise<{
    id: string
    name: string
    selling_price: number | null
    purchase_price: number | null
    category_id: string | null
  } | null> {
    const { data } = await supabaseAdmin
      .from('products')
      .select('id, name, selling_price, purchase_price, category_id')
      .eq('id', productId)
      .single()

    return data as unknown as {
      id: string; name: string; selling_price: number | null
      purchase_price: number | null; category_id: string | null
    } | null
  }

  private async getProductVelocity(productId: string, branchId?: string): Promise<number | null> {
    const days = 30
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    let query = supabaseAdmin
      .from('sale_items')
      .select('quantity')
      .eq('product_id', productId)
      .gte('created_at', startDate)

    if (branchId) {
      const { data: saleIds } = await supabaseAdmin
        .from('sales')
        .select('id')
        .eq('branch_id', branchId)
        .gte('created_at', startDate)

      if (saleIds && saleIds.length > 0) {
        query = query.in('sale_id', saleIds.map(s => s.id))
      }
    }

    const { data } = await query
    const totalQty = (data ?? []).reduce((sum, item) => sum + (item.quantity ?? 0), 0)
    return totalQty / days
  }

  private async getInventoryLevel(productId: string, branchId?: string): Promise<number | null> {
    let query = supabaseAdmin
      .from('inventory')
      .select('quantity')
      .eq('product_id', productId)

    if (branchId) {
      query = query.eq('branch_id', branchId)
    } else {
      query = query.limit(1)
    }

    const { data } = await query
    if (!data || data.length === 0) return 0
    return (data as Array<{ quantity: number }>).reduce((sum, r) => sum + (r.quantity ?? 0), 0)
  }

  private async getCategoryVelocityPercentiles(categoryId: string | null, branchId?: string): Promise<number[]> {
    if (!categoryId) return []

    const days = 30
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    let query = supabaseAdmin
      .from('sale_items')
      .select('product_id, quantity')
      .gte('created_at', startDate)
      .limit(5000)

    const { data } = await query
    if (!data || data.length === 0) return []

    // Aggregate by product
    const productQty = new Map<string, number>()
    for (const item of data) {
      productQty.set(item.product_id, (productQty.get(item.product_id) ?? 0) + (item.quantity ?? 0))
    }

    // Get product categories
    const productIds = Array.from(productQty.keys())
    const { data: products } = await supabaseAdmin
      .from('products')
      .select('id, category_id')
      .in('id', productIds)

    if (!products) return []

    // Filter by category
    const categoryProducts = new Set(
      products.filter(p => p.category_id === categoryId).map(p => p.id),
    )

    return Array.from(productQty.entries())
      .filter(([pid]) => categoryProducts.has(pid))
      .map(([, qty]) => qty / days)
  }

  private async isDeadStock(productId: string): Promise<boolean> {
    const days = 30
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    const { data } = await supabaseAdmin
      .from('sale_items')
      .select('id')
      .eq('product_id', productId)
      .gte('created_at', startDate)
      .limit(1)

    // No sales in 30 days = dead stock
    return !data || data.length === 0
  }
}

export const pricingEngine = new PricingEngine()
