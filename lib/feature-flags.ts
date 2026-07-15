'use server'

import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FeatureFlag {
  id: string
  key: string
  name: string
  description: string | null
  enabled: boolean
  rollout_percentage: number
  target_branches: string[] | null
  target_roles: string[] | null
  created_at: string
  updated_at: string
}

export interface FeatureFlagContext {
  branchId?: string
  role?: string
  userId?: string
}

// ─── In-memory cache (revalidates every 60 seconds) ─────────────────────────

let flagCache: Map<string, FeatureFlag> = new Map()
let lastCacheRefresh = 0
const CACHE_TTL_MS = 60 * 1000 // 60 seconds

async function refreshCache(): Promise<void> {
  try {
    const { data, error } = await supabaseAdmin
      .from('feature_flags')
      .select('*')
      .order('key')

    if (error) {
      logger.error('[FeatureFlags] Cache refresh failed:', error)
      return
    }

    flagCache.clear()
    for (const flag of data || []) {
      flagCache.set(flag.key, flag as FeatureFlag)
    }
    lastCacheRefresh = Date.now()
  } catch (error) {
    logger.error('[FeatureFlags] Cache refresh error:', error)
  }
}

async function getCachedFlag(key: string): Promise<FeatureFlag | null> {
  // Refresh cache if expired or empty
  if (Date.now() - lastCacheRefresh > CACHE_TTL_MS || flagCache.size === 0) {
    await refreshCache()
  }
  return flagCache.get(key) || null
}

// ─── Core Service ───────────────────────────────────────────────────────────

/**
 * Get all feature flags (admin only)
 */
export async function getAllFeatureFlags(): Promise<FeatureFlag[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('feature_flags')
      .select('*')
      .order('key')

    if (error) throw error
    return (data || []) as FeatureFlag[]
  } catch (error) {
    logger.error('[FeatureFlags] Failed to get all flags:', error)
    return []
  }
}

/**
 * Create a new feature flag
 */
export async function createFeatureFlag(
  key: string,
  name: string,
  description: string | null,
  enabled: boolean = false,
  rolloutPercentage: number = 100,
  targetBranches: string[] | null = null,
  targetRoles: string[] | null = null
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from('feature_flags')
      .insert({
        key,
        name,
        description,
        enabled,
        rollout_percentage: rolloutPercentage,
        target_branches: targetBranches,
        target_roles: targetRoles,
      })

    if (error) throw error

    // Refresh cache
    await refreshCache()

    return { success: true }
  } catch (error) {
    logger.error('[FeatureFlags] Failed to create flag:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

/**
 * Toggle a feature flag on/off
 */
export async function toggleFeatureFlag(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Get current state
    const { data, error: fetchError } = await supabaseAdmin
      .from('feature_flags')
      .select('enabled')
      .eq('id', id)
      .single()

    if (fetchError) throw fetchError

    // Toggle
    const { error } = await supabaseAdmin
      .from('feature_flags')
      .update({ enabled: !data.enabled })
      .eq('id', id)

    if (error) throw error

    // Refresh cache
    await refreshCache()

    return { success: true }
  } catch (error) {
    logger.error('[FeatureFlags] Failed to toggle flag:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

/**
 * Delete a feature flag
 */
export async function deleteFeatureFlag(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from('feature_flags')
      .delete()
      .eq('id', id)

    if (error) throw error

    // Refresh cache
    await refreshCache()

    return { success: true }
  } catch (error) {
    logger.error('[FeatureFlags] Failed to delete flag:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

/**
 * Force refresh the flag cache (e.g., after admin changes)
 */
export async function refreshFeatureFlagCache(): Promise<void> {
  await refreshCache()
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Simple deterministic hash for rollout percentage checks
 */
function simpleHash(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash)
}
