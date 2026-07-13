/**
 * Sales Module — Public API
 *
 * This module handles all sales operations: POS transactions, returns, voids, holds.
 * Other modules should ONLY import from this file — never from internal files.
 *
 * Cross-module communication: Via events (emitEvent from automation module)
 *
 * Implementation: Delegates to lib/sales-actions.ts for all real operations.
 */

import { createSaleWithContext, createSale as salesCreateSale, voidSale as salesVoidSale, getSaleById as salesGetSaleById, getSales as salesGetSales, returnSale, searchSales as salesSearchSales, holdSale as salesHoldSale, getHeldSales as salesGetHeldSales, resumeHeldSale as salesResumeHeldSale, cancelHeldSale as salesCancelHeldSale } from '@/lib/sales-actions'
import { logger } from '@/lib/logger'

// ─── Type helpers ─────────────────────────────────────────────────────────────
type SearchSalesResultRow = Awaited<ReturnType<typeof salesSearchSales>>['sales'][number]
type HeldSaleRow = Awaited<ReturnType<typeof salesGetHeldSales>>[number]
type SaleByIdResult = Awaited<ReturnType<typeof salesGetSaleById>>

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Sale {
  id: string
  branch_id: string
  cashier_id: string
  customer_id: string | null
  subtotal: number
  discount_amount: number
  tax_amount: number
  total_amount: number
  payment_method: string
  payment_status: string
  receipt_number: string
  notes: string | null
  sale_status: string | null
  shift_id: string | null
  voided_at: string | null
  void_reason: string | null
  voided_by: string | null
  returned_at: string | null
  returned_qty: number | null
  return_reason: string | null
  returned_by: string | null
  created_at: string
  updated_at: string
  hold_notes: string | null
  returned_amount: number | null
}

export interface SaleItem {
  id: string
  sale_id: string
  product_id: string
  quantity: number
  unit_price: number
  discount_percent: number
  line_total: number
  created_at: string
}

export interface CreateSaleInput {
  branch_id: string
  cashier_id: string
  customer_id?: string | null
  shift_id?: string | null
  items: Array<{
    product_id: string
    quantity: number
    unit_price: number
    discount_percent?: number
  }>
  payment_method: string
  amount_paid?: number
  notes?: string
  payment_status?: 'pending' | 'completed' | 'failed'
  total_discount?: number
}

export interface SaleResult {
  success: boolean
  sale_id?: string
  receipt_number?: string
  error?: string
}

// ─── Events Emitted ─────────────────────────────────────────────────────────

export const SALE_EVENTS = {
  COMPLETED: 'sale.completed',
  VOIDED: 'sale.voided',
  RETURNED: 'sale.returned',
  HIGH_VALUE: 'sale.high_value',
} as const

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Create a new sale transaction.
 * Delegates to the real createSaleWithContext in lib/sales-actions.ts.
 * Emits: sale.completed
 */
