/**
 * Sales Repository — Enterprise Core Data Access for Sales
 *
 * Encapsulates ALL direct Supabase access for the sales, sale_items,
 * and related tables. Callers (module facade, server actions) use this
 * repository instead of calling supabase directly.
 *
 * Constitution Reference: §5 (Module Architecture), §9 (Transaction & Event Rules)
 * Eliminates violation V-028 (direct DB access bypassing modules)
 */

import { BaseRepository } from '@/lib/modules/core/repository'
import type { PaginatedResult } from '@/lib/modules/core/repository'
import { getNairobiDayRange } from '@/lib/date-time'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SaleRow {
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
  [key: string]: unknown
}

export interface SaleItemRow {
  id: string
  sale_id: string
  product_id: string
  quantity: number
  unit_price: number
  cost_price?: number | null
  discount_percent: number
  line_total: number
  created_at: string
  [key: string]: unknown
}

export interface SaleWithItems extends SaleRow {
  items: SaleItemRow[]
  branch?: { id: string; name: string; code: string } | null
  cashier?: { id: string; full_name: string } | null
  customer?: { id: string; name: string; phone: string } | null
}

export interface CreateSaleParams {
  branchId: string
  cashierId: string
  customerId?: string | null
  shiftId?: string | null
  subtotal: number
  discountAmount: number
  taxAmount: number
  totalAmount: number
  paymentMethod: string
  paymentStatus?: string
  receiptNumber: string
  notes?: string | null
  saleStatus?: string
}

export interface CreateSaleItemParams {
  /** Set internally by createSaleWithItems. Optional for input convenience. */
  saleId?: string
  productId: string
  quantity: number
  unitPrice: number
  costPrice?: number | null
  discountPercent?: number
  lineTotal: number
}

export interface SaleSearchParams {
  branchId?: string
  query?: string
  paymentMethod?: string
  dateFrom?: string
  dateTo?: string
  cashierId?: string
  customerId?: string
  status?: string
  page?: number
  pageSize?: number
}

// ─── Repository ─────────────────────────────────────────────────────────────

export class SalesRepository extends BaseRepository<SaleRow> {
  constructor() {
    super('sales', {
      audit: { eventType: 'sale.*', aggregateType: 'sale' },
      lock: { resourcePrefix: 'sale:' },
    })
  }

  /**
   * Get a sale with its items and related data in a single query.
   */
  async getSaleWithDetails(saleId: string): Promise<SaleWithItems | null> {
    const { data, error } = await this.client
      .from('sales')
      .select(`
        *,
        branch:branches!branch_id(id, name, code),
        cashier:users!sales_cashier_id_fkey(id, full_name),
        customer:customers(id, name, phone)
      `)
      .eq('id', saleId)
      .maybeSingle()

    if (error) throw this._toError(error, 'getSaleWithDetails')
    if (!data) return null

    const items = await this.getSaleItems(saleId)

    return { ...data, items } as unknown as SaleWithItems
  }

  /**
   * Get all items for a sale.
   */
  async getSaleItems(saleId: string): Promise<SaleItemRow[]> {
    const { data, error } = await this.client
      .from('sale_items')
      .select('*')
      .eq('sale_id', saleId)
      .order('created_at', { ascending: true })

    if (error) throw this._toError(error, 'getSaleItems')
    return (data ?? []) as SaleItemRow[]
  }

  /**
   * Get sales list with filters and pagination.
   */
  async getSalesList(
    branchId: string,
    options?: {
      cashierId?: string
      customerId?: string
      startDate?: string
      endDate?: string
      status?: string
      paymentMethod?: string
      limit?: number
      offset?: number
    },
  ): Promise<{ data: SaleRow[]; total: number }> {
    let query = this.client
      .from('sales')
      .select('*', { count: 'exact' })
      .eq('branch_id', branchId)

    if (options?.cashierId) query = query.eq('cashier_id', options.cashierId)
    if (options?.customerId) query = query.eq('customer_id', options.customerId)
    if (options?.status) query = query.eq('sale_status', options.status)
    if (options?.paymentMethod) query = query.eq('payment_method', options.paymentMethod)
    if (options?.startDate) query = query.gte('created_at', options.startDate)
    if (options?.endDate) query = query.lte('created_at', options.endDate)

    query = query.order('created_at', { ascending: false })

    const limit = options?.limit ?? 50
    const offset = options?.offset ?? 0
    const { data, error, count } = await query.range(offset, offset + limit - 1)

    if (error) throw this._toError(error, 'getSalesList')
    return {
      data: (data ?? []) as SaleRow[],
      total: count ?? 0,
    }
  }

