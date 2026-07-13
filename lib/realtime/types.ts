export interface RealtimeEvent {
  type: string
  source: string
  entityType?: string
  entityId?: string
  payload: Record<string, unknown>
  timestamp: number
}

export const EventTypes = {
  SALE_COMPLETED: 'sale.completed',
  SALE_VOIDED: 'sale.voided',
  SALE_REFUNDED: 'sale.refunded',
  INVENTORY_UPDATED: 'inventory.updated',
  STOCK_LOW: 'stock.low',
  STOCK_OUT: 'stock.out',
  STOCK_TRANSFERRED: 'stock.transferred',
  DEVICE_STATUS: 'device.status',
  SESSION_CHANGED: 'session.changed',
  PAYMENT_CONFIRMED: 'payment.confirmed',
  PAYMENT_FAILED: 'payment.failed',
  AUTOMATION_TRIGGERED: 'automation.triggered',
  NOTIFICATION_CREATED: 'notification.created',
  ORDER_CREATED: 'order.created',
  SHIFT_CLOSED: 'shift.closed',
} as const
