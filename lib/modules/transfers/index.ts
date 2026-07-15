/**
 * Transfers Module — Public API
 *
 * Manages stock transfers between branches and transfer wizards.
 * Other modules should ONLY import from this file.
 *
 * Reads are served from TransferRepository (enterprise core data access).
 * Writes delegate to lib/transfer-actions.ts and lib/transfer-wizard-actions.ts.
 */

import { logger } from '@/lib/logger'
import * as transferActions from '@/lib/transfer-actions'
import * as wizardActions from '@/lib/transfer-wizard-actions'
import { transferRepo } from './repository'
import type { StockTransferRow, TransferWizardRow, LegacyTransferRow, ProductWithStock } from './repository'

// ─── Public API - Stock Transfers (reads via repository) ────────────────────

export async function getStockTransfers(fromBranchId?: string, status?: string): Promise<StockTransferRow[]> {
  try {
    return await transferRepo.getStockTransfers(fromBranchId, status)
  } catch (error) {
    logger.error('[Transfers Module] getStockTransfers failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function getStockTransfer(id: string): Promise<StockTransferRow | null> {
  try {
    return await transferRepo.getStockTransfer(id)
  } catch (error) {
    logger.error('[Transfers Module] getStockTransfer failed', error instanceof Error ? error.message : String(error))
    return null
  }
}

// ─── Public API - Stock Transfers (writes — delegates to action file) ───────

export async function createStockTransfer(data: Record<string, unknown>): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    return await transferActions.createStockTransfer(data as Parameters<typeof transferActions.createStockTransfer>[0])
  } catch (error) {
    logger.error('[Transfers Module] createStockTransfer failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function approveStockTransfer(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    return await transferActions.approveStockTransfer(id)
  } catch (error) {
    logger.error('[Transfers Module] approveStockTransfer failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function markInTransit(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    return await transferActions.markInTransit(id)
  } catch (error) {
    logger.error('[Transfers Module] markInTransit failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function receiveStockTransfer(id: string, items: Record<string, unknown>[], _userId?: string): Promise<{ success: boolean; error?: string }> {
  try {
    return await transferActions.receiveStockTransfer(id, items as Parameters<typeof transferActions.receiveStockTransfer>[1])
  } catch (error) {
    logger.error('[Transfers Module] receiveStockTransfer failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function cancelStockTransfer(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    return await transferActions.cancelStockTransfer(id)
  } catch (error) {
    logger.error('[Transfers Module] cancelStockTransfer failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Public API - Convenience Reads (via repository) ────────────────────────

export async function getAllBranches(): Promise<Array<{ id: string; name: string; code: string }>> {
  try {
    return await transferRepo.getAllBranches()
  } catch (error) {
    logger.error('[Transfers Module] getAllBranches failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function getProductsAtBranch(branchId: string): Promise<ProductWithStock[]> {
  try {
    return await transferRepo.getProductsAtBranch(branchId)
  } catch (error) {
    logger.error('[Transfers Module] getProductsAtBranch failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

// ─── Public API - Transfer Wizards (reads via repository) ───────────────────

export async function getTransferWizards(): Promise<TransferWizardRow[]> {
  try {
    return await transferRepo.getTransferWizards()
  } catch (error) {
    logger.error('[Transfers Module] getTransferWizards failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function getLegacyTransfers(limit?: number): Promise<{ transfers: LegacyTransferRow[]; mode: 'legacy' | 'empty' }> {
  try {
    return await transferRepo.getLegacyTransfers(limit)
  } catch (error) {
    logger.error('[Transfers Module] getLegacyTransfers failed', error instanceof Error ? error.message : String(error))
    return { transfers: [], mode: 'legacy' }
  }
}

// ─── Public API - Transfer Wizards (writes — delegates to action file) ──────

export async function createTransferWizard(data: Record<string, unknown>): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    return await wizardActions.createTransferWizard(data as Parameters<typeof wizardActions.createTransferWizard>[0])
  } catch (error) {
    logger.error('[Transfers Module] createTransferWizard failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function updateTransferStatus(id: string, status: string, userId?: string): Promise<{ success: boolean; error?: string }> {
  try {
    return await wizardActions.updateTransferStatus(id, status, userId ? { user_id: userId } : undefined)
  } catch (error) {
    logger.error('[Transfers Module] updateTransferStatus failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Backward-Compatible Re-exports (types only) ─────────────────────────────

export type { StockTransfer, TransferItem } from '@/lib/transfer-actions'