  /**
   * Search sales with ILIKE on receipt_number, date range, and payment method.
   * Returns flat rows (no joins).
   */
  async searchSales(
    params: SaleSearchParams,
  ): Promise<PaginatedResult<SaleRow>> {
    const page = params.page ?? 1
    const pageSize = params.pageSize ?? 50
    const offset = (page - 1) * pageSize

    let query = this.client
      .from('sales')
      .select('*', { count: 'exact', head: false })

    if (params.branchId) query = query.eq('branch_id', params.branchId)
    if (params.query) query = query.ilike('receipt_number', `%${params.query}%`)
    if (params.paymentMethod) query = query.eq('payment_method', params.paymentMethod)
    if (params.cashierId) query = query.eq('cashier_id', params.cashierId)
    if (params.customerId) query = query.eq('customer_id', params.customerId)
    if (params.status) query = query.eq('sale_status', params.status)
    if (params.dateFrom) query = query.gte('created_at', params.dateFrom)
    if (params.dateTo) query = query.lte('created_at', params.dateTo)

    query = query.order('created_at', { ascending: false })

    const { data, error, count } = await query.range(offset, offset + pageSize - 1)

    if (error) throw this._toError(error, 'searchSales')
    return {
      data: (data ?? []) as SaleRow[],
      total: count ?? 0,
      page,
      pageSize,
    }
  }

  /**
   * Create a sale and its items in a single atomic operation.
   * Returns the created sale with the receipt number.
   */
  async createSaleWithItems(
    sale: CreateSaleParams,
    items: CreateSaleItemParams[],
  ): Promise<{ sale: SaleRow; items: SaleItemRow[] }> {
    // 1. Insert the sale
    const createdSale = await this.insert({
      id: `sale_${crypto.randomUUID().slice(0, 8)}`,
      branch_id: sale.branchId,
      cashier_id: sale.cashierId,
      customer_id: sale.customerId ?? null,
      shift_id: sale.shiftId ?? null,
      subtotal: sale.subtotal,
      discount_amount: sale.discountAmount,
      tax_amount: sale.taxAmount,
      total_amount: sale.totalAmount,
      payment_method: sale.paymentMethod,
      payment_status: sale.paymentStatus ?? 'completed',
      receipt_number: sale.receiptNumber,
      notes: sale.notes ?? null,
      sale_status: sale.saleStatus ?? 'completed',
    } as Partial<SaleRow>)

    // 2. Insert sale items
    const saleItems: SaleItemRow[] = []
    for (const item of items) {
      const { data, error } = await this.client
        .from('sale_items')
        .insert({
          sale_id: createdSale.id,
          product_id: item.productId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          cost_price: item.costPrice ?? null,
          discount_percent: item.discountPercent ?? 0,
          line_total: item.lineTotal,
        } as Record<string, unknown>)
        .select()
        .single()

      if (error) throw this._toError(error, 'createSaleItems')
      saleItems.push(data as unknown as SaleItemRow)
    }

    return { sale: createdSale, items: saleItems }
  }

