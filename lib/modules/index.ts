/**
 * WINNMATT Module System
 *
 * This is the central entry point for all module imports.
 * Use this file to import from any module.
 *
 * Usage:
 *   import { sales, inventory, finance } from '@/lib/modules'
 *
 * Rules:
 * 1. Never import from module internal files directly
 * 2. All cross-module communication goes through events
 * 3. Shared utilities come from '@/lib/shared/contracts'
 */

export * as sales from './sales'
export * as inventory from './inventory'
export * as finance from './finance'
export * as customers from './customers'
export * as workforce from './workforce'
export * as automation from './automation'

// Re-export shared contracts
export {
  MODULES,
  type ModuleId,
  type EventBus,
  type EventHandler,
  type BusEvent,
  type ModuleHealth,
  type AuditEntry,
  type NotificationPayload,
  recordAudit,
  sendNotification,
  formatKES,
  convertCurrency,
} from '../shared/contracts'
