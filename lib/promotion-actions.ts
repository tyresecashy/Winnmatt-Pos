'use server'

import { logger } from '@/lib/logger'
import { authenticateServerAction } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'

// ─── Types ──────────────────────────────────────────────────────────────────

export type PromotionType = 'fixed_amount' | 'percentage' | 'bonus_points'
export type PromotionScope = 'cart' | 'product' | 'category'

export interface Promotion {
  id: string
  name: string
  description: string | null
  type: PromotionType
  value: number
  scope: PromotionScope
  applicable_product_ids: string[]
  applicable_category_ids: string[]
  min_purchase_cents: number
  max_discount_cents: number
  start_date: string | null
  end_date: string | null
  is_active: boolean
  auto_apply: boolean
  stackable: boolean
  requires_coupon: boolean
  bonus_multiplier: number
  usage_limit: number
  current_usage: number
  created_at: string
  updated_at: string
}

export interface PromotionCoupon {
  id: string
  promotion_id: string
  code: string
  usage_limit: number | null
  current_usage: number | null
  is_active: boolean | null
  created_at: string | null
}

export interface PromotionWithCoupons extends Promotion {
  coupons: PromotionCoupon[]
}

// ─── CRUD: Promotions ───────────────────────────────────────────────────────

export async function getPromotions(): Promise<Promotion[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('promotions')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data || []) as unknown as Promotion[]
  } catch (error) {
    logger.error('[PROMO] Failed to fetch promotions:', error)
    return []
  }
}

export async function getPromotionById(id: string): Promise<PromotionWithCoupons | null> {
  try {
    const { data: promotion, error: promoError } = await supabaseAdmin
      .from('promotions')
      .select('*')
      .eq('id', id)
      .single()

    if (promoError) throw promoError

    const { data: coupons } = await supabaseAdmin
      .from('promotion_coupons')
      .select('*')
      .eq('promotion_id', id)
      .order('created_at', { ascending: true })

    return { ...(promotion as unknown as Omit<PromotionWithCoupons, 'coupons'>), coupons: (coupons || []) as unknown as PromotionWithCoupons['coupons'] }
  } catch (error) {
    logger.error('[PROMO] Failed to fetch promotion:', error)
    return null
  }
}

export async function createPromotion(
  data: Omit<Promotion, 'id' | 'current_usage' | 'created_at' | 'updated_at'>
): Promise<Promotion | null> {
  try {
    const authResult = await authenticateServerAction()
    if (!authResult.success || !['super_admin', 'admin'].includes(authResult.profile?.role || '')) {
      throw new Error('Unauthorized')
    }

    const { data: promo, error } = await supabaseAdmin
      .from('promotions')
      .insert(data)
      .select()
      .single()

    if (error) throw error
    return promo as unknown as Promotion
  } catch (error) {
    logger.error('[PROMO] Failed to create promotion:', error)
    return null
  }
}

export async function updatePromotion(
  id: string,
  updates: Partial<Omit<Promotion, 'id' | 'current_usage' | 'created_at' | 'updated_at'>>
): Promise<Promotion | null> {
  try {
    const authResult = await authenticateServerAction()
    if (!authResult.success || !['super_admin', 'admin'].includes(authResult.profile?.role || '')) {
      throw new Error('Unauthorized')
    }

    const { data, error } = await supabaseAdmin
      .from('promotions')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data as unknown as Promotion
  } catch (error) {
    logger.error('[PROMO] Failed to update promotion:', error)
    return null
  }
}

export async function deletePromotion(id: string): Promise<boolean> {
  try {
    const authResult = await authenticateServerAction()
    if (!authResult.success || !['super_admin', 'admin'].includes(authResult.profile?.role || '')) {
      throw new Error('Unauthorized')
    }

    const { error } = await supabaseAdmin
      .from('promotions')
      .delete()
      .eq('id', id)

    if (error) throw error
    return true
  } catch (error) {
    logger.error('[PROMO] Failed to delete promotion:', error)
    return false
  }
}

