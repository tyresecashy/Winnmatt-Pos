/**
 * Product Intelligence Types — Unit tests
 *
 * Sprint 11A: Validates that all type definitions and constants are correctly exported.
 */

import { describe, it, expect } from 'vitest'
import { DEFAULT_PI_CONFIG, PI_EVENT_TYPES } from '../types'

describe('PI Types & Constants', () => {
  describe('PI_EVENT_TYPES', () => {
    it('has all 7 event types', () => {
      const types = Object.values(PI_EVENT_TYPES)
      expect(types).toHaveLength(7)
      expect(types).toContain('kpi.status_changed')
      expect(types).toContain('kpi.threshold_breached')
      expect(types).toContain('scoring.completed')
      expect(types).toContain('forecast.updated')
      expect(types).toContain('reorder.alert')
      expect(types).toContain('recommendation.generated')
      expect(types).toContain('anomaly.detected')
    })

    it('all values are non-empty strings', () => {
      for (const val of Object.values(PI_EVENT_TYPES)) {
        expect(typeof val).toBe('string')
        expect(val.length).toBeGreaterThan(0)
      }
    })
  })

  describe('DEFAULT_PI_CONFIG', () => {
    it('has all required config fields', () => {
      expect(DEFAULT_PI_CONFIG.maxBatchSize).toBe(500)
      expect(DEFAULT_PI_CONFIG.defaultLeadTimeDays).toBe(7)
      expect(DEFAULT_PI_CONFIG.defaultServiceLevel).toBe(0.95)
      expect(DEFAULT_PI_CONFIG.kpiRetentionDays).toBe(90)
      expect(DEFAULT_PI_CONFIG.cacheEnabled).toBe(false)
      expect(DEFAULT_PI_CONFIG.coldStartDays).toBe(30)
    })
  })
})
