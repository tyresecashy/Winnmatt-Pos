/**
 * Transfers Module — Public API
 *
 * Manages stock transfers between branches and transfer wizards.
 * Other modules should ONLY import from this file.
 *
 * Implementation: Delegates to lib/transfer-actions.ts and lib/transfer-wizard-actions.ts.
 */

import { logger } from '@/lib/logger'
import * as transferActions from '@/lib/transfer-actions'
import * as wizardActions from '@/lib/transfer-wizard-actions'

// ─── Type helpers ─────────────────────────────────────────────────────────────
type StockTransferRow = Awaited<ReturnType<typeof transferActions.getStockTransfers>>[number]
type StockTransferResult = Awaited<ReturnType<typeof transferActions.getStockTransfer>>
type BranchRow = Awaited<ReturnType<typeof transferActions.getAllBranches>>[number]
type ProductAtBranchRow = Awaited<ReturnType<typeof transferActions.getProductsAtBranch>>[number]
type TransferWizardRow = Awaited<ReturnType<typeof wizardActions.getTransferWizards>>[number]
type LegacyTransferResult = Awaited<ReturnType<typeof wizardActions.getLegacyTransfers>>

// ─── Public API - Stock Transfers ───────────────────────────────────────────

export async function getStockTransfers(fromBranchId?: string, status?: string): Promise<StockTransferRow[]> {
  try {
    return await transferActions.getStockTransfers(fromBranchId, status)
  } catch (error) {
    logger.error('[Transfers Module] getStockTransfers failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function getStockTransfer(id: string): Promise<StockTransferResult> {
  try {
    return await transferActions.getStockTransfer(id)
  } catch (error) {
    logger.error('[Transfers Module] getStockTransfer failed', error instanceof Error ? error.message : String(error))
    return null
  }
}

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

export async function receiveStockTransfer(id: string, items: Record<string, unknown>[], userId: string): Promise<{ success: boolean; error?: string }> {
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

export async function getAllBranches(): Promise<BranchRow[]> {
  try {
    return await transferActions.getAllBranches()
  } catch (error) {
    logger.error('[Transfers Module] getAllBranches failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function getProductsAtBranch(branchId: string): Promise<ProductAtBranchRow[]> {
  try {
    return await transferActions.getProductsAtBranch(branchId)
  } catch (error) {
    logger.error('[Transfers Module] getProductsAtBranch failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

// ─── Public API - Transfer Wizards ──────────────────────────────────────────

export async function getTransferWizards(): Promise<TransferWizardRow[]> {
  try {
    return await wizardActions.getTransferWizards()
  } catch (error) {
    logger.error('[Transfers Module] getTransferWizards failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function getLegacyTransfers(limit?: number): Promise<LegacyTransferResult> {
  try {
    return await wizardActions.getLegacyTransfers(limit)
  } catch (error) {
    logger.error('[Transfers Module] getLegacyTransfers failed', error instanceof Error ? error.message : String(error))
    return [] as any
  }
}

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
