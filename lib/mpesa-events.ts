import { publish as busPublish, subscribe as busSubscribe } from '@/lib/realtime/event-bus'
import type { RealtimeEvent } from '@/lib/realtime/types'

export type MpesaEvent = {
  type: 'payment.confirmed' | 'payment.failed'
  saleId: string
  checkoutRequestId: string
  mpesaReceiptNumber?: string
  errorMessage?: string
  timestamp: number
}

export function publishEvent(event: MpesaEvent) {
  busPublish({
    type: event.type,
    source: 'mpesa',
    entityType: 'sale',
    entityId: event.saleId,
    payload: { ...event },
    timestamp: event.timestamp,
  })
}

export function subscribeEvent(
  checkoutRequestId: string,
  callback: (event: MpesaEvent) => void
): () => void {
  const unsub = busSubscribe('payment.confirmed', (e: RealtimeEvent) => {
    callback(e.payload as unknown as MpesaEvent)
  })
  const unsub2 = busSubscribe('payment.failed', (e: RealtimeEvent) => {
    callback(e.payload as unknown as MpesaEvent)
  })
  return () => { unsub(); unsub2() }
}
