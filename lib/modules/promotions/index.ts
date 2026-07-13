/**
 * Promotions Module — Public API
 *
 * Manages promotions, coupons, and discount validation.
 * Other modules should ONLY import from this file.
 *
 * Implementation: Delegates to lib/promotion-actions.ts.
 */

import { logger } from '@/lib/logger'
import * as promotionActions from '@/lib/promotion-actions'

// ─── Type helpers ─────────────────────────────────────────────────────────────
type PromotionRow = Awaited<ReturnType<typeof promotionActions.getPromotions>>[number]
type PromotionDetail = Awaited<ReturnType<typeof promotionActions.getPromotionById>>
type CouponRow = Awaited<ReturnType<typeof promotionActions.getCouponsForPromotion>>[number]
type AutoApplyPromotionRow = Awaited<ReturnType<typeof promotionActions.getAutoApplyPromotions>>[number]
type ValidatedCoupon = Awaited<ReturnType<typeof promotionActions.validateCoupon>>

// ─── Public API ─────────────────────────────────────────────────────────────

export async function getPromotions(): Promise<PromotionRow[]> {
  try {
    return await promotionActions.getPromotions()
  } catch (error) {
    logger.error('[Promotions Module] getPromotions failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function getPromotionById(id: string): Promise<PromotionDetail> {
  try {
    return await promotionActions.getPromotionById(id)
  } catch (error) {
    logger.error('[Promotions Module] getPromotionById failed', error instanceof Error ? error.message : String(error))
    return null
  }
}

export async function createPromotion(data: Record<string, unknown>): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const result = await promotionActions.createPromotion(data as Parameters<typeof promotionActions.createPromotion>[0])
    if (result) return { success: true, id: result.id }
    return { success: false, error: 'Failed to create promotion' }
  } catch (error) {
    logger.error('[Promotions Module] createPromotion failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function updatePromotion(id: string, data: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await promotionActions.updatePromotion(id, data as Parameters<typeof promotionActions.updatePromotion>[1])
    if (result) return { success: true }
    return { success: false, error: 'Failed to update promotion' }
  } catch (error) {
    logger.error('[Promotions Module] updatePromotion failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function deletePromotion(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await promotionActions.deletePromotion(id)
    if (result) return { success: true }
    return { success: false, error: 'Failed to delete promotion' }
  } catch (error) {
    logger.error('[Promotions Module] deletePromotion failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function getCouponsForPromotion(promotionId: string): Promise<CouponRow[]> {
  try {
    return await promotionActions.getCouponsForPromotion(promotionId)
  } catch (error) {
    logger.error('[Promotions Module] getCouponsForPromotion failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function createCoupon(promotionId: string, code: string, usageLimit: number = 0): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const result = await promotionActions.createCoupon(promotionId, code, usageLimit)
    if (result) return { success: true, id: result.id }
    return { success: false, error: 'Failed to create coupon' }
  } catch (error) {
    logger.error('[Promotions Module] createCoupon failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function deleteCoupon(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await promotionActions.deleteCoupon(id)
    if (result) return { success: true }
    return { success: false, error: 'Failed to delete coupon' }
  } catch (error) {
    logger.error('[Promotions Module] deleteCoupon failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function getAutoApplyPromotions(cartTotalCents: number, cartItemCategoryIds: string[]): Promise<AutoApplyPromotionRow[]> {
  try {
    return await promotionActions.getAutoApplyPromotions(cartTotalCents, cartItemCategoryIds)
  } catch (error) {
    logger.error('[Promotions Module] getAutoApplyPromotions failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function validateCoupon(code: string, cartTotalCents: number): Promise<ValidatedCoupon> {
  try {
    return await promotionActions.validateCoupon(code, cartTotalCents)
  } catch (error) {
    logger.error('[Promotions Module] validateCoupon failed', error instanceof Error ? error.message : String(error))
    return { valid: false, error: 'Failed to validate coupon' }
  }
}

export async function applyPromotionToSale(promotionId: string, saleId: string, discountCents: number, couponCode?: string, bonusMultiplier?: number): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await promotionActions.applyPromotionToSale(promotionId, saleId, discountCents, couponCode, bonusMultiplier)
    if (result) return { success: true }
    return { success: false, error: 'Failed to apply promotion' }
  } catch (error) {
    logger.error('[Promotions Module] applyPromotionToSale failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Backward-Compatible Type Re-exports ─────────────────────────────────────
export type { Promotion, PromotionCoupon, PromotionType, PromotionScope, ValidatedPromotion } from '@/lib/promotion-actions'
