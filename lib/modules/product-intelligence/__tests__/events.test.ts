/**
 * Product Intelligence Events — Unit tests
 *
 * Sprint 11A: Tests that event creation helpers produce valid RealtimeEvent objects.
 */

import { describe, it, expect } from 'vitest'
import {
  createKPIStatusChangeEvent,
  createKPIThresholdBreachEvent,
  createScoringCompletedEvent,
  createForecastUpdatedEvent,
  createReorderAlertEvent,
  createAnomalyDetectedEvent,
} from '../events'

describe('PI Event Creators', () => {
  it('createKPIStatusChangeEvent returns valid event', () => {
    const event = createKPIStatusChangeEvent({
      kpiId: 'revenue_velocity',
      branchId: null,
      previousStatus: 'on_track',
      newStatus: 'at_risk',
      value: 85000,
      target: 100000,
    })

    expect(event.type).toBe('kpi.status_changed')
    expect(event.source).toBe('product-intelligence')
    expect(event.entityType).toBe('kpi')
    expect(event.entityId).toBe('revenue_velocity')
    expect(event.payload).toBeDefined()
    expect(event.timestamp).toBeGreaterThan(0)
  })

  it('createKPIThresholdBreachEvent returns valid event', () => {
    const event = createKPIThresholdBreachEvent({
      kpiId: 'stockout_rate',
      branchId: null,
      value: 0.05,
      threshold: 0.02,
      direction: 'above',
    })

    expect(event.type).toBe('kpi.threshold_breached')
    expect(event.source).toBe('product-intelligence')
  })

  it('createScoringCompletedEvent returns valid event', () => {
    const event = createScoringCompletedEvent('product', 150)

    expect(event.type).toBe('scoring.completed')
    expect(event.source).toBe('product-intelligence')
    expect(event.payload).toMatchObject({ scoreType: 'product', count: 150 })
  })

  it('createForecastUpdatedEvent returns valid event', () => {
    const event = createForecastUpdatedEvent('prod-1', 'branch-1', 'exponential_smoothing', 12.5)

    expect(event.type).toBe('forecast.updated')
    expect(event.source).toBe('product-intelligence')
    expect(event.entityId).toBe('prod-1')
  })

  it('createReorderAlertEvent returns valid event', () => {
    const event = createReorderAlertEvent({
      productId: 'prod-1',
      branchId: 'branch-1',
      urgency: 'immediate',
      currentStock: 5,
      reorderPoint: 20,
    })

    expect(event.type).toBe('reorder.alert')
    expect(event.source).toBe('product-intelligence')
    expect(event.entityType).toBe('inventory')
  })

  it('createAnomalyDetectedEvent returns valid event', () => {
    const event = createAnomalyDetectedEvent({
      entityType: 'product',
      entityId: 'prod-1',
      entityName: 'Test Product',
      metric: 'daily_sales',
      expectedValue: 100,
      actualValue: 250,
      deviation: 3.2,
      direction: 'spike',
      severity: 'high',
      detectedAt: new Date().toISOString(),
      details: 'Unusual sales spike detected',
    })

    expect(event.type).toBe('anomaly.detected')
    expect(event.source).toBe('product-intelligence')
  })
})
