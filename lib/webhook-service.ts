'use server'

import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import crypto from 'crypto'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WebhookEndpoint {
  id: string
  name: string
  url: string
  secret: string | null
  events: string[]
  status: 'active' | 'inactive' | 'error'
  description: string | null
  headers: Record<string, string>
  retry_count: number
  timeout_ms: number
  created_at: string
  updated_at: string
  last_triggered_at: string | null
  error_message: string | null
}

export interface WebhookDelivery {
  id: string
  endpoint_id: string
  event: string
  payload: Record<string, unknown>
  status: 'pending' | 'success' | 'failed' | 'retrying'
  attempt: number
  max_attempts: number
  request_url: string | null
  request_headers: Record<string, string> | null
  request_body: string | null
  response_status: number | null
  response_headers: Record<string, string> | null
  response_body: string | null
  error_message: string | null
  duration_ms: number | null
  created_at: string
  completed_at: string | null
}

export interface WebhookEvent {
  event: string
  payload: Record<string, unknown>
  timestamp: string
}

// ─── Webhook Service ────────────────────────────────────────────────────────

/**
 * Register a new webhook endpoint.
 */
export async function createWebhookEndpoint(
  name: string,
  url: string,
  events: string[],
  options: {
    secret?: string
    description?: string
    headers?: Record<string, string>
    retryCount?: number
    timeoutMs?: number
  } = {}
): Promise<{ success: boolean; data?: WebhookEndpoint; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin
      .from('webhook_endpoints')
      .insert({
        name,
        url,
        events,
        secret: options.secret || crypto.randomBytes(32).toString('hex'),
        description: options.description || null,
        headers: options.headers || {},
        retry_count: options.retryCount || 3,
        timeout_ms: options.timeoutMs || 5000,
      })
      .select()
      .single()

    if (error) throw error

    return { success: true, data: data as WebhookEndpoint }
  } catch (error) {
    logger.error('[Webhook] Failed to create endpoint:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Update a webhook endpoint.
 */
export async function updateWebhookEndpoint(
  id: string,
  updates: Partial<Pick<WebhookEndpoint, 'name' | 'url' | 'events' | 'status' | 'description' | 'headers' | 'retry_count' | 'timeout_ms'>>
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from('webhook_endpoints')
      .update(updates)
      .eq('id', id)

    if (error) throw error
    return { success: true }
  } catch (error) {
    logger.error('[Webhook] Failed to update endpoint:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Delete a webhook endpoint.
 */
export async function deleteWebhookEndpoint(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from('webhook_endpoints')
      .delete()
      .eq('id', id)

    if (error) throw error
    return { success: true }
  } catch (error) {
    logger.error('[Webhook] Failed to delete endpoint:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Get all webhook endpoints.
 */
export async function getWebhookEndpoints(): Promise<WebhookEndpoint[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('webhook_endpoints')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data || []) as WebhookEndpoint[]
  } catch (error) {
    logger.error('[Webhook] Failed to get endpoints:', error)
    return []
  }
}

/**
 * Get a specific webhook endpoint.
 */
export async function getWebhookEndpoint(id: string): Promise<WebhookEndpoint | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('webhook_endpoints')
      .select('*')
      .eq('id', id)
      .single()

    if (error) return null
    return data as WebhookEndpoint
  } catch (error) {
    logger.error('[Webhook] Failed to get endpoint:', error)
    return null
  }
}

/**
 * Generate HMAC signature for webhook payload.
 */
function generateSignature(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

/**
 * Send webhook to an endpoint with retry logic.
 */
export async function sendWebhook(
  endpointId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<{ success: boolean; deliveryId?: string; error?: string }> {
  try {
    // Get endpoint
    const endpoint = await getWebhookEndpoint(endpointId)
    if (!endpoint) {
      return { success: false, error: 'Endpoint not found' }
    }

    // Check if endpoint subscribes to this event
    if (!endpoint.events.includes(event) && !endpoint.events.includes('*')) {
      return { success: false, error: 'Endpoint not subscribed to this event' }
    }

    // Check if endpoint is active
    if (endpoint.status !== 'active') {
      return { success: false, error: 'Endpoint is not active' }
    }

    // Create delivery record
    const { data: delivery, error: deliveryError } = await supabaseAdmin
      .from('webhook_deliveries')
      .insert({
        endpoint_id: endpointId,
        event,
        payload,
        status: 'pending',
        attempt: 1,
        max_attempts: endpoint.retry_count,
      })
      .select()
      .single()

    if (deliveryError) throw deliveryError

    // Send the webhook
    const result = await deliverWebhook(endpoint, delivery as WebhookDelivery, payload)

    return { success: true, deliveryId: delivery.id, ...result }
  } catch (error) {
    logger.error('[Webhook] Failed to send webhook:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Deliver webhook with retry logic.
 */
async function deliverWebhook(
  endpoint: WebhookEndpoint,
  delivery: WebhookDelivery,
  payload: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const startTime = Date.now()

  for (let attempt = 1; attempt <= endpoint.retry_count; attempt++) {
    try {
      // Prepare request
      const body = JSON.stringify({
        event: delivery.event,
        payload,
        timestamp: new Date().toISOString(),
        delivery_id: delivery.id,
        attempt,
      })

      // Generate signature if secret exists
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Webhook-Event': delivery.event,
        'X-Webhook-Delivery': delivery.id,
        'X-Webhook-Attempt': String(attempt),
        ...endpoint.headers,
      }

      if (endpoint.secret) {
        headers['X-Webhook-Signature'] = generateSignature(body, endpoint.secret)
      }

      // Send request
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), endpoint.timeout_ms)

      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      })

      clearTimeout(timeout)

      const duration = Date.now() - startTime
      const responseBody = await response.text()

      // Update delivery record
      await supabaseAdmin
        .from('webhook_deliveries')
        .update({
          status: response.ok ? 'success' : 'failed',
          request_url: endpoint.url,
          request_headers: headers,
          request_body: body,
          response_status: response.status,
          response_body: responseBody.substring(0, 1000), // Limit response size
          duration_ms: duration,
          completed_at: new Date().toISOString(),
          error_message: response.ok ? null : `HTTP ${response.status}: ${responseBody.substring(0, 200)}`,
        })
        .eq('id', delivery.id)

      // Update endpoint last triggered
      await supabaseAdmin
        .from('webhook_endpoints')
        .update({
          last_triggered_at: new Date().toISOString(),
          error_message: response.ok ? null : `Last delivery failed: HTTP ${response.status}`,
          status: response.ok ? 'active' : 'error',
        })
        .eq('id', endpoint.id)

      if (response.ok) {
        return { success: true }
      }

      // If not last attempt, wait before retry (exponential backoff)
      if (attempt < endpoint.retry_count) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
      }
    } catch (error) {
      const duration = Date.now() - startTime

      // Update delivery record on error
      await supabaseAdmin
        .from('webhook_deliveries')
        .update({
          status: attempt === endpoint.retry_count ? 'failed' : 'retrying',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          duration_ms: duration,
          completed_at: attempt === endpoint.retry_count ? new Date().toISOString() : null,
        })
        .eq('id', delivery.id)

      // If not last attempt, wait before retry
      if (attempt < endpoint.retry_count) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
      }
    }
  }

  // Update endpoint status after all retries failed
  await supabaseAdmin
    .from('webhook_endpoints')
    .update({
      status: 'error',
      error_message: 'All delivery attempts failed',
    })
    .eq('id', endpoint.id)

  return { success: false, error: 'All delivery attempts failed' }
}

