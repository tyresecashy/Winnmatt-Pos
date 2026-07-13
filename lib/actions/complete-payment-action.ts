'use server'
import { logger } from '@/lib/logger';

import { createCashSaveTimingTracker } from '@/lib/cash-save-timing'
import type { SaleItem, SaleReceiptSeed, PaymentSplit } from '@/lib/sales-actions'
import type { SaleDetailsData } from '@/components/receipt-preview'
import {
  getAuthenticatedServerActionUser,
  loadCheckoutUserProfileResult,
  authorizePOSProfile,
  resolveAuthorizedBranchId,
} from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getRedemptionEligibility, redeemLoyaltyPoints } from '@/lib/modules/customers'
import { buildReceiptPayload, type RawSaleData, type RawItem } from '@/lib/receipt-builder'
import { createSaleWithContext, getSaleByIdForAuthorizedContext } from '@/lib/sales-actions'
import { applyPromotionToSale } from '@/lib/modules/promotions'
import { syncCashSaleEvent } from '@/lib/shift-cash-sync'
import { emitEvent } from '@/lib/automation'

interface CreateSaleResult {
  success: boolean
  sale?: { id: string }
  receiptNumber?: string
  receiptSeed?: SaleReceiptSeed
  loyaltyAward?: { pointsAwarded: number; newBalance: number } | null
  error?: string
}

// Full sale record used to build receipt payload - shape matches the return of buildReceiptSaleFromSeed and getSaleByIdForAuthorizedContext

export interface CompletePaymentPromotion {
  promotionId: string
  discountCents: number
  couponCode?: string
}

export interface CompletePaymentRequest {
  branchId: string
  cashierId: string
  shiftId?: string | null
  items: SaleItem[]
  paymentMethod: 'cash' | 'card' | 'bank_transfer' | 'cheque' | 'credit'
  customerId?: string
  cartDiscount: number
  receiptSettings: Record<string, unknown>
  redemptionPoints?: number
  redemptionDiscount?: number
  promotions?: CompletePaymentPromotion[]
  paymentSplits?: PaymentSplit[]
}

export interface CompletePaymentResponse {
  success: boolean
  receiptData?: SaleDetailsData
  saleId?: string
  error?: string
}

async function buildReceiptSaleFromSeed(
  profile: {
    id?: string
    full_name?: string
    branch?: {
      id?: string
      name?: string
      code?: string
    }
  } | null | undefined,
  effectiveBranchId: string,
  customerId: string | undefined,
  receiptSeed: SaleReceiptSeed,
  loyaltyBalance?: number
): Promise<RawSaleData> {
  const branchPromise =
    profile?.branch?.id === effectiveBranchId && profile.branch?.name && profile.branch?.code
      ? Promise.resolve(profile.branch as { id: string; name: string; code: string })
      : supabaseAdmin
          .from('branches')
          .select('id, name, code')
          .eq('id', effectiveBranchId)
          .single()
          .then(({ data, error }) => {
            if (error) {
              logger.error('Operation failed', { error: error })
              throw new Error('Operation failed')
            }
            return data
          })

  const customerPromise = customerId
    ? supabaseAdmin
        .from('customers')
        .select('id, name, phone, loyalty_points')
        .eq('id', customerId)
        .single()
        .then(({ data, error }) => {
          if (error) {
            logger.error('Operation failed', { error: error })
            throw new Error('Operation failed')
          }
          if (!data) {
            return null
          }

          return {
            ...data,
            loyalty_points: loyaltyBalance ?? data.loyalty_points,
          }
        })
    : Promise.resolve(null)

  const [branch, customer] = await Promise.all([branchPromise, customerPromise])

  return {
    ...receiptSeed.sale,
    branch: branch as { id: string; name: string; code: string },
    cashier: {
      id: profile?.id ?? '',
      full_name: profile?.full_name ?? '',
    },
    customer: customer as RawSaleData['customer'],
    items: receiptSeed.items as RawItem[],
  }
}

/**
 * Complete a payment and return validated receipt data.
 * Single source of truth for checkout completion logic.
 * 
 * This extracts the massive inline callback from pos/page.tsx into a testable,
 * reusable server action that:
 * 1. Validates cart contents
 * 2. Creates the sale
 * 3. Processes loyalty redemption if applicable
 * 4. Fetches full sale details
 * 5. Builds validated receipt payload
 * 6. Returns receipt data ready for display
 */

