/**
 * Branches Module — Public API
 *
 * Manages branch locations and their managers.
 * Other modules should ONLY import from this file.
 *
 * Implementation: Delegates to lib/branch-actions.ts.
 */

import { logger } from '@/lib/logger'
import * as branchActions from '@/lib/branch-actions'

// ─── Type helpers ─────────────────────────────────────────────────────────────
type BranchRow_type = Awaited<ReturnType<typeof branchActions.getBranches>>[number]
type BranchResult = Awaited<ReturnType<typeof branchActions.getBranchById>>
type BranchManagerRow = Awaited<ReturnType<typeof branchActions.getBranchManagers>>[number]

// ─── Types ──────────────────────────────────────────────────────────────────

export type { BranchRow } from '@/lib/branch-actions'

// ─── Public API ─────────────────────────────────────────────────────────────

export async function getBranches(): Promise<BranchRow_type[]> {
  try {
    return await branchActions.getBranches()
  } catch (error) {
    logger.error('[Branches Module] getBranches failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function getBranchById(id: string): Promise<BranchResult> {
  try {
    return await branchActions.getBranchById(id)
  } catch (error) {
    logger.error('[Branches Module] getBranchById failed', error instanceof Error ? error.message : String(error))
    return null
  }
}

export async function createBranch(data: Record<string, unknown>): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const result = await branchActions.createBranch(data as Parameters<typeof branchActions.createBranch>[0])
    if (!result) return { success: false, error: 'Failed to create branch' }
    return { success: true, id: result.id }
  } catch (error) {
    logger.error('[Branches Module] createBranch failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function updateBranch(id: string, data: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await branchActions.updateBranch(id, data as Parameters<typeof branchActions.updateBranch>[1])
    return { success: result !== null }
  } catch (error) {
    logger.error('[Branches Module] updateBranch failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function toggleBranchStatus(id: string, isActive: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await branchActions.toggleBranchStatus(id, isActive)
    return { success: result !== null }
  } catch (error) {
    logger.error('[Branches Module] toggleBranchStatus failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function getBranchManagers(): Promise<BranchManagerRow[]> {
  try {
    return await branchActions.getBranchManagers()
  } catch (error) {
    logger.error('[Branches Module] getBranchManagers failed', error instanceof Error ? error.message : String(error))
    return []
  }
}