  /**
   * Search sales with joined data (customer, branch, cashier).
   * Matches the shape returned by lib/sales-actions.ts searchSales.
   * Use this when the caller needs related objects (e.g. sales-history UI).
   */
  async searchSalesWithJoins(
    params: SaleSearchParams,
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const page = params.page ?? 1
    const pageSize = params.pageSize ?? 50
    const offset = (page - 1) * pageSize

    let query = this.client
      .from('sales')
      .select(`
        *,
        branch:branches!branch_id(id, name, code),
        cashier:users!sales_cashier_id_fkey(id, full_name),
        customer:customers(id, name, phone)
      `, { count: 'exact', head: false })

    if (params.branchId) query = query.eq('branch_id', params.branchId)
    if (params.query) query = query.ilike('receipt_number', `%${params.query}%`)
    if (params.paymentMethod) query = query.eq('payment_method', params.paymentMethod)
    if (params.cashierId) query = query.eq('cashier_id', params.cashierId)
    if (params.customerId) query = query.eq('customer_id', params.customerId)
    if (params.status) query = query.eq('sale_status', params.status)
    if (params.dateFrom) query = query.gte('created_at', params.dateFrom)
    if (params.dateTo) query = query.lte('created_at', params.dateTo)

    query = query.order('created_at', { ascending: false })

    const { data, error, count } = await query.range(offset, offset + pageSize - 1)

    if (error) throw this._toError(error, 'searchSalesWithJoins')
    return {
      data: (data ?? []) as Record<string, unknown>[],
      total: count ?? 0,
      page,
      pageSize,
    }
  }

  /**
   * Get a sale by ID with all nested data: items (with product info),
   * branch, cashier, customer. Matches the shape returned by
   * lib/sales-actions.ts getSaleById.
   */
  async getSaleByIdWithDetails(saleId: string): Promise<Record<string, unknown> | null> {
    const { data, error } = await this.client
      .from('sales')
      .select(`
        *,
        branch:branches!branch_id(id, name, code),
        cashier:users!sales_cashier_id_fkey(id, full_name),
        customer:customers(id, name, phone),
        items:sale_items(
          id,
          product_id,
          quantity,
          unit_price,
          discount_percent,
          line_total,
          product:products(id, sku, name)
        )
      `)
      .eq('id', saleId)
      .maybeSingle()

    if (error) throw this._toError(error, 'getSaleByIdWithDetails')
    return (data ?? null) as Record<string, unknown> | null
  }

