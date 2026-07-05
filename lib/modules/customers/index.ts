/**
 * Customers Module — Public API
 *
 * Handles customer profiles, loyalty, credit.
 * Other modules should ONLY import from this file.
 */

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
 */
export async function getCustomer(customerId: string): Promise<Customer | null> {
  throw new Error('Not implemented')
}

/**
 * Get customers with filters.
 */
export async function getCustomers(filters: {
  search?: string
  type?: string
  tier?: string
  branch_id?: string
  limit?: number
  offset?: number
}): Promise<{ data: Customer[]; total: number }> {
  throw new Error('Not implemented')
}

/**
 * Award loyalty points.
 * Emits: customer.tier_changed (if tier changes)
 */
export async function awardLoyaltyPoints(
  customerId: string,
  points: number,
  saleId: string,
  branchId: string
): Promise<{ success: boolean; new_balance?: number; error?: string }> {
  throw new Error('Not implemented')
}

/**
 * Redeem loyalty points.
 */
export async function redeemLoyaltyPoints(
  customerId: string,
  points: number,
  branchId: string
): Promise<{ success: boolean; new_balance?: number; error?: string }> {
  throw new Error('Not implemented')
}

/**
 * Get customer loyalty balance.
 */
export async function getLoyaltyBalance(customerId: string): Promise<{
  points: number
  tier: string
  lifetime_points: number
}> {
  throw new Error('Not implemented')
}
