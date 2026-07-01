'use server'

import { createCashSaveTimingTracker, isCashSaveTimingEnabled } from '@/lib/cash-save-timing'
import { supabaseAdmin } from '@/lib/supabase-server'
import type { LoyaltySettings, LoyaltyTransaction } from '@/lib/db.types'

const LOYALTY_SETTINGS_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'

/**
 * Get current loyalty configuration
 * 
 * @returns LoyaltySettings or null if fetch fails
 */
export async function getLoyaltySettings(): Promise<LoyaltySettings | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('loyalty_settings')
      .select('*')
      .eq('id', LOYALTY_SETTINGS_ID)
      .single()

    if (error) {
      console.error('[LOYALTY] Failed to fetch settings:', error)
      return null
    }

    return data as LoyaltySettings
  } catch (error) {
    console.error('[LOYALTY] Error fetching settings:', error)
    return null
  }
}

/**
 * Update loyalty settings (Owner only)
 * 
 * @param userId ID of the user making the change
 * @param userRole Role of the user (must be 'owner')
 * @param updates Partial settings object to update
 * @returns Updated LoyaltySettings or null on error
 */
export async function updateLoyaltySettings(
  userId: string,
  userRole: string,
  updates: Partial<LoyaltySettings>
): Promise<LoyaltySettings | null> {
  try {
    // Only owner can change loyalty rules
    if (userRole !== 'owner') {
      throw new Error('Unauthorized: Only owner can modify loyalty settings')
    }

    const { data, error } = await supabaseAdmin
      .from('loyalty_settings')
      .update({
        ...updates,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', LOYALTY_SETTINGS_ID)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update loyalty settings: ${error.message}`)
    }

    // Log the change to audit logs
    await supabaseAdmin.from('audit_logs').insert({
      actor_id: userId,
      action: 'update_loyalty_settings',
      resource_type: 'loyalty_settings',
      resource_id: LOYALTY_SETTINGS_ID,
      old_value: null, // Could be enhanced to fetch old value
      new_value: updates,
      details: `Updated loyalty settings: ${JSON.stringify(updates)}`,
    })

    console.log('[LOYALTY] Loyalty settings updated by', userId)
    return data as LoyaltySettings
  } catch (error) {
    console.error('[LOYALTY] Error updating settings:', error)
    return null
  }
}

/**
 * Award points from completed sale
 * 
 * Called from createSale() after payment_status='completed'
 * 
 * @param customerId UUID of the customer
 * @param saleId UUID of the sale
 * @param saleAmountCents Total sale amount in cents (before discount)
 * @param discountAmountCents Total discount amount in cents
 * @param branchId UUID of the branch
 * @param cashierId UUID of the cashier who completed the sale
 * @returns Object with pointsAwarded and newBalance, or null if loyalty disabled
 */
export async function awardLoyaltyPoints(
  customerId: string,
  saleId: string,
  saleAmountCents: number,
  discountAmountCents: number,
  branchId: string,
  cashierId: string
): Promise<{ pointsAwarded: number; newBalance: number } | null> {
  const timing = createCashSaveTimingTracker(
    'loyalty_award',
    isCashSaveTimingEnabled()
  )

  try {
    const settings = await timing.measure('settings_fetch', () => getLoyaltySettings())
    if (!settings || !settings.earn_enabled) {
      timing.logSuccess({
        saleId,
        branchId,
        customerId,
        customerType: 'named_customer',
      })
      return null
    }

    const { data: customer, error: fetchError } = await timing.measure(
      'customer_balance_fetch',
      async () =>
        await supabaseAdmin
          .from('customers')
          .select('loyalty_points')
          .eq('id', customerId)
          .single()
    )

    if (fetchError) {
      throw new Error(`Failed to fetch customer: ${fetchError.message}`)
    }

    const currentBalance = customer?.loyalty_points || 0

    // Check minimum basket threshold
    if (saleAmountCents < settings.earn_minimum_basket_cents) {
      timing.logSuccess({
        saleId,
        branchId,
        customerId,
        customerType: 'named_customer',
      })
      return { pointsAwarded: 0, newBalance: currentBalance }
    }

    // Determine earnable amount
    let earnableAmount = saleAmountCents
    if (!settings.earn_on_discounted && discountAmountCents > 0) {
      // Earn only on discounted price
      earnableAmount = saleAmountCents - discountAmountCents
    }
    // else: earn on full sale amount (default behavior)

    // Calculate points (integer division - loses fractional points)
    const pointsToAward = Math.floor(earnableAmount / settings.earn_threshold_cents)

    if (pointsToAward === 0) {
      timing.logSuccess({
        saleId,
        branchId,
        customerId,
        customerType: 'named_customer',
      })
      return { pointsAwarded: 0, newBalance: currentBalance }
    }

    const newBalance = currentBalance + pointsToAward

    const { error: updateError } = await timing.measure(
      'customer_balance_update',
      async () =>
        await supabaseAdmin
          .from('customers')
          .update({ loyalty_points: newBalance, updated_at: new Date().toISOString() })
          .eq('id', customerId)
    )

    if (updateError) {
      throw new Error(`Failed to update customer balance: ${updateError.message}`)
    }

    const { error: txError } = await timing.measure(
      'loyalty_transaction_insert',
      async () =>
        await supabaseAdmin
          .from('loyalty_transactions')
          .insert({
            customer_id: customerId,
            type: 'earn_sale',
            sale_id: saleId,
            points_delta: pointsToAward,
            balance_before: currentBalance,
            balance_after: newBalance,
            reason: `Earned ${pointsToAward} points from sale ${saleId}`,
            branch_id: branchId,
            created_by: cashierId,
          })
    )

    if (txError) {
      console.warn('[LOYALTY] Failed to record transaction:', txError)
      // Don't fail the sale if transaction logging fails
    }

    timing.logSuccess({
      saleId,
      branchId,
      customerId,
      customerType: 'named_customer',
    })
    return { pointsAwarded: pointsToAward, newBalance }
  } catch (error) {
    timing.logFailure({
      saleId,
      branchId,
      customerId,
      customerType: 'named_customer',
    })
    console.error('[LOYALTY] Loyalty award failure for completed sale', {
      customerId,
      saleId,
      saleAmountCents,
      discountAmountCents,
      error: error instanceof Error ? error.message : String(error),
    })
    console.error('[LOYALTY] Error awarding points:', error)
    return null
  }
}

/**
 * Reverse points when sale is voided
 * 
 * Called from voidSale() after sale is marked voided
 * 
 * @param saleId UUID of the sale being voided
 * @param customerId UUID of the customer
 * @param branchId UUID of the branch
 * @param voidingUserId UUID of the user voiding the sale
 * @returns Object with pointsReversed and newBalance, or null if no points to reverse
 */
export async function reverseLoyaltyPoints(
  saleId: string,
  customerId: string,
  branchId: string,
  voidingUserId: string
): Promise<{ pointsReversed: number; newBalance: number } | null> {
  try {
    // Find the earn transaction for this sale
    const { data: earnTx, error: txError } = await supabaseAdmin
      .from('loyalty_transactions')
      .select('*')
      .eq('sale_id', saleId)
      .eq('type', 'earn_sale')
      .single()

    if (txError || !earnTx) {
      console.log('[LOYALTY] No earn transaction found for sale', saleId)
      return null // No points were awarded for this sale
    }

    // Get current customer balance
    const { data: customer, error: fetchError } = await supabaseAdmin
      .from('customers')
      .select('loyalty_points')
      .eq('id', customerId)
      .single()

    if (fetchError) {
      throw new Error(`Failed to fetch customer: ${fetchError.message}`)
    }

    const currentBalance = customer?.loyalty_points || 0
    const pointsToReverse = (earnTx as any).points_delta

    // Ensure balance doesn't go negative (safety check)
    const newBalance = Math.max(0, currentBalance - pointsToReverse)

    // Update customer balance
    const { error: updateError } = await supabaseAdmin
      .from('customers')
      .update({ loyalty_points: newBalance, updated_at: new Date().toISOString() })
      .eq('id', customerId)

    if (updateError) {
      throw new Error(`Failed to update customer balance: ${updateError.message}`)
    }

    // Record reversal transaction
    const { error: reverseError } = await supabaseAdmin
      .from('loyalty_transactions')
      .insert({
        customer_id: customerId,
        type: 'reverse_void',
        sale_id: saleId,
        points_delta: -pointsToReverse,
        balance_before: currentBalance,
        balance_after: newBalance,
        reason: `Points reversed due to sale void by ${voidingUserId}`,
        branch_id: branchId,
        created_by: voidingUserId,
      })

    if (reverseError) {
      console.warn('[LOYALTY] Failed to record reversal:', reverseError)
    }

    console.log(`[LOYALTY] ⚠️  Reversed ${pointsToReverse} points for customer ${customerId}. New balance: ${newBalance}`)
    return { pointsReversed: pointsToReverse, newBalance }
  } catch (error) {
    console.error('[LOYALTY] Error reversing points:', error)
    return null
  }
}

/**
 * Get customer loyalty history
 * 
 * @param customerId UUID of the customer
 * @param limit Maximum number of transactions to return
 * @returns Array of LoyaltyTransaction records
 */
export async function getLoyaltyHistory(
  customerId: string,
  limit: number = 50
): Promise<LoyaltyTransaction[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('loyalty_transactions')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[LOYALTY] Failed to fetch history:', error)
      return []
    }

    return (data as LoyaltyTransaction[]) || []
  } catch (error) {
    console.error('[LOYALTY] Error fetching history:', error)
    return []
  }
}

