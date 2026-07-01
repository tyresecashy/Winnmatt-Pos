'use server'

import { createCashSaveTimingTracker } from '@/lib/cash-save-timing'
import type { SaleItem, SaleReceiptSeed } from '@/lib/sales-actions'
import type { SaleDetailsData } from '@/components/receipt-preview'
import {
  getAuthenticatedServerActionUser,
  loadCheckoutUserProfileResult,
  authorizePOSProfile,
  resolveAuthorizedBranchId,
} from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getRedemptionEligibility, redeemLoyaltyPoints } from '@/lib/loyalty-actions'
import { buildReceiptPayload } from '@/lib/receipt-builder'
import { createSaleWithContext, getSaleByIdForAuthorizedContext } from '@/lib/sales-actions'

interface CreateSaleResult {
  success: boolean
  sale?: { id: string }
  receiptNumber?: string
  receiptSeed?: SaleReceiptSeed
  loyaltyAward?: { pointsAwarded: number; newBalance: number } | null
  error?: string
}

// Full sale record used to build receipt payload - shape matches the return of buildReceiptSaleFromSeed and getSaleByIdForAuthorizedContext

export interface CompletePaymentRequest {
  branchId: string
  cashierId: string
  items: SaleItem[]
  paymentMethod: 'cash' | 'card' | 'bank_transfer' | 'cheque' | 'credit'
  customerId?: string
  cartDiscount: number
  receiptSettings: Record<string, unknown>
  redemptionPoints?: number
  redemptionDiscount?: number
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
) {
  const branchPromise =
    profile?.branch?.id === effectiveBranchId && profile.branch?.name && profile.branch?.code
      ? Promise.resolve(profile.branch)
      : supabaseAdmin
          .from('branches')
          .select('id, name, code')
          .eq('id', effectiveBranchId)
          .single()
          .then(({ data, error }) => {
            if (error) throw new Error(`Failed to load branch for receipt: ${error.message}`)
            return data
          })

  const customerPromise = customerId
    ? supabaseAdmin
        .from('customers')
        .select('id, name, phone, loyalty_points')
        .eq('id', customerId)
        .single()
        .then(({ data, error }) => {
          if (error) throw new Error(`Failed to load customer for receipt: ${error.message}`)
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
    branch,
    cashier: {
      id: profile?.id,
      full_name: profile?.full_name,
    },
    customer,
    items: receiptSeed.items,
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
export async function completePaymentAction(
  request: CompletePaymentRequest
): Promise<CompletePaymentResponse> {
  const timing = createCashSaveTimingTracker(
    'complete_payment_action',
    request.paymentMethod === 'cash'
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
        console.warn('[completePaymentAction] Ignoring mismatched client branch id', {
          userId: profile.id,
          requestedBranchId: request.branchId,
          authenticatedBranchId: effectiveBranchId,
        })
      }

      if (request.cashierId && request.cashierId !== profile.id) {
        console.warn('[completePaymentAction] Ignoring mismatched client cashier id', {
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
        if (request.paymentMethod !== 'cash') {
          throw new Error('Failed at: VALIDATION - Loyalty redemption is only available for cash sales')
        }

        if (!request.customerId) {
          throw new Error('Failed at: VALIDATION - Only named customers can redeem loyalty points')
        }

        const requestedPoints = Math.floor(request.redemptionPoints || 0)
        const eligibility = await getRedemptionEligibility(
          request.customerId,
          Math.round(saleTotalBeforeRedemption * 100)
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
          (requestedPoints * eligibility.redeemValueCents) / 100
        )
        const maxRedeemableDiscountKSh = Math.round(
          eligibility.maxRedeemableDiscount / 100
        )

        if (expectedDiscount > maxRedeemableDiscountKSh) {
          throw new Error('Failed at: VALIDATION - Redemption value exceeds the allowed discount for this sale')
        }

        return {
          points: requestedPoints,
          discount: expectedDiscount,
          discountCents: Math.round(expectedDiscount * 100),
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

    let createResult: CreateSaleResult
    try {
      createResult = await timing.measure('create_sale_total', () =>
        createSaleWithContext(
          {
            branchId: effectiveBranchId,
            cashierId: profile.id,
          },
          request.items,
          request.paymentMethod,
          request.customerId,
          totalDiscountForSale,
          'POS Sale'
        )
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
        error: `Failed at: CREATE SALE - ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }

    if (!createResult || !createResult.success) {
      return {
        success: false,
        error: `Failed at: CREATE SALE - ${createResult?.error || 'Unknown error'}`
      }
    }

    if (!createResult.sale || !createResult.sale.id) {
      return {
        success: false,
        error: 'Failed at: CREATE SALE - No sale ID returned'
      }
    }

    const saleId = createResult.sale.id
    resolvedSaleId = saleId

    let redemptionResult:
      | {
          pointsRedeemed: number
          discountApplied: number
          newBalance: number
        }
      | null = null

    if (request.customerId && validatedRedemption && validatedRedemption.points > 0) {
      const redemptionCustomerId = request.customerId
      try {
        redemptionResult = await timing.measure('redemption_apply', () =>
          redeemLoyaltyPoints(
            redemptionCustomerId,
            saleId,
            validatedRedemption.points,
            validatedRedemption.discountCents,
            effectiveBranchId,
            profile.id,
            {
              currentBalance: validatedRedemption.currentBalance,
              skipSettingsCheck: true,
            }
          )
        )

        if (!redemptionResult) {
          console.warn('[completePaymentAction] Loyalty redemption did not complete', {
            customerId: redemptionCustomerId,
            saleId,
          })
        }
      } catch (error) {
        console.warn('[completePaymentAction] Loyalty redemption failed after sale save', {
          saleId,
          error: String(error),
        })
      }
    }

    let fullSale: any
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

        fullSale = await Promise.race([getSaleByIdPromise, timeoutPromise])
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

    return {
      success: true,
      receiptData: receiptPayload,
      saleId: receiptPayload.id
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    timing.logFailure({
      saleId: resolvedSaleId,
      branchId: resolvedBranchId,
      itemCount: request.items.length,
      customerType,
    })
    console.error('[completePaymentAction] Unhandled error', { error: errorMsg })
    return {
      success: false,
      error: `Failed at: UNKNOWN STAGE - ${errorMsg}`
    }
  }
}
