/**
 * Sales Module — Public API
 *
 * This module handles all sales operations: POS transactions, returns, voids, holds.
 * Other modules should ONLY import from this file — never from internal files.
 *
 * Cross-module communication: Via events (emitEvent from automation module)
 */

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
 * Emits: sale.completed
 */
export async function createSaleTransaction(input: CreateSaleInput): Promise<SaleResult> {
  // Implementation in lib/sales-actions.ts
  throw new Error('Not implemented — use lib/sales-actions.ts directly')
}

/**
 * Void a sale.
 * Emits: sale.voided
 */
export async function voidSale(
  saleId: string,
  reason: string,
  voidedBy: string
): Promise<{ success: boolean; error?: string }> {
  throw new Error('Not implemented — use lib/sales-actions.ts directly')
}

/**
 * Process a sale return.
 * Emits: sale.returned
 */
export async function processReturn(
  saleId: string,
  items: Array<{ sale_item_id: string; quantity: number }>,
  reason: string,
  returnedBy: string
): Promise<{ success: boolean; refund_amount?: number; error?: string }> {
  throw new Error('Not implemented — use lib/sales-actions.ts directly')
}

/**
 * Get sale by ID with items.
 */
export async function getSale(saleId: string): Promise<Sale & { items: SaleItem[] } | null> {
  throw new Error('Not implemented — use lib/sales-actions.ts directly')
}

/**
 * Get sales list with filters.
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
  throw new Error('Not implemented — use lib/sales-actions.ts directly')
}