/**
 * Get customer loyalty summary (balance + recent activity)
 * 
 * @param customerId UUID of the customer
 * @returns Object with balance, recent transactions, and total earned
 */
export async function getLoyaltySummary(customerId: string): Promise<{
  balance: number
  totalEarned: number
  recentTransactions: LoyaltyTransaction[]
} | null> {
  try {
    // Get customer balance
    const { data: customer, error: customerError } = await supabaseAdmin
      .from('customers')
      .select('loyalty_points')
      .eq('id', customerId)
      .single()

    if (customerError) {
      throw new Error(`Failed to fetch customer: ${customerError.message}`)
    }

    // Get recent transactions
    const { data: transactions, error: txError } = await supabaseAdmin
      .from('loyalty_transactions')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (txError) {
      console.warn('[LOYALTY] Failed to fetch transactions:', txError)
    }

    // Calculate total earned (sum of all earn_sale transactions)
    const totalEarned = (transactions || [])
      .filter((tx: any) => tx.type === 'earn_sale')
      .reduce((sum: number, tx: any) => sum + tx.points_delta, 0)

    return {
      balance: customer?.loyalty_points || 0,
      totalEarned,
      recentTransactions: (transactions as LoyaltyTransaction[]) || [],
    }
  } catch (error) {
    console.error('[LOYALTY] Error fetching summary:', error)
    return null
  }
}

