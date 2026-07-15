/**
 * Tax Module — Public API
 *
 * Manages tax rates, tax groups, and category assignments.
 * Other modules should ONLY import from this file.
 *
 * Implementation: Delegates to lib/tax-actions.ts.
 */

import { logger } from '@/lib/logger'
import * as taxActions from '@/lib/tax-actions'
import { taxRepo } from './repository'

// ─── Type helpers ─────────────────────────────────────────────────────────────
type TaxRateRow = Awaited<ReturnType<typeof taxActions.getTaxRates>>[number]
type TaxGroupRow = Awaited<ReturnType<typeof taxActions.getTaxGroups>>[number]
type CategoryAssignmentRow = Awaited<ReturnType<typeof taxActions.getCategoryTaxAssignments>>[number]
type ProductCategoryRow = Awaited<ReturnType<typeof taxActions.getProductCategories>>[number]
type DefaultTaxRateResult = Awaited<ReturnType<typeof taxActions.getDefaultTaxRate>>

// ─── Public API - Tax Rates ─────────────────────────────────────────────────

export async function getTaxRates(includeInactive?: boolean): Promise<TaxRateRow[]> {
  try {
    return await taxRepo.getTaxRates(includeInactive) as unknown as TaxRateRow[]
  } catch (error) {
    logger.error('[Tax Module] getTaxRates failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function createTaxRate(data: Record<string, unknown>): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    return await taxActions.createTaxRate(data as Parameters<typeof taxActions.createTaxRate>[0])
  } catch (error) {
    logger.error('[Tax Module] createTaxRate failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function updateTaxRate(id: string, data: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  try {
    return await taxActions.updateTaxRate(id, data)
  } catch (error) {
    logger.error('[Tax Module] updateTaxRate failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function deleteTaxRate(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    return await taxActions.deleteTaxRate(id)
  } catch (error) {
    logger.error('[Tax Module] deleteTaxRate failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Public API - Tax Groups ────────────────────────────────────────────────

export async function getTaxGroups(): Promise<TaxGroupRow[]> {
  try {
    return await taxRepo.getTaxGroups() as unknown as TaxGroupRow[]
  } catch (error) {
    logger.error('[Tax Module] getTaxGroups failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function createTaxGroup(data: Record<string, unknown>): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    return await taxActions.createTaxGroup(data as Parameters<typeof taxActions.createTaxGroup>[0])
  } catch (error) {
    logger.error('[Tax Module] createTaxGroup failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function updateTaxGroup(id: string, data: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  try {
    return await taxActions.updateTaxGroup(id, data)
  } catch (error) {
    logger.error('[Tax Module] updateTaxGroup failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function deleteTaxGroup(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    return await taxActions.deleteTaxGroup(id)
  } catch (error) {
    logger.error('[Tax Module] deleteTaxGroup failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Public API - Category Tax Assignments ──────────────────────────────────

export async function getCategoryTaxAssignments(): Promise<CategoryAssignmentRow[]> {
  try {
    return await taxRepo.getCategoryTaxAssignments() as unknown as CategoryAssignmentRow[]
  } catch (error) {
    logger.error('[Tax Module] getCategoryTaxAssignments failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function assignTaxToCategory(categoryId: string, taxRateId: string): Promise<{ success: boolean; error?: string }> {
  try {
    return await taxActions.assignTaxToCategory({ category_id: categoryId, tax_group_id: taxRateId })
  } catch (error) {
    logger.error('[Tax Module] assignTaxToCategory failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function removeCategoryTaxAssignment(categoryId: string, taxRateId: string): Promise<{ success: boolean; error?: string }> {
  try {
    return await taxActions.removeCategoryTaxAssignment(categoryId, taxRateId)
  } catch (error) {
    logger.error('[Tax Module] removeCategoryTaxAssignment failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function getProductCategories(): Promise<ProductCategoryRow[]> {
  try {
    return await taxRepo.getProductCategories() as unknown as ProductCategoryRow[]
  } catch (error) {
    logger.error('[Tax Module] getProductCategories failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function getDefaultTaxRate(): Promise<DefaultTaxRateResult> {
  try {
    return await taxRepo.getDefaultTaxRate() as unknown as DefaultTaxRateResult
  } catch (error) {
    logger.error('[Tax Module] getDefaultTaxRate failed', error instanceof Error ? error.message : String(error))
    return null
  }
}

export async function getTaxForCategory(categoryId: string): Promise<{
  group_id: string | null
  group_name: string | null
  is_tax_inclusive: boolean
  combined_percentage: number
  rates: { rate_id: string; rate_name: string; percentage: number; tax_type: string }[]
}> {
  try {
    return await taxRepo.getTaxForCategory(categoryId) as unknown as {
      group_id: string | null
      group_name: string | null
      is_tax_inclusive: boolean
      combined_percentage: number
      rates: { rate_id: string; rate_name: string; percentage: number; tax_type: string }[]
    }
  } catch (error) {
    logger.error('[Tax Module] getTaxForCategory failed', error instanceof Error ? error.message : String(error))
    return { group_id: null, group_name: null, is_tax_inclusive: true, combined_percentage: 0, rates: [] }
  }
}
