'use server'

import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

// ─── Types ──────────────────────────────────────────────────────────────────

export type NotificationChannel = 'in_app' | 'sms' | 'email' | 'push' | 'webhook'
export type NotificationType = 'info' | 'success' | 'warning' | 'error'
export type NotificationCategory = 'sales' | 'inventory' | 'finance' | 'workforce' | 'system' | 'marketing' | 'general'

export interface NotificationTemplate {
  id: string
  name: string
  description: string | null
  category: NotificationCategory
  channels: NotificationChannel[]
  subject_template: string | null
  body_template: string
  sms_template: string | null
  push_template: string | null
  variables: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface NotificationLog {
  id: string
  template_id: string | null
  user_id: string | null
  channel: NotificationChannel
  recipient: string | null
  subject: string | null
  body: string
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'read'
  error_message: string | null
  metadata: Record<string, unknown> | null
  sent_at: string | null
  delivered_at: string | null
  read_at: string | null
  created_at: string
}

export interface InAppNotification {
  id: string
  user_id: string
  title: string
  message: string
  type: NotificationType
  category: string
  link: string | null
  data: Record<string, unknown> | null
  is_read: boolean
  created_at: string
}

export interface NotificationPreferences {
  in_app: Record<string, boolean>
  sms: Record<string, boolean>
  email: Record<string, boolean>
  push: Record<string, boolean>
}

// ─── Template Service ───────────────────────────────────────────────────────

/**
 * Get all notification templates
 */
export async function getTemplates(): Promise<NotificationTemplate[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('notification_templates')
      .select('*')
      .order('category')

    if (error) throw error
    return (data || []) as NotificationTemplate[]
  } catch (error) {
    logger.error('[Notification] Failed to get templates:', error)
    return []
  }
}

/**
 * Get template by name
 */
export async function getTemplateByName(name: string): Promise<NotificationTemplate | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('notification_templates')
      .select('*')
      .eq('name', name)
      .single()

    if (error) return null
    return data as NotificationTemplate
  } catch (error) {
    logger.error('[Notification] Failed to get template:', error)
    return null
  }
}

/**
 * Create or update a template
 */
export async function upsertTemplate(
  template: Omit<NotificationTemplate, 'id' | 'created_at' | 'updated_at'>
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from('notification_templates')
      .upsert({
        name: template.name,
        description: template.description,
        category: template.category,
        channels: template.channels,
        subject_template: template.subject_template,
        body_template: template.body_template,
        sms_template: template.sms_template,
        push_template: template.push_template,
        variables: template.variables,
        is_active: template.is_active,
      })

    if (error) throw error
    return { success: true }
  } catch (error) {
    logger.error('[Notification] Failed to upsert template:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// ─── Template Rendering ─────────────────────────────────────────────────────

/**
 * Render a template with variables
 */
function renderTemplate(template: string, variables: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return variables[key] !== undefined ? String(variables[key]) : `{{${key}}}`
  })
}

// ─── Notification Sending ───────────────────────────────────────────────────

/**
 * Send a notification using a template
 */
export async function sendNotification(
  templateName: string,
  recipients: { userId?: string; email?: string; phone?: string }[],
  variables: Record<string, unknown>
): Promise<{ success: boolean; sent: number; failed: number }> {
  try {
    const template = await getTemplateByName(templateName)
    if (!template || !template.is_active) {
      return { success: false, sent: 0, failed: 0 }
    }

    let sent = 0
    let failed = 0

    for (const recipient of recipients) {
      try {
        // Render templates
        const subject = template.subject_template 
          ? renderTemplate(template.subject_template, variables)
          : null
        const body = renderTemplate(template.body_template, variables)
        const sms = template.sms_template 
          ? renderTemplate(template.sms_template, variables)
          : null
        const push = template.push_template 
          ? renderTemplate(template.push_template, variables)
          : null

        // Send to each channel
        for (const channel of template.channels) {
          try {
            // Check user preferences
            if (recipient.userId) {
              const hasPermission = await checkUserPreference(
                recipient.userId,
                channel,
                template.category
              )
              if (!hasPermission) continue
            }

            // Send based on channel
            switch (channel) {
              case 'in_app':
                if (recipient.userId) {
                  await sendInAppNotification(
                    recipient.userId,
                    subject || 'Notification',
                    body,
                    template.category as NotificationType,
                    template.category
                  )
                }
                break
              case 'email':
                if (recipient.email) {
                  await sendEmailNotification(recipient.email, subject || '', body)
                }
                break
              case 'sms':
                if (recipient.phone) {
                  await sendSMSNotification(recipient.phone, sms || body)
                }
                break
              case 'push':
                if (recipient.userId) {
                  await sendPushNotification(
                    recipient.userId,
                    subject || 'Notification',
                    push || body
                  )
                }
                break
            }

            sent++
          } catch (error) {
            logger.error(`[Notification] Failed to send via ${channel}:`, error)
            failed++
          }
        }
      } catch (error) {
        logger.error('[Notification] Failed to send notification:', error)
        failed++
      }
    }

    return { success: true, sent, failed }
  } catch (error) {
    logger.error('[Notification] Failed to send notifications:', error)
    return { success: false, sent: 0, failed: 0 }
  }
}

/**
 * Send in-app notification
 */