/**
 * Restore loyalty points that were pre-deducted before sale creation.
 * Called as a rollback only when the sale creation fails after points
 * have already been deducted.
 */
async function restorePreDeductedPoints(
  customerId: string,
  points: number,
  _branchId: string,
  _userId: string
): Promise<void> {
  try {
    const { data: cust } = await supabaseAdmin
      .from('customers')
      .select('loyalty_points')
      .eq('id', customerId)
      .single()
    if (cust) {
      await supabaseAdmin
        .from('customers')
        .update({ loyalty_points: (cust.loyalty_points || 0) + points })
        .eq('id', customerId)
      logger.info('[COMPLETE_PAYMENT] Restored pre-deducted loyalty points', {
        customerId,
        points,
      })
    }
  } catch (err) {
    // Best-effort — the sale failed and we couldn't restore points.
    // This should be reconciled manually.
    logger.error('[COMPLETE_PAYMENT] Failed to restore pre-deducted points', {
      customerId,
      points,
      error: String(err),
    })
  }
}

/**
 * Deduct quantities from batch_tracking using FIFO (oldest expiry first).
 * Silently skips products with no batch records.
 */
async function consumeBatchInventory(
  items: SaleItem[],
  branchId: string
): Promise<void> {
  const productQtys = new Map<string, number>()
  for (const item of items) {
    const key = item.productId
    if (key) {
      productQtys.set(key, (productQtys.get(key) || 0) + item.quantity)
    }
  }

  const batchEntries = await Promise.all(
    Array.from(productQtys.entries()).map(async ([productId, neededQty]) => {
      const { data: batches, error } = await supabaseAdmin
        .from('batch_tracking')
        .select('id, quantity, reserved_quantity')
        .eq('product_id', productId)
        .eq('status', 'active')
        .order('expiry_date', { ascending: true })
        .order('created_at', { ascending: true })

      if (error) {
        logger.error('Operation failed', { error: error })
        throw new Error('Operation failed')
      }
      if (!batches || batches.length === 0) return

      let remaining = neededQty
      for (const batch of batches) {
        if (remaining <= 0) break
        const available = (batch.quantity || 0) - (batch.reserved_quantity || 0)
        if (available <= 0) continue
        const deduct = Math.min(available, remaining)
        const newQty = (batch.quantity || 0) - deduct
        const newReserved = Math.min(batch.reserved_quantity || 0, newQty)
        const { error: updateError } = await supabaseAdmin
          .from('batch_tracking')
          .update({ quantity: newQty, reserved_quantity: newReserved })
          .eq('id', batch.id)
          .eq('quantity', batch.quantity)
        if (updateError) {
          logger.warn('[BatchConsumption] Conflict on batch', { batchId: batch.id, error: updateError.message })
          continue
        }
        remaining -= deduct
      }
    })
  )

  await Promise.all(batchEntries)
}