export async function createSaleTransaction(input: CreateSaleInput): Promise<SaleResult> {
  try {
    const paymentMethod = input.payment_method as 'cash' | 'card' | 'bank_transfer' | 'cheque' | 'credit' | 'mpesa'
    const result = await createSaleWithContext(
      { branchId: input.branch_id, cashierId: input.cashier_id, shiftId: input.shift_id ?? null },
      input.items.map((i) => ({
        productId: i.product_id,
        quantity: i.quantity,
        unitPrice: i.unit_price,
        discountPercent: i.discount_percent,
      })),
      paymentMethod,
      input.customer_id ?? undefined,
      input.total_discount ?? 0,
      input.notes ?? undefined,
      input.payment_status ?? 'completed',
      undefined // paymentSplits
    )
    if (!result.success) return { success: false, error: result.error }
    return {
      success: true,
      sale_id: result.sale?.id,
      receipt_number: result.receiptNumber,
    }
  } catch (error) {
    logger.error('[Sales Module] createSaleTransaction failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

/**
 * Void a sale.
 * Delegates to the real voidSale in lib/sales-actions.ts.
 * Emits: sale.voided
 */
export async function voidSale(
  saleId: string,
  reason: string,
  voidedBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const sale = await salesGetSaleById(saleId)
    if (!sale) return { success: false, error: 'Sale not found' }
    const branchId = sale.branch_id
    return await salesVoidSale(saleId, branchId, reason, voidedBy)
  } catch (error) {
    logger.error('[Sales Module] voidSale failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

/**
 * Process a sale return.
 * Delegates to the real returnSale in lib/sales-actions.ts.
 * Emits: sale.returned
 */
export async function processReturn(
  saleId: string,
  items: Array<{ sale_item_id: string; quantity: number }>,
  reason: string,
  returnedBy: string
): Promise<{ success: boolean; refund_amount?: number; error?: string }> {
  try {
    const sale = await salesGetSaleById(saleId)
    if (!sale) return { success: false, error: 'Sale not found' }
    const branchId = sale.branch_id
    const firstItem = items[0]
    const result = await returnSale(saleId, branchId, reason, returnedBy, {
      itemId: firstItem?.sale_item_id,
      quantity: firstItem?.quantity,
      isFullReturn: items.length === 0,
    })
    if (!result.success) return { success: false, error: result.error }
    return { success: true, refund_amount: undefined }
  } catch (error) {
    logger.error('[Sales Module] processReturn failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

/**
 * Get sale by ID with items.
 * Delegates to the real getSaleById in lib/sales-actions.ts.
 */
export async function getSale(saleId: string): Promise<Sale & { items: SaleItem[] } | null> {
  try {
    const result = await salesGetSaleById(saleId)
    if (!result) return null
    return result as unknown as Sale & { items: SaleItem[] }
  } catch (error) {
    logger.error('[Sales Module] getSale failed', error instanceof Error ? error.message : String(error))
    return null
  }
}

/**
 * Get sales list with filters.
 * Delegates to the real getSales in lib/sales-actions.ts.
 */
export async function getSales(filters: {
  branch_id?: string
  cashier_id?: string
  customer_id?: string
  start_date?: string
  end_date?: string
  status?: string
  limit?: number
  offset?: number
}): Promise<{ data: Sale[]; total: number }> {
  try {
    const branchId = filters.branch_id || ''
    const limit = filters.limit || 50
    const result = await salesGetSales(branchId, limit)
    return { data: (result || []) as unknown as Sale[], total: (result || []).length }
  } catch (error) {
    logger.error('[Sales Module] getSales failed', error instanceof Error ? error.message : String(error))
    return { data: [], total: 0 }
  }
}

/**
 * Search sales with full-text search, filters, and pagination.
 * Delegates to the real searchSales in lib/sales-actions.ts.
 */
export async function searchSales(
  query: string,
  options?: {
    paymentMethod?: string
    startDate?: string
    endDate?: string
    page?: number
    pageSize?: number
  }
): Promise<{ data: SearchSalesResultRow[]; total: number }> {
  try {
    const result = await salesSearchSales({
      branchId: '',
      query,
      paymentMethod: options?.paymentMethod,
      dateFrom: options?.startDate,
      dateTo: options?.endDate,
      page: options?.page,
      pageSize: options?.pageSize,
    })
    return { data: result.sales as unknown as SearchSalesResultRow[], total: result.total }
  } catch (error) {
    logger.error('[Sales Module] searchSales failed', error instanceof Error ? error.message : String(error))
    return { data: [], total: 0 }
  }
}

/**
 * Put a sale on hold.
 * Delegates to the real holdSale in lib/sales-actions.ts.
 */
export async function holdSale(
  branchId: string,
  cashierId: string,
  customerId: string | null,
  items: Array<{ productId: string; quantity: number; unitPrice: number }>,
  notes?: string
): Promise<{ success: boolean; sale_id?: string; error?: string }> {
  try {
    const mappedItems = items.map((i) => ({
      productId: i.productId,
      name: '',
      sku: '',
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      discountPercent: 0,
      sellingPrice: i.unitPrice,
    }))
    const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0)
    const result = await salesHoldSale(branchId, cashierId, mappedItems, customerId, subtotal, 0, subtotal, notes)
    if (!result.success) return { success: false, error: result.error }
    return { success: true, sale_id: result.saleId }
  } catch (error) {
    logger.error('[Sales Module] holdSale failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

/**
 * Get all held (on_hold) sales for a branch.
 * Delegates to the real getHeldSales in lib/sales-actions.ts.
 */
export async function getHeldSales(branchId: string): Promise<HeldSaleRow[]> {
  try {
    const result = await salesGetHeldSales(branchId)
    return result as unknown as HeldSaleRow[]
  } catch (error) {
    logger.error('[Sales Module] getHeldSales failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

/**
 * Resume (release) a held sale, returning the cart data.
 * Delegates to the real resumeHeldSale in lib/sales-actions.ts.
 */
export async function resumeHeldSale(
  saleId: string
): Promise<{ success: boolean; data?: HeldSaleRow; error?: string }> {
  try {
    const result = await salesResumeHeldSale(saleId, '')
    if (!result.success) return { success: false, error: result.error }
    return { success: true, data: result.heldSale as unknown as HeldSaleRow | undefined }
  } catch (error) {
    logger.error('[Sales Module] resumeHeldSale failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

/**
 * Cancel (discard) a held sale without resuming it.
 * Delegates to the real cancelHeldSale in lib/sales-actions.ts.
 */
export async function cancelHeldSale(
  saleId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    return await salesCancelHeldSale(saleId, '')
  } catch (error) {
    logger.error('[Sales Module] cancelHeldSale failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

/**
 * Get a single sale by ID.
 * Delegates to the real getSaleById in lib/sales-actions.ts.
 */
export async function getSaleById(saleId: string): Promise<SaleByIdResult> {
  try {
    const result = await salesGetSaleById(saleId)
    if (!result) return null
    return result as unknown as SaleByIdResult
  } catch (error) {
    logger.error('[Sales Module] getSaleById failed', error instanceof Error ? error.message : String(error))
    return null
  }
}

// ─── Type Re-exports ─────────────────────────────────────────────────────────
export type { PaymentSplit, SaleReceiptSeed, HeldSale, SearchSalesParams, SearchSalesResult } from '@/lib/sales-actions'

// ─── Backward-Compatible Re-exports ──────────────────────────────────────────
// These preserve original signatures for callers migrating to the module layer.

/** @deprecated Use createSaleTransaction instead. Original signature preserved for migration. */
export { salesCreateSale as createSale }

/** @deprecated Use processReturn instead. Original signature preserved for migration. */
export { returnSale }
// Void sale actions
export { serverVoidSale } from '@/lib/void-sale-actions'
export { serverGetSaleAuditTrail } from '@/lib/void-sale-actions'
