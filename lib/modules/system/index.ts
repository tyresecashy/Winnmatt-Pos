/**
 * System Module — Public API
 *
 * Provides system-level operations: developer tools, notifications,
 * global search, data staging, attachments, bulk operations, and campaigns.
 * Other modules should ONLY import from this file.
 *
 * Implementation: Delegates to lib/developer-actions.ts, lib/notification-actions.ts,
 * lib/search-actions.ts, lib/staging-actions.ts, lib/attachment-actions.ts,
 * lib/bulk-operations-actions.ts, and lib/campaign-actions.ts.
 */

import { logger } from '@/lib/logger'
import * as devActions from '@/lib/developer-actions'
import * as notifActions from '@/lib/notification-actions'
import * as searchActions from '@/lib/search-actions'
import * as stagingActions from '@/lib/staging-actions'
import * as attachmentActions from '@/lib/attachment-actions'
import * as bulkActions from '@/lib/bulk-operations-actions'
import * as campaignActions from '@/lib/campaign-actions'
import * as healthActions from '@/lib/system-health-actions'
import type { Campaign } from '@/lib/campaign-actions'
import type { SearchResult } from '@/lib/search-actions'
import type { BulkProduct, BulkCategory, BulkBranch, BulkSupplier } from '@/lib/bulk-operations-actions'

// ─── Type helpers ─────────────────────────────────────────────────────────────
type TableCountRow = Awaited<ReturnType<typeof devActions.getDatabaseTableCounts>>[number]
type DevHealthResult = Awaited<ReturnType<typeof devActions.getSystemHealth>>
type AuditLogRow = Awaited<ReturnType<typeof healthActions.getSystemAuditLog>>[number]
type LaunchReadinessResult = Awaited<ReturnType<typeof healthActions.getLaunchReadiness>>
type NotificationRow = Awaited<ReturnType<typeof notifActions.getNotifications>>[number]
type NotificationRuleRow = Awaited<ReturnType<typeof notifActions.getNotificationRules>>[number]
type GlobalSearchRow = SearchResult
type BulkOperationDataRow = Awaited<ReturnType<typeof bulkActions.getBulkOperationData>>

// ─── Public API - Developer ─────────────────────────────────────────────────