export async function completePaymentAction(
  request: CompletePaymentRequest
): Promise<CompletePaymentResponse> {
  // If payment splits provided, derive primary method (largest split)
  const effectivePaymentMethod = request.paymentSplits && request.paymentSplits.length > 0
    ? request.paymentSplits.reduce((max, s) => s.amount > max.amount ? s : max).method
    : request.paymentMethod

  const timing = createCashSaveTimingTracker(
    'complete_payment_action',
    effectivePaymentMethod === 'cash'
  )
  let resolvedBranchId: string | null = null
  let resolvedSaleId: string | null = null
  let customerType: 'named_customer' | 'walk_in' = request.customerId ? 'named_customer' : 'walk_in'

  try {
    const { profile, effectiveBranchId } = await timing.measure('auth_context_resolution', async () => {
      const authIdentity = await timing.measure('auth_claims_or_session_resolution', async () => {
        const authUserResult = await getAuthenticatedServerActionUser()
        if (!authUserResult.user) {
          throw new Error(`Failed at: AUTH - ${authUserResult.error || 'Unauthorized'}`)
        }

        return authUserResult.user
      })

      const profileResult = await timing.measure('auth_profile_fetch', async () => {
        const result = await loadCheckoutUserProfileResult(authIdentity.id)
        if (!result.profile) {
          const message =
            result.reason === 'inactive'
              ? 'Unauthorized: User is inactive'
              : 'Unauthorized: User not found'
          throw new Error(`Failed at: AUTH - ${message}`)
        }

        return result.profile
      })

      const profile = profileResult
      const posAccess = authorizePOSProfile(profile)
      if (!posAccess.authorized) {
        throw new Error(`Failed at: AUTH - ${posAccess.error || 'Unauthorized'}`)
      }

      const effectiveBranchId = await timing.measure('auth_branch_resolution', async () => {
        const branchScope = resolveAuthorizedBranchId(profile, request.branchId)
        if (!branchScope.authorized || !branchScope.branchId) {
          throw new Error(
            `Failed at: AUTH - ${branchScope.error || 'No branch assigned for POS checkout'}`
          )
        }

        return branchScope.branchId
      })

      if (request.branchId && request.branchId !== effectiveBranchId) {
        logger.warn('[completePaymentAction] Ignoring mismatched client branch id', {
          userId: profile.id,
          requestedBranchId: request.branchId,
          authenticatedBranchId: effectiveBranchId,
        })
      }

      if (request.cashierId && request.cashierId !== profile.id) {
        logger.warn('[completePaymentAction] Ignoring mismatched client cashier id', {
          requestedCashierId: request.cashierId,
          authenticatedCashierId: profile.id,
        })
      }

      return {
        profile,
        effectiveBranchId,
      }
    })

    resolvedBranchId = effectiveBranchId

    const saleSubtotal = request.items.reduce((sum, item) => {
      const lineTotal = item.quantity * item.unitPrice
      const discountAmount = lineTotal * ((item.discountPercent || 0) / 100)
      return sum + (lineTotal - discountAmount)
    }, 0)

    const saleTotalBeforeRedemption = Math.max(0, saleSubtotal - request.cartDiscount)

    let validatedRedemption:
      | {
          points: number
          discount: number
          discountCents: number
          currentBalance: number
        }
      | null = null

    if ((request.redemptionPoints || 0) > 0) {
      validatedRedemption = await timing.measure('redemption_validation', async () => {
        if (!request.customerId) {
          throw new Error('Failed at: VALIDATION - Only named customers can redeem loyalty points')
        }

        const requestedPoints = Math.floor(request.redemptionPoints || 0)
        const eligibility = await getRedemptionEligibility(
          request.customerId,
          Math.round(saleTotalBeforeRedemption)
        )

        if (!eligibility || !eligibility.eligible) {
          throw new Error(
            `Failed at: VALIDATION - ${eligibility?.reason || 'Unable to validate redemption'}`
          )
        }

        if (requestedPoints <= 0 || requestedPoints > eligibility.maxRedeemablePoints) {
          throw new Error('Failed at: VALIDATION - Redemption points exceed the allowed balance for this sale')
        }

        const expectedDiscount = Math.round(
          requestedPoints * eligibility.redeemValueCents
        )
        const maxRedeemableDiscountKSh = Math.round(
          eligibility.maxRedeemableDiscount
        )

        if (expectedDiscount > maxRedeemableDiscountKSh) {
          throw new Error('Failed at: VALIDATION - Redemption value exceeds the allowed discount for this sale')
        }

        return {
          points: requestedPoints,
          discount: expectedDiscount,
          discountCents: Math.round(expectedDiscount),
          currentBalance: eligibility.currentBalance,
        }
      })
    }

    const totalDiscountForSale =
      request.cartDiscount + (validatedRedemption?.discount || 0)

    if (!effectiveBranchId || !profile.id) {
      return {
        success: false,
        error: 'Failed at: VALIDATION - Missing branch or cashier information'
      }
    }

    if (!Array.isArray(request.items) || request.items.length === 0) {
      return {
        success: false,
        error: 'Failed at: VALIDATION - Cart is empty'
      }
    }

    // ── Deduct loyalty points BEFORE creating the sale ────────────────
    // This ensures atomicity: if the point deduction fails, the sale is
    // never created.  If the sale creation later fails, we restore points.
    let redemptionResult:
      | {
          pointsRedeemed: number
          discountApplied: number
          newBalance: number
        }
      | null = null

    let pointsPreDeducted = false
    const customerId = request.customerId
    if (customerId && validatedRedemption && validatedRedemption.points > 0) {
      // We need a saleId placeholder for the redemption record — we'll update
      // it after the sale is actually created.
      const placeholderSaleId = '__pending__'
      try {
        redemptionResult = await timing.measure('redemption_apply', () =>
          redeemLoyaltyPoints(
            customerId,
            validatedRedemption.points,
            effectiveBranchId
          ).then(r => r.success ? { pointsRedeemed: validatedRedemption.points, discountApplied: validatedRedemption.discountCents, newBalance: r.new_balance ?? 0 } : null)
        )
        if (redemptionResult) {
          pointsPreDeducted = true
        } else {
          logger.warn('[completePaymentAction] Loyalty redemption did not complete')
        }
      } catch (error) {
        return {
          success: false,
          error: `Failed at: REDEMPTION - ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      }
    }

    let createResult: CreateSaleResult
    try {
      createResult = await timing.measure('create_sale_total', () =>
        createSaleWithContext(
          {
            branchId: effectiveBranchId,
            cashierId: profile.id,
            shiftId: request.shiftId,
          },
          request.items,
          effectivePaymentMethod,
          request.customerId,
          totalDiscountForSale,
          'POS Sale',
          undefined,
          request.paymentSplits
        )
      )
    } catch (error) {
      timing.logFailure({
        saleId: resolvedSaleId,
        branchId: resolvedBranchId,
        itemCount: request.items.length,
        customerType,
      })
      // Roll-back: restore pre-deducted points if sale creation failed
      if (pointsPreDeducted && redemptionResult && request.customerId) {
        void restorePreDeductedPoints(
          request.customerId,
          validatedRedemption!.points,
          effectiveBranchId,
          profile.id
        )
      }
      return {
        success: false,
        error: `Failed at: CREATE SALE - ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }

    if (!createResult || !createResult.success) {
      if (pointsPreDeducted && redemptionResult && request.customerId) {
        void restorePreDeductedPoints(
          request.customerId,
          validatedRedemption!.points,
          effectiveBranchId,
          profile.id
        )
      }
      return {
        success: false,
        error: `Failed at: CREATE SALE - ${createResult?.error || 'Unknown error'}`
      }
    }

    if (!createResult.sale || !createResult.sale.id) {
      if (pointsPreDeducted && redemptionResult && request.customerId) {
        void restorePreDeductedPoints(
          request.customerId,
          validatedRedemption!.points,
          effectiveBranchId,
          profile.id
        )
      }
      return {
        success: false,
        error: 'Failed at: CREATE SALE - No sale ID returned'
      }
    }

    const saleId = createResult.sale.id
    resolvedSaleId = saleId

    // If we pre-deducted with a placeholder, update the redemption record
    // to reference the real sale ID.  (redeemLoyaltyPoints already recorded
    // the transaction with placeholderSaleId — the transaction records use
    // the sale_id for audit purposes.)
    if (pointsPreDeducted && redemptionResult) {
      try {
        await supabaseAdmin
          .from('loyalty_transactions')
          .update({ sale_id: saleId })
          .eq('sale_id', '__pending__')
          .eq('customer_id', customerId!)
      } catch {
        // Non-fatal — the points are already deducted and the sale is created
        logger.warn('[completePaymentAction] Could not update loyalty transaction with real sale ID', { saleId })
      }
    }

    // ── Consume batch inventory (FIFO) after sale creation ──────────
    if (request.items.length > 0) {
      try {
        await consumeBatchInventory(request.items, effectiveBranchId)
      } catch (error) {
        logger.warn('[completePaymentAction] Batch consumption failed (non-fatal):', {
          saleId,
          error: String(error),
        })
      }
    }

    // ── Apply promotions after sale creation ─────────────────────────
    if (Array.isArray(request.promotions) && request.promotions.length > 0) {
      for (const promo of request.promotions) {
        try {
          await applyPromotionToSale(
            promo.promotionId,
            saleId,
            promo.discountCents,
            promo.couponCode,
            undefined // bonusMultiplier not set from coupon validation
          )
        } catch (error) {
          logger.warn('[completePaymentAction] Failed to apply promotion to sale:', {
            saleId,
            promotionId: promo.promotionId,
            error: String(error),
          })
        }
      }
    }

    // ── Sync cash sale event to register/drawer audit trail ────────────
    if (
      request.shiftId &&
      (effectivePaymentMethod === 'cash' ||
        (Array.isArray(request.paymentSplits) &&
          request.paymentSplits.some(s => s.method === 'cash')))
    ) {
      const totalPaid = Math.max(
        0,
        saleTotalBeforeRedemption - (validatedRedemption?.discount || 0)
      )
      void syncCashSaleEvent({
        saleId,
        branchId: effectiveBranchId,
        amount: totalPaid,
        shiftId: request.shiftId,
        cashierId: profile.id,
      })
    }

    let fullSale: RawSaleData | null
    try {
      const receiptSeed = createResult.receiptSeed as SaleReceiptSeed | undefined
      const expectedLoyaltyBalance =
        redemptionResult?.newBalance ?? createResult.loyaltyAward?.newBalance

      if (receiptSeed?.sale?.id && Array.isArray(receiptSeed.items) && receiptSeed.items.length > 0) {
        fullSale = await timing.measure('receipt_sale_refetch', () =>
          buildReceiptSaleFromSeed(
            profile,
            effectiveBranchId,
            request.customerId,
            receiptSeed,
            expectedLoyaltyBalance
          )
        )
      } else {
        const getSaleByIdPromise = timing.measure('receipt_sale_refetch', () =>
          getSaleByIdForAuthorizedContext(
            profile,
            saleId,
            effectiveBranchId
          )
        )
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('getSaleById timeout after 5 seconds')), 5000)
        )

        fullSale = await Promise.race([getSaleByIdPromise, timeoutPromise]) as RawSaleData
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed at: FETCH SALE DETAILS - ${error instanceof Error ? error.message : 'Unknown error'}`,
        saleId
      }
    }

    if (!fullSale || !fullSale.id) {
      return {
        success: false,
        error: 'Failed at: FETCH SALE DETAILS - Sale data is invalid or missing',
        saleId
      }
    }

    let receiptPayload: SaleDetailsData | null
    try {
      receiptPayload = await timing.measure('receipt_payload_build', () =>
        buildReceiptPayload(fullSale, request.receiptSettings)
      )
    } catch (error) {
      timing.logFailure({
        saleId: resolvedSaleId,
        branchId: resolvedBranchId,
        itemCount: request.items.length,
        customerType,
      })
      return {
        success: false,
        error: `Failed at: BUILD RECEIPT - ${error instanceof Error ? error.message : 'Unknown error'}`,
        saleId
      }
    }

    if (!receiptPayload) {
      return {
        success: false,
        error: 'Failed at: BUILD RECEIPT - Receipt validation failed (missing required fields)',
        saleId
      }
    }

    const pointsEarned = createResult.loyaltyAward?.pointsAwarded || 0
    const pointsRedeemed = redemptionResult?.pointsRedeemed || 0
    const newLoyaltyBalance =
      redemptionResult?.newBalance ??
      createResult.loyaltyAward?.newBalance ??
      receiptPayload.customer?.loyalty_points ??
      0

    if (pointsEarned > 0 || pointsRedeemed > 0) {
      receiptPayload.loyalty = {
        points_earned: pointsEarned,
        ...(pointsRedeemed > 0 ? { points_redeemed: pointsRedeemed } : {}),
        new_balance: newLoyaltyBalance,
      }

      if (receiptPayload.customer) {
        receiptPayload.customer.loyalty_points = newLoyaltyBalance
      }
    }

    timing.logSuccess({
      saleId: receiptPayload.id,
      branchId: resolvedBranchId,
      itemCount: request.items.length,
      customerType,
    })

    // Emit automation event (fire-and-forget)
    emitEvent({
      eventType: 'sale.completed',
      source: 'pos',
      entityType: 'sale',
      entityId: receiptPayload.id,
      payload: {
        saleId: receiptPayload.id,
        branchId: resolvedBranchId || '',
        total: receiptPayload.total_amount,
        paymentMethod: request.paymentMethod,
        customerId: request.customerId || undefined,
        itemCount: request.items.length,
        cashierName: profile.full_name || 'Unknown',
      },
    }).catch(err => logger.warn('[Automation] Failed to emit sale.completed', { error: err.message }))

    return {
      success: true,
      receiptData: receiptPayload,
      saleId: receiptPayload.id,
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    timing.logFailure({
      saleId: resolvedSaleId,
      branchId: resolvedBranchId,
      itemCount: request.items.length,
      customerType,
    })
    logger.error('[completePaymentAction] Unhandled error', { error: errorMsg })
    return {
      success: false,
      error: `Failed at: UNKNOWN STAGE - ${errorMsg}`
    }
  }
}
