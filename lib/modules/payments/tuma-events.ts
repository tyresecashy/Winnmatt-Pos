/**
 * Tuma Payments — Event Bus Integration
 *
 * Bridges Tuma payment callbacks to the real-time event bus.
 * Reuses existing PAYMENT_CONFIRMED and PAYMENT_FAILED events
 * so the POS can listen via existing SSE infrastructure.
 */

import { publish as busPublish, subscribe as busSubscribe } from '@/lib/realtime/event-bus'
import type { RealtimeEvent } from '@/lib/realtime/types'
import type { TumaCallbackPayload } from './tuma-types'

export type TumaPaymentEvent = {
  type: 'payment.confirmed' | 'payment.failed'
  saleId: string
  checkoutRequestId: string
  mpesaReceiptNumber?: string
  errorMessage?: string
  timestamp: number
}

/**
 * Publish a Tuma payment event to the event bus.
 * Maps Tuma callback statuses to existing event types:
 *   completed → payment.confirmed
 *   failed / cancelled / timeout → payment.failed
 */
export function publishPaymentEvent(
  status: TumaCallbackPayload['status'],
  saleId: string,
  checkoutRequestId: string,
  mpesaReceiptNumber?: string,
  errorMessage?: string
) {
  const eventType = status === 'completed' ? 'payment.confirmed' : 'payment.failed'

  const event: TumaPaymentEvent = {
    type: eventType,
    saleId,
    checkoutRequestId,
    mpesaReceiptNumber,
    errorMessage,
    timestamp: Date.now(),
  }

  busPublish({
    type: eventType,
    source: 'tuma',
    entityType: 'sale',
    entityId: saleId,
    payload: { ...event },
    timestamp: event.timestamp,
  })
}

/**
 * Subscribe to Tuma payment events from the event bus.
 * Returns a cleanup function.
 */
export function subscribeToPaymentEvents(
  checkoutRequestId: string,
  callback: (event: TumaPaymentEvent) => void
): () => void {
  const unsubConfirmed = busSubscribe('payment.confirmed', (e: RealtimeEvent) => {
    // Note: checkoutRequestId parameter is accepted but not filtered server-side
    // Filtering happens client-side in the POS polling mechanism
    callback(e.payload as unknown as TumaPaymentEvent)
  })

  const unsubFailed = busSubscribe('payment.failed', (e: RealtimeEvent) => {
    callback(e.payload as unknown as TumaPaymentEvent)
  })

  return () => {
    unsubConfirmed()
    unsubFailed()
  }
}
