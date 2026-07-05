'use server'

import {
  authenticateServerAction,
  authorizePOSProfile,
  resolveAuthorizedBranchId,
  verifySaleAccess,
} from '@/lib/auth-helpers'
import { createCashSaveTimingTracker, isCashSaveTimingEnabled } from '@/lib/cash-save-timing'
import type { UserProfile } from '@/contexts/auth-context'
import { getNairobiDayRange } from '@/lib/date-time'
import { supabaseAdmin } from '@/lib/supabase-server'
import { awardLoyaltyPoints, reverseLoyaltyPoints } from '@/lib/loyalty-actions'
import { logger } from '@/lib/logger'
import { emitEvent } from '@/lib/automation'

export interface PaymentSplit {
  method: 'cash' | 'card' | 'bank_transfer' | 'cheque' | 'credit' | 'mpesa'
  amount: number
  reference?: string
}

export interface SaleItem {
  productId: string
  quantity: number
  unitPrice: number
  discountPercent?: number
}

interface SalePayload {
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
  created_at: string
  updated_at: string
}

interface InsertedSaleItem {
  id: string
  sale_id: string
  product_id: string
  quantity: number
  unit_price: number
  discount_percent: number
  line_total: number
  created_at: string
}

interface SaleItemPayload {
  product_id: string
  quantity: number
  unit_price: number
  discount_percent: number
  line_total: number
}

interface AuthorizedSaleContext {
  branchId: string
  cashierId: string
}

interface ReceiptSeedItem {
  id: string
  product_id: string
  quantity: number
  unit_price: number
  discount_percent: number
  line_total: number
  product?: {
    id: string
    sku: string
    name: string
  }
}

export interface SaleReceiptSeed {
  sale: SalePayload
  items: ReceiptSeedItem[]
}

/**
 * Update customer aggregate stats after a completed sale.
 * Keeps total_lifetime_spend_cents, total_visits, and last_purchase_date in sync.
 */
