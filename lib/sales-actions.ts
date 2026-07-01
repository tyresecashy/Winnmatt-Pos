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

export interface SaleItem {
  productId: string
  quantity: number
  unitPrice: number
  discountPercent?: number
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
  product: {
    id: string
    sku: string
    name: string
  }
}

export interface SaleReceiptSeed {
  sale: any
  items: ReceiptSeedItem[]
}

interface PreparedCashSalePayload {
  subtotal: number
  totalAmount: number
  receiptNumber: string
  writeTimestamp: string
  createdSale: any
  insertedSaleItems: Array<{
    id: string
    sale_id: string
    product_id: string
    quantity: number
    unit_price: number
    discount_percent: number
    line_total: number
    created_at: string
  }>
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
  const receiptNumber = `RCP-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`

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
  const persistedItems = Array.isArray(rpcResult?.items)
    ? rpcResult.items
    : prepared.insertedSaleItems

  return {
    success: true,
    sale: persistedSale,
    receiptNumber: prepared.receiptNumber,
    loyaltyAward: null,
    receiptSeed: {
      sale: persistedSale,
      items: persistedItems.map((item: any) => ({
        id: item.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_percent: item.discount_percent,
        line_total: item.line_total,
        product: item.product,
      })),
    } satisfies SaleReceiptSeed,
    subtotalCents: Math.round(prepared.subtotal * 100),
    discountCents: Math.round(totalDiscount * 100),
  }
}

export async function createSaleWithContext(
  context: AuthorizedSaleContext,
  items: SaleItem[],
  paymentMethod: 'cash' | 'card' | 'bank_transfer' | 'cheque' | 'credit' | 'mpesa',
  customerId?: string,
  totalDiscount: number = 0,
  notes?: string,
  paymentStatus: 'pending' | 'completed' | 'failed' = 'completed'
) {
  const { branchId, cashierId } = context
  const timing = createCashSaveTimingTracker(
    'sale_persistence',
    paymentMethod === 'cash' && isCashSaveTimingEnabled()
  )

  if (paymentMethod === 'cash' && paymentStatus === 'completed') {
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

      let loyaltyAward: { pointsAwarded: number; newBalance: number } | null = null

      if (customerId) {
        loyaltyAward = await timing.measure('loyalty_award', () =>
          awardLoyaltyPoints(
            customerId,
            transactionResult.sale.id,
            transactionResult.subtotalCents,
            transactionResult.discountCents,
            branchId,
            cashierId
          )
        )
      }

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
        loyaltyAward,
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

        console.error('[SALES] Cash transaction RPC failed', {
          branchId,
          itemCount: items.length,
          error: error instanceof Error ? error.message : String(error),
        })

        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create sale',
        }
      }

      console.warn('[SALES] Cash transaction RPC missing, falling back to app-side persistence')
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
    const saleItems: any[] = []
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
    const receiptNumber = `RCP-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
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
        (inventoryRows || []).map((row: any) => {
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
      payment_method: paymentMethod,
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
          .insert(createdSale as any)
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
        .insert(insertedSaleItems as any)
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
          Math.round(subtotal * 100),
          Math.round(totalDiscount * 100),
          branchId,
          cashierId
        )
      )
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
      receiptSeed: {
        sale: createdSale,
        items: insertedSaleItems.map((item: any) => ({
          ...item,
          product: inventorySnapshots[item.product_id]?.product,
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
      console.error('[SALES] Rolling back incomplete sale', {
        saleId: createdSaleId,
        error: error instanceof Error ? error.message : String(error),
      })

      for (const change of appliedInventoryChanges.reverse()) {
        const { error: restoreError } = await supabaseAdmin
          .from('inventory')
          .update({
            quantity: change.previousQuantity,
            updated_at: new Date().toISOString(),
          })
          .eq('id', change.inventoryId)

        if (restoreError) {
          console.error('[SALES] Failed to restore inventory during rollback', {
            saleId: createdSaleId,
            productId: change.productId,
            error: restoreError.message,
          })
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

    console.error('Error creating sale:', error)
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
    console.warn('[getSaleById] POS access denied:', posAccess.error)
    return null
  }

  const saleQuery = supabaseAdmin
    .from('sales')
    .select(`
      *,
      branch:branches(id, name, code),
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
    profile.role === 'owner'
      ? branchId
        ? saleQuery.eq('branch_id', branchId)
        : saleQuery
      : saleQuery.eq('branch_id', profile.branch_id || branchId || '')

  const { data, error } = await scopedQuery.single()

  if (error) {
    console.error('[getSaleById] Supabase error:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    })
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
    console.error('[getSaleById] Failed to fetch sale for authorized context:', {
      saleId,
      errorMessage,
    })
    return null
  }
}