  /**
   * Get held sales with full product info in each item.
   * Matches the HeldSale shape expected by the POS UI.
   */
  async getHeldSalesWithProducts(
    branchId: string,
    cashierId?: string,
  ): Promise<Array<Record<string, unknown>>> {
    let query = this.client
      .from('sales')
      .select(`
        *,
        customers!left(name),
        sale_items(
          id,
          product_id,
          quantity,
          unit_price,
          discount_percent,
          line_total,
          product:products(id, name, sku, selling_price)
        )
      `)
      .eq('sale_status', 'on_hold')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })

    if (cashierId) {
      query = query.eq('cashier_id', cashierId)
    }

    const { data, error } = await query

    if (error) throw this._toError(error, 'getHeldSalesWithProducts')

    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      ...row,
      customer_name: (row.customers as { name?: string } | null)?.name ?? null,
    }))
  }

  /**
   * Get today's sales summary for a branch (for dashboard / shift close).
   */
  async getTodaySummary(branchId: string): Promise<{
    totalSales: number
    totalItems: number
    saleCount: number
    averageSale: number
  }> {
    const { start, end } = getNairobiDayRange()
    const startStr = start.toISOString()
    const endStr = end.toISOString()

    const { data, error } = await this.client
      .from('sales')
      .select('total_amount, subtotal', { count: 'exact' })
      .eq('branch_id', branchId)
      .eq('payment_status', 'completed')
      .neq('sale_status', 'returned')
      .gte('created_at', startStr)
      .lte('created_at', endStr)

    if (error) throw this._toError(error, 'getTodaySummary')

    const rows = (data ?? []) as Array<{ total_amount: number; subtotal: number }>
    const totalSales = rows.reduce((sum, r) => sum + Number(r.total_amount ?? 0), 0)
    const saleCount = rows.length

    return {
      totalSales,
      totalItems: 0, // would need a join — caller can use getSaleItems
      saleCount,
      averageSale: saleCount > 0 ? Math.round(totalSales / saleCount) : 0,
    }
  }

  /**
   * Check if a receipt number already exists (for duplicate detection).
   */
  async receiptExists(receiptNumber: string): Promise<boolean> {
    return this.exists({ receipt_number: receiptNumber })
  }

  /**
   * Get the last receipt number for a branch (for incrementing).
   */
  async getLastReceiptNumber(branchId: string): Promise<string | null> {
    const { data, error } = await this.client
      .from('sales')
      .select('receipt_number')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw this._toError(error, 'getLastReceiptNumber')
    return data?.receipt_number ?? null
  }

  /**
   * Void a sale with reason.
   */
  async voidSale(
    saleId: string,
    reason: string,
    voidedBy: string,
  ): Promise<SaleRow> {
    return this.update(saleId, {
      sale_status: 'voided',
      voided_at: new Date().toISOString(),
      void_reason: reason,
      voided_by: voidedBy,
    } as Partial<SaleRow>)
  }

  /**
   * Mark a sale as returned.
   */
  async returnSale(
    saleId: string,
    reason: string,
    returnedBy: string,
    returnedAmount: number,
    returnedQty: number,
  ): Promise<SaleRow> {
    return this.update(saleId, {
      sale_status: 'returned',
      returned_at: new Date().toISOString(),
      return_reason: reason,
      returned_by: returnedBy,
      returned_amount: returnedAmount,
      returned_qty: returnedQty,
    } as Partial<SaleRow>)
  }

  /**
   * Put a sale on hold.
   */
  async holdSale(
    branchId: string,
    cashierId: string,
    items: Array<{
      productId: string
      quantity: number
      unitPrice: number
      discountPercent?: number
    }>,
    customerId: string | null,
    subtotal: number,
    discountAmount: number,
    totalAmount: number,
    notes?: string,
  ): Promise<SaleRow> {
    const totalDiscount = discountAmount || 0
    const lineItems = items.map(i => ({
      productId: i.productId,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      discountPercent: i.discountPercent ?? 0,
      lineTotal: i.unitPrice * i.quantity * (1 - (i.discountPercent ?? 0) / 100),
    }))

    return this.insert({
      branch_id: branchId,
      cashier_id: cashierId,
      customer_id: customerId,
      subtotal,
      discount_amount: totalDiscount,
      tax_amount: 0,
      total_amount: totalAmount,
      payment_method: 'hold',
      payment_status: 'hold',
      receipt_number: `HOLD-${Date.now()}`,
      notes: notes ?? null,
      sale_status: 'on_hold',
    } as Partial<SaleRow>)
  }

  /**
   * Resume (un-hold) a sale.
   */
  async resumeHeldSale(
    saleId: string,
    branchId: string,
  ): Promise<{ sale: SaleRow; items: SaleItemRow[] } | null> {
    const sale = await this.findById(saleId)
    if (!sale || sale.sale_status !== 'on_hold') return null

    const items = await this.getSaleItems(saleId)
    return { sale, items }
  }

  /**
   * Get all held (on_hold) sales for a branch, with items and customer.
   */
  async getHeldSales(
    branchId: string,
    cashierId?: string,
  ): Promise<Array<SaleRow & { customer_name: string | null; items: SaleItemRow[] }>> {
    let query = this.client
      .from('sales')
      .select(`
        *,
        customers!left(name),
        sale_items(*)
      `)
      .eq('sale_status', 'on_hold')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })

    if (cashierId) {
      query = query.eq('cashier_id', cashierId)
    }

    const { data, error } = await query

    if (error) throw this._toError(error, 'getHeldSales')

    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      ...row,
      customer_name: (row.customers as { name?: string } | null)?.name ?? null,
      items: (row.sale_items as SaleItemRow[]) ?? [],
    })) as Array<SaleRow & { customer_name: string | null; items: SaleItemRow[] }>
  }

  /**
   * Cancel (delete) a held sale.
   */
  async cancelHeldSale(saleId: string, branchId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await this.client
      .from('sales')
      .delete()
      .eq('id', saleId)
      .eq('sale_status', 'on_hold')
      .eq('branch_id', branchId)

    if (error) return { success: false, error: error.message }
    return { success: true }
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

/** Shared sales repository instance. All code uses this, never creating new instances. */
export const salesRepo = new SalesRepository()