async function updateCustomerSaleStats(customerId: string, saleAmountCents: number) {
  try {
    const { data: customer, error: fetchError } = await supabaseAdmin
      .from('customers')
      .select('total_lifetime_spend_cents, total_visits, last_purchase_date')
      .eq('id', customerId)
      .single()

    if (fetchError) {
      logger.warn('[CUSTOMER_STATS] Could not fetch customer for stats update', { customerId, error: fetchError.message })
      return
    }

    const newSpend = (customer?.total_lifetime_spend_cents || 0) + saleAmountCents
    const newVisits = (customer?.total_visits || 0) + 1

    const { error: updateError } = await supabaseAdmin
      .from('customers')
      .update({
        total_lifetime_spend_cents: newSpend,
        total_visits: newVisits,
        last_purchase_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', customerId)

    if (updateError) {
      logger.warn('[CUSTOMER_STATS] Failed to update customer stats', { customerId, error: updateError.message })
    }
  } catch (error) {
    logger.warn('[CUSTOMER_STATS] Unexpected error updating stats', { customerId, error })
  }
}

interface PreparedCashSalePayload {
  subtotal: number
  totalAmount: number
  receiptNumber: string
  writeTimestamp: string
  createdSale: SalePayload
  insertedSaleItems: InsertedSaleItem[]
}

function prepareCashSalePayload(
  context: AuthorizedSaleContext,
  items: SaleItem[],
  paymentMethod: 'cash' | 'card' | 'bank_transfer' | 'cheque' | 'credit' | 'mpesa',
  customerId?: string,
  totalDiscount: number = 0,
  notes?: string,
  paymentStatus: 'pending' | 'completed' | 'failed' = 'completed'
): PreparedCashSalePayload {
  let subtotal = 0
  const writeTimestamp = new Date().toISOString()
  const saleId = crypto.randomUUID()

  const insertedSaleItems = items.map((item) => {
    const lineTotal = item.quantity * item.unitPrice
    const discountAmount = lineTotal * ((item.discountPercent || 0) / 100)
    const lineSubtotal = lineTotal - discountAmount

    subtotal += lineSubtotal

    return {
      id: crypto.randomUUID(),
      sale_id: saleId,
      product_id: item.productId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      discount_percent: item.discountPercent || 0,
      line_total: Math.round(lineSubtotal),
      created_at: writeTimestamp,
    }
  })

  const totalAmount = Math.max(0, subtotal - totalDiscount)
  const receiptNumber = `RCP-${crypto.randomUUID().substring(0, 8).toUpperCase()}`

  return {
    subtotal,
    totalAmount,
    receiptNumber,
    writeTimestamp,
    createdSale: {
      id: saleId,
      branch_id: context.branchId,
      cashier_id: context.cashierId,
      customer_id: customerId || null,
      subtotal: Math.round(subtotal),
      discount_amount: Math.round(totalDiscount),
      tax_amount: 0,
      total_amount: Math.round(totalAmount),
      payment_method: paymentMethod,
      payment_status: paymentStatus,
      receipt_number: receiptNumber,
      notes: notes || null,
      created_at: writeTimestamp,
      updated_at: writeTimestamp,
    },
    insertedSaleItems,
  }
}

async function writePaymentSplits(saleId: string, splits: PaymentSplit[]): Promise<void> {
  if (!splits || splits.length === 0) return

  const { error } = await supabaseAdmin
    .from('payment_splits')
    .insert(splits.map((s) => ({
      sale_id: saleId,
      method: s.method,
      amount: Math.round(s.amount),
      reference: s.reference || null,
    })))

  if (error) {
    logger.error('[SALES] Failed to write payment splits', error, { saleId, splits })
    throw new Error(`Failed to save payment splits: ${error.message}`)
  }
}

function isMissingCashSaleTransactionRpc(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false
  }

  const rpcError = error as { code?: string; message?: string; details?: string; hint?: string }
  const combinedMessage = [
    rpcError.message,
    rpcError.details,
    rpcError.hint,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return (
    rpcError.code === 'PGRST202' ||
    rpcError.code === '42883' ||
    combinedMessage.includes('save_cash_sale_transaction') &&
      (combinedMessage.includes('could not find') || combinedMessage.includes('does not exist'))
  )
}

async function createCashSaleWithTransaction(
  context: AuthorizedSaleContext,
  items: SaleItem[],
  totalDiscount: number,
  customerId?: string,
  notes?: string,
  paymentStatus: 'pending' | 'completed' | 'failed' = 'completed'
) {
  const prepared = prepareCashSalePayload(
    context,
    items,
    'cash',
    customerId,
    totalDiscount,
    notes,
    paymentStatus
  )

  const rpcPayload = prepared.insertedSaleItems.map((item) => ({
    id: item.id,
    product_id: item.product_id,
    quantity: item.quantity,
    unit_price: item.unit_price,
    discount_percent: item.discount_percent,
    line_total: item.line_total,
    created_at: item.created_at,
  }))

  const { data, error } = await supabaseAdmin.rpc('save_cash_sale_transaction', {
    p_sale_id: prepared.createdSale.id,
    p_branch_id: context.branchId,
    p_cashier_id: context.cashierId,
    p_customer_id: customerId || null,
    p_subtotal: prepared.createdSale.subtotal,
    p_discount_amount: prepared.createdSale.discount_amount,
    p_total_amount: prepared.createdSale.total_amount,
    p_payment_method: 'cash',
    p_payment_status: paymentStatus,
    p_receipt_number: prepared.receiptNumber,
    p_notes: notes || null,
    p_written_at: prepared.writeTimestamp,
    p_items: rpcPayload,
  })

  if (error) {
    throw error
  }

  const rpcResult =
    Array.isArray(data) ? data[0] : data

  const persistedSale = rpcResult?.sale || prepared.createdSale
  const persistedItems: (InsertedSaleItem & { product?: { id: string; sku: string; name: string } })[] = Array.isArray(rpcResult?.items)
    ? rpcResult.items as (InsertedSaleItem & { product?: { id: string; sku: string; name: string } })[]
    : prepared.insertedSaleItems

  return {
    success: true,
    sale: persistedSale,
    receiptNumber: prepared.receiptNumber,
    loyaltyAward: null,
    receiptSeed: {
      sale: persistedSale,
      items: persistedItems.map((item) => ({
        id: item.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_percent: item.discount_percent,
        line_total: item.line_total,
        product: item.product,
      })),
    } satisfies SaleReceiptSeed,
    subtotal: Math.round(prepared.subtotal),
    discount: Math.round(totalDiscount),
  }
}

export async function createSaleWithContext(
  context: AuthorizedSaleContext,
  items: SaleItem[],
  paymentMethod: 'cash' | 'card' | 'bank_transfer' | 'cheque' | 'credit' | 'mpesa',
  customerId?: string,
  totalDiscount: number = 0,
  notes?: string,
  paymentStatus: 'pending' | 'completed' | 'failed' = 'completed',
  paymentSplits?: PaymentSplit[]
) {
  const { branchId, cashierId } = context

  // If payment splits provided, derive the primary method (largest split)
  const hasSplits = paymentSplits && paymentSplits.length > 0
  const effectivePaymentMethod: typeof paymentMethod = hasSplits
    ? paymentSplits!.reduce((max, s) => s.amount > max.amount ? s : max).method
    : paymentMethod

  const timing = createCashSaveTimingTracker(
    'sale_persistence',
    effectivePaymentMethod === 'cash' && isCashSaveTimingEnabled()
  )

  // Skip RPC fast path when splits are present (RPC hardcodes 'cash' and doesn't handle splits)
  if (!hasSplits && effectivePaymentMethod === 'cash' && paymentStatus === 'completed') {
    try {
      const transactionResult = await timing.measure('db_transaction_rpc', () =>
        createCashSaleWithTransaction(
          context,
          items,
          totalDiscount,
          customerId,
          notes,
          paymentStatus
        )
      )

      // NOTE: Loyalty is already awarded inside createCashSaleWithTransaction.
      // Do NOT award again here — that was a bug causing double awards and stale
      // balance issues during redemption.

      timing.logSuccess({
        saleId: transactionResult.sale.id,
        branchId,
        itemCount: items.length,
        customerType: customerId ? 'named_customer' : 'walk_in',
      })

      return {
        success: true,
        sale: transactionResult.sale,
        receiptNumber: transactionResult.receiptNumber,
        loyaltyAward: transactionResult.loyaltyAward,
        receiptSeed: transactionResult.receiptSeed,
      }
    } catch (error) {
      if (!isMissingCashSaleTransactionRpc(error)) {
        timing.logFailure({
          saleId: null,
          branchId,
          itemCount: items.length,
          customerType: customerId ? 'named_customer' : 'walk_in',
        })

        logger.error('[SALES] Cash transaction RPC failed', error, { branchId, itemCount: items.length })

        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create sale',
        }
      }

      logger.warn('[SALES] Cash transaction RPC missing, falling back to app-side persistence')
    }
  }

  let createdSaleId: string | null = null
  const appliedInventoryChanges: Array<{
    inventoryId: string
    previousQuantity: number
    productId: string
    quantityChanged: number
    branchId: string
  }> = []

  try {
    let subtotal = 0
    const saleItems: SaleItemPayload[] = []
    const requestedQuantities = new Map<string, number>()
    const writeTimestamp = new Date().toISOString()
    const saleId = crypto.randomUUID()

    for (const item of items) {
      const lineTotal = item.quantity * item.unitPrice
      const discountAmount = lineTotal * ((item.discountPercent || 0) / 100)
      const lineSubtotal = lineTotal - discountAmount

      subtotal += lineSubtotal

      saleItems.push({
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        discount_percent: item.discountPercent || 0,
        line_total: Math.round(lineSubtotal),
      })

      requestedQuantities.set(
        item.productId,
        (requestedQuantities.get(item.productId) || 0) + item.quantity
      )
    }

    const totalAmount = Math.max(0, subtotal - totalDiscount)
    const receiptNumber = `RCP-${crypto.randomUUID().substring(0, 8).toUpperCase()}`
    const inventorySnapshots: Record<string, {
      id: string
      quantity: number
      product: {
        id: string
        sku: string
        name: string
      }
    }> = {}

    await timing.measure('stock_validation', async () => {
      const productIds = Array.from(requestedQuantities.keys())
      const { data: inventoryRows, error: fetchError } = await supabaseAdmin
        .from('inventory')
        .select('id, product_id, quantity, product:products(id, sku, name)')
        .eq('branch_id', branchId)
        .in('product_id', productIds)

      if (fetchError) {
        throw new Error(`Failed to validate stock: ${fetchError.message}`)
      }

      const inventoryByProductId = new Map(
        (inventoryRows || []).map((row) => {
          const product = Array.isArray(row.product) ? row.product[0] : row.product

          return [
            row.product_id,
            {
              id: row.id,
              quantity: row.quantity,
              product: {
                id: product?.id,
                sku: product?.sku || '',
                name: product?.name,
              },
            },
          ]
        })
      )

      for (const [productId, requestedQuantity] of requestedQuantities.entries()) {
        const currentInventory = inventoryByProductId.get(productId)
        if (!currentInventory) {
          throw new Error(`Inventory not found for product ${productId} at branch ${branchId}`)
        }

        if (!currentInventory.product?.id || !currentInventory.product?.name) {
          throw new Error(`Product details missing for product ${productId}`)
        }

        if (currentInventory.quantity < requestedQuantity) {
          throw new Error(
            `Insufficient stock for product ${productId}: only ${currentInventory.quantity} available`
          )
        }

        inventorySnapshots[productId] = currentInventory
      }
    })

    const createdSale = {
      id: saleId,
      branch_id: branchId,
      cashier_id: cashierId,
      customer_id: customerId || null,
      subtotal: Math.round(subtotal),
      discount_amount: Math.round(totalDiscount),
      tax_amount: 0,
      total_amount: Math.round(totalAmount),
      payment_method: effectivePaymentMethod,
      payment_status: paymentStatus,
      receipt_number: receiptNumber,
      notes: notes || null,
      created_at: writeTimestamp,
      updated_at: writeTimestamp,
    }

    const { error: saleError } = await timing.measure(
      'sale_row_insert',
      async () =>
        await supabaseAdmin
          .from('sales')
          .insert(createdSale)
    )

    if (saleError) throw saleError
    createdSaleId = saleId

    const insertedSaleItems = saleItems.map((item) => ({
      ...item,
      id: crypto.randomUUID(),
      sale_id: saleId,
      created_at: writeTimestamp,
    }))

    const stockMovementRows = items.map((item) => ({
      product_id: item.productId,
      branch_id: branchId,
      type: 'sale' as const,
      quantity: -item.quantity,
      reference_id: saleId,
    }))

    const saleItemsInsertPromise = timing.measure('sale_items_insert', async () =>
      await supabaseAdmin
        .from('sale_items')
        .insert(insertedSaleItems)
    )

    const inventoryUpdatesPromise = timing.measure('inventory_updates', async () => {
      const inventoryUpdateResults = await Promise.allSettled(
        Array.from(requestedQuantities.entries()).map(async ([productId, requestedQuantity]) => {
          const currentInventory = inventorySnapshots[productId]
          if (!currentInventory) {
            throw new Error(`Inventory snapshot missing for product ${productId}`)
          }

          const newQuantity = currentInventory.quantity - requestedQuantity
          const { data: updatedInventory, error: updateError } = await supabaseAdmin
            .from('inventory')
            .update({
              quantity: newQuantity,
              updated_at: writeTimestamp,
            })
            .eq('id', currentInventory.id)
            .eq('quantity', currentInventory.quantity)
            .select('id')
            .maybeSingle()

          if (updateError) {
            throw new Error(`Failed to update inventory for product ${productId}: ${updateError.message}`)
          }

          if (!updatedInventory) {
            throw new Error(
              `Stock changed while completing the sale for product ${productId}. Refresh stock and try again.`
            )
          }

          return {
            inventoryId: currentInventory.id,
            previousQuantity: currentInventory.quantity,
            productId,
            quantityChanged: requestedQuantity,
            branchId,
          }
        })
      )

      const successfulUpdates = inventoryUpdateResults
        .filter(
          (result): result is PromiseFulfilledResult<(typeof appliedInventoryChanges)[number]> =>
            result.status === 'fulfilled'
        )
        .map((result) => result.value)

      appliedInventoryChanges.push(...successfulUpdates)

      const failedUpdate = inventoryUpdateResults.find((result) => result.status === 'rejected')
      if (failedUpdate && failedUpdate.status === 'rejected') {
        throw failedUpdate.reason
      }
    })

    const [saleItemsInsertResult, inventoryUpdateResult] = await Promise.allSettled([
      saleItemsInsertPromise,
      inventoryUpdatesPromise,
    ])

    if (saleItemsInsertResult.status === 'rejected') {
      throw saleItemsInsertResult.reason
    }

    if (saleItemsInsertResult.value?.error) {
      throw saleItemsInsertResult.value.error
    }

    if (inventoryUpdateResult.status === 'rejected') {
      throw inventoryUpdateResult.reason
    }

    const { error: movementError } = await timing.measure(
      'stock_movements_insert',
      async () =>
        await supabaseAdmin
          .from('stock_movements')
          .insert(stockMovementRows)
    )

    if (movementError) {
      throw new Error(`Failed to create stock movement: ${movementError.message}`)
    }

    let loyaltyAward: { pointsAwarded: number; newBalance: number } | null = null

    if (customerId && paymentStatus === 'completed') {
      loyaltyAward = await timing.measure('loyalty_award', () =>
        awardLoyaltyPoints(
          customerId,
          saleId,
          Math.round(subtotal),
          Math.round(totalDiscount),
          branchId,
          cashierId
        )
      )
    }

    // Auto-populate customer aggregate stats
    if (customerId && paymentStatus === 'completed') {
      await updateCustomerSaleStats(customerId, createdSale.total_amount)
    }

    // Write payment splits if provided (only in app-level persistence path)
    if (hasSplits && paymentSplits) {
      await writePaymentSplits(saleId, paymentSplits)
    }

    timing.logSuccess({
      saleId,
      branchId,
      itemCount: items.length,
      customerType: customerId ? 'named_customer' : 'walk_in',
    })

    return {
      success: true,
      sale: createdSale,
      receiptNumber,
      loyaltyAward,
      subtotal: Math.round(subtotal),
      discount: Math.round(totalDiscount),
      receiptSeed: {
        sale: createdSale,
        items: insertedSaleItems.map((item) => ({
          ...item,
          product: inventorySnapshots[item.product_id]!.product,
        })),
      } satisfies SaleReceiptSeed,
    }
  } catch (error) {
    timing.logFailure({
      saleId: createdSaleId,
      branchId,
      itemCount: items.length,
      customerType: customerId ? 'named_customer' : 'walk_in',
    })

    if (createdSaleId) {
      logger.error('[SALES] Rolling back incomplete sale', error, { saleId: createdSaleId })

      for (const change of appliedInventoryChanges.reverse()) {
        const { error: restoreError } = await supabaseAdmin
          .from('inventory')
          .update({
            quantity: change.previousQuantity,
            updated_at: new Date().toISOString(),
          })
          .eq('id', change.inventoryId)

        if (restoreError) {
          logger.error('[SALES] Failed to restore inventory during rollback', restoreError, { saleId: createdSaleId, productId: change.productId })
        }
      }

      await supabaseAdmin
        .from('stock_movements')
        .delete()
        .eq('reference_id', createdSaleId)
        .eq('type', 'sale')

      await supabaseAdmin
        .from('sale_items')
        .delete()
        .eq('sale_id', createdSaleId)

      await supabaseAdmin
        .from('sales')
        .delete()
        .eq('id', createdSaleId)
    }

    logger.error('Error creating sale', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create sale',
    }
  }
}

async function getSaleByIdWithProfile(
  profile: UserProfile,
  saleId: string,
  branchId?: string
) {
  const posAccess = authorizePOSProfile(profile)
  if (!posAccess.authorized) {
    logger.warn('[getSaleById] POS access denied', { error: posAccess.error })
    return null
  }

  const saleQuery = supabaseAdmin
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

  const scopedQuery =
    profile.role === 'super_admin'
      ? branchId
        ? saleQuery.eq('branch_id', branchId)
        : saleQuery
      : saleQuery.eq('branch_id', profile.branch_id || branchId || '')

  const { data, error } = await scopedQuery.single()

  if (error) {
    logger.error('[getSaleById] Supabase error', error, { code: error.code, details: error.details, hint: error.hint })
    throw error
  }

  return data || null
}

export async function getSaleByIdForAuthorizedContext(
  profile: UserProfile,
  saleId: string,
  branchId?: string
) {
  try {
    return await getSaleByIdWithProfile(profile, saleId, branchId)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('[getSaleById] Failed to fetch sale for authorized context', undefined, { saleId, errorMessage })
    return null
  }
}

// TODO: Consolidate this legacy createSale with createSaleWithContext in a future refactor.
// createSale handles auth internally while createSaleWithContext receives a pre-authed context.
export async function createSale(
  branchId: string,
  cashierId: string,
  items: SaleItem[],
  paymentMethod: 'cash' | 'card' | 'bank_transfer' | 'cheque' | 'credit' | 'mpesa',
  customerId?: string,
  totalDiscount: number = 0,
  notes?: string,
  paymentStatus: 'pending' | 'completed' | 'failed' = 'completed',
  paymentSplits?: PaymentSplit[]
) {
  let createdSaleId: string | null = null
  const appliedInventoryChanges: Array<{
    inventoryId: string
    previousQuantity: number
    productId: string
    quantityChanged: number
    branchId: string
  }> = []

  try {
    // If payment splits provided, derive the primary method (largest split)
    const hasSplits = paymentSplits && paymentSplits.length > 0
    const effectivePaymentMethod: typeof paymentMethod = hasSplits
      ? paymentSplits!.reduce((max, s) => s.amount > max.amount ? s : max).method
      : paymentMethod

    const authResult = await authenticateServerAction()
    if (!authResult.success || !authResult.profile) {
      return {
        success: false,
        error: authResult.error || 'Unauthorized',
      }
    }

    const posAccess = authorizePOSProfile(authResult.profile)
    if (!posAccess.authorized) {
      return {
        success: false,
        error: posAccess.error || 'Access denied',
      }
    }

    const branchScope = resolveAuthorizedBranchId(authResult.profile, branchId)
    if (!branchScope.authorized || !branchScope.branchId) {
      return {
        success: false,
        error: branchScope.error || 'Access denied',
      }
    }

    const effectiveBranchId = branchScope.branchId
    const effectiveCashierId = authResult.profile.id

    if (cashierId && cashierId !== effectiveCashierId) {
      logger.warn('[SALES] Ignoring mismatched cashier id in createSale', { requestedCashierId: cashierId, authenticatedCashierId: effectiveCashierId })
    }

    // Calculate totals
    let subtotal = 0
    const saleItems: SaleItemPayload[] = []

    for (const item of items) {
      const lineTotal = item.quantity * item.unitPrice
      const discountAmount = lineTotal * ((item.discountPercent || 0) / 100)
      const lineSubtotal = lineTotal - discountAmount

      subtotal += lineSubtotal

      saleItems.push({
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        discount_percent: item.discountPercent || 0,
        line_total: Math.round(lineSubtotal),
      })
    }

    // Tax is NOT added on top of customer-facing total
    // Customer pays the selling total only (item prices already include tax consideration)
    const taxAmount = 0 // Tax shown as included in price, not added
    const totalAmount = Math.max(0, subtotal - totalDiscount)

    const receiptNumber = `RCP-${crypto.randomUUID().substring(0, 8).toUpperCase()}`

    const inventorySnapshots: Record<string, { id: string; quantity: number }> = {}

    for (const item of items) {
      const { data: currentInventory, error: fetchError } = await supabaseAdmin
        .from('inventory')
        .select('id, quantity')
        .eq('product_id', item.productId)
        .eq('branch_id', effectiveBranchId)
        .single()

      if (fetchError || !currentInventory) {
        throw new Error(`Inventory not found for product ${item.productId} at branch ${effectiveBranchId}`)
      }

      if (currentInventory.quantity < item.quantity) {
        throw new Error(
          `Insufficient stock for product ${item.productId}: only ${currentInventory.quantity} available`
        )
      }

      inventorySnapshots[item.productId] = {
        id: currentInventory.id,
        quantity: currentInventory.quantity,
      }
    }

    // Create sale
    const { data: saleData, error: saleError } = await supabaseAdmin
      .from('sales')
      .insert({
        branch_id: effectiveBranchId,
        cashier_id: effectiveCashierId,
        customer_id: customerId || null,
        subtotal: Math.round(subtotal),
        discount_amount: Math.round(totalDiscount),
        tax_amount: taxAmount,
        total_amount: Math.round(totalAmount),
        payment_method: effectivePaymentMethod,
        payment_status: paymentStatus,
        receipt_number: receiptNumber,
        notes: notes || null,
      })
      .select()
      .single()

    if (saleError) throw saleError
    createdSaleId = saleData.id

    // Write payment splits if provided

    // Create sale items
    const itemsToInsert = saleItems.map((item) => ({
      ...item,
      sale_id: saleData.id,
    }))

    const { error: itemsError } = await supabaseAdmin
      .from('sale_items')
      .insert(itemsToInsert)

    if (itemsError) throw itemsError

    // CRITICAL: Update inventory quantity for each item
    for (const item of items) {
      const currentInventory = inventorySnapshots[item.productId]
      if (!currentInventory) {
        throw new Error(`Inventory snapshot missing for product ${item.productId}`)
      }

      // Calculate new quantity (minimum 0)
      const newQuantity = currentInventory.quantity - item.quantity

      // Update inventory
      const { data: updatedInventory, error: updateError } = await supabaseAdmin
        .from('inventory')
        .update({
          quantity: newQuantity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentInventory.id)
        .eq('quantity', currentInventory.quantity)
        .select('id')
        .maybeSingle()

      if (updateError) {
        throw new Error(`Failed to update inventory for product ${item.productId}: ${updateError.message}`)
      }
      if (!updatedInventory) {
        throw new Error(
          `Stock changed while completing the sale for product ${item.productId}. Refresh stock and try again.`
        )
      }

      appliedInventoryChanges.push({
        inventoryId: currentInventory.id,
        previousQuantity: currentInventory.quantity,
        productId: item.productId,
        quantityChanged: item.quantity,
        branchId: effectiveBranchId,
      })

      // Create stock movement for audit trail
      const { error: movementError } = await supabaseAdmin
        .from('stock_movements')
        .insert({
          product_id: item.productId,
          branch_id: effectiveBranchId,
          type: 'sale',
          quantity: -item.quantity,
          reference_id: saleData.id,
        })

      if (movementError) throw new Error(`Failed to create stock movement: ${movementError.message}`)
    }

    let loyaltyAward: { pointsAwarded: number; newBalance: number } | null = null

    // Award loyalty points only for named customers on completed sales
    if (!customerId) {
      logger.info('[LOYALTY] Customer not eligible for points: walk-in customer', { saleId: saleData.id, paymentStatus })
    } else if (paymentStatus !== 'completed') {
      logger.info('[LOYALTY] Customer not eligible for points: sale is not completed', { customerId, saleId: saleData.id, paymentStatus })
    } else {
      logger.info('[LOYALTY] Customer eligible for loyalty earn', { customerId, saleId: saleData.id, saleAmountKSh: Math.round(subtotal), discountAmountKSh: Math.round(totalDiscount) })

      loyaltyAward = await awardLoyaltyPoints(
        customerId,
        saleData.id,
        Math.round(subtotal),
        Math.round(totalDiscount),
        effectiveBranchId,
        effectiveCashierId
      )
      if (loyaltyAward && loyaltyAward.pointsAwarded) {
        logger.info(`[LOYALTY] Awarded ${loyaltyAward.pointsAwarded} points to customer. New balance: ${loyaltyAward.newBalance}`)
      }
    }

    // Auto-populate customer aggregate stats
    if (customerId && paymentStatus === 'completed') {
      await updateCustomerSaleStats(customerId, saleData.total_amount)
    }

    // Write payment splits if provided
    if (hasSplits && paymentSplits) {
      await writePaymentSplits(saleData.id, paymentSplits)
    }

    logger.info('[DEBUG] createSale() returning', { success: true, saleId: saleData?.id, receiptNumber, loyaltyAward })
    return {
      success: true,
      sale: saleData,
      receiptNumber,
      loyaltyAward,
    }
  } catch (error) {
    if (createdSaleId) {
      logger.error('[SALES] Rolling back incomplete sale', error, { saleId: createdSaleId })

      for (const change of appliedInventoryChanges.reverse()) {
        const { error: restoreError } = await supabaseAdmin
          .from('inventory')
          .update({
            quantity: change.previousQuantity,
            updated_at: new Date().toISOString(),
          })
          .eq('id', change.inventoryId)

        if (restoreError) {
          logger.error('[SALES] Failed to restore inventory during rollback', restoreError, { saleId: createdSaleId, productId: change.productId })
        }
      }

      await supabaseAdmin
        .from('stock_movements')
        .delete()
        .eq('reference_id', createdSaleId)
        .eq('type', 'sale')

      await supabaseAdmin
        .from('sale_items')
        .delete()
        .eq('sale_id', createdSaleId)

      await supabaseAdmin
        .from('sales')
        .delete()
        .eq('id', createdSaleId)
    }

    logger.error('Error creating sale', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create sale',
    }
  }
}

export async function getSales(branchId: string, limit: number = 50) {
  try {
    const authResult = await authenticateServerAction()
    if (!authResult.success || !authResult.profile) {
      logger.warn('[SALES] Sales history denied', { error: authResult.error })
      return []
    }

    const posAccess = authorizePOSProfile(authResult.profile)
    if (!posAccess.authorized) {
      logger.warn('[SALES] Sales history POS access denied', { error: posAccess.error })
      return []
    }

    const branchScope = resolveAuthorizedBranchId(authResult.profile, branchId)
    if (!branchScope.authorized || !branchScope.branchId) {
      logger.warn('[SALES] Sales history branch denied', { error: branchScope.error })
      return []
    }

    const { data, error } = await supabaseAdmin
      .from('sales')
      .select(`
        *,
        branch:branches!branch_id(id, name, code),
        cashier:users!sales_cashier_id_fkey(id, full_name),
        customer:customers(id, name, phone)
      `)
      .eq('branch_id', branchScope.branchId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return (data || []).map((sale) => ({
      ...sale,
      branch: Array.isArray(sale.branch) ? sale.branch[0] || null : sale.branch,
      cashier: Array.isArray(sale.cashier) ? sale.cashier[0] || null : sale.cashier,
      customer: Array.isArray(sale.customer) ? sale.customer[0] || null : sale.customer,
    }))
  } catch (error) {
    logger.error('Error fetching sales', error)
    return []
  }
}

export async function getSaleById(saleId: string) {
  try {
    const authResult = await authenticateServerAction()
    if (!authResult.success || !authResult.profile) {
      logger.warn('[getSaleById] Auth denied', { error: authResult.error })
      return null
    }

    const posAccess = authorizePOSProfile(authResult.profile)
    if (!posAccess.authorized) {
    logger.warn('[getSaleById] POS access denied', { error: posAccess.error })
      return null
    }

    const saleAccess = await verifySaleAccess(authResult.profile, saleId)
    if (!saleAccess.authorized) {
      logger.warn('[getSaleById] Sale access denied', { saleId, userId: authResult.profile.id, reason: saleAccess.error })
      return null
    }

    logger.info('[getSaleById] Fetching sale', { saleId })
    
    const { data, error } = await supabaseAdmin
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
      .single()

    if (error) {
      logger.error('[getSaleById] Supabase error', error, { code: error.code, details: error.details, hint: error.hint })
      throw error
    }

    if (!data) {
      logger.warn('[getSaleById] No sale found for id', { saleId })
      return null
    }

    logger.info('[DEBUG] getSaleById() returning', { saleId: data?.id, hasItems: !!data?.items, itemsLength: data?.items?.length })
    return data
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('[getSaleById] FATAL: Failed to fetch sale', error, { saleId, errorMessage })
    return null
  }
}

export async function getSalesByDateRange(branchId: string, startDate: string, endDate: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('sales')
      .select('*')
      .eq('branch_id', branchId)
      .neq('payment_status', 'failed') // Exclude voided sales from reports
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  } catch (error) {
    logger.error('Error fetching sales by date range', error)
    return []
  }
}

export async function getTodaySalesStats(branchId: string) {
  try {
    const { start, end } = getNairobiDayRange()

    const { data, error } = await supabaseAdmin
      .from('sales')
      .select('id, total_amount, payment_method')
      .eq('branch_id', branchId)
      .neq('payment_status', 'failed') // Exclude voided sales from stats
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString())

    if (error) throw error

    const totalSales = data?.reduce((sum, s) => sum + s.total_amount, 0) || 0
    const transactionCount = data?.length || 0

    const stats = {
      totalSales,
      transactionCount,
      averageBasket: transactionCount > 0 ? Math.round(totalSales / transactionCount) : 0,
      paymentMethods: {
        cash: 0,
        card: 0,
        bank_transfer: 0,
        cheque: 0,
        credit: 0,
        mpesa: 0,
      },
    }

    data?.forEach((sale) => {
      stats.paymentMethods[sale.payment_method as keyof typeof stats.paymentMethods] += sale.total_amount
    })

    return stats
  } catch (error) {
    logger.error('Error fetching today sales stats', error)
    return { totalSales: 0, transactionCount: 0, averageBasket: 0, paymentMethods: {} }
  }
}

/**
 * VOID SALE - Complete reversal of a sale
 * - Marks sale as voided
 * - Restores ALL inventory for all items
 * - Creates reversal movements for audit trail
 * - Records audit log entry
 * - Only allowed by manager/admin users
 * - Only allowed within same branch
 */
export async function voidSale(
  saleId: string,
  branchId: string,
  voidReason: string,
  userId: string // user performing the void
) {
  try {
    // Validation 1: Check user permissions (must be manager/admin)
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('role, branch_id')
      .eq('id', userId)
      .single()

    if (userError) throw new Error('User not found')
    if (!userData) throw new Error('User not found')

    // Only manager and admin can void sales
    if (!['manager', 'admin'].includes(userData.role)) {
      throw new Error('Only managers and admins can void sales')
    }

    // Validation 2: User must be from same branch
    if (userData.branch_id !== branchId) {
      throw new Error('Cannot void sales from other branches')
    }

    // Validation 3: Fetch sale details
    const { data: saleData, error: saleError } = await supabaseAdmin
      .from('sales')
      .select('*')
      .eq('id', saleId)
      .single()

    if (saleError) throw new Error('Sale not found')
    if (!saleData) throw new Error('Sale not found')

    // Validation 4: Sale must be in completed state
    if (saleData.payment_status && saleData.payment_status !== 'completed') {
      throw new Error(`Cannot void a ${saleData.payment_status} sale. Only completed sales can be voided.`)
    }

    // Validation 5: Fetch all items in the sale
    const { data: saleItems, error: itemsError } = await supabaseAdmin
      .from('sale_items')
      .select('*')
      .eq('sale_id', saleId)

    if (itemsError) throw new Error('Failed to fetch sale items')
    if (!saleItems || saleItems.length === 0) {
      throw new Error('Sale has no items to void')
    }

    // Step 1: Restore inventory for each item with rollback on partial failure
    const restoredItems: Array<{ inventoryId: string; quantity: number; productId: string }> = []
    try {
      for (const item of saleItems) {
        // Get current inventory
        const { data: currentInventory, error: fetchError } = await supabaseAdmin
          .from('inventory')
          .select('id, quantity')
          .eq('product_id', item.product_id)
          .eq('branch_id', branchId)
          .single()

        if (fetchError) throw new Error(`Inventory not found for product ${item.product_id}`)

        // Restore quantity (add back the sales quantity)
        const newQuantity = currentInventory.quantity + item.quantity
        const { data: updatedRows, error: updateError } = await supabaseAdmin
          .from('inventory')
          .update({
            quantity: newQuantity,
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentInventory.id)
          .eq('quantity', currentInventory.quantity)
          .select()

        if (updateError) throw new Error(`Failed to restore inventory: ${updateError.message}`)
        if (!updatedRows || updatedRows.length === 0) throw new Error(`Concurrent modification detected for inventory of product ${item.product_id}. Please retry.`)

        // Track restored item for potential rollback
        restoredItems.push({
          inventoryId: currentInventory.id,
          quantity: item.quantity,
          productId: item.product_id,
        })

        // Create reversal movement (positive quantity to offset original sale)
        const { error: movementError } = await supabaseAdmin
          .from('stock_movements')
          .insert({
            product_id: item.product_id,
            branch_id: branchId,
            type: 'reversal',
            quantity: item.quantity, // positive = added back
            reference_id: saleId,
            notes: `Sale void: ${voidReason}`,
          })

        if (movementError) throw new Error(`Failed to create reversal movement: ${movementError.message}`)
      }
    } catch (error) {
      // Rollback already restored items
      for (const restored of restoredItems) {
        const { data: currentInv } = await supabaseAdmin
          .from('inventory')
          .select('id, quantity')
          .eq('id', restored.inventoryId)
          .single()

        if (currentInv) {
          const revertQuantity = currentInv.quantity - restored.quantity
          await supabaseAdmin
            .from('inventory')
            .update({
              quantity: revertQuantity,
              updated_at: new Date().toISOString(),
            })
            .eq('id', restored.inventoryId)

          // Delete the reversal movement we created
          await supabaseAdmin
            .from('stock_movements')
            .delete()
            .eq('reference_id', saleId)
            .eq('product_id', restored.productId)
            .eq('type', 'reversal')
        }
      }
      throw error // Re-throw the original error
    }

    // Step 2: Update sale as voided
    const { error: voidError } = await supabaseAdmin
      .from('sales')
      .update({
        payment_status: 'failed', // Mark as failed to indicate voided
        sale_status: 'voided',
        void_reason: voidReason,
        voided_by: userId,
        voided_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', saleId)

    if (voidError) throw new Error(`Failed to update sale: ${voidError.message}`)

    // Step 2a: Reverse loyalty points and restore redeemed points if customer was present
    if (saleData.customer_id) {
      // Reverse earned points
      const reverseResult = await reverseLoyaltyPoints(
        saleId,
        saleData.customer_id,
        branchId,
        userId
      )
      if (reverseResult) {
        logger.info(`[LOYALTY] Reversed ${reverseResult.pointsReversed} points. New balance: ${reverseResult.newBalance}`)
      }
      
      // Restore redeemed points (imported from loyalty-actions)
      const { restoreRedeemedPoints } = await import('@/lib/loyalty-actions')
      const restoreResult = await restoreRedeemedPoints(
        saleId,
        saleData.customer_id,
        branchId,
        userId
      )
      if (restoreResult) {
        logger.info(`[LOYALTY] Restored ${restoreResult.pointsRestored} redeemed points. New balance: ${restoreResult.newBalance}`)
      }
    }

    // Step 3: Create audit log entry
    const { error: auditError } = await supabaseAdmin
      .from('sale_audit_log')
      .insert({
        sale_id: saleId,
        action: 'voided',
        reason: voidReason,
        performed_by: userId,
        details: {
          itemCount: saleItems.length,
          totalAmount: saleData.total_amount,
          paymentMethod: saleData.payment_method,
        },
      })

    if (auditError) throw new Error(`Failed to create audit log: ${auditError.message}`)

    // Emit automation event (fire-and-forget)
    emitEvent({
      eventType: 'sale.voided',
      source: 'pos',
      entityType: 'sale',
      entityId: saleId,
      payload: {
        saleId,
        branchId,
        total: saleData.total_amount,
        reason: voidReason,
        cashierName: 'Unknown',
      },
    }).catch(err => logger.warn('[Automation] Failed to emit sale.voided', { error: err.message }))

    return {
      success: true,
      message: `Sale ${saleData.receipt_number} voided successfully`,
      saleId,
    }
  } catch (error) {
    logger.error('Error voiding sale', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to void sale',
    }
  }
}

/**
 * RETURN SALE / PARTIAL RETURN - Process customer returns
 * - Marks sale as returned (full or partial)
 * - Restores inventory for returned items only
 * - Creates reversal movements
 * - Records audit log with return details
 * - Supports partial item returns
 */
export async function returnSale(
  saleId: string,
  branchId: string,
  returnReason: string,
  userId: string,
  returnDetails?: {
    itemId?: string // specific item in sale_items
    quantity?: number // how many units returned
    isFullReturn?: boolean // return entire sale
  }
) {
  try {
    // Validation 1: Check user permissions
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('role, branch_id')
      .eq('id', userId)
      .single()

    if (userError) throw new Error('User not found')
    if (!['manager', 'admin', 'cashier'].includes(userData.role)) {
      throw new Error('Invalid permissions for returns')
    }

    if (userData.branch_id !== branchId) {
      throw new Error('Cannot process returns from other branches')
    }

    // Validation 2: Fetch sale
    const { data: saleData, error: saleError } = await supabaseAdmin
      .from('sales')
      .select('*')
      .eq('id', saleId)
      .single()

    if (saleError) throw new Error('Sale not found')
    if (saleData.sale_status === 'voided' || saleData.payment_status === 'failed') {
      throw new Error('Cannot return a voided sale')
    }

    // Validation 3: Fetch sale items
    const { data: saleItems, error: itemsError } = await supabaseAdmin
      .from('sale_items')
      .select('*')
      .eq('sale_id', saleId)

    if (itemsError) throw new Error('Failed to fetch sale items')

    // Determine which items to return
    let itemsToReturn = saleItems
    if (returnDetails?.itemId && returnDetails.quantity !== undefined) {
      // Partial return - only specific item
      const item = saleItems.find((i) => i.id === returnDetails.itemId)
      if (!item) throw new Error('Item not found in sale')
      if (returnDetails.quantity > item.quantity) {
        throw new Error(`Cannot return more than ${item.quantity} units`)
      }
      itemsToReturn = [{ ...item, quantity: returnDetails.quantity }]
    }

    // Step 1: Restore inventory for returned items with rollback on partial failure
    const restoredItems: Array<{ inventoryId: string; quantity: number; productId: string }> = []
    try {
      for (const item of itemsToReturn) {
        const { data: currentInventory, error: fetchError } = await supabaseAdmin
          .from('inventory')
          .select('id, quantity')
          .eq('product_id', item.product_id)
          .eq('branch_id', branchId)
          .single()

        if (fetchError) throw new Error(`Inventory not found for product ${item.product_id}`)

        const newQuantity = currentInventory.quantity + item.quantity
        const { data: updatedRows, error: updateError } = await supabaseAdmin
          .from('inventory')
          .update({
            quantity: newQuantity,
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentInventory.id)
          .eq('quantity', currentInventory.quantity)
          .select()

        if (updateError) throw new Error(`Failed to restore inventory: ${updateError.message}`)
        if (!updatedRows || updatedRows.length === 0) throw new Error(`Concurrent modification detected for inventory of product ${item.product_id}. Please retry.`)

        // Track restored item for potential rollback
        restoredItems.push({
          inventoryId: currentInventory.id,
          quantity: item.quantity,
          productId: item.product_id,
        })

        const { error: movementError } = await supabaseAdmin
          .from('stock_movements')
          .insert({
            product_id: item.product_id,
            branch_id: branchId,
            type: 'reversal',
            quantity: item.quantity,
            reference_id: saleId,
            notes: `Return: ${returnReason}`,
          })

        if (movementError) throw new Error(`Failed to create reversal movement: ${movementError.message}`)
      }
    } catch (error) {
      // Rollback already restored items
      for (const restored of restoredItems) {
        const { data: currentInv } = await supabaseAdmin
          .from('inventory')
          .select('id, quantity')
          .eq('id', restored.inventoryId)
          .single()

        if (currentInv) {
          const revertQuantity = currentInv.quantity - restored.quantity
          await supabaseAdmin
            .from('inventory')
            .update({
              quantity: revertQuantity,
              updated_at: new Date().toISOString(),
            })
            .eq('id', restored.inventoryId)

          // Delete the reversal movement we created
          await supabaseAdmin
            .from('stock_movements')
            .delete()
            .eq('reference_id', saleId)
            .eq('product_id', restored.productId)
            .eq('type', 'reversal')
        }
      }
      throw error // Re-throw the original error
    }

    // Step 1b: Reverse loyalty points if customer was present
    if (saleData.customer_id) {
      const reverseResult = await reverseLoyaltyPoints(
        saleId,
        saleData.customer_id,
        branchId,
        userId
      )
      if (reverseResult) {
        logger.info(`[LOYALTY] Reversed ${reverseResult.pointsReversed} points. New balance: ${reverseResult.newBalance}`)
      }

      // Restore redeemed points (import on demand)
      const { restoreRedeemedPoints } = await import('@/lib/loyalty-actions')
      const restoreResult = await restoreRedeemedPoints(
        saleId,
        saleData.customer_id,
        branchId,
        userId
      )
      if (restoreResult) {
        logger.info(`[LOYALTY] Restored ${restoreResult.pointsRestored} redeemed points. New balance: ${restoreResult.newBalance}`)
      }
    }

    // Step 1c: Insert structured return_items records for reporting
    const unitRefunds = itemsToReturn.map((item: Record<string, unknown>) => {
      const unitPrice = (item.unit_price as number) || 0
      const discountPercent = (item.discount_percent as number) || 0
      const qty = (item.quantity as number) || 0
      const unitRefund = Math.round(unitPrice * (1 - discountPercent / 100))
      return {
        sale_id: saleId,
        product_id: item.product_id as string,
        quantity_returned: qty,
        unit_refund_amount: unitRefund,
        total_refund: unitRefund * qty,
        reason: returnReason,
        created_by: userId,
      }
    })
    const { error: returnItemsError } = await supabaseAdmin
      .from('return_items')
      .insert(unitRefunds)
    if (returnItemsError) {
      logger.warn('[RETURN] Failed to insert return_items', { error: returnItemsError.message })
    }

    // Step 2: Update sale status
    const isFullReturn = !returnDetails?.itemId || itemsToReturn.length === saleItems.length
    const newStatus = isFullReturn ? 'returned' : 'completed' // partial return keeps as completed but logged

    const { error: updateError } = await supabaseAdmin
      .from('sales')
      .update({
        sale_status: newStatus,
        returned_at: new Date().toISOString(),
        returned_qty: itemsToReturn.reduce((sum, i) => sum + i.quantity, 0),
        returned_amount: itemsToReturn.reduce(
          (sum, i) => sum + Math.round(i.unit_price * (1 - (i.discount_percent || 0) / 100) * i.quantity),
          0
        ),
        return_reason: returnReason,
        returned_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', saleId)

    if (updateError) throw new Error(`Failed to update sale: ${updateError.message}`)

    // Step 3: Create audit log
    const action = isFullReturn ? 'returned' : 'partial_return'
    const { error: auditError } = await supabaseAdmin
      .from('sale_audit_log')
      .insert({
        sale_id: saleId,
        action,
        reason: returnReason,
        performed_by: userId,
        details: {
          itemsReturned: itemsToReturn.map((i) => ({
            productId: i.product_id,
            quantity: i.quantity,
          })),
          isFullReturn,
        },
      })

    if (auditError) throw new Error(`Failed to create audit log: ${auditError.message}`)

    // Emit automation event (fire-and-forget)
    emitEvent({
      eventType: 'sale.returned',
      source: 'pos',
      entityType: 'sale',
      entityId: saleId,
      payload: {
        saleId,
        branchId,
        total: saleData.total_amount,
        reason: returnReason,
        itemCount: itemsToReturn.length,
        isFullReturn,
        cashierName: 'Unknown',
      },
    }).catch(err => logger.warn('[Automation] Failed to emit sale.returned', { error: err.message }))

    return {
      success: true,
      message: `${isFullReturn ? 'Full' : 'Partial'} return processed for sale ${saleData.receipt_number}`,
      saleId,
    }
  } catch (error) {
    logger.error('Error processing return', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process return',
    }
  }
}

/**
 * GET SALE AUDIT TRAIL - View all modifications to a sale
 */
export async function getSaleAuditTrail(saleId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('sale_audit_log')
      .select(`
        *,
        performed_by_user:users(id, full_name, role)
      `)
      .eq('sale_id', saleId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  } catch (error) {
    logger.error('Error fetching audit trail', error)
    return []
  }
}

// ─── Hold Sale ──────────────────────────────────────────────────────────────

interface HeldSaleItem {
  id: string
  product_id: string
  quantity: number
  unit_price: number
  discount_percent: number
  line_total: number
  product: {
    id: string
    name: string
    sku: string
    selling_price: number
  }
}

export interface HeldSale {
  id: string
  receipt_number: string
  subtotal: number
  discount_amount: number
  total_amount: number
  customer_id: string | null
  customer_name: string | null
  hold_notes: string | null
  created_at: string
  items: HeldSaleItem[]
}

/**
 * Put a sale on hold.
 * Creates a sale row (payment_status='pending', sale_status='on_hold')
 * with sale_items so the cashier can resume it later.
 * Does NOT deduct inventory.
 */
export async function holdSale(
  branchId: string,
  cashierId: string,
  items: Array<{
    productId: string
    name: string
    sku: string
    quantity: number
    unitPrice: number
    discountPercent: number
    sellingPrice: number
  }>,
  customerId: string | null,
  subtotal: number,
  discountAmount: number,
  totalAmount: number,
  holdNotes?: string
) {
  try {
    const { profile } = await authenticateServerAction()
    if (!profile) {
      return { success: false, error: 'Unauthorized' }
    }
    if (profile.branch_id !== branchId) {
      return { success: false, error: 'Cannot hold sales for another branch' }
    }

    const receiptNumber = `HLD-${crypto.randomUUID().substring(0, 8).toUpperCase()}`
    const saleId = crypto.randomUUID()
    const now = new Date().toISOString()

    // 1. Insert the sale row
    const { error: saleError } = await supabaseAdmin
      .from('sales')
      .insert({
        id: saleId,
        branch_id: branchId,
        cashier_id: cashierId,
        customer_id: customerId || null,
        subtotal: Math.round(subtotal),
        discount_amount: Math.round(discountAmount),
        tax_amount: 0,
        total_amount: Math.round(totalAmount),
        payment_method: 'cash',
        payment_status: 'pending',
        sale_status: 'on_hold',
        receipt_number: receiptNumber,
        notes: holdNotes || null,
        hold_notes: holdNotes || null,
      })

    if (saleError) {
      logger.error('[HOLD SALE] Failed to insert sale row', saleError)
      return { success: false, error: saleError.message }
    }

    // 2. Insert sale items
    const saleItemRows = items.map((item) => ({
      sale_id: saleId,
      product_id: item.productId,
      quantity: item.quantity,
      unit_price: Math.round(item.unitPrice),
      discount_percent: item.discountPercent,
      line_total: Math.round(item.unitPrice * item.quantity * (1 - item.discountPercent / 100)),
    }))

    const { error: itemsError } = await supabaseAdmin
      .from('sale_items')
      .insert(saleItemRows)

    if (itemsError) {
      logger.error('[HOLD SALE] Failed to insert sale items', itemsError)
      // Attempt cleanup
      await supabaseAdmin.from('sales').delete().eq('id', saleId)
      return { success: false, error: itemsError.message }
    }

    logger.info('[HOLD SALE] Sale placed on hold', { saleId, receiptNumber, itemCount: items.length })

    return {
      success: true,
      saleId,
      receiptNumber,
    }
  } catch (error) {
    logger.error('[HOLD SALE] Unexpected error', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to hold sale',
    }
  }
}

/**
 * List held (on_hold) sales for a branch and optionally a specific cashier.
 */
export async function getHeldSales(
  branchId: string,
  cashierId?: string
): Promise<HeldSale[]> {
  try {
    let query = supabaseAdmin
      .from('sales')
      .select(`
        id,
        receipt_number,
        subtotal,
        discount_amount,
        total_amount,
        customer_id,
        hold_notes,
        created_at,
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

    if (error) {
      logger.error('[HOLD SALE] Failed to fetch held sales', error)
      return []
    }

    const heldSales: HeldSale[] = (data || []).map((row: any) => ({
      id: row.id,
      receipt_number: row.receipt_number,
      subtotal: row.subtotal,
      discount_amount: row.discount_amount,
      total_amount: row.total_amount,
      customer_id: row.customer_id,
      customer_name: row.customers?.name || null,
      hold_notes: row.hold_notes || null,
      created_at: row.created_at,
      items: (row.sale_items || []).map((item: any) => ({
        id: item.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_percent: item.discount_percent,
        line_total: item.line_total,
        product: item.product || {
          id: item.product_id,
          name: 'Unknown',
          sku: '',
          selling_price: item.unit_price,
        },
      })),
    }))

    return heldSales
  } catch (error) {
    logger.error('[HOLD SALE] Error fetching held sales', error)
    return []
  }
}

/**
 * Resume (release) a held sale.
 * Deletes the held sale row and items, returning the data needed
 * to restore the cart. Does NOT modify inventory.
 */
export async function resumeHeldSale(
  saleId: string,
  branchId: string
): Promise<{
  success: boolean
  heldSale?: HeldSale
  error?: string
}> {
  try {
    // 1. Fetch the held sale with items
    const { data: saleData, error: fetchError } = await supabaseAdmin
      .from('sales')
      .select(`
        id,
        receipt_number,
        subtotal,
        discount_amount,
        total_amount,
        customer_id,
        hold_notes,
        created_at,
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
      .eq('id', saleId)
      .eq('sale_status', 'on_hold')
      .eq('branch_id', branchId)
      .single()

    if (fetchError || !saleData) {
      logger.error('[HOLD SALE] Failed to fetch held sale for resume', fetchError)
      return { success: false, error: 'Held sale not found' }
    }

    const heldSale: HeldSale = {
      id: saleData.id,
      receipt_number: saleData.receipt_number,
      subtotal: saleData.subtotal,
      discount_amount: saleData.discount_amount,
      total_amount: saleData.total_amount,
      customer_id: saleData.customer_id,
      customer_name: (saleData as any).customers?.name || null,
      hold_notes: (saleData as any).hold_notes || null,
      created_at: saleData.created_at,
      items: ((saleData as any).sale_items || []).map((item: any) => ({
        id: item.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_percent: item.discount_percent,
        line_total: item.line_total,
        product: item.product || {
          id: item.product_id,
          name: 'Unknown',
          sku: '',
          selling_price: item.unit_price,
        },
      })),
    }

    // 2. Delete the held sale (cascades to sale_items via FK)
    const { error: deleteError } = await supabaseAdmin
      .from('sales')
      .delete()
      .eq('id', saleId)
      .eq('sale_status', 'on_hold')

    if (deleteError) {
      logger.error('[HOLD SALE] Failed to delete held sale on resume', deleteError)
      return { success: false, error: deleteError.message }
    }

    logger.info('[HOLD SALE] Sale resumed', { saleId })

    return { success: true, heldSale }
  } catch (error) {
    logger.error('[HOLD SALE] Error resuming held sale', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to resume held sale',
    }
  }
}

/**
 * Cancel (discard) a held sale without resuming it.
 */
export async function cancelHeldSale(saleId: string, branchId: string) {
  try {
    const { error } = await supabaseAdmin
      .from('sales')
      .delete()
      .eq('id', saleId)
      .eq('sale_status', 'on_hold')
      .eq('branch_id', branchId)

    if (error) {
      logger.error('[HOLD SALE] Failed to cancel held sale', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    logger.error('[HOLD SALE] Error cancelling held sale', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel held sale',
    }
  }
}
