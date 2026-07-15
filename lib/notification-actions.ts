'use server'

import { authenticateServerAction } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

export async function getNotifications(userId: string, limit = 50) {
  try {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  } catch (error) {
    logger.error('Error fetching notifications:', error)
    return []
  }
}

export async function getUnreadCount(userId: string) {
  try {
    const { count, error } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false)

    if (error) throw error
    return count || 0
  } catch (error) {
    return 0
  }
}

export async function markAsRead(notificationId: string) {
  try {
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId)

    if (error) throw error
    return { success: true }
  } catch (error) {
    return { success: false }
  }
}

export async function markAllAsRead(userId: string) {
  try {
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_read', false)

    if (error) throw error
    return { success: true }
  } catch (error) {
    return { success: false }
  }
}

export async function getNotificationRules(branchId?: string) {
  try {
    let query = supabaseAdmin.from('notification_rules').select('*')
    if (branchId) query = query.eq('branch_id', branchId)
    const { data, error } = await query.order('label')
    if (error) throw error
    return data || []
  } catch (error) {
    logger.error('Error fetching notification rules:', error)
    return []
  }
}
