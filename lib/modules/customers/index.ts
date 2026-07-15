/**
 * Customers Module — Public API
 *
 * Handles customer profiles, loyalty, credit.
 * Other modules should ONLY import from this file.
 *
 * Implementation: Delegates to lib/customers-actions.ts and lib/loyalty-actions.ts.
 */

import { logger } from '@/lib/logger'
import { getCustomerById, getCustomers as realGetCustomers, getCustomersWithStats as realGetCustomersWithStats, updateCustomer as realUpdateCustomer, createCustomer as realCreateCustomer } from '@/lib/customers-actions'
import { awardLoyaltyPoints as realAwardLoyaltyPoints, redeemLoyaltyPoints as realRedeemLoyaltyPoints, getLoyaltyHistory as realGetLoyaltyHistory, getRedemptionEligibility as realGetRedemptionEligibility, getLoyaltySettings as realGetLoyaltySettings, updateLoyaltySettings as realUpdateLoyaltySettings } from '@/lib/loyalty-actions'
import type { LoyaltySettings } from '@/lib/loyalty-actions'
import type { CustomerWithStats as CustomerWithStatsType, Customer as _CustomerRow } from '@/lib/customers-actions'
import { customerRepo } from './repository'

// ─── Type helpers ─────────────────────────────────────────────────────────────
type CustomerWithStatsResult = Awaited<ReturnType<typeof getCustomerById>>
type LoyaltyHistoryRow = Awaited<ReturnType<typeof realGetLoyaltyHistory>>[number]
type RedemptionEligibilityResult = Awaited<ReturnType<typeof realGetRedemptionEligibility>>

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Customer {
  id: string
  name: string
  phone: string | null
  email: string | null
  type: string
  loyalty_points: number | null
  credit_limit: number | null
  credit_balance: number | null
  created_at: string
  updated_at: string
  tier: string | null
  birthday: string | null
  total_lifetime_spend_cents: number | null
  total_visits: number | null
  last_purchase_date: string | null
  notes: string | null
  tags: string[] | null
}

export interface LoyaltyTransaction {
  id: string
  customer_id: string
  type: string
  sale_id: string | null
  points_delta: number
  balance_before: number
  balance_after: number
  reason: string | null
  branch_id: string
  created_by: string | null
  created_at: string
}

// ─── Events Emitted ─────────────────────────────────────────────────────────

export const CUSTOMER_EVENTS = {
  CREATED: 'customer.created',
  UPDATED: 'customer.updated',
  TIER_CHANGED: 'customer.tier_changed',
} as const

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Get customer by ID.
 * Delegates to getCustomerById in lib/customers-actions.ts.
 */
export async function getCustomer(customerId: string): Promise<Customer | null> {
  try {
    const result = await getCustomerById(customerId)
    if (!result) return null
    return result as unknown as Customer
  } catch (error) {
    logger.error('[Customers Module] getCustomer failed', error instanceof Error ? error.message : String(error))
    return null
  }
}

/**
 * Get customers with filters.
 * Delegates to getCustomers in lib/customers-actions.ts (supports limit).
 */
export async function getCustomers(filters: {
  search?: string
  type?: string
  tier?: string
  branch_id?: string
  limit?: number
  offset?: number
}): Promise<{ data: Customer[]; total: number }> {
  try {
    const limit = filters.limit || 100
    const result = await realGetCustomers(limit)
    if (!Array.isArray(result)) return { data: [], total: 0 }
    let customers = [...result] as unknown as Customer[]
    // Apply client-side search filter if provided
    if (filters.search) {
      const q = filters.search.toLowerCase()
      customers = customers.filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          c.phone?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q)
      )
    }
    // Apply type filter
    if (filters.type) {
      customers = customers.filter((c) => c.type === filters.type)
    }
    return { data: customers, total: customers.length }
  } catch (error) {
    logger.error('[Customers Module] getCustomers failed', error instanceof Error ? error.message : String(error))
    return { data: [], total: 0 }
  }
}

// ─── Backward-Compatible Re-exports ──────────────────────────────────────────

