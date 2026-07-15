/**
 * KPI Tracker — Unit tests
 *
 * Sprint 11A: Tests for infrastructure (types, status logic).
 * Computation tests added in Sprint 11B.
 */

import { describe, it, expect } from 'vitest'
import { KPITracker, KPI_DEFINITIONS } from '../kpi/tracker'
import type { KPIId } from '../types'

describe('KPI Tracker', () => {
  const tracker = new KPITracker()

  describe('KPI_DEFINITIONS', () => {
    it('has all 8 KPI definitions', () => {
      const ids = Object.keys(KPI_DEFINITIONS)
      expect(ids).toHaveLength(8)
      expect(ids).toContain('revenue_velocity')
      expect(ids).toContain('gross_margin_pct')
      expect(ids).toContain('inventory_turnover')
      expect(ids).toContain('stockout_rate')
      expect(ids).toContain('customer_retention')
      expect(ids).toContain('order_accuracy')
      expect(ids).toContain('labor_efficiency')
      expect(ids).toContain('ai_resolution_rate')
    })

    it('each definition has all required fields', () => {
      for (const def of Object.values(KPI_DEFINITIONS)) {
        expect(def.id).toBeDefined()
        expect(def.name).toBeDefined()
        expect(def.formula).toBeDefined()
        expect(def.unit).toBeDefined()
        expect(def.refreshCadence).toBeDefined()
        expect(def.sourceService).toBeDefined()
      }
    })
  })

  describe('determineStatus', () => {
    it('returns on_track when value is within 10% of target', () => {
      expect(tracker.determineStatus(95, 100)).toBe('on_track')
      expect(tracker.determineStatus(100, 100)).toBe('on_track')
      expect(tracker.determineStatus(110, 100)).toBe('on_track')
    })

    it('returns at_risk when value is within 20% of target', () => {
      expect(tracker.determineStatus(85, 100)).toBe('at_risk')
      expect(tracker.determineStatus(115, 100)).toBe('at_risk')
    })

    it('returns behind when value is more than 20% from target', () => {
      expect(tracker.determineStatus(70, 100)).toBe('behind')
      expect(tracker.determineStatus(130, 100)).toBe('behind')
    })

    it('returns no_target when target is null', () => {
      expect(tracker.determineStatus(100, null)).toBe('no_target')
    })

    it('returns no_target when target is 0', () => {
      expect(tracker.determineStatus(100, 0)).toBe('no_target')
    })
  })

  describe('getDefinition', () => {
    it('returns definition for known KPI', () => {
      const def = tracker.getDefinition('revenue_velocity')
      expect(def).toBeDefined()
      expect(def!.name).toBe('Revenue Velocity')
    })

    it('returns undefined for unknown KPI', () => {
      const def = tracker.getDefinition('nonexistent' as KPIId)
      expect(def).toBeUndefined()
    })
  })
})