/**
 * Get delivery history for an endpoint.
 */
export async function getWebhookDeliveries(
  endpointId: string,
  limit: number = 50
): Promise<WebhookDelivery[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('webhook_deliveries')
      .select('*')
      .eq('endpoint_id', endpointId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return (data || []) as WebhookDelivery[]
  } catch (error) {
    logger.error('[Webhook] Failed to get deliveries:', error)
    return []
  }
}

/**
 * Retry a failed delivery.
 */
export async function retryWebhookDelivery(
  deliveryId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get the original delivery
    const { data: delivery, error: fetchError } = await supabaseAdmin
      .from('webhook_deliveries')
      .select('*')
      .eq('id', deliveryId)
      .single()

    if (fetchError || !delivery) {
      return { success: false, error: 'Delivery not found' }
    }

    // Get the endpoint
    const endpoint = await getWebhookEndpoint(delivery.endpoint_id)
    if (!endpoint) {
      return { success: false, error: 'Endpoint not found' }
    }

    // Create new delivery attempt
    const { data: newDelivery, error: createError } = await supabaseAdmin
      .from('webhook_deliveries')
      .insert({
        endpoint_id: delivery.endpoint_id,
        event: delivery.event,
        payload: delivery.payload,
        status: 'pending',
        attempt: 1,
        max_attempts: endpoint.retry_count,
      })
      .select()
      .single()

    if (createError) throw createError

    // Send the webhook
    const result = await deliverWebhook(endpoint, newDelivery as WebhookDelivery, delivery.payload)

    return { success: true, ...result }
  } catch (error) {
    logger.error('[Webhook] Failed to retry delivery:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Broadcast event to all subscribed endpoints.
 */
export async function broadcastWebhookEvent(
  event: string,
  payload: Record<string, unknown>
): Promise<{ sent: number; failed: number }> {
  try {
    // Get all active endpoints subscribed to this event
    const { data: endpoints, error } = await supabaseAdmin
      .from('webhook_endpoints')
      .select('*')
      .eq('status', 'active')
      .contains('events', [event])

    if (error) throw error

    let sent = 0
    let failed = 0

    for (const endpoint of endpoints || []) {
      const result = await sendWebhook(endpoint.id, event, payload)
      if (result.success) {
        sent++
      } else {
        failed++
      }
    }

    return { sent, failed }
  } catch (error) {
    logger.error('[Webhook] Failed to broadcast event:', error)
    return { sent: 0, failed: 0 }
  }
}