/**
 * Get redemption eligibility and calculate maximum redeemable amount
 * 
 * @param customerId UUID of the customer
 * @param saleTotalCents Sale total in cents (after discounts applied)
 * @returns Object with eligible, maxRedeemablePoints, maxRedeemableDiscount, or null
 */
export async function getRedemptionEligibility(
  customerId: string,
  saleTotalCents: number
): Promise<{
  eligible: boolean
  reason?: string
  maxRedeemablePoints: number
  maxRedeemableDiscount: number
  currentBalance: number
  redeemValueCents: number
} | null> {
  const timing = createCashSaveTimingTracker(
    'loyalty_redemption_validation',
    isCashSaveTimingEnabled()
  )

  try {
    const settings = await timing.measure('settings_fetch', () => getLoyaltySettings())
    if (!settings || !settings.redeem_enabled) {
      timing.logSuccess({
        customerId,
        customerType: 'named_customer',
      })
      return {
        eligible: false,
        reason: 'Loyalty redemption is disabled',
        maxRedeemablePoints: 0,
        maxRedeemableDiscount: 0,
        currentBalance: 0,
        redeemValueCents: settings?.redeem_value_cents || 50,
      }
    }

    // Get customer balance
    const { data: customer, error: fetchError } = await timing.measure(
      'customer_balance_fetch',
      async () =>
        await supabaseAdmin
          .from('customers')
          .select('loyalty_points')
          .eq('id', customerId)
          .single()
    )

    if (fetchError || !customer) {
      timing.logSuccess({
        customerId,
        customerType: 'named_customer',
      })
      return {
        eligible: false,
        reason: 'Customer not found',
        maxRedeemablePoints: 0,
        maxRedeemableDiscount: 0,
        currentBalance: 0,
        redeemValueCents: settings.redeem_value_cents || 50,
      }
    }

    const currentBalance = customer.loyalty_points || 0

    // Check minimum points
    if (currentBalance < settings.redeem_minimum_points) {
      timing.logSuccess({
        customerId,
        customerType: 'named_customer',
      })
      return {
        eligible: false,
        reason: `Need at least ${settings.redeem_minimum_points} points to redeem`,
        maxRedeemablePoints: 0,
        maxRedeemableDiscount: 0,
        currentBalance,
        redeemValueCents: settings.redeem_value_cents || 50,
      }
    }

    // Check minimum basket
    if (saleTotalCents < settings.redeem_minimum_basket_cents) {
      timing.logSuccess({
        customerId,
        customerType: 'named_customer',
      })
      return {
        eligible: false,
        reason: `Minimum purchase of ${(settings.redeem_minimum_basket_cents / 100).toFixed(0)} KSh required for redemption`,
        maxRedeemablePoints: 0,
        maxRedeemableDiscount: 0,
        currentBalance,
        redeemValueCents: settings.redeem_value_cents || 50,
      }
    }

    // Calculate maximum by percentage cap
    const maxDiscountByCap = Math.floor(
      (saleTotalCents * settings.redeem_max_percent_per_sale) / 100
    )

    // Convert discount to max points
    const maxPointsByDiscount = Math.floor(
      maxDiscountByCap / (settings.redeem_value_cents || 1)
    )

    // Use whichever is lower: available points or max by percentage
    const maxRedeemablePoints = Math.min(currentBalance, maxPointsByDiscount)
    const maxRedeemableDiscount = maxRedeemablePoints * settings.redeem_value_cents

    const result = {
      eligible: maxRedeemablePoints > 0,
      maxRedeemablePoints,
      maxRedeemableDiscount,
      currentBalance,
      redeemValueCents: settings.redeem_value_cents || 50,
    }
    timing.logSuccess({
      customerId,
      customerType: 'named_customer',
    })
    return result
  } catch (error) {
    timing.logFailure({
      customerId,
      customerType: 'named_customer',
    })
    console.error('[LOYALTY] Error calculating redemption eligibility:', error)
    return null
  }
}