export { searchCustomers } from '@/lib/customers-actions'
export { getCustomerById } from '@/lib/customers-actions'
export { getCustomerPurchases } from '@/lib/customers-actions'
export type { CustomerWithStats, CustomerFormData, Customer as CustomerRow } from '@/lib/customers-actions'

/** Backward-compat: matches original customers-actions.getCustomers signature */
export async function getCustomersLegacy(limit = 100): Promise<_CustomerRow[]> {
  try {
    const raw = await realGetCustomers(limit)
    return (raw || []) as unknown as _CustomerRow[]
  } catch (error) {
    logger.error('[Customers Module] getCustomersLegacy failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

// ─── Loyalty Type Re-exports ──────────────────────────────────────────────────

export type { LoyaltySettings } from '@/lib/loyalty-actions'

/** Backward-compat: matches original customers-actions.getCustomersWithStats */
export async function getCustomersWithStatsLegacy(): Promise<CustomerWithStatsType[]> {
  try {
    const result = await realGetCustomersWithStats()
    return (result || []) as unknown as CustomerWithStatsType[]
  } catch (error) {
    logger.error('[Customers Module] getCustomersWithStatsLegacy failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

/**
 * Award loyalty points.
 * Delegates to awardLoyaltyPoints in lib/loyalty-actions.ts.
 * Emits: customer.tier_changed (if tier changes)
 *
 * Note: real implementation requires sale amounts; pass 0 for amount if unknown.
 */
export async function awardLoyaltyPoints(
  customerId: string,
  points: number,
  saleId: string,
  branchId: string
): Promise<{ success: boolean; new_balance?: number; error?: string }> {
  try {
    // The real awardLoyaltyPoints calculates points from sale amount, not a points parameter.
    // We pass points as saleAmountCents (approximation) so the real function can compute.
    // For direct points control, use lib/loyalty-actions.ts directly.
    const cashierId = 'module'
    const result = await realAwardLoyaltyPoints(
      customerId,
      saleId,
      points, // used as saleAmountCents
      0, // discountAmountCents
      branchId,
      cashierId
    )
    if (!result) return { success: false, error: 'Failed to award points' }
    return { success: true, new_balance: result.newBalance }
  } catch (error) {
    logger.error('[Customers Module] awardLoyaltyPoints failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

/**
 * Redeem loyalty points.
 * Delegates to redeemLoyaltyPoints in lib/loyalty-actions.ts.
 */
export async function redeemLoyaltyPoints(
  customerId: string,
  points: number,
  branchId: string
): Promise<{ success: boolean; new_balance?: number; error?: string }> {
  try {
    const cashierId = 'module'
    const result = await realRedeemLoyaltyPoints(
      customerId,
      '',
      points,
      0, // discountAppliedCents
      branchId,
      cashierId
    )
    if (!result) return { success: false, error: 'Failed to redeem points' }
    return { success: true, new_balance: result.newBalance }
  } catch (error) {
    logger.error('[Customers Module] redeemLoyaltyPoints failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

/**
 * Get customer loyalty balance.
 * Queries customers table for current points + tier,
 * and loyalty_transactions for lifetime earned points.
 */
export async function getLoyaltyBalance(customerId: string): Promise<{
  points: number
  tier: string
  lifetime_points: number
}> {
  try {
    return await customerRepo.getLoyaltyBalance(customerId)
  } catch (error) {
    logger.error('[Customers Module] getLoyaltyBalance failed', error instanceof Error ? error.message : String(error))
    return { points: 0, tier: 'bronze', lifetime_points: 0 }
  }
}

// ─── Extended API ────────────────────────────────────────────────────────────

/**
 * Get customer by ID with purchase statistics.
 * Delegates to getCustomerById in lib/customers-actions.ts.
 */
export async function getCustomerWithStats(customerId: string): Promise<CustomerWithStatsResult> {
  try {
    const result = await getCustomerById(customerId)
    if (!result) return null
    return result as unknown as CustomerWithStatsResult
  } catch (error) {
    logger.error('[Customers Module] getCustomerWithStats failed', error instanceof Error ? error.message : String(error))
    return null
  }
}

/**
 * Get all customers with purchase statistics.
 * Delegates to getCustomersWithStats in lib/customers-actions.ts.
 */
export async function getCustomersWithStats(limit?: number): Promise<CustomerWithStatsType[]> {
  try {
    const result = await realGetCustomersWithStats()
    if (!Array.isArray(result)) return []
    const customers = result as unknown as CustomerWithStatsType[]
    return limit ? customers.slice(0, limit) : customers
  } catch (error) {
    logger.error('[Customers Module] getCustomersWithStats failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

/**
 * Get loyalty transaction history for a customer.
 * Delegates to getLoyaltyHistory in lib/loyalty-actions.ts.
 */
export async function getLoyaltyHistory(customerId: string): Promise<LoyaltyHistoryRow[]> {
  try {
    const result = await realGetLoyaltyHistory(customerId)
    return (result as unknown as LoyaltyHistoryRow[]) || []
  } catch (error) {
    logger.error('[Customers Module] getLoyaltyHistory failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

/**
 * Check redemption eligibility for a customer at a given sale total.
 * Delegates to getRedemptionEligibility in lib/loyalty-actions.ts.
 */
export async function getRedemptionEligibility(customerId: string, amountCents: number): Promise<RedemptionEligibilityResult> {
  try {
    const result = await realGetRedemptionEligibility(customerId, amountCents)
    if (!result) return null
    return result as unknown as RedemptionEligibilityResult
  } catch (error) {
    logger.error('[Customers Module] getRedemptionEligibility failed', error instanceof Error ? error.message : String(error))
    return null
  }
}

/**
 * Get loyalty program settings.
 * Delegates to getLoyaltySettings in lib/loyalty-actions.ts.
 */
export async function getLoyaltySettings(): Promise<LoyaltySettings | null> {
  try {
    const result = await realGetLoyaltySettings()
    if (!result) return null
    return result as unknown as LoyaltySettings | null
  } catch (error) {
    logger.error('[Customers Module] getLoyaltySettings failed', error instanceof Error ? error.message : String(error))
    return null
  }
}

/**
 * Update loyalty program settings.
 * Delegates to updateLoyaltySettings in lib/loyalty-actions.ts.
 * Note: The underlying action requires owner/admin authorization.
 */
export async function updateLoyaltySettings(settings: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await realUpdateLoyaltySettings('', '', settings as Partial<LoyaltySettings>)
    if (!result) return { success: false, error: 'Failed to update loyalty settings' }
    return { success: true }
  } catch (error) {
    logger.error('[Customers Module] updateLoyaltySettings failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

/**
 * Update an existing customer.
 * Delegates to updateCustomer in lib/customers-actions.ts.
 */
export async function updateCustomer(customerId: string, data: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await realUpdateCustomer(customerId, data as Parameters<typeof realUpdateCustomer>[1])
    if (!result.success) return { success: false, error: (result as { error?: string }).error || 'Failed to update customer' }
    return { success: true }
  } catch (error) {
    logger.error('[Customers Module] updateCustomer failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

/**
 * Create a new customer.
 * Delegates to createCustomer in lib/customers-actions.ts.
 */
export async function createCustomer(data: Record<string, unknown>): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const result = await realCreateCustomer(
      data.name as string,
      (data.type as 'retail' | 'wholesale' | 'business') || 'retail',
      data.phone as string | undefined,
      data.email as string | undefined,
      (data.credit_limit as number) || 0,
      {
        tier: data.tier as 'bronze' | 'silver' | 'gold' | 'platinum' | 'vip' | undefined,
        birthday: data.birthday as string | null | undefined,
        notes: data.notes as string | null | undefined,
        tags: data.tags as string[] | undefined,
      }
    )
    const typedResult = result as { success: boolean; error?: string; customer?: { id: string } }
    if (!typedResult.success) return { success: false, error: typedResult.error || 'Failed to create customer' }
    return { success: true, id: typedResult.customer?.id }
  } catch (error) {
    logger.error('[Customers Module] createCustomer failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Loyalty reverse/restore re-exports (for sales-actions and other internal callers) ──
export { reverseLoyaltyPoints, restoreRedeemedPoints } from '@/lib/loyalty-actions'
