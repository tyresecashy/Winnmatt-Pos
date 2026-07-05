/**
 * Automation Engine — Public API
 *
 * Import from here to use the automation engine:
 *   import { emitEvent } from '@/lib/automation'
 */

export { emitEvent } from './events'
export type {
  EventType,
  EventSource,
  EmitEventOptions,
  ProcessEventResult,
  SaleCompletedPayload,
  StockChangedPayload,
  StockLowPayload,
  ShiftClosedPayload,
  CustomerCreatedPayload,
} from './types'
