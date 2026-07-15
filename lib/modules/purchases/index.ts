/**
 * Purchases Module — Public API
 *
 * Manages purchase orders and their lifecycle.
 * Other modules should ONLY import from this file.
 *
 * Reads are served from PurchaseRepository (enterprise core data access).
 * Writes, workflows, and computed stats delegate to action files.
 */

import { logger } from '@/lib/logger'
import * as purchaseActions from '@/lib/purchase-actions'
import { purchaseRepo } from './repository'
import type { PurchaseOrderRow, PurchaseOrderItemRow } from './repository'
import type { CreatePurchaseOrderInput, PurchaseOrderItem } from '@/lib/purchase-actions'

// ─── Public API - Purchase Orders (reads via repository) ───────────────────

export async function getPurchaseOrders(branchId: string, limit?: number): Promise<PurchaseOrderRow[]> {
  try {
    return await purchaseRepo.getPurchaseOrders(branchId, limit)
  } catch (error) {
    logger.error('[Purchases Module] getPurchaseOrders failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function getPurchaseOrderById(poId: string): Promise<PurchaseOrderRow | null> {
  try {
    return await purchaseRepo.getPurchaseOrderById(poId)
  } catch (error) {
    logger.error('[Purchases Module] getPurchaseOrderById failed', error instanceof Error ? error.message : String(error))
    return null
  }
}

// ─── Public API - Purchase Orders (writes — delegates to action file) ───────

export async function createPurchaseOrder(input: CreatePurchaseOrderInput): Promise<{
  success: boolean
  purchase_order?: unknown
  message?: string
  error?: string
}> {
  try {
    return await purchaseActions.createPurchaseOrder(input)
  } catch (error) {
    logger.error('[Purchases Module] createPurchaseOrder failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function updatePurchaseOrderStatus(
  poId: string,
  status: 'draft' | 'pending' | 'received' | 'cancelled',
): Promise<{ success: boolean; purchase_order?: unknown; message?: string; error?: string }> {
  try {
    return await purchaseActions.updatePurchaseOrderStatus(poId, status)
  } catch (error) {
    logger.error('[Purchases Module] updatePurchaseOrderStatus failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function cancelPurchaseOrder(
  poId: string,
  reason?: string,
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    return await purchaseActions.cancelPurchaseOrder(poId, reason)
  } catch (error) {
    logger.error('[Purchases Module] cancelPurchaseOrder failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function receivePurchaseOrder(
  poId: string,
  partial?: boolean,
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    return await purchaseActions.receivePurchaseOrder(poId, partial)
  } catch (error) {
    logger.error('[Purchases Module] receivePurchaseOrder failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Public API - Purchase Stats (computed — delegates to action file) ──────

export async function getPurchaseStats(branchId: string): Promise<{
  total_orders: number
  total_spent: number
  draft: number
  pending: number
  approved: number
  received: number
  cancelled: number
}> {
  try {
    return await purchaseActions.getPurchaseStats(branchId)
  } catch (error) {
    logger.error('[Purchases Module] getPurchaseStats failed', error instanceof Error ? error.message : String(error))
    return { total_orders: 0, total_spent: 0, draft: 0, pending: 0, approved: 0, received: 0, cancelled: 0 }
  }
}

// ─── Backward-Compatible Type Re-exports ─────────────────────────────────────
export type { PurchaseOrderItem, CreatePurchaseOrderInput } from '@/lib/purchase-actions'
export type { PurchaseOrderRow, PurchaseOrderItemRow } from './repository'