// ─── CRUD: Coupons ──────────────────────────────────────────────────────────

export async function getCouponsForPromotion(promotionId: string): Promise<PromotionCoupon[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('promotion_coupons')
      .select('*')
      .eq('promotion_id', promotionId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return data || []
  } catch (error) {
    logger.error('[PROMO] Failed to fetch coupons:', error)
    return []
  }
}

export async function createCoupon(
  promotionId: string,
  code: string,
  usageLimit: number = 0
): Promise<PromotionCoupon | null> {
  try {
    const authResult = await authenticateServerAction()
    if (!authResult.success || !['super_admin', 'admin'].includes(authResult.profile?.role || '')) {
      throw new Error('Unauthorized')
    }

    const { data, error } = await supabaseAdmin
      .from('promotion_coupons')
      .insert({
        promotion_id: promotionId,
        code: code.toUpperCase().replace(/\s+/g, ''),
        usage_limit: usageLimit,
      })
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    logger.error('[PROMO] Failed to create coupon:', error)
    return null
  }
}

export async function deleteCoupon(id: string): Promise<boolean> {
  try {
    const authResult = await authenticateServerAction()
    if (!authResult.success || !['super_admin', 'admin'].includes(authResult.profile?.role || '')) {
      throw new Error('Unauthorized')
    }

    const { error } = await supabaseAdmin
      .from('promotion_coupons')
      .delete()
      .eq('id', id)

    if (error) throw error
    return true
  } catch (error) {
    logger.error('[PROMO] Failed to delete coupon:', error)
    return false
  }
}

// ─── POS Validation ─────────────────────────────────────────────────────────

export interface ValidatedPromotion {
  promotion: Promotion
  discountCents: number
  couponCode?: string
}

/**
 * Get auto-apply promotions that match the current cart.
 */
export async function getAutoApplyPromotions(
  cartTotalCents: number,
  cartItemCategoryIds: string[]
): Promise<Promotion[]> {
  try {
    const now = new Date().toISOString()

    const { data, error } = await supabaseAdmin
      .from('promotions')
      .select('*')
      .eq('is_active', true)
      .eq('auto_apply', true)
      .eq('requires_coupon', false)
      .lte('start_date', now)
      .gte('end_date', now)
      .order('value', { ascending: false })

    if (error) throw error

    const promotions = ((data || []) as unknown as Promotion[]).filter((p: Promotion) => {
      // Check min purchase
      if (p.min_purchase_cents > 0 && cartTotalCents < p.min_purchase_cents) return false

      // Check usage limit
      if (p.usage_limit > 0 && p.current_usage >= p.usage_limit) return false

      // Check scope
      if (p.scope === 'category' && p.applicable_category_ids.length > 0) {
        const matches = p.applicable_category_ids.some((catId) =>
          cartItemCategoryIds.includes(catId)
        )
        if (!matches) return false
      }

      return true
    })

    return promotions
  } catch (error) {
    logger.error('[PROMO] Failed to get auto-apply promotions:', error)
    return []
  }
}

/**
 * Validate a coupon code and return the matching promotion + calculated discount.
 */