/**
 * Redeem loyalty points at checkout
 * 
 * Called from payment completion after sale is created
 * Points are deducted and discount is applied
 * 
 * @param customerId UUID of the customer
 * @param saleId UUID of the sale
 * @param pointsToRedeem Number of points to redeem
 * @param discountAppliedCents Actual discount in cents applied
 * @param branchId UUID of the branch
 * @param cashierId UUID of the cashier
 * @returns Object with pointsRedeemed, discountApplied, newBalance, or null
 */
export async function redeemLoyaltyPoints(
  customerId: string,
  saleId: string,
  pointsToRedeem: number,
  discountAppliedCents: number,
  branchId: string,
  cashierId: string,
  options?: {
    currentBalance?: number
    skipSettingsCheck?: boolean
  }
): Promise<{ pointsRedeemed: number; discountApplied: number; newBalance: number } | null> {
  const timing = createCashSaveTimingTracker(
    'loyalty_redeem',
    isCashSaveTimingEnabled()
  )

  try {
    if (pointsToRedeem <= 0) {
      timing.logSuccess({
        saleId,
        branchId,
        customerId,
        customerType: 'named_customer',
      })
      return null // No redemption
    }

    if (!options?.skipSettingsCheck) {
      const settings = await timing.measure('settings_fetch', () => getLoyaltySettings())
      if (!settings || !settings.redeem_enabled) {
        console.log('[LOYALTY] Redemption disabled, skipping')
        timing.logSuccess({
          saleId,
          branchId,
          customerId,
          customerType: 'named_customer',
        })
        return null
      }
    } else {
      timing.record('settings_fetch', 0)
    }

    let currentBalance = options?.currentBalance ?? null

    if (currentBalance === null) {
      const { data: customer, error: fetchError } = await timing.measure(
        'customer_balance_fetch',
        async () =>
          await supabaseAdmin
            .from('customers')
            .select('loyalty_points')
            .eq('id', customerId)
            .single()
      )

      if (fetchError) {
        throw new Error(`Failed to fetch customer: ${fetchError.message}`)
      }

      currentBalance = customer?.loyalty_points || 0
    } else {
      timing.record('customer_balance_fetch', 0)
    }

    // Validate redemption
    const resolvedCurrentBalance = currentBalance ?? 0

    if (pointsToRedeem > resolvedCurrentBalance) {
      throw new Error(`Insufficient points: have ${resolvedCurrentBalance}, trying to redeem ${pointsToRedeem}`)
    }

    const newBalance = resolvedCurrentBalance - pointsToRedeem

    // Update customer balance
    const { data: updatedCustomer, error: updateError } = await timing.measure(
      'customer_balance_update',
      async () =>
        await supabaseAdmin
          .from('customers')
          .update({ loyalty_points: newBalance, updated_at: new Date().toISOString() })
          .eq('id', customerId)
          .eq('loyalty_points', resolvedCurrentBalance)
          .select('id')
          .maybeSingle()
    )

    if (updateError) {
      throw new Error(`Failed to update customer balance: ${updateError.message}`)
    }

    if (!updatedCustomer) {
      throw new Error('Customer loyalty balance changed during redemption. Retry the sale.')
    }

    // Record redemption transaction
    const { error: txError } = await timing.measure(
      'loyalty_transaction_insert',
      async () =>
        await supabaseAdmin
          .from('loyalty_transactions')
          .insert({
            customer_id: customerId,
            type: 'redeem_sale',
            sale_id: saleId,
            points_delta: -pointsToRedeem, // Negative = deduction
            balance_before: resolvedCurrentBalance,
            balance_after: newBalance,
            reason: `Redeemed ${pointsToRedeem} points for ${(discountAppliedCents / 100).toFixed(0)} KSh discount on sale ${saleId}`,
            branch_id: branchId,
            created_by: cashierId,
          })
    )

    if (txError) {
      console.warn('[LOYALTY] Failed to record redemption transaction:', txError)
      // Don't fail the sale - but log for investigation
    }

    console.log(`[LOYALTY] ✅ Redeemed ${pointsToRedeem} points (${(discountAppliedCents / 100).toFixed(0)} KSh) for customer ${customerId}. New balance: ${newBalance}`)
    timing.logSuccess({
      saleId,
      branchId,
      customerId,
      customerType: 'named_customer',
    })
    return { pointsRedeemed: pointsToRedeem, discountApplied: discountAppliedCents, newBalance }
  } catch (error) {
    timing.logFailure({
      saleId,
      branchId,
      customerId,
      customerType: 'named_customer',
    })
    console.error('[LOYALTY] Error redeeming points:', error)
    return null
  }
}

