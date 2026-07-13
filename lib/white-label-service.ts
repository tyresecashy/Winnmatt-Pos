'use server'

import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TenantConfig {
  id: string
  tenant_id: string
  name: string
  logo_url: string | null
  favicon_url: string | null
  primary_color: string
  secondary_color: string
  accent_color: string
  background_color: string
  font_family: string
  custom_css: string | null
  login_background_url: string | null
  receipt_template: string | null
  footer_text: string | null
  contact_email: string | null
  contact_phone: string | null
  website_url: string | null
  social_links: Record<string, string>
  features: Record<string, boolean>
  limits: Record<string, number>
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface TenantTheme {
  id: string
  name: string
  description: string | null
  primary_color: string
  secondary_color: string
  accent_color: string
  background_color: string
  card_background: string
  text_color: string
  border_color: string
  font_family: string
  is_default: boolean
  preview_url: string | null
  created_at: string
}

export interface TenantAsset {
  id: string
  tenant_id: string
  asset_type: string
  file_url: string
  file_name: string
  mime_type: string | null
  width: number | null
  height: number | null
  is_active: boolean
  created_at: string
}

export interface TenantDomain {
  id: string
  tenant_id: string
  domain: string
  is_primary: boolean
  ssl_status: 'pending' | 'active' | 'failed'
  verified_at: string | null
  created_at: string
}

// ─── Tenant Config Service ──────────────────────────────────────────────────

/**
 * Get tenant config by tenant_id
 */
export async function getTenantConfig(tenantId: string): Promise<TenantConfig | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('tenant_configs')
      .select('*')
      .eq('tenant_id', tenantId)
      .single()

    if (error) return null
    return data as TenantConfig
  } catch (error) {
    logger.error('[WhiteLabel] Failed to get tenant config:', error)
    return null
  }
}

/**
 * Get tenant config by domain
 */
export async function getTenantByDomain(domain: string): Promise<TenantConfig | null> {
  try {
    const { data, error } = await supabaseAdmin
      .rpc('get_tenant_by_domain' as never, { p_domain: domain } as never)
      .single()

    if (error) return null
    return data as unknown as TenantConfig
  } catch (error) {
    logger.error('[WhiteLabel] Failed to get tenant by domain:', error)
    return null
  }
}

/**
 * Update tenant config
 */
