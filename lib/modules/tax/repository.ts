/**
 * Tax Repository — Enterprise Core Data Access for Tax Configuration
 *
 * Encapsulates direct Supabase access for tax_rates, tax_group_combined_view,
 * category_tax_view, and categories tables. Callers (module facade, server
 * actions) use this repository instead of calling supabase directly.
 *
 * Constitution Reference: §5 (Module Architecture), §9 (Transaction & Event Rules)
 *
 * NOTE: The tax engine (tax-engine.ts) uses its own internal queries.ts for
 * computation-time lookups. This repository serves the admin CRUD layer.
 */

import { BaseRepository } from '@/lib/modules/core/repository'
import type { TaxRate, TaxGroupCombined, CategoryTaxAssignment, TaxGroupRate } from './types'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TaxRateRow {
  id: string
  name: string
  percentage: number
  tax_type: 'vat' | 'excise' | 'service' | 'other'
  description: string | null
  is_active: boolean
  is_default: boolean
  effective_from: string | null
  effective_to: string | null
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface TaxGroupCombinedRow {
  group_id: string
  group_name: string
  description: string | null
  is_active: boolean
  combined_percentage: number
  rate_count: number
  rates: TaxGroupRate[]
  [key: string]: unknown
}

export interface CategoryTaxAssignmentRow {
  id: string
  category_id: string
  category_name?: string
  tax_group_id: string
  group_name?: string
  is_tax_inclusive: boolean
  effective_from: string | null
  effective_to: string | null
  tax_rates?: TaxGroupRate[]
  [key: string]: unknown
}

export interface ProductCategoryRow {
  id: string
  name: string
}

export interface TaxForCategoryResult {
  group_id: string | null
  group_name: string | null
  is_tax_inclusive: boolean
  combined_percentage: number
  rates: TaxGroupRate[]
}

// ─── Repository ─────────────────────────────────────────────────────────────

export class TaxRepository extends BaseRepository<TaxRateRow> {
  constructor() {
    super('tax_rates', {
      audit: { eventType: 'tax.*', aggregateType: 'tax_rate' },
      lock: { resourcePrefix: 'tax:' },
    })
  }

  /**
   * Get all tax rates, optionally including inactive ones.
   * Orders by percentage descending.
   */
  async getTaxRates(includeInactive?: boolean): Promise<TaxRateRow[]> {
    let query = this.client
      .from(this.tableName)
      .select('*')
      .order('percentage', { ascending: false })

    if (!includeInactive) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query
    if (error) throw this._toError(error, 'getTaxRates')
    return (data ?? []) as TaxRateRow[]
  }

  /**
   * Get the default active tax rate (fallback when no category assignment exists).
   * @returns The default tax rate, or null if none configured.
   */
  async getDefaultTaxRate(): Promise<TaxRateRow | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('is_default', true)
      .eq('is_active', true)
      .single()

    if (error) return null
    return (data ?? null) as TaxRateRow | null
  }

  /**
   * Get all tax groups with combined rates from the view.
   */
  async getTaxGroups(): Promise<TaxGroupCombinedRow[]> {
    const { data, error } = await this.client
      .from('tax_group_combined_view')
      .select('*')

    if (error) throw this._toError(error, 'getTaxGroups')
    return (data ?? []) as unknown as TaxGroupCombinedRow[]
  }

  /**
   * Get all category tax assignments.
   */
  async getCategoryTaxAssignments(): Promise<CategoryTaxAssignmentRow[]> {
    const { data, error } = await this.client
      .from('category_tax_view')
      .select('*')
      .order('category_name', { ascending: true })

    if (error) throw this._toError(error, 'getCategoryTaxAssignments')
    return (data ?? []) as unknown as CategoryTaxAssignmentRow[]
  }

  /**
   * Get product categories for the assignment picker.
   */
  async getProductCategories(): Promise<ProductCategoryRow[]> {
    const { data, error } = await this.client
      .from('categories')
      .select('id, name')
      .order('name', { ascending: true })

    if (error) throw this._toError(error, 'getProductCategories')
    return data ?? []
  }

  /**
   * Resolve tax for a product category with fallback to default rate.
   *
   * This is the admin-side lookup (the engine has its own resolveCategoryTax
   * in queries.ts which includes date checking logic).
   */
  async getTaxForCategory(categoryId: string): Promise<TaxForCategoryResult> {
    try {
      const { data, error } = await this.client
        .from('category_tax_view')
        .select('*')
        .eq('category_id', categoryId)
        .single()

      if (error || !data) {
        const defaultRate = await this.getDefaultTaxRate()
        if (defaultRate) {
          return {
            group_id: null,
            group_name: null,
            is_tax_inclusive: true,
            combined_percentage: defaultRate.percentage,
            rates: [{
              rate_id: defaultRate.id,
              rate_name: defaultRate.name,
              percentage: defaultRate.percentage,
              tax_type: defaultRate.tax_type,
            }],
          }
        }
        return { group_id: null, group_name: null, is_tax_inclusive: true, combined_percentage: 0, rates: [] }
      }

      const viewData = data as Record<string, unknown>
      const taxRates = (viewData.tax_rates || []) as TaxGroupRate[]
      return {
        group_id: viewData.group_id as string,
        group_name: viewData.group_name as string,
        is_tax_inclusive: (viewData.is_tax_inclusive as boolean) ?? true,
        combined_percentage: taxRates.reduce((sum: number, r: TaxGroupRate) => sum + r.percentage, 0),
        rates: taxRates,
      }
    } catch (error) {
      throw this._toError(error, 'getTaxForCategory')
    }
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

export const taxRepo = new TaxRepository()