export async function createSale(
  branchId: string,
  cashierId: string,
  items: SaleItem[],
  paymentMethod: 'cash' | 'card' | 'bank_transfer' | 'cheque' | 'credit' | 'mpesa',
  customerId?: string,
  totalDiscount: number = 0,
  notes?: string,
  paymentStatus: 'pending' | 'completed' | 'failed' = 'completed'
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
      console.warn('[SALES] Ignoring mismatched cashier id in createSale', {
        requestedCashierId: cashierId,
        authenticatedCashierId: effectiveCashierId,
      })
    }

    // Calculate totals
    let subtotal = 0
    const saleItems: any[] = []

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

    const receiptNumber = `RCP-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`

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
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        receipt_number: receiptNumber,
        notes: notes || null,
      })
      .select()
      .single()

    if (saleError) throw saleError
    createdSaleId = saleData.id

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
      console.log('[LOYALTY] Customer not eligible for points: walk-in customer', {
        saleId: saleData.id,
        paymentStatus,
      })
    } else if (paymentStatus !== 'completed') {
      console.log('[LOYALTY] Customer not eligible for points: sale is not completed', {
        customerId,
        saleId: saleData.id,
        paymentStatus,
      })
    } else {
      console.log('[LOYALTY] Customer eligible for loyalty earn', {
        customerId,
        saleId: saleData.id,
        saleAmountKSh: Math.round(subtotal),
        discountAmountKSh: Math.round(totalDiscount),
      })

      loyaltyAward = await awardLoyaltyPoints(
        customerId,
        saleData.id,
        Math.round(subtotal * 100),
        Math.round(totalDiscount * 100),
        effectiveBranchId,
        effectiveCashierId
      )
      if (loyaltyAward && loyaltyAward.pointsAwarded) {
        console.log(`[LOYALTY] ✅ Awarded ${loyaltyAward.pointsAwarded} points to customer. New balance: ${loyaltyAward.newBalance}`)
      }
    }

    console.log('[DEBUG] createSale() returning:', {
      success: true,
      saleId: saleData?.id,
      receiptNumber,
      loyaltyAward,
      saleDataKeys: Object.keys(saleData || {}),
    })
    return {
      success: true,
      sale: saleData,
      receiptNumber,
      loyaltyAward,
    }
  } catch (error) {
    if (createdSaleId) {
      console.error('[SALES] Rolling back incomplete sale', {
        saleId: createdSaleId,
        error: error instanceof Error ? error.message : String(error),
      })

      for (const change of appliedInventoryChanges.reverse()) {
        const { error: restoreError } = await supabaseAdmin
          .from('inventory')
          .update({
            quantity: change.previousQuantity,
            updated_at: new Date().toISOString(),
          })
          .eq('id', change.inventoryId)

        if (restoreError) {
          console.error('[SALES] Failed to restore inventory during rollback', {
            saleId: createdSaleId,
            productId: change.productId,
            error: restoreError.message,
          })
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

    console.error('Error creating sale:', error)
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
      console.warn('[SALES] Sales history denied:', authResult.error)
      return []
    }

    const posAccess = authorizePOSProfile(authResult.profile)
    if (!posAccess.authorized) {
      console.warn('[SALES] Sales history POS access denied:', posAccess.error)
      return []
    }

    const branchScope = resolveAuthorizedBranchId(authResult.profile, branchId)
    if (!branchScope.authorized || !branchScope.branchId) {
      console.warn('[SALES] Sales history branch denied:', branchScope.error)
      return []
    }

    const { data, error } = await supabaseAdmin
      .from('sales')
      .select(`
        *,
        branch:branches(id, name, code),
        cashier:users!sales_cashier_id_fkey(id, full_name),
        customer:customers(id, name, phone)
      `)
      .eq('branch_id', branchScope.branchId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return (data || []).map((sale: any) => ({
      ...sale,
      branch: Array.isArray(sale.branch) ? sale.branch[0] || null : sale.branch,
      cashier: Array.isArray(sale.cashier) ? sale.cashier[0] || null : sale.cashier,
      customer: Array.isArray(sale.customer) ? sale.customer[0] || null : sale.customer,
    }))
  } catch (error) {
    console.error('Error fetching sales:', error)
    return []
  }
}

export async function getSaleById(saleId: string) {
  try {
    const authResult = await authenticateServerAction()
    if (!authResult.success || !authResult.profile) {
      console.warn('[getSaleById] Auth denied:', authResult.error)
      return null
    }

    const posAccess = authorizePOSProfile(authResult.profile)
    if (!posAccess.authorized) {
      console.warn('[getSaleById] POS access denied:', posAccess.error)
      return null
    }

    const saleAccess = await verifySaleAccess(authResult.profile, saleId)
    if (!saleAccess.authorized) {
      console.warn('[getSaleById] Sale access denied:', {
        saleId,
        userId: authResult.profile.id,
        reason: saleAccess.error,
      })
      return null
    }

    console.log('[getSaleById] Fetching sale:', { saleId })
    
    const { data, error } = await supabaseAdmin
      .from('sales')
      .select(`
        *,
        branch:branches(id, name, code),
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
      console.error('[getSaleById] Supabase error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      })
      throw error
    }

    if (!data) {
      console.warn('[getSaleById] No sale found for id:', saleId)
      return null
    }

    console.log('[DEBUG] getSaleById() returning:', {
      saleId: data?.id,
      hasItems: !!data?.items,
      itemsLength: data?.items?.length,
      cashierIsArray: Array.isArray(data?.cashier),
      branchIsArray: Array.isArray(data?.branch),
      customerIsArray: Array.isArray(data?.customer),
      firstItemProductIsArray: Array.isArray(data?.items?.[0]?.product),
      dataKeys: Object.keys(data || {}),
      itemKeys: data?.items?.length ? Object.keys(data.items[0] || {}) : [],
      firstItemProduct: data?.items?.[0]?.product,
    })
    return data
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[getSaleById] FATAL: Failed to fetch sale:', {
      saleId,
      errorMessage,
      errorStack: error instanceof Error ? error.stack : undefined,
    })
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
    console.error('Error fetching sales by date range:', error)
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
    console.error('Error fetching today sales stats:', error)
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

    // Step 1: Restore inventory for each item
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
      const { error: updateError } = await supabaseAdmin
        .from('inventory')
        .update({
          quantity: newQuantity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentInventory.id)

      if (updateError) throw new Error(`Failed to restore inventory: ${updateError.message}`)

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
        console.log(`[LOYALTY] ⚠️  Reversed ${reverseResult.pointsReversed} points. New balance: ${reverseResult.newBalance}`)
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
        console.log(`[LOYALTY] ⚠️  Restored ${restoreResult.pointsRestored} redeemed points. New balance: ${restoreResult.newBalance}`)
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

    return {
      success: true,
      message: `Sale ${saleData.receipt_number} voided successfully`,
      saleId,
    }
  } catch (error) {
    console.error('Error voiding sale:', error)
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

    // Step 1: Restore inventory for returned items
    for (const item of itemsToReturn) {
      const { data: currentInventory, error: fetchError } = await supabaseAdmin
        .from('inventory')
        .select('id, quantity')
        .eq('product_id', item.product_id)
        .eq('branch_id', branchId)
        .single()

      if (fetchError) throw new Error(`Inventory not found for product ${item.product_id}`)

      const newQuantity = currentInventory.quantity + item.quantity
      const { error: updateError } = await supabaseAdmin
        .from('inventory')
        .update({
          quantity: newQuantity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentInventory.id)

      if (updateError) throw new Error(`Failed to restore inventory: ${updateError.message}`)

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

    // Step 2: Update sale status
    const isFullReturn = !returnDetails?.itemId || itemsToReturn.length === saleItems.length
    const newStatus = isFullReturn ? 'returned' : 'completed' // partial return keeps as completed but logged

    const { error: updateError } = await supabaseAdmin
      .from('sales')
      .update({
        sale_status: newStatus,
        returned_at: new Date().toISOString(),
        returned_qty: itemsToReturn.reduce((sum, i) => sum + i.quantity, 0),
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

    return {
      success: true,
      message: `${isFullReturn ? 'Full' : 'Partial'} return processed for sale ${saleData.receipt_number}`,
      saleId,
    }
  } catch (error) {
    console.error('Error processing return:', error)
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
    console.error('Error fetching audit trail:', error)
    return []
  }
}