export async function updateTenantConfig(
  tenantId: string,
  updates: Partial<Omit<TenantConfig, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>>
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from('tenant_configs')
      .update(updates)
      .eq('tenant_id', tenantId)

    if (error) throw error
    return { success: true }
  } catch (error) {
    logger.error('[WhiteLabel] Failed to update tenant config:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

/**
 * Create a new tenant
 */
export async function createTenant(
  tenantId: string,
  name: string,
  options: Partial<Omit<TenantConfig, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>> = {}
): Promise<{ success: boolean; data?: TenantConfig; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin
      .from('tenant_configs')
      .insert({
        tenant_id: tenantId,
        name,
        ...options,
      })
      .select()
      .single()

    if (error) throw error
    return { success: true, data: data as TenantConfig }
  } catch (error) {
    logger.error('[WhiteLabel] Failed to create tenant:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Theme Service ──────────────────────────────────────────────────────────

/**
 * Get all themes
 */
export async function getThemes(): Promise<TenantTheme[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('tenant_themes')
      .select('*')
      .order('name')

    if (error) throw error
    return (data || []) as TenantTheme[]
  } catch (error) {
    logger.error('[WhiteLabel] Failed to get themes:', error)
    return []
  }
}

/**
 * Get default theme
 */
export async function getDefaultTheme(): Promise<TenantTheme | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('tenant_themes')
      .select('*')
      .eq('is_default', true)
      .single()

    if (error) return null
    return data as TenantTheme
  } catch (error) {
    logger.error('[WhiteLabel] Failed to get default theme:', error)
    return null
  }
}

/**
 * Apply theme to tenant
 */
export async function applyTheme(
  tenantId: string,
  themeId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get theme
    const { data: theme } = await supabaseAdmin
      .from('tenant_themes')
      .select('*')
      .eq('id', themeId)
      .single()

    if (!theme) {
      return { success: false, error: 'Theme not found' }
    }

    // Apply theme colors to tenant
    const { error } = await supabaseAdmin
      .from('tenant_configs')
      .update({
        primary_color: theme.primary_color,
        secondary_color: theme.secondary_color,
        accent_color: theme.accent_color,
        background_color: theme.background_color,
        font_family: theme.font_family,
      })
      .eq('tenant_id', tenantId)

    if (error) throw error
    return { success: true }
  } catch (error) {
    logger.error('[WhiteLabel] Failed to apply theme:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

/**
 * Create custom theme
 */
export async function createTheme(
  name: string,
  colors: {
    primary_color: string
    secondary_color: string
    accent_color: string
    background_color: string
    card_background: string
    text_color: string
    border_color: string
  },
  description?: string
): Promise<{ success: boolean; data?: TenantTheme; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin
      .from('tenant_themes')
      .insert({
        name,
        description,
        ...colors,
        font_family: 'Inter',
      })
      .select()
      .single()

    if (error) throw error
    return { success: true, data: data as TenantTheme }
  } catch (error) {
    logger.error('[WhiteLabel] Failed to create theme:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Asset Service ──────────────────────────────────────────────────────────

/**
 * Get tenant assets
 */
export async function getTenantAssets(
  tenantId: string,
  assetType?: string
): Promise<TenantAsset[]> {
  try {
    let query = supabaseAdmin
      .from('tenant_assets')
      .select('*')
      .eq('tenant_id', tenantId)

    if (assetType) {
      query = query.eq('asset_type', assetType)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw error
    return (data || []) as TenantAsset[]
  } catch (error) {
    logger.error('[WhiteLabel] Failed to get tenant assets:', error)
    return []
  }
}

/**
 * Upload tenant asset
 */
export async function uploadTenantAsset(
  tenantId: string,
  assetType: string,
  fileUrl: string,
  fileName: string,
  mimeType?: string,
  width?: number,
  height?: number
): Promise<{ success: boolean; data?: TenantAsset; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin
      .from('tenant_assets')
      .insert({
        tenant_id: tenantId,
        asset_type: assetType,
        file_url: fileUrl,
        file_name: fileName,
        mime_type: mimeType,
        width,
        height,
      })
      .select()
      .single()

    if (error) throw error
    return { success: true, data: data as TenantAsset }
  } catch (error) {
    logger.error('[WhiteLabel] Failed to upload tenant asset:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

/**
 * Delete tenant asset
 */
export async function deleteTenantAsset(assetId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from('tenant_assets')
      .delete()
      .eq('id', assetId)

    if (error) throw error
    return { success: true }
  } catch (error) {
    logger.error('[WhiteLabel] Failed to delete tenant asset:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Domain Service ─────────────────────────────────────────────────────────

/**
 * Get tenant domains
 */
export async function getTenantDomains(tenantId: string): Promise<TenantDomain[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('tenant_domains')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('is_primary', { ascending: false })

    if (error) throw error
    return (data || []) as TenantDomain[]
  } catch (error) {
    logger.error('[WhiteLabel] Failed to get tenant domains:', error)
    return []
  }
}

/**
 * Add custom domain
 */
export async function addTenantDomain(
  tenantId: string,
  domain: string,
  isPrimary: boolean = false
): Promise<{ success: boolean; data?: TenantDomain; error?: string }> {
  try {
    // Check if domain already exists
    const { data: existing } = await supabaseAdmin
      .from('tenant_domains')
      .select('id')
      .eq('domain', domain)
      .single()

    if (existing) {
      return { success: false, error: 'Domain already exists' }
    }

    // If setting as primary, unset other primary domains
    if (isPrimary) {
      await supabaseAdmin
        .from('tenant_domains')
        .update({ is_primary: false })
        .eq('tenant_id', tenantId)
    }

    const { data, error } = await supabaseAdmin
      .from('tenant_domains')
      .insert({
        tenant_id: tenantId,
        domain,
        is_primary: isPrimary,
      })
      .select()
      .single()

    if (error) throw error
    return { success: true, data: data as TenantDomain }
  } catch (error) {
    logger.error('[WhiteLabel] Failed to add tenant domain:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

/**
 * Delete tenant domain
 */
export async function deleteTenantDomain(domainId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from('tenant_domains')
      .delete()
      .eq('id', domainId)

    if (error) throw error
    return { success: true }
  } catch (error) {
    logger.error('[WhiteLabel] Failed to delete tenant domain:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── CSS Generation ─────────────────────────────────────────────────────────

/**
 * Generate CSS variables from tenant config
 */
export function generateTenantCSS(config: TenantConfig): string {
  return `
:root {
  --primary: ${config.primary_color};
  --primary-foreground: ${getContrastColor(config.primary_color)};
  --secondary: ${config.secondary_color};
  --secondary-foreground: ${getContrastColor(config.secondary_color)};
  --accent: ${config.accent_color};
  --accent-foreground: ${getContrastColor(config.accent_color)};
  --background: ${config.background_color};
  --foreground: ${getContrastColor(config.background_color)};
  --font-family: ${config.font_family}, sans-serif;
}
${config.custom_css || ''}
`
}

/**
 * Get contrast color for background
 */
function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace('#', '')
  const r = parseInt(hex.substr(0, 2), 16)
  const g = parseInt(hex.substr(2, 2), 16)
  const b = parseInt(hex.substr(4, 2), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? '#000000' : '#ffffff'
}
