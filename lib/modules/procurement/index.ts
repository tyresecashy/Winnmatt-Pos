/**
 * Procurement Module — Public API
 *
 * Manages purchase orders, purchase requisitions, and receipts.
 * Other modules should ONLY import from this file.
 *
 * Implementation: Delegates to lib/procurement-actions.ts, lib/purchase-actions.ts, lib/purchase-order-actions.ts, lib/purchase-requisition-actions.ts.
 */

import { logger } from '@/lib/logger'
import * as procurement from '@/lib/procurement-actions'
import type { ReceiveItemInput } from '@/lib/procurement-actions'
import * as purchaseActions from '@/lib/purchase-actions'
import type { CreatePurchaseOrderInput } from '@/lib/purchase-actions'
import * as purchaseOrderActions from '@/lib/purchase-order-actions'
import * as requisitionActions from '@/lib/purchase-requisition-actions'

// ─── Type helpers ─────────────────────────────────────────────────────────────
type PurchaseOrderRow = Awaited<ReturnType<typeof procurement.getPurchaseOrders>>[number]
type PurchaseReceiptRow = Awaited<ReturnType<typeof procurement.getPurchaseReceipts>>[number]
type PurchaseReceiptResult = Awaited<ReturnType<typeof procurement.getPurchaseReceiptById>>
type BackorderRow = Awaited<ReturnType<typeof procurement.getBackorders>>[number]

// ─── Public API - Procurement ───────────────────────────────────────────────

export async function getPurchaseOrders(filters?: Record<string, unknown>): Promise<PurchaseOrderRow[]> {
  try {
    return await procurement.getPurchaseOrders(filters)
  } catch (error) {
    logger.error('[Procurement Module] getPurchaseOrders failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function receivePurchaseOrder(orderId: string, items: Record<string, unknown>[], notes?: string): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    return await procurement.receivePurchaseOrder(orderId, items as unknown as ReceiveItemInput[], notes)
  } catch (error) {
    logger.error('[Procurement Module] receivePurchaseOrder failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function updatePurchaseOrderStatus(
  poId: string,
  status: 'draft' | 'pending' | 'approved' | 'partially_received' | 'received' | 'cancelled'
): Promise<{ success: boolean; purchase_order?: unknown; message?: string; error?: string }> {
  try {
    return await procurement.updatePurchaseOrderStatus(poId, status)
  } catch (error) {
    logger.error('[Procurement Module] updatePurchaseOrderStatus failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function getPurchaseReceipts(branchId?: string): Promise<PurchaseReceiptRow[]> {
  try {
    return await procurement.getPurchaseReceipts(branchId)
  } catch (error) {
    logger.error('[Procurement Module] getPurchaseReceipts failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function getPurchaseReceiptById(id: string): Promise<PurchaseReceiptResult> {
  try {
    return await procurement.getPurchaseReceiptById(id)
  } catch (error) {
    logger.error('[Procurement Module] getPurchaseReceiptById failed', error instanceof Error ? error.message : String(error))
    return null
  }
}

export async function getBackorders(): Promise<BackorderRow[]> {
  try {
    return await procurement.getBackorders()
  } catch (error) {
    logger.error('[Procurement Module] getBackorders failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

// ─── Public API - Purchase Orders ────────────────────────────────────────────

export async function createPurchaseOrder(input: Record<string, unknown>): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    return await purchaseActions.createPurchaseOrder(input as unknown as CreatePurchaseOrderInput)
  } catch (error) {
    logger.error('[Procurement Module] createPurchaseOrder failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function cancelPurchaseOrder(id: string, reason?: string): Promise<{ success: boolean; error?: string }> {
  try {
    return await purchaseActions.cancelPurchaseOrder(id, reason)
  } catch (error) {
    logger.error('[Procurement Module] cancelPurchaseOrder failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function approvePurchaseOrder(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    return await purchaseOrderActions.approvePurchaseOrder(id)
  } catch (error) {
    logger.error('[Procurement Module] approvePurchaseOrder failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Backward-Compatible Re-exports ──────────────────────────────────────────

export { getPurchaseOrder } from '@/lib/purchase-order-actions'
export type { PurchaseOrder } from '@/lib/purchase-order-actions'
export type { PurchaseOrderItem } from '@/lib/purchase-order-actions'

// ─── Purchase Requisition re-exports ─────────────────────────────────────────
export {
  getRequisitions, getRequisitionById, createRequisition, submitRequisition,
  approveRequisition, rejectRequisition, cancelRequisition, deleteRequisition,
  getRequisitionForPO,
} from '@/lib/purchase-requisition-actions'
export type { PurchaseRequisition, PurchaseRequisitionItem, RequisitionStatus, RequisitionUrgency } from '@/lib/purchase-requisition-actions'

// ─── Attachment re-exports ───────────────────────────────────────────────────
export { getPOAttachments, uploadPOAttachment, deletePOAttachment, getAttachmentDownloadUrl } from '@/lib/attachment-actions'
export type { POAttachment } from '@/lib/attachment-actions'
