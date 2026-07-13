'use server'

import { logger } from '@/lib/logger'

import { supabaseAdmin } from '@/lib/supabase-server'
import { authenticateServerAction } from '@/lib/auth-helpers'

/**
 * Change the current user's password via Supabase Auth admin API.
 */
export async function changePassword(currentPassword: string, newPassword: string) {
  const { profile, user } = await authenticateServerAction()
  if (!profile || !user) throw new Error('Unauthorized')

  // Verify current password by attempting to sign in
  const { error: signInErr } = await supabaseAdmin.auth.signInWithPassword({
    email: user.email!,
    password: currentPassword,
  })
  if (signInErr) {
    return { success: false, error: 'Current password is incorrect' }
  }

  // Update to new password using admin API (bypasses re-auth)
  const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    password: newPassword,
  })
  if (updateErr) {
    logger.error('Operation failed', { error: updateErr })
    return { success: false, error: 'Operation failed. Please try again.' }
  }

  return { success: true }
}

/**
 * Fetch login history for the current user, paginated.
 */
export async function getLoginHistory(options?: { limit?: number; offset?: number; search?: string }) {
  await authenticateServerAction()

  const limit = options?.limit ?? 50
  const offset = options?.offset ?? 0

  let query = supabaseAdmin
    .from('login_history')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (options?.search) {
    query = query.ilike('ip_address', `%${options.search}%`)
  }

  const { data, error, count } = await query
  if (error) {
    if (error) logger.error('Operation failed', { error: error })
    throw new Error('Operation failed')
  }
  return { data: data || [], count: count || 0 }
}

/**
 * Record a login attempt (called from login server action / auth callback).
 */
export async function recordLoginAttempt(params: {
  userId: string
  ipAddress?: string
  userAgent?: string
  deviceInfo?: string
  location?: string
  status: 'success' | 'failed'
  failureReason?: string
}) {
  await supabaseAdmin.from('login_history').insert({
    user_id: params.userId,
    ip_address: params.ipAddress || null,
    user_agent: params.userAgent || null,
    device_info: params.deviceInfo || null,
    location: params.location || null,
    status: params.status,
    failure_reason: params.failureReason || null,
  })
}

/**
 * Update password policy settings for the user (stored in user_settings).
 * Note: Requires the user_settings table. Falls back silently if table is missing.
 */
export async function savePasswordPolicy(settings: {
  requirePasswordChange: boolean
  minPasswordLength: number
  passwordExpiry: string
}) {
  const { profile } = await authenticateServerAction()
  if (!profile) throw new Error('Unauthorized')

  const { error } = await supabaseAdmin
    .from('user_settings' as never)
    .upsert({
      user_id: profile.id,
      settings: {
        require_password_change: settings.requirePasswordChange,
        min_password_length: settings.minPasswordLength,
        password_expiry: settings.passwordExpiry,
      },
    } as never, { onConflict: 'user_id' })

  if (error && error.code !== '42P01') {
    // 42P01 = relation does not exist — table not created yet; ignore
    logger.error('Operation failed', { error: error })
    throw new Error('Operation failed')
  }
  return { success: true }
}
