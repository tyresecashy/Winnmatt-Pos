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

// ─── Type helpers ─────────────────────────────────────────────────────────────
type TaxRateRow = Awaited<ReturnType<typeof taxActions.getTaxRates>>[number]
type TaxGroupRow = Awaited<ReturnType<typeof taxActions.getTaxGroups>>[number]
type CategoryAssignmentRow = Awaited<ReturnType<typeof taxActions.getCategoryTaxAssignments>>[number]
type ProductCategoryRow = Awaited<ReturnType<typeof taxActions.getProductCategories>>[number]
type DefaultTaxRateResult = Awaited<ReturnType<typeof taxActions.getDefaultTaxRate>>

// ─── Public API - Tax Rates ─────────────────────────────────────────────────

export async function getTaxRates(includeInactive?: boolean): Promise<TaxRateRow[]> {
  try {
    return await taxActions.getTaxRates(includeInactive)
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
    return await taxActions.getTaxGroups()
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
    return await taxActions.getCategoryTaxAssignments()
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
    return await taxActions.getProductCategories()
  } catch (error) {
    logger.error('[Tax Module] getProductCategories failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function getDefaultTaxRate(): Promise<DefaultTaxRateResult> {
  try {
    return await taxActions.getDefaultTaxRate()
  } catch (error) {
    logger.error('[Tax Module] getDefaultTaxRate failed', error instanceof Error ? error.message : String(error))
    return null
  }
}
