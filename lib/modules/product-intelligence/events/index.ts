/**
 * Product Intelligence — Event definitions
 *
 * Defines event types, payloads, and publish helpers for PI events.
 * All events are published via the existing lib/realtime/event-bus.ts.
 *
 * Sprint 11A: Type definitions and publish helpers only.
 * Event emission wired in Sprint 11B+ when business logic exists.
 *
 * @see lib/realtime/event-bus.ts
 * @see lib/shared/contracts.ts
 */

import type { RealtimeEvent } from '@/lib/realtime/types'
import {
  PI_EVENT_TYPES,
  type PIEventPayload,
  type KPIStatusChangeEvent,
  type KPIThresholdBreachEvent,
  type ForecastMethod,
  type ReorderSuggestion,
  type Anomaly,
} from '../types'

/**
 * Create a PI event envelope matching the RealtimeEvent interface.
 */
function createPIEvent(
  type: string,
  payload: Record<string, unknown>,
  entityType?: string,
  entityId?: string,
): RealtimeEvent {
  return {
    type,
    source: 'product-intelligence',
    entityType,
    entityId,
    payload,
    timestamp: Date.now(),
  }
}

/**
 * Publish a KPI status change event.
 */
export function createKPIStatusChangeEvent(data: KPIStatusChangeEvent): RealtimeEvent {
  return createPIEvent(
    PI_EVENT_TYPES.KPI_STATUS_CHANGED,
    data as unknown as Record<string, unknown>,
    'kpi',
    data.kpiId,
  )
}

/**
 * Publish a KPI threshold breach event.
 */
export function createKPIThresholdBreachEvent(data: KPIThresholdBreachEvent): RealtimeEvent {
  return createPIEvent(
    PI_EVENT_TYPES.KPI_THRESHOLD_BREACHED,
    data as unknown as Record<string, unknown>,
    'kpi',
    data.kpiId,
  )
}

/**
 * Publish a scoring completed event.
 */
export function createScoringCompletedEvent(
  scoreType: 'product' | 'customer' | 'supplier',
  count: number,
): RealtimeEvent {
  return createPIEvent(
    PI_EVENT_TYPES.SCORING_COMPLETED,
    { scoreType, count, timestamp: new Date().toISOString() },
    'scoring',
    scoreType,
  )
}

/**
 * Publish a forecast updated event.
 */
export function createForecastUpdatedEvent(
  productId: string,
  branchId: string | null,
  method: ForecastMethod,
  mape: number | null,
): RealtimeEvent {
  return createPIEvent(
    PI_EVENT_TYPES.FORECAST_UPDATED,
    { productId, branchId, method, mape },
    'forecast',
    productId,
  )
}

/**
 * Publish a recommendation generated event.
 */
export function createRecommendationGeneratedEvent(
  recommendationType: 'cross-sell' | 'reorder' | 'pricing',
  productId: string,
  branchId: string | null,
): RealtimeEvent {
  return createPIEvent(
    PI_EVENT_TYPES.RECOMMENDATION_GENERATED,
    { recommendationType, productId, branchId, timestamp: new Date().toISOString() },
    'recommendation',
    productId,
  )
}

/**
 * Publish a reorder alert event.
 */
export function createReorderAlertEvent(
  data: Pick<ReorderSuggestion, 'productId' | 'currentStock' | 'reorderPoint'> & {
    branchId: string | null
    urgency: ReorderSuggestion['urgency']
  },
): RealtimeEvent {
  return createPIEvent(
    PI_EVENT_TYPES.REORDER_ALERT,
    data as unknown as Record<string, unknown>,
    'inventory',
    data.productId,
  )
}

/**
 * Publish an anomaly detected event.
 */
export function createAnomalyDetectedEvent(data: Anomaly): RealtimeEvent {
  return createPIEvent(
    PI_EVENT_TYPES.ANOMALY_DETECTED,
    data as unknown as Record<string, unknown>,
    data.entityType,
    data.entityId,
  )
}

/**
 * All PI event type strings for event-bus subscription.
 */
export const PI_EVENT_NAMES: string[] = Object.values(PI_EVENT_TYPES)
