'use server'
import { logger } from '@/lib/logger';

import { authenticateServerAction } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'
// ---------------------------------------------------------------------------
// Types for business & branch receipt settings (not in generated types yet)
// ---------------------------------------------------------------------------
export interface BusinessSettings {
  id: string; business_name: string; phone_number: string | null
  email: string | null; address: string | null; tax_pin: string | null
  business_pin: string | null; receipt_footer_text: string | null
  return_policy_text: string | null; thank_you_message: string | null
  created_at: string; updated_at: string
}

export interface BranchReceiptSettings {
  id: string; branch_id: string; phone_number: string | null
  email: string | null; address: string | null
  receipt_header_text: string | null; created_at: string; updated_at: string
}

export interface MergedReceiptSettings extends BusinessSettings {
  branchSettings?: BranchReceiptSettings
  effectivePhoneNumber: string | null
  effectiveEmail: string | null
  effectiveAddress: string | null
}

/**
 * Singleton business settings ID (hardcoded)
 * The database has exactly one row with this ID.
 */
const BUSINESS_SETTINGS_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'

export async function getReceiptSettingBranches(): Promise<
  Array<{ id: string; name: string; code: string }>
> {
  const authResult = await authenticateServerAction()

  if (!authResult.success || !authResult.profile) {
    logger.warn('[receipt-settings] Branch list denied:', { error: authResult.error })
    return []
  }

  if (!['admin', 'owner'].includes(authResult.profile.role)) {
    logger.warn('[receipt-settings] Branch list forbidden for role:', { role: authResult.profile.role })
    return []
  }

  const { data, error } = await supabaseAdmin
    .from('branches')
    .select('id, name, code')
    .order('name')

  if (error) {
    logger.error('[receipt-settings] Failed to fetch branches:', error)
    return []
  }

  return data || []
}

/**
 * Get global business settings (singleton)
 */
export async function getBusinessSettings(): Promise<BusinessSettings | null> {
  const { data, error } = await supabaseAdmin
    .from('business_settings')
    .select('*')
    .eq('id', BUSINESS_SETTINGS_ID)
    .single()

  if (error) {
    logger.error('[receipt-settings] Failed to fetch business settings:', error)
    return null
  }

  return data as BusinessSettings
}

/**
 * Get branch-specific receipt settings overrides (if they exist)
 */
export async function getBranchReceiptSettings(
  branchId: string
): Promise<BranchReceiptSettings | null> {
  const { data, error } = await supabaseAdmin
    .from('branch_receipt_settings')
    .select('*')
    .eq('branch_id', branchId)
    .single()

  // No error is fine - it just means no override exists for this branch
  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows found (expected case)
    logger.error('[receipt-settings] Failed to fetch branch settings:', error)
    return null
  }

  return data as BranchReceiptSettings | null
}

/**
 * Get merged receipt settings: Global + branch overrides (if any)
 * Branch override values take precedence over global values.
 *
 * @param branchId - Optional branch ID. If provided, merges branch overrides.
 * @returns Merged settings with effective computed values
 */
export async function getMergedReceiptSettings(
  branchId?: string
): Promise<MergedReceiptSettings> {
  const globalSettings = await getBusinessSettings()

  if (!globalSettings) {
    throw new Error('Business settings not initialized')
  }

  let branchSettings: BranchReceiptSettings | null = null
  if (branchId) {
    branchSettings = await getBranchReceiptSettings(branchId)
  }

  // Merge: branch override OR global fallback
  const effectivePhoneNumber = branchSettings?.phone_number ?? globalSettings.phone_number
  const effectiveEmail = branchSettings?.email ?? globalSettings.email
  const effectiveAddress = branchSettings?.address ?? globalSettings.address

  return {
    ...globalSettings,
    branchSettings: branchSettings || undefined,
    effectivePhoneNumber,
    effectiveEmail,
    effectiveAddress,
  }
}

/**
 * Update global business settings (admin only)
 * @param userRole - Role of the user making the update (must be 'admin')
 * @param data - Partial business settings to update
 */
export async function updateBusinessSettings(
  userRole: string,
  data: Partial<Omit<BusinessSettings, 'id' | 'created_at'>>
): Promise<BusinessSettings> {
  // Role-based permission check (app-level)
  if (userRole !== 'admin') {
    throw new Error('Unauthorized: Only admins can update business settings')
  }

  const { data: updated, error } = await supabaseAdmin
    .from('business_settings')
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', BUSINESS_SETTINGS_ID)
    .select()
    .single()

  if (error) {
    logger.error('Operation failed', { error: error })
    throw new Error('Operation failed')
  }

  return updated as BusinessSettings
}

/**
 * Update branch receipt settings (admin only)
 * Creates a new row if it doesn't exist for that branch.
 *
 * @param userRole - Role of the user making the update (must be 'admin')
 * @param branchId - Branch ID to update overrides for
 * @param data - Partial branch settings to update
 */
export async function updateBranchReceiptSettings(
  userRole: string,
  branchId: string,
  data: Partial<Omit<BranchReceiptSettings, 'id' | 'created_at' | 'branch_id'>>
): Promise<BranchReceiptSettings> {
  // Role-based permission check (app-level)
  if (userRole !== 'admin') {
    throw new Error('Unauthorized: Only admins can update branch receipt settings')
  }

  // Try to update existing row
  const { data: existing } = await supabaseAdmin
    .from('branch_receipt_settings')
    .select('id')
    .eq('branch_id', branchId)
    .single()

  if (existing) {
    // Update existing
    const { data: updated, error } = await supabaseAdmin
      .from('branch_receipt_settings')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('branch_id', branchId)
      .select()
      .single()

    if (error) {
      logger.error('Operation failed', { error: error })
      throw new Error('Operation failed')
    }

    return updated as BranchReceiptSettings
  } else {
    // Insert new
    const { data: inserted, error } = await supabaseAdmin
      .from('branch_receipt_settings')
      .insert([
        {
          branch_id: branchId,
          ...data,
        },
      ])
      .select()
      .single()

    if (error) {
      logger.error('Operation failed', { error: error })
      throw new Error('Operation failed')
    }

    return inserted as BranchReceiptSettings
  }
}