export async function getDatabaseTableCounts(): Promise<TableCountRow[]> {
  try {
    return await devActions.getDatabaseTableCounts()
  } catch (error) {
    logger.error('[System Module] getDatabaseTableCounts failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function getSystemHealth(): Promise<DevHealthResult> {
  try {
    return await devActions.getSystemHealth()
  } catch (error) {
    logger.error('[System Module] getSystemHealth failed', error instanceof Error ? error.message : String(error))
    return null as unknown as DevHealthResult
  }
}

// ─── Public API - System Health ──────────────────────────────────────────────

export async function getSystemAuditLog(limit?: number): Promise<AuditLogRow[]> {
  try {
    return await healthActions.getSystemAuditLog(limit)
  } catch (error) {
    logger.error('[System Module] getSystemAuditLog failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function getLaunchReadiness(branchId: string): Promise<LaunchReadinessResult> {
  try {
    return await healthActions.getLaunchReadiness(branchId)
  } catch (error) {
    logger.error('[System Module] getLaunchReadiness failed', error instanceof Error ?error.message : String(error))
    return null as unknown as LaunchReadinessResult
  }
}

export async function updateLaunchChecklistItem(branchId: string, itemKey: string, value: boolean): Promise<{ success: boolean; status?: string; error?: string }> {
  try {
    return await healthActions.updateLaunchChecklistItem(branchId, itemKey, value)
  } catch (error) {
    logger.error('[System Module] updateLaunchChecklistItem failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Public API - Notifications ─────────────────────────────────────────────

export async function getNotifications(userId: string, limit?: number): Promise<NotificationRow[]> {
  try {
    return await notifActions.getNotifications(userId, limit)
  } catch (error) {
    logger.error('[System Module] getNotifications failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function getUnreadCount(userId: string): Promise<number> {
  try {
    return await notifActions.getUnreadCount(userId)
  } catch (error) {
    logger.error('[System Module] getUnreadCount failed', error instanceof Error ? error.message : String(error))
    return 0
  }
}

export async function markAsRead(notificationId: string): Promise<{ success: boolean; error?: string }> {
  try {
    return await notifActions.markAsRead(notificationId)
  } catch (error) {
    logger.error('[System Module] markAsRead failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function markAllAsRead(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    return await notifActions.markAllAsRead(userId)
  } catch (error) {
    logger.error('[System Module] markAllAsRead failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function getNotificationRules(branchId?: string): Promise<NotificationRuleRow[]> {
  try {
    return await notifActions.getNotificationRules(branchId)
  } catch (error) {
    logger.error('[System Module] getNotificationRules failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

// ─── Public API - Search ────────────────────────────────────────────────────

export async function globalSearch(query: string, filters?: Record<string, unknown>): Promise<GlobalSearchRow[]> {
  try {
    const result = await searchActions.globalSearch(query, filters as unknown as Parameters<typeof searchActions.globalSearch>[1])
    return result.data ?? []
  } catch (error) {
    logger.error('[System Module] globalSearch failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function updateStagingPrice(itemId: string, price: number): Promise<{ success: boolean; error?: string }> {
  try {
    return await stagingActions.updateStagingPrice(itemId, price)
  } catch (error) {
    logger.error('[System Module] updateStagingPrice failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function approveStagingProduct(itemId: string, approvedBy: string): Promise<{ success: boolean; error?: string }> {
  try {
    return await stagingActions.approveStagingProduct(itemId, approvedBy)
  } catch (error) {
    logger.error('[System Module] approveStagingProduct failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function rejectStagingProduct(itemId: string, rejectedBy: string, reason: string): Promise<{ success: boolean; error?: string }> {
  try {
    return await stagingActions.rejectStagingProduct(itemId, rejectedBy, reason)
  } catch (error) {
    logger.error('[System Module] rejectStagingProduct failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function publishBatchToLive(batchId: string, approvedBy: string): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await stagingActions.publishBatchToLive(batchId, approvedBy)
    if ('success' in result) return result as unknown as { success: boolean; error?: string }
    return { success: !result.error, error: result.error }
  } catch (error) {
    logger.error('[System Module] publishBatchToLive failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Public API - Bulk Operations ───────────────────────────────────────────

export async function getBulkOperationData(): Promise<BulkOperationDataRow> {
  try {
    return await bulkActions.getBulkOperationData()
  } catch (error) {
    logger.error('[System Module] getBulkOperationData failed', error instanceof Error ? error.message : String(error))
    return { products: [], categories: [], branches: [], suppliers: [], inventory: [] } as unknown as BulkOperationDataRow
  }
}

export async function bulkUpdateProductPrice(productIds: string[], newPrice: number): Promise<{ success: boolean; updated: number; failed: number; error?: string }> {
  try {
    const result = await bulkActions.bulkUpdateProductPrice(productIds, newPrice)
    return { success: result.success, updated: result.updated, failed: result.failed, error: result.error }
  } catch (error) {
    logger.error('[System Module] bulkUpdateProductPrice failed', error instanceof Error ? error.message : String(error))
    return { success: false, updated: 0, failed: productIds.length, error: 'Operation failed. Please try again.' }
  }
}

export async function bulkUpdateProductCategory(productIds: string[], categoryId: string): Promise<{ success: boolean; updated: number; failed: number; error?: string }> {
  try {
    const result = await bulkActions.bulkUpdateProductCategory(productIds, categoryId)
    return { success: result.success, updated: result.updated, failed: result.failed, error: result.error }
  } catch (error) {
    logger.error('[System Module] bulkUpdateProductCategory failed', error instanceof Error ? error.message : String(error))
    return { success: false, updated: 0, failed: productIds.length, error: 'Operation failed. Please try again.' }
  }
}

export async function bulkAdjustInventory(adjustments: Array<{ productId: string; branchId: string; quantity: number; reason: string }>): Promise<{ success: boolean; updated: number; failed: number; error?: string }> {
  try {
    const result = await bulkActions.bulkAdjustInventory(adjustments)
    return { success: result.success, updated: result.updated, failed: result.failed, error: result.error }
  } catch (error) {
    logger.error('[System Module] bulkAdjustInventory failed', error instanceof Error ? error.message : String(error))
    return { success: false, updated: 0, failed: adjustments.length, error: 'Operation failed. Please try again.' }
  }
}

// ─── Public API - Campaigns ─────────────────────────────────────────────────

export async function getCampaigns(branchId?: string): Promise<Campaign[]> {
  try {
    return await campaignActions.getCampaigns(branchId)
  } catch (error) {
    logger.error('[System Module] getCampaigns failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function createCampaign(data: Record<string, unknown>): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const result = await campaignActions.createCampaign(data as unknown as Parameters<typeof campaignActions.createCampaign>[0])
    if (!result) return { success: false, error: 'Failed to create campaign' }
    return { success: true, id: result.id }
  } catch (error) {
    logger.error('[System Module] createCampaign failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function updateCampaign(id: string, data: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await campaignActions.updateCampaign(id, data as unknown as Parameters<typeof campaignActions.updateCampaign>[1])
    return { success: result !== null }
  } catch (error) {
    logger.error('[System Module] updateCampaign failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function deleteCampaign(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    return await campaignActions.deleteCampaign(id)
  } catch (error) {
    logger.error('[System Module] deleteCampaign failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Type Re-exports ──────────────────────────────────────────────────────────
export type { Campaign } from '@/lib/campaign-actions'
export type { SearchResult } from '@/lib/search-actions'
export type { BulkProduct, BulkCategory, BulkBranch, BulkSupplier } from '@/lib/bulk-operations-actions'
