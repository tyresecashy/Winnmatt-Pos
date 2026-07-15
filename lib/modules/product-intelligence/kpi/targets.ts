/**
 * KPI Targets — Target setting and attainment tracking.
 *
 * Sprint 11A: Infrastructure only — data access wiring.
 * Business logic implemented in Sprint 11B+.
 */

import type { KPITarget, KPIId } from '../types'
import { kpiRepository } from '../repositories/kpi-repository'

/**
 * Target Manager — handles CRUD for KPI targets and attainment checks.
 */
export class KPITargetManager {
  /**
   * Set a target for a KPI.
   */
  async setTarget(target: KPITarget): Promise<void> {
    await kpiRepository.upsertTarget(target)
  }

  /**
   * Get the active target for a KPI (optionally branch-specific).
   */
  async getTarget(kpiId: KPIId, branchId?: string): Promise<KPITarget | null> {
    return kpiRepository.getTarget(kpiId, branchId ?? null)
  }

  /**
   * Get all targets (optionally filtered by branch).
   */
  async getAllTargets(branchId?: string): Promise<KPITarget[]> {
    return kpiRepository.getAllTargets(branchId ?? null)
  }

  /**
   * Remove a target.
   */
  async removeTarget(kpiId: KPIId, branchId?: string): Promise<void> {
    await kpiRepository.deleteTarget(kpiId, branchId ?? null)
  }
}

export const kpiTargetManager = new KPITargetManager()
