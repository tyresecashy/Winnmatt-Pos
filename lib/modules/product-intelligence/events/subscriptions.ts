/**
 * Product Intelligence — Event subscriptions
 *
 * Subscribes to existing system events to trigger PI updates:
 * - sale.completed → Re-score products + customer + business health; invalidate product forecasts
 * - stock.changed → Re-score affected product(s); invalidate its forecast; check inventory anomalies
 * - stock.low     → Evaluate reorder need and publish alert
 *
 * Sprint 11B: Real scoring triggers wired.
 * Sprint 11C: Forecast invalidation on sale/stock events.
 * Sprint 11D: Reorder evaluation on stock.low events.
 * Sprint 11E: Inventory anomaly detection on stock.changed events.
 *
 * @see lib/realtime/event-bus.ts (subscribe / subscribeAll)
 */

import { subscribe, publish } from '@/lib/realtime/event-bus'
import { logger } from '@/lib/logger'
import { productScorer } from '../scoring/product-scorer'
import { customerScorer } from '../scoring/customer-scorer'
import { businessHealthScorer } from '../scoring/business-health'
import { demandForecaster } from '../forecasting/demand-forecast'
import { reorderEngine } from '../recommendations/reorder'
import { anomalyDetector } from '../insights/anomaly-detector'
import { createScoringCompletedEvent, createReorderAlertEvent } from './index'

/**
 * Register all Product Intelligence event subscriptions.
 * Call once during module initialization.
 *
 * Returns unsubscribe functions for clean shutdown.
 */
export function registerSubscriptions(): Array<() => void> {
  const unsubscribers: Array<() => void> = []

  // ─── sale.completed → Re-score + invalidate forecasts ────────────
  const unsubSale = subscribe('sale.completed', (event) => {
    const branchId = event.payload?.branchId as string | undefined
    const customerId = event.payload?.customerId as string | undefined
    const productIds = event.payload?.productIds as string[] | undefined

    logger.info('[PI] sale.completed — triggering score recomputation + forecast invalidation', {
      branchId,
      customerId,
      productCount: productIds?.length,
    })

    // Fire-and-forget scoring triggers
    productScorer.scoreAllProducts(branchId).catch((err) => {
      logger.error('[PI] sale.completed → productScorer.scoreAllProducts failed', { error: err })
    })

    if (customerId) {
      customerScorer.scoreCustomer(customerId).catch((err) => {
        logger.error('[PI] sale.completed → customerScorer.scoreCustomer failed', { customerId, error: err })
      })
    }

    businessHealthScorer.computeHealthScore(branchId).catch((err) => {
      logger.error('[PI] sale.completed → businessHealthScorer.computeHealthScore failed', { branchId, error: err })
    })

    // Invalidate affected product forecasts (recompute happens on-demand or scheduled)
    if (productIds && productIds.length > 0) {
      for (const pid of productIds) {
        demandForecaster.invalidateForecast(pid, branchId).catch((err) => {
          logger.error('[PI] sale.completed → forecast invalidation failed', { productId: pid, error: err })
        })
      }
    }

    // Emit scoring completed event
    publish(createScoringCompletedEvent('product', productIds?.length ?? 0))
  })
  unsubscribers.push(unsubSale)

  // ─── stock.changed → Re-score + invalidate forecast + anomaly check ──
  const unsubStock = subscribe('stock.changed', (event) => {
    const productId = event.payload?.productId as string | undefined
    const branchId = event.payload?.branchId as string | undefined

    logger.debug('[PI] stock.changed — triggering product re-score + forecast invalidation', {
      productId,
      branchId,
    })

    if (productId) {
      productScorer.scoreProduct(productId).catch((err) => {
        logger.error('[PI] stock.changed → productScorer.scoreProduct failed', { productId, error: err })
      })

      // Invalidate forecast — recompute happens on-demand
      demandForecaster.invalidateForecast(productId, branchId).catch((err) => {
        logger.error('[PI] stock.changed → forecast invalidation failed', { productId, error: err })
      })
    }

    // Fire-and-forget inventory anomaly detection
    anomalyDetector.detectInventoryAnomalies(branchId).catch((err) => {
      logger.warn('[PI] stock.changed → inventory anomaly check failed', { error: err })
    })

    // Recompute business health (inventory health component)
    businessHealthScorer.computeHealthScore(branchId).catch((err) => {
      logger.error('[PI] stock.changed → businessHealthScorer.computeHealthScore failed', { branchId, error: err })
    })
  })
  unsubscribers.push(unsubStock)

  // ─── stock.low → Evaluate reorder need and publish alert ─────────
  const unsubLow = subscribe('stock.low', (event) => {
    const productId = event.payload?.productId as string | undefined
    const branchId = event.payload?.branchId as string | undefined

    logger.debug('[PI] stock.low received — evaluating reorder need', {
      productId,
      branchId,
    })

    if (productId) {
      reorderEngine.evaluateProduct(productId, branchId).then((suggestion) => {
        if (suggestion.urgency === 'immediate' || suggestion.urgency === 'soon') {
          publish(createReorderAlertEvent({
            productId: suggestion.productId,
            branchId: branchId ?? null,
            urgency: suggestion.urgency,
            currentStock: suggestion.currentStock,
            reorderPoint: suggestion.reorderPoint,
          }))
        }
      }).catch((err) => {
        logger.error('[PI] stock.low → reorderEngine.evaluateProduct failed', { productId, error: err })
      })
    }
  })
  unsubscribers.push(unsubLow)

  logger.info('[PI] Registered 3 event subscriptions (Sprint 11E — with anomaly detection)')
  return unsubscribers
}

/**
 * Register scheduled recomputation tasks.
 * Call from cron/automation engine to periodically re-run stale forecasts.
 */
export function registerScheduledTasks(): void {
  logger.info('[PI] Scheduled forecasting tasks available — trigger via demandForecaster.recomputeStaleForecasts() and revenueForecaster.recomputeStaleForecasts()')
}
