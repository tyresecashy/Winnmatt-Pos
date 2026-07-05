// ─── Shared Tax Types & Utilities ───────────────────────────────────────────
// NOT a server action file — safe to import in client components

export interface TaxRate {
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
}

export interface TaxGroup {
  id: string
  name: string
  description: string | null
  is_active: boolean
  combined_percentage?: number
  rate_count?: number
  rates?: TaxGroupRate[]
  created_at: string
}

export interface TaxGroupRate {
  rate_id: string
  rate_name: string
  percentage: number
  tax_type: string
}

export interface CategoryTaxAssignment {
  id: string
  category_id: string
  category_name?: string
  tax_group_id: string
  group_name?: string
  is_tax_inclusive: boolean
  effective_from: string | null
  effective_to: string | null
  tax_rates?: TaxGroupRate[]
}

export interface TaxGroupCombined {
  group_id: string
  group_name: string
  description: string | null
  is_active: boolean
  combined_percentage: number
  rate_count: number
  rates: TaxGroupRate[]
}

export interface ProductCategory {
  id: string
  name: string
}

/**
 * Calculate tax amounts given a base price and tax percentage.
 * @param amountCents Price in cents
 * @param percentage Tax percentage (e.g. 16 for 16%)
 * @param isTaxInclusive Whether the amount already includes tax
 */
export function calculateTax(
  amountCents: number,
  percentage: number,
  isTaxInclusive: boolean
): { taxCents: number; exclusiveCents: number; inclusiveCents: number } {
  if (percentage === 0) {
    return { taxCents: 0, exclusiveCents: amountCents, inclusiveCents: amountCents }
  }

  if (isTaxInclusive) {
    // Price includes tax — extract tax portion
    const taxCents = Math.round(amountCents * percentage / (100 + percentage))
    return { taxCents, exclusiveCents: amountCents - taxCents, inclusiveCents: amountCents }
  } else {
    // Price excludes tax — add tax
    const taxCents = Math.round(amountCents * percentage / 100)
    return { taxCents, exclusiveCents: amountCents, inclusiveCents: amountCents + taxCents }
  }
}
