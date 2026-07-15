/**
 * Supplier Repository — Enterprise Core Data Access for Suppliers
 *
 * Encapsulates ALL direct Supabase access for the suppliers table
 * and related read operations. Callers (module facade, server actions)
 * use this repository instead of calling supabase directly.
 *
 * Constitution Reference: §5 (Module Architecture), §9 (Transaction & Event Rules)
 */

import { BaseRepository } from '@/lib/modules/core/repository'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SupplierRow {
  id: string
  name: string
  contact_person: string | null
  phone: string | null
  email: string | null
  payment_terms: string | null
  balance: number | null
  code: string | null
  company_name: string | null
  address: string | null
  tax_number: string | null
  bank_name: string | null
  bank_account: string | null
  bank_code: string | null
  credit_limit: number | null
  credit_days: number | null
  delivery_days: string | null
  lead_time: number | null
  rating: number | null
  performance_score: number | null
  quality_score: number | null
  late_delivery_pct: number | null
  rejected_deliveries: number | null
  total_purchase_amount: number | null
  total_orders: number | null
  outstanding_orders: number | null
  status: string | null
  website: string | null
  notes: string | null
  search_vector: unknown
  created_at: string
  updated_at: string
  [key: string]: unknown
}

// ─── Repository ─────────────────────────────────────────────────────────────

export class SupplierRepository extends BaseRepository<SupplierRow> {
  constructor() {
    super('suppliers', {
      audit: { eventType: 'supplier.*', aggregateType: 'supplier' },
      lock: { resourcePrefix: 'supplier:' },
    })
  }

  /**
   * Get all suppliers ordered by name.
   * @returns Array of supplier rows (empty array on none)
   */
  async getSuppliers(): Promise<SupplierRow[]> {
    return this.findMany({}, { orderBy: 'name', ascending: true })
  }

  /**
   * Get a single supplier by ID.
   * @returns Supplier row or null if not found
   */
  async getSupplierById(id: string): Promise<SupplierRow | null> {
    return this.findById(id)
  }

  /**
   * Search suppliers by name, contact_person, phone, or email (ILIKE).
   * Trims and normalises the query, returning up to 20 results.
   * @returns Array of matching supplier rows (empty if query is blank)
   */
  async searchSuppliers(query: string): Promise<SupplierRow[]> {
    const trimmed = query.trim()
    if (!trimmed) return []

    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .or(
        `name.ilike.%${trimmed}%,contact_person.ilike.%${trimmed}%,phone.ilike.%${trimmed}%,email.ilike.%${trimmed}%`,
      )
      .order('name', { ascending: true })
      .limit(20)

    if (error) throw this._toError(error, 'searchSuppliers')
    return (data ?? []) as SupplierRow[]
  }

  /**
   * Create a new supplier with enterprise core wiring (audit + lock).
   */
  async createSupplier(
    values: Partial<SupplierRow>,
  ): Promise<SupplierRow> {
    return this.insert(values)
  }

  /**
   * Update an existing supplier with enterprise core wiring.
   */
  async updateSupplier(
    id: string,
    values: Partial<SupplierRow>,
  ): Promise<SupplierRow> {
    return this.update(id, values)
  }

  /**
   * Delete a supplier by ID with audit trail.
   */
  async deleteSupplier(id: string): Promise<void> {
    return this.delete(id)
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

export const supplierRepo = new SupplierRepository()