async function sendInAppNotification(
  userId: string,
  title: string,
  message: string,
  type: NotificationType,
  category: string,
  link?: string,
  data?: Record<string, unknown>
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('notifications')
    .insert({
      user_id: userId,
      title,
      message,
      type,
      category,
      link: link || null,
      data: data || null,
    })

  if (error) throw error

  // Log the notification
  await logNotification({
    channel: 'in_app',
    recipient: userId,
    subject: title,
    body: message,
    status: 'sent',
  })
}

/**
 * Send email notification (placeholder - would integrate with email provider)
 */
async function sendEmailNotification(
  email: string,
  subject: string,
  body: string
): Promise<void> {
  // Placeholder - would integrate with SendGrid, Mailgun, etc.
  logger.info(`[Notification] Email sent to ${email}: ${subject}`)
  
  await logNotification({
    channel: 'email',
    recipient: email,
    subject,
    body,
    status: 'sent',
  })
}

/**
 * Send SMS notification (placeholder - would integrate with SMS provider)
 */
async function sendSMSNotification(
  phone: string,
  message: string
): Promise<void> {
  // Placeholder - would integrate with Africa's Talking, Twilio, etc.
  logger.info(`[Notification] SMS sent to ${phone}: ${message.substring(0, 50)}...`)
  
  await logNotification({
    channel: 'sms',
    recipient: phone,
    body: message,
    status: 'sent',
  })
}

/**
 * Send push notification (placeholder - would integrate with FCM)
 */
async function sendPushNotification(
  userId: string,
  title: string,
  body: string
): Promise<void> {
  // Placeholder - would integrate with Firebase Cloud Messaging
  logger.info(`[Notification] Push sent to ${userId}: ${title}`)
  
  await logNotification({
    channel: 'push',
    recipient: userId,
    subject: title,
    body,
    status: 'sent',
  })
}

/**
 * Log a notification
 */
async function logNotification(data: {
  templateId?: string
  userId?: string
  channel: NotificationChannel
  recipient?: string
  subject?: string
  body: string
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'read'
  error?: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  try {
    await supabaseAdmin
      .from('notification_log')
      .insert({
        template_id: data.templateId || null,
        user_id: data.userId || null,
        channel: data.channel,
        recipient: data.recipient || null,
        subject: data.subject || null,
        body: data.body,
        status: data.status,
        error_message: data.error || null,
        metadata: data.metadata || null,
        sent_at: data.status === 'sent' ? new Date().toISOString() : null,
      })
  } catch (error) {
    logger.error('[Notification] Failed to log notification:', error)
  }
}

// ─── User Preferences ───────────────────────────────────────────────────────

/**
 * Get user notification preferences
 */
export async function getUserPreferences(userId: string): Promise<NotificationPreferences> {
  try {
    const { data, error } = await supabaseAdmin
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)

    if (error) throw error

    // Build preferences object
    const preferences: NotificationPreferences = {
      in_app: {},
      sms: {},
      email: {},
      push: {},
    }

    for (const pref of data || []) {
      if (pref.channel in preferences) {
        preferences[pref.channel as keyof NotificationPreferences][pref.category] = pref.enabled
      }
    }

    return preferences
  } catch (error) {
    logger.error('[Notification] Failed to get preferences:', error)
    return { in_app: {}, sms: {}, email: {}, push: {} }
  }
}

/**
 * Update user notification preference
 */
export async function updatePreference(
  userId: string,
  channel: NotificationChannel,
  category: string,
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from('notification_preferences')
      .upsert({
        user_id: userId,
        channel,
        category,
        enabled,
      })

    if (error) throw error
    return { success: true }
  } catch (error) {
    logger.error('[Notification] Failed to update preference:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Check if user has enabled a notification channel for a category
 */
async function checkUserPreference(
  userId: string,
  channel: NotificationChannel,
  category: string
): Promise<boolean> {
  try {
    const { data } = await supabaseAdmin
      .from('notification_preferences')
      .select('enabled')
      .eq('user_id', userId)
      .eq('channel', channel)
      .eq('category', category)
      .single()

    // Default to enabled if no preference set
    return data?.enabled ?? true
  } catch {
    return true
  }
}

// ─── In-App Notifications ───────────────────────────────────────────────────

/**
 * Get user's in-app notifications
 */
export async function getNotifications(
  userId: string,
  options: {
    unreadOnly?: boolean
    limit?: number
    offset?: number
  } = {}
): Promise<{ notifications: InAppNotification[]; unreadCount: number }> {
  try {
    const { unreadOnly = false, limit = 50, offset = 0 } = options

    let query = supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)

    if (unreadOnly) {
      query = query.eq('is_read', false)
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    // Get unread count
    const { count: unreadCount } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false)

    return {
      notifications: (data || []) as InAppNotification[],
      unreadCount: unreadCount || 0,
    }
  } catch (error) {
    logger.error('[Notification] Failed to get notifications:', error)
    return { notifications: [], unreadCount: 0 }
  }
}

/**
 * Mark notification as read
 */
export async function markAsRead(
  notificationId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', userId)

    if (error) throw error
    return { success: true }
  } catch (error) {
    logger.error('[Notification] Failed to mark as read:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Mark all notifications as read
 */
export async function markAllAsRead(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)

    if (error) throw error
    return { success: true }
  } catch (error) {
    logger.error('[Notification] Failed to mark all as read:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Delete a notification
 */
export async function deleteNotification(
  notificationId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('user_id', userId)

    if (error) throw error
    return { success: true }
  } catch (error) {
    logger.error('[Notification] Failed to delete notification:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