/**
 * Restore redeemed points when a sale is voided
 * 
 * Called from voidSale() if sale had redemption
 * 
 * @param saleId UUID of the voided sale
 * @param customerId UUID of the customer
 * @param branchId UUID of the branch
 * @param voidingUserId UUID of the user voiding
 * @returns Object with pointsRestored and newBalance, or null
 */
export async function restoreRedeemedPoints(
  saleId: string,
  customerId: string,
  branchId: string,
  voidingUserId: string
): Promise<{ pointsRestored: number; newBalance: number } | null> {
  try {
    // Find the redemption transaction for this sale
    const { data: redeemTx, error: txError } = await supabaseAdmin
      .from('loyalty_transactions')
      .select('*')
      .eq('sale_id', saleId)
      .eq('type', 'redeem_sale')
      .single()

    if (txError || !redeemTx) {
      console.log('[LOYALTY] No redemption transaction found for sale', saleId)
      return null // No points were redeemed for this sale
    }

    // Get current customer balance
    const { data: customer, error: fetchError } = await supabaseAdmin
      .from('customers')
      .select('loyalty_points')
      .eq('id', customerId)
      .single()

    if (fetchError) {
      throw new Error(`Failed to fetch customer: ${fetchError.message}`)
    }

    const currentBalance = customer?.loyalty_points || 0
    const pointsToRestore = Math.abs((redeemTx as any).points_delta) // Convert neg to pos

    const newBalance = currentBalance + pointsToRestore

    // Update customer balance
    const { error: updateError } = await supabaseAdmin
      .from('customers')
      .update({ loyalty_points: newBalance, updated_at: new Date().toISOString() })
      .eq('id', customerId)

    if (updateError) {
      throw new Error(`Failed to update customer balance: ${updateError.message}`)
    }

    // Record restoration transaction
    const { error: reverseError } = await supabaseAdmin
      .from('loyalty_transactions')
      .insert({
        customer_id: customerId,
        type: 'reverse_redeem',
        sale_id: saleId,
        points_delta: pointsToRestore, // Positive = restoration
        balance_before: currentBalance,
        balance_after: newBalance,
        reason: `Restored ${pointsToRestore} redeemed points due to void of sale ${saleId}`,
        branch_id: branchId,
        created_by: voidingUserId,
      })

    if (reverseError) {
      console.warn('[LOYALTY] Failed to record restoration transaction:', reverseError)
      // Don't fail the void - but log for investigation
    }

    console.log(`[LOYALTY] ✅ Restored ${pointsToRestore} redeemed points to customer ${customerId}. New balance: ${newBalance}`)
    return { pointsRestored: pointsToRestore, newBalance }
  } catch (error) {
    console.error('[LOYALTY] Error restoring redeemed points:', error)
    return null
  }
}
