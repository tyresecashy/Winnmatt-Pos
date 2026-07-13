'use server'

import { logger } from '@/lib/logger'
import { authenticateServerAction } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'
import type { TaxRate, TaxGroup, TaxGroupCombined, CategoryTaxAssignment, ProductCategory, TaxGroupRate } from '@/lib/tax-utils'

// ─── Tax Rates CRUD ─────────────────────────────────────────────────────────

export async function getTaxRates(includeInactive?: boolean): Promise<TaxRate[]> {
  try {
    let query = supabaseAdmin
      .from('tax_rates')
      .select('*')
      .order('percentage', { ascending: false })

    if (!includeInactive) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query
    if (error) throw error
    return (data || []) as TaxRate[]
  } catch (error) {
    logger.error('[TAX] Failed to fetch tax rates:', error)
    return []
  }
}

export async function createTaxRate(
  input: Pick<TaxRate, 'name' | 'percentage' | 'tax_type' | 'description' | 'is_active' | 'is_default' | 'effective_from' | 'effective_to'>
): Promise<{ success: boolean; data?: TaxRate; error?: string }> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !['super_admin', 'admin'].includes(auth.profile?.role || '')) {
      return { success: false, error: 'Unauthorized' }
    }

    // If setting as default, clear existing default
    if (input.is_default) {
      await supabaseAdmin
        .from('tax_rates')
        .update({ is_default: false })
        .eq('is_default', true)
    }

    const { data, error } = await supabaseAdmin
      .from('tax_rates')
      .insert({
        name: input.name,
        percentage: input.percentage,
        tax_type: input.tax_type,
        description: input.description || null,
        is_active: input.is_active ?? true,
        is_default: input.is_default ?? false,
        effective_from: input.effective_from || null,
        effective_to: input.effective_to || null,
      })
      .select()
      .single()

    if (error) throw error
    return { success: true, data: data as TaxRate }
  } catch (error) {
    logger.error('[TAX] Failed to create tax rate:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function updateTaxRate(
  id: string,
  input: Partial<Pick<TaxRate, 'name' | 'percentage' | 'tax_type' | 'description' | 'is_active' | 'is_default' | 'effective_from' | 'effective_to'>>
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !['super_admin', 'admin'].includes(auth.profile?.role || '')) {
      return { success: false, error: 'Unauthorized' }
    }

    // If setting as default, clear existing default
    if (input.is_default) {
      await supabaseAdmin
        .from('tax_rates')
        .update({ is_default: false })
        .eq('is_default', true)
        .neq('id', id)
    }

    const { error } = await supabaseAdmin
      .from('tax_rates')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error
    return { success: true }
  } catch (error) {
    logger.error('[TAX] Failed to update tax rate:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function deleteTaxRate(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !['super_admin', 'admin'].includes(auth.profile?.role || '')) {
      return { success: false, error: 'Unauthorized' }
    }

    // Check if rate is used in any group
    const { count } = await supabaseAdmin
      .from('tax_group_items')
      .select('*', { count: 'exact', head: true })
      .eq('rate_id', id)

    if (count && count > 0) {
      return { success: false, error: `Cannot delete: rate is used in ${count} tax group(s). Deactivate it instead.` }
    }

    const { error } = await supabaseAdmin
      .from('tax_rates')
      .delete()
      .eq('id', id)

    if (error) throw error
    return { success: true }
  } catch (error) {
    logger.error('[TAX] Failed to delete tax rate:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Tax Groups CRUD ────────────────────────────────────────────────────────

export async function getTaxGroups(): Promise<TaxGroupCombined[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('tax_group_combined_view')
      .select('*')

    if (error) throw error
    return (data || []) as unknown as TaxGroupCombined[]
  } catch (error) {
    logger.error('[TAX] Failed to fetch tax groups:', error)
    return []
  }
}

export async function createTaxGroup(
  input: { name: string; description?: string; rate_ids?: string[] }
): Promise<{ success: boolean; data?: TaxGroup; error?: string }> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !['super_admin', 'admin'].includes(auth.profile?.role || '')) {
      return { success: false, error: 'Unauthorized' }
    }

    // Create the group
    const { data: group, error: groupError } = await supabaseAdmin
      .from('tax_groups')
      .insert({ name: input.name, description: input.description || null })
      .select()
      .single()

    if (groupError) throw groupError

    // Add rates to the group
    if (input.rate_ids && input.rate_ids.length > 0) {
      const items = input.rate_ids.map((rateId, idx) => ({
        group_id: group.id,
        rate_id: rateId,
        sort_order: idx + 1,
      }))

      const { error: itemsError } = await supabaseAdmin
        .from('tax_group_items')
        .insert(items)

      if (itemsError) throw itemsError
    }

    return { success: true, data: group as TaxGroup }
  } catch (error) {
    logger.error('[TAX] Failed to create tax group:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function updateTaxGroup(
  id: string,
  input: { name?: string; description?: string; is_active?: boolean; rate_ids?: string[] }
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !['super_admin', 'admin'].includes(auth.profile?.role || '')) {
      return { success: false, error: 'Unauthorized' }
    }

    // Update group metadata
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (input.name !== undefined) updates.name = input.name
    if (input.description !== undefined) updates.description = input.description
    if (input.is_active !== undefined) updates.is_active = input.is_active

    const { error: updateError } = await supabaseAdmin
      .from('tax_groups')
      .update(updates)
      .eq('id', id)

    if (updateError) throw updateError

    // If rate_ids provided, replace all items
    if (input.rate_ids) {
      // Delete existing
      await supabaseAdmin
        .from('tax_group_items')
        .delete()
        .eq('group_id', id)

      // Insert new
      if (input.rate_ids.length > 0) {
        const items = input.rate_ids.map((rateId, idx) => ({
          group_id: id,
          rate_id: rateId,
          sort_order: idx + 1,
        }))

        const { error: itemsError } = await supabaseAdmin
          .from('tax_group_items')
          .insert(items)

        if (itemsError) throw itemsError
      }
    }

    return { success: true }
  } catch (error) {
    logger.error('[TAX] Failed to update tax group:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function deleteTaxGroup(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !['super_admin', 'admin'].includes(auth.profile?.role || '')) {
      return { success: false, error: 'Unauthorized' }
    }

    // Check if group is used in any category assignment
    const { count } = await supabaseAdmin
      .from('category_tax_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('tax_group_id', id)

    if (count && count > 0) {
      return { success: false, error: `Cannot delete: assigned to ${count} product categories. Deactivate it instead.` }
    }

    // Cascade delete items then group
    await supabaseAdmin.from('tax_group_items').delete().eq('group_id', id)

    const { error } = await supabaseAdmin
      .from('tax_groups')
      .delete()
      .eq('id', id)

    if (error) throw error
    return { success: true }
  } catch (error) {
    logger.error('[TAX] Failed to delete tax group:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Category Tax Assignments ───────────────────────────────────────────────

export async function getCategoryTaxAssignments(): Promise<CategoryTaxAssignment[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('category_tax_view')
      .select('*')
      .order('category_name', { ascending: true })

    if (error) throw error
    return (data || []) as unknown as CategoryTaxAssignment[]
  } catch (error) {
    logger.error('[TAX] Failed to fetch category tax assignments:', error)
    return []
  }
}

export async function assignTaxToCategory(
  input: { category_id: string; tax_group_id: string; is_tax_inclusive?: boolean; effective_from?: string; effective_to?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !['super_admin', 'admin'].includes(auth.profile?.role || '')) {
      return { success: false, error: 'Unauthorized' }
    }

    // Upsert: if exists, update; otherwise insert
    const { data: existing } = await supabaseAdmin
      .from('category_tax_assignments')
      .select('id')
      .eq('category_id', input.category_id)
      .eq('tax_group_id', input.tax_group_id)
      .single()

    if (existing) {
      const { error } = await supabaseAdmin
        .from('category_tax_assignments')
        .update({
          is_tax_inclusive: input.is_tax_inclusive ?? true,
          effective_from: input.effective_from || null,
          effective_to: input.effective_to || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)

      if (error) throw error
    } else {
      const { error } = await supabaseAdmin
        .from('category_tax_assignments')
        .insert({
          category_id: input.category_id,
          tax_group_id: input.tax_group_id,
          is_tax_inclusive: input.is_tax_inclusive ?? true,
          effective_from: input.effective_from || null,
          effective_to: input.effective_to || null,
        })

      if (error) throw error
    }

    return { success: true }
  } catch (error) {
    logger.error('[TAX] Failed to assign tax to category:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function removeCategoryTaxAssignment(
  categoryId: string,
  taxGroupId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !['super_admin', 'admin'].includes(auth.profile?.role || '')) {
      return { success: false, error: 'Unauthorized' }
    }

    const { error } = await supabaseAdmin
      .from('category_tax_assignments')
      .delete()
      .eq('category_id', categoryId)
      .eq('tax_group_id', taxGroupId)

    if (error) throw error
    return { success: true }
  } catch (error) {
    logger.error('[TAX] Failed to remove category tax assignment:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Product Categories (for assignment picker) ─────────────────────────────

export async function getProductCategories(): Promise<ProductCategory[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('categories')
      .select('id, name')
      .order('name', { ascending: true })

    if (error) throw error
    return data || []
  } catch (error) {
    logger.error('[TAX] Failed to fetch product categories:', error)
    return []
  }
}

// ─── Tax Calculation Helpers ────────────────────────────────────────────────

export async function getTaxForCategory(categoryId: string): Promise<{
  group_id: string | null
  group_name: string | null
  is_tax_inclusive: boolean
  combined_percentage: number
  rates: TaxGroupRate[]
}> {
  try {
    const { data, error } = await supabaseAdmin
      .from('category_tax_view')
      .select('*')
      .eq('category_id', categoryId)
      .single()

    if (error || !data) {
      // Fallback: get default tax rate
      const defaultRate = await getDefaultTaxRate()
      return {
        group_id: null,
        group_name: null,
        is_tax_inclusive: true,
        combined_percentage: defaultRate?.percentage || 0,
        rates: defaultRate ? [{ rate_id: defaultRate.id, rate_name: defaultRate.name, percentage: defaultRate.percentage, tax_type: defaultRate.tax_type }] : [],
      }
    }

    const viewData = data as Record<string, unknown>
    const taxRates = (viewData.tax_rates || []) as unknown as TaxGroupRate[]
    return {
      group_id: viewData.group_id as string,
      group_name: viewData.group_name as string,
      is_tax_inclusive: (viewData.is_tax_inclusive as boolean) ?? true,
      combined_percentage: Array.isArray(taxRates)
        ? taxRates.reduce((sum: number, r: TaxGroupRate) => sum + r.percentage, 0)
        : 0,
      rates: taxRates,
    }
  } catch (error) {
    logger.error('[TAX] Failed to get tax for category:', error)
    return { group_id: null, group_name: null, is_tax_inclusive: true, combined_percentage: 0, rates: [] }
  }
}

export async function getDefaultTaxRate(): Promise<TaxRate | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('tax_rates')
      .select('*')
      .eq('is_default', true)
      .eq('is_active', true)
      .single()

    if (error) return null
    return data as TaxRate
  } catch {
    return null
  }
}
