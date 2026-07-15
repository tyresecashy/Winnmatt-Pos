/**
 * Customer Repository — Enterprise Core Data Access for Customers
 *
 * Encapsulates ALL direct Supabase access for the customers table
 * and related read operations. Callers (module facade, server actions)
 * use this repository instead of calling supabase directly.
 *
 * Constitution Reference: §5 (Module Architecture), §9 (Transaction & Event Rules)
 */

import { BaseRepository } from '@/lib/modules/core/repository'
import type { PaginatedResult } from '@/lib/modules/core/repository'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CustomerRow {
  id: string
  name: string
  phone: string | null
  email: string | null
  type: string
  loyalty_points: number | null
  credit_limit: number | null
  credit_balance: number | null
  tier: string | null
  birthday: string | null
  total_lifetime_spend_cents: number | null
  total_visits: number | null
  last_purchase_date: string | null
  notes: string | null
  tags: string[] | null
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface CustomerWithDetails extends CustomerRow {
  total_purchases: number
  purchase_count: number
  last_visit: string | null
}

export interface CustomerPurchase {
  id: string
  receipt_number: string
  total_amount: number
  created_at: string
  sale_items: Array<{ quantity?: number }> | null
  item_count: number
}

export interface CustomerStats {
  total: number
  retail: number
  wholesale: number
  business: number
}

export interface LoyaltyBalance {
  points: number
  tier: string
  lifetime_points: number
}

export interface TopCustomer {
  id: string
  name: string
  phone: string | null
  email: string | null
  type: string
  total_purchases: number
  purchase_count: number
  last_visit: string | null
}

export interface CustomerRepositoryOptions {
  search?: string
  type?: string
  tier?: string
  branchId?: string
  limit?: number
  offset?: number
}

// ─── Repository ─────────────────────────────────────────────────────────────

export class CustomerRepository extends BaseRepository<CustomerRow> {
  constructor() {
    super('customers', {
      audit: { eventType: 'customer.*', aggregateType: 'customer' },
      lock: { resourcePrefix: 'customer:' },
    })
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Customer Lookup
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get a customer by ID with purchase statistics.
   * Queries customers table and aggregates from sales if possible.
   */
  async getCustomerWithDetails(customerId: string): Promise<CustomerWithDetails | null> {
    const { data: customer, error: customerError } = await this.client
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .maybeSingle()

    if (customerError) throw this._toError(customerError, 'getCustomerWithDetails')
    if (!customer) return null

    const raw = customer as CustomerRow

    // Try to get purchase stats via RPC
    try {
      const { data: stats } = await (this.client as unknown as { rpc: (fn: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> })
        .rpc('get_customer_stats', { p_customer_id: customerId })

      if (stats) {
        const statsArr = (stats as unknown) as Array<{
          total_purchases: number
          purchase_count: number
          last_visit: string | null
        }>
        return {
          ...raw,
          total_purchases: statsArr[0]?.total_purchases ?? 0,
          purchase_count: statsArr[0]?.purchase_count ?? 0,
          last_visit: statsArr[0]?.last_visit ?? null,
        }
      }
    } catch {
      // Stats RPC may not exist — return without stats
    }

    return {
      ...raw,
      total_purchases: 0,
      purchase_count: 0,
      last_visit: null,
    }
  }

  /**
   * Get customers with optional filtering, search, and pagination.
   * Supports client-side search/type filtering via the facade layer.
   */
  async getCustomers(options?: CustomerRepositoryOptions): Promise<CustomerRow[]> {
    let query = this.client
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })

    if (options?.type) {
      query = query.eq('type', options.type)
    }

    if (options?.tier) {
      query = query.eq('tier', options.tier)
    }

    if (options?.search) {
      const q = options.search
      query = query.or(
        `name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`,
      )
    }

    if (options?.limit) {
      query = query.limit(options.limit)
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit ?? 100) - 1)
    }

    const { data, error } = await query

    if (error) throw this._toError(error, 'getCustomers')
    return (data ?? []) as CustomerRow[]
  }

  /**
   * Get paginated customers with full count.
   */
  async getCustomersPaginated(
    options?: CustomerRepositoryOptions & { page?: number; pageSize?: number },
  ): Promise<PaginatedResult<CustomerRow>> {
    const page = options?.page ?? 1
    const pageSize = options?.pageSize ?? 50
    const offset = (page - 1) * pageSize

    let query = this.client
      .from('customers')
      .select('*', { count: 'exact', head: false })
      .order('created_at', { ascending: false })

    if (options?.type) query = query.eq('type', options.type)
    if (options?.tier) query = query.eq('tier', options.tier)

    if (options?.search) {
      const q = options.search
      query = query.or(
        `name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`,
      )
    }

    const { data, error, count } = await query.range(offset, offset + pageSize - 1)

    if (error) throw this._toError(error, 'getCustomersPaginated')
    return {
      data: (data ?? []) as CustomerRow[],
      total: count ?? 0,
      page,
      pageSize,
    }
  }

  /**
   * Search customers by name, phone, or email (ILIKE).
   * Returns limited results for POS/search UI.
   */
  async searchCustomers(query: string): Promise<CustomerRow[]> {
    if (!query?.trim()) return []

    const normalized = query.trim().replace(/\s+/g, ' ')

    const { data, error } = await this.client
      .from('customers')
      .select('id, name, phone, email, type, loyalty_points, tier, tags, birthday, updated_at, created_at')
      .or(
        `name.ilike.%${normalized}%,phone.ilike.%${normalized}%,email.ilike.%${normalized}%`,
      )
      .order('name', { ascending: true })
      .order('updated_at', { ascending: false })
      .limit(20)

    if (error) throw this._toError(error, 'searchCustomers')
    return (data ?? []) as CustomerRow[]
  }

  /**
   * Get customers filtered by type.
   */
  async getCustomersByType(type: string): Promise<CustomerRow[]> {
    const { data, error } = await this.client
      .from('customers')
      .select('*')
      .eq('type', type)
      .order('name')

    if (error) throw this._toError(error, 'getCustomersByType')
    return (data ?? []) as CustomerRow[]
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Customer Reports & Analytics
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get customers with purchase statistics.
   * Fetches all customers + aggregates from sales.
   */
  async getCustomersWithStats(): Promise<CustomerWithDetails[]> {
    // Get all customers
    const { data: customers, error: customersError } = await this.client
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })

    if (customersError) throw this._toError(customersError, 'getCustomersWithStats')

    const customerRows = (customers ?? []) as CustomerRow[]
    if (customerRows.length === 0) return []

    // Get aggregated stats from sales
    const { data: stats, error: statsError } = await this.client
      .from('sales')
      .select('customer_id, total_amount')

    if (statsError) {
      // Return customers without stats if sales table is unavailable
      return customerRows.map((c) => ({
        ...c,
        total_purchases: 0,
        purchase_count: 0,
        last_visit: null,
      }))
    }

    // Aggregate per customer
    const statsMap = new Map<
      string,
      { total_purchases: number; purchase_count: number }
    >()
    const salesArr = (stats as unknown) as Array<{
      customer_id: string | null
      total_amount: number
    }>
    for (const sale of salesArr) {
      if (!sale.customer_id) continue
      const existing = statsMap.get(sale.customer_id) ?? {
        total_purchases: 0,
        purchase_count: 0,
      }
      existing.total_purchases += sale.total_amount || 0
      existing.purchase_count += 1
      statsMap.set(sale.customer_id, existing)
    }

    return customerRows.map((customer) => {
      const s = statsMap.get(customer.id)
      return {
        ...customer,
        total_purchases: s?.total_purchases ?? 0,
        purchase_count: s?.purchase_count ?? 0,
        last_visit: null,
      }
    })
  }

  /**
   * Get recent purchases for a customer.
   * Queries sales table with sale_items for item count.
   */
  async getCustomerPurchases(
    customerId: string,
    limit: number = 10,
  ): Promise<CustomerPurchase[]> {
    const { data, error } = await this.client
      .from('sales')
      .select(`
        id,
        receipt_number,
        total_amount,
        created_at,
        sale_items(quantity)
      `)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw this._toError(error, 'getCustomerPurchases')

    const rows = (data ?? []) as Array<{
      id: string
      receipt_number: string
      total_amount: number
      created_at: string
      sale_items: Array<{ quantity?: number }> | null
    }>

    return rows.map((sale) => ({
      ...sale,
      item_count:
        sale.sale_items?.reduce(
          (sum: number, item: { quantity?: number }) => sum + (item.quantity ?? 0),
          0,
        ) ?? 0,
    }))
  }

  /**
   * Get customer counts by type.
   */
  async getCustomerStats(): Promise<CustomerStats> {
    const { data, error } = await this.client
      .from('customers')
      .select('type')

    if (error) throw this._toError(error, 'getCustomerStats')

    const rows = (data ?? []) as Array<{ type: string }>

    return {
      total: rows.length,
      retail: rows.filter((c) => c.type === 'retail').length,
      wholesale: rows.filter((c) => c.type === 'wholesale').length,
      business: rows.filter((c) => c.type === 'business').length,
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Loyalty
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get customer loyalty balance: current points, tier, and lifetime earned points.
   */
  async getLoyaltyBalance(customerId: string): Promise<LoyaltyBalance> {
    const [customerResult, txResult] = await Promise.all([
      this.client
        .from('customers')
        .select('loyalty_points, tier')
        .eq('id', customerId)
        .maybeSingle(),
      this.client
        .from('loyalty_transactions')
        .select('points_delta')
        .eq('customer_id', customerId)
        .gt('points_delta', 0),
    ])

    const customer = customerResult.data as {
      loyalty_points: number | null
      tier: string | null
    } | null

    if (!customer) {
      return { points: 0, tier: 'bronze', lifetime_points: 0 }
    }

    const transactions = (txResult.data ?? []) as Array<{ points_delta: number }>
    const lifetimePoints = transactions.reduce(
      (sum: number, t: { points_delta: number }) => sum + t.points_delta,
      0,
    )

    return {
      points: customer.loyalty_points ?? 0,
      tier: customer.tier ?? 'bronze',
      lifetime_points: lifetimePoints,
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Top & Recent Customers
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get top customers by total purchase amount.
   * Aggregates from sales and joins customer data.
   */
  async getTopCustomers(limit: number = 10): Promise<TopCustomer[]> {
    // Aggregate sales by customer
    const { data: sales, error: salesError } = await this.client
      .from('sales')
      .select('customer_id, total_amount, created_at')
      .not('customer_id', 'is', null)

    if (salesError) throw this._toError(salesError, 'getTopCustomers')

    const salesArr = (sales ?? []) as Array<{
      customer_id: string
      total_amount: number
      created_at: string
    }>

    // Aggregate per customer
    const aggMap = new Map<
      string,
      { total_purchases: number; purchase_count: number; last_visit: string | null }
    >()
    for (const sale of salesArr) {
      if (!sale.customer_id) continue
      const existing = aggMap.get(sale.customer_id) ?? {
        total_purchases: 0,
        purchase_count: 0,
        last_visit: null,
      }
      existing.total_purchases += sale.total_amount || 0
      existing.purchase_count += 1
      if (!existing.last_visit || sale.created_at > existing.last_visit) {
        existing.last_visit = sale.created_at
      }
      aggMap.set(sale.customer_id, existing)
    }

    // Sort by total purchases and take top N
    const sorted = Array.from(aggMap.entries())
      .sort((a, b) => b[1].total_purchases - a[1].total_purchases)
      .slice(0, limit)

    if (sorted.length === 0) return []

    // Fetch customer details for top customers
    const customerIds = sorted.map(([id]) => id)
    const { data: customers, error: customersError } = await this.client
      .from('customers')
      .select('id, name, phone, email, type')
      .in('id', customerIds)

    if (customersError) throw this._toError(customersError, 'getTopCustomers')

    const customerMap = new Map<
      string,
      { id: string; name: string; phone: string | null; email: string | null; type: string }
    >()
    for (const c of (customers ?? []) as Array<{
      id: string
      name: string
      phone: string | null
      email: string | null
      type: string
    }>) {
      customerMap.set(c.id, c)
    }

    return sorted.map(([customerId, agg]) => {
      const c = customerMap.get(customerId)
      return {
        id: customerId,
        name: c?.name ?? 'Unknown',
        phone: c?.phone ?? null,
        email: c?.email ?? null,
        type: c?.type ?? 'unknown',
        total_purchases: agg.total_purchases,
        purchase_count: agg.purchase_count,
        last_visit: agg.last_visit,
      }
    })
  }

  /**
   * Get most recently created customers.
   */
  async getRecentCustomers(limit: number = 10): Promise<CustomerRow[]> {
    const { data, error } = await this.client
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw this._toError(error, 'getRecentCustomers')
    return (data ?? []) as CustomerRow[]
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Write Operations (with Enterprise Core wiring)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Create a new customer record.
   * Wraps the BaseRepository.insert() with enterprise audit and lock support.
   */
  async createCustomer(data: Partial<CustomerRow>): Promise<CustomerRow> {
    return this.insert(data, { lockId: `new_${data.name ?? 'unknown'}` })
  }

  /**
   * Update an existing customer record.
   * Wraps the BaseRepository.update() with enterprise audit and lock support.
   */
  async updateCustomer(id: string, data: Partial<CustomerRow>): Promise<CustomerRow> {
    return this.update(id, data, { lockId: id })
  }

  /**
   * Delete a customer record by ID.
   * Wraps the BaseRepository.delete() with enterprise audit and lock support.
   */
  async deleteCustomer(id: string): Promise<void> {
    return this.delete(id, { lockId: id, reason: 'Customer deletion via repository' })
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

/** Shared customer repository instance. All code uses this, never creating new instances. */
export const customerRepo = new CustomerRepository()