export async function validateCoupon(
  code: string,
  cartTotalCents: number
): Promise<{ valid: boolean; error?: string; validated?: ValidatedPromotion }> {
  try {
    const normalizedCode = code.toUpperCase().trim()

    // Look up coupon
    const { data: coupon, error: couponError } = await supabaseAdmin
      .from('promotion_coupons')
      .select('*')
      .eq('code', normalizedCode)
      .maybeSingle()

    if (couponError) throw couponError
    if (!coupon) return { valid: false, error: 'Coupon not found' }

    if (!coupon.is_active) return { valid: false, error: 'Coupon is inactive' }

    // Check coupon usage limit
    if ((coupon.usage_limit ?? 0) > 0 && (coupon.current_usage ?? 0) >= (coupon.usage_limit ?? 0)) {
      return { valid: false, error: 'Coupon has reached its usage limit' }
    }

    // Fetch the promotion
    const promo = await getPromotionById(coupon.promotion_id)
    if (!promo) return { valid: false, error: 'Promotion not found' }

    if (!promo.is_active) return { valid: false, error: 'Promotion is not active' }

    // Check date range
    const now = new Date()
    if (promo.start_date && new Date(promo.start_date) > now) {
      return { valid: false, error: 'Promotion has not started yet' }
    }
    if (promo.end_date && new Date(promo.end_date) < now) {
      return { valid: false, error: 'Promotion has expired' }
    }

    // Check usage limit
    if (promo.usage_limit > 0 && promo.current_usage >= promo.usage_limit) {
      return { valid: false, error: 'Promotion has reached its usage limit' }
    }

    // Check min purchase
    if (promo.min_purchase_cents > 0 && cartTotalCents < promo.min_purchase_cents) {
      return {
        valid: false,
        error: `Minimum purchase of KSh ${promo.min_purchase_cents.toLocaleString()} required`,
      }
    }

    // Calculate discount
    let discountCents = 0
    if (promo.type === 'percentage') {
      discountCents = Math.round(cartTotalCents * (promo.value / 100))
    } else if (promo.type === 'fixed_amount') {
      discountCents = Math.round(promo.value) // value is in KES
    }

    // Apply max discount cap
    if (promo.max_discount_cents > 0 && discountCents > promo.max_discount_cents) {
      discountCents = promo.max_discount_cents
    }

    return {
      valid: true,
      validated: {
        promotion: promo,
        discountCents,
        couponCode: normalizedCode,
      },
    }
  } catch (error) {
    logger.error('[PROMO] Failed to validate coupon:', error)
    return { valid: false, error: 'Failed to validate coupon' }
  }
}

/**
 * Record that a promotion was used on a sale (increments usage counters).
 */
export async function applyPromotionToSale(
  promotionId: string,
  saleId: string,
  discountCents: number,
  couponCode?: string,
  bonusMultiplier?: number
): Promise<boolean> {
  try {
    // Find coupon if code provided
    let couponId: string | null = null
    if (couponCode) {
      const { data: coupon } = await supabaseAdmin
        .from('promotion_coupons')
        .select('id, current_usage')
        .eq('code', couponCode.toUpperCase().trim())
        .maybeSingle()

      if (coupon) {
        couponId = coupon.id

        // Increment coupon usage atomically
        const { error: couponIncErr } = await supabaseAdmin
          .from('promotion_coupons')
          .update({ current_usage: (coupon.current_usage ?? 0) + 1 })
          .eq('id', coupon.id)
        if (couponIncErr) {
          logger.warn('[PROMO] Failed to increment coupon usage:', { error: couponIncErr.message })
        }
      }
    }

    // Log usage
    const { error: logError } = await supabaseAdmin
      .from('promotion_usage_log')
      .insert({
        promotion_id: promotionId,
        coupon_id: couponId,
        sale_id: saleId,
        discount_cents: discountCents,
        bonus_multiplier_applied: bonusMultiplier || null,
      })

    if (logError) throw logError

    // Increment promotion usage counter atomically
    // Fetch current usage first for safe non-SQL-injection update
    const { data: promo } = await supabaseAdmin
      .from('promotions')
      .select('current_usage')
      .eq('id', promotionId)
      .maybeSingle()
    const { error: promoIncErr } = await supabaseAdmin
      .from('promotions')
      .update({ current_usage: (promo?.current_usage ?? 0) + 1 })
      .eq('id', promotionId)
    if (promoIncErr) {
      logger.warn('[PROMO] Failed to increment promotion usage:', { error: promoIncErr.message })
    }

    return true
  } catch (error) {
    logger.error('[PROMO] Failed to apply promotion:', error)
    return false
  }
}
