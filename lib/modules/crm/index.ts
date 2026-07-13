/**
 * CRM Module — Public API
 *
 * Manages customer relationships, segments, credit, and CRM details.
 * Other modules should ONLY import from this file.
 *
 * Implementation: Delegates to lib/customer-crm-actions.ts, lib/segment-actions.ts, and lib/credit-actions.ts.
 */

import { logger } from '@/lib/logger'
import * as crm from '@/lib/customer-crm-actions'
import * as segments from '@/lib/segment-actions'
import * as credit from '@/lib/credit-actions'
import type { CustomerCRMDetail, CustomerActivity, CustomerSaleItem } from '@/lib/customer-crm-actions'
import type { CustomerCreditSummary } from '@/lib/credit-actions'
import type { Segment } from '@/lib/segment-actions'

// ─── Type helpers ─────────────────────────────────────────────────────────────
type CreditPaymentRow = Awaited<ReturnType<typeof credit.getCustomerPayments>>[number]
type CreditSummaryRow = Awaited<ReturnType<typeof credit.getCreditSummaries>>[number]
type CreditSummaryResult = Awaited<ReturnType<typeof credit.getCustomerCreditSummary>>
type CreditAgingRow = Awaited<ReturnType<typeof credit.getCreditAging>>[number]
// ─── Public API - Customer CRM ──────────────────────────────────────────────

export async function getCustomerCRMDetail(customerId: string): Promise<CustomerCRMDetail | null> {
  try {
    return await crm.getCustomerCRMDetail(customerId)
  } catch (error) {
    logger.error('[CRM Module] getCustomerCRMDetail failed', error instanceof Error ? error.message : String(error))
    return null
  }
}

export async function getCustomerActivity(customerId: string, limit?: number): Promise<CustomerActivity[]> {
  try {
    return await crm.getCustomerActivity(customerId, limit)
  } catch (error) {
    logger.error('[CRM Module] getCustomerActivity failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function getCustomerSalesHistory(customerId: string, limit?: number): Promise<CustomerSaleItem[]> {
  try {
    return await crm.getCustomerSalesHistory(customerId, limit)
  } catch (error) {
    logger.error('[CRM Module] getCustomerSalesHistory failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

// ─── Public API - Segments ──────────────────────────────────────────────────

export async function getSegments(): Promise<Segment[]> {
  try {
    return await segments.getSegments()
  } catch (error) {
    logger.error('[CRM Module] getSegments failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function getCustomerSegments(customerId: string): Promise<Segment[]> {
  try {
    return await segments.getCustomerSegments(customerId)
  } catch (error) {
    logger.error('[CRM Module] getCustomerSegments failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function assignCustomerToSegment(customerId: string, segmentId: string, assignedBy?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await segments.assignCustomerToSegment(customerId, segmentId, assignedBy)
    return { success: result }
  } catch (error) {
    logger.error('[CRM Module] assignCustomerToSegment failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function setCustomerSegments(customerId: string, segmentIds: string[], assignedBy?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await segments.setCustomerSegments(customerId, segmentIds, assignedBy)
    return { success: result }
  } catch (error) {
    logger.error('[CRM Module] setCustomerSegments failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Public API - Credit ────────────────────────────────────────────────────

export async function recordCreditPayment(data: Record<string, unknown>): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const result = await credit.recordCreditPayment(data as unknown as FormData)
    if ('error' in result && result.error) return { success: false, error: result.error as string }
    return { success: true }
  } catch (error) {
    logger.error('[CRM Module] recordCreditPayment failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function getCustomerPayments(customerId: string): Promise<CreditPaymentRow[]> {
  try {
    return await credit.getCustomerPayments(customerId)
  } catch (error) {
    logger.error('[CRM Module] getCustomerPayments failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function getCreditSummaries(): Promise<CreditSummaryRow[]> {
  try {
    return await credit.getCreditSummaries()
  } catch (error) {
    logger.error('[CRM Module] getCreditSummaries failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function getCustomerCreditSummary(customerId: string): Promise<CreditSummaryResult | null> {
  try {
    return await credit.getCustomerCreditSummary(customerId)
  } catch (error) {
    logger.error('[CRM Module] getCustomerCreditSummary failed', error instanceof Error ? error.message : String(error))
    return null
  }
}

export async function getCreditAging(): Promise<CreditAgingRow[]> {
  try {
    return await credit.getCreditAging()
  } catch (error) {
    logger.error('[CRM Module] getCreditAging failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function updateCreditLimit(customerId: string, limit: number): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await credit.updateCreditLimit(customerId, limit)
    if ('error' in result && result.error) return { success: false, error: result.error as string }
    return { success: true }
  } catch (error) {
    logger.error('[CRM Module] updateCreditLimit failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Backward-Compatible Re-exports ──────────────────────────────────────────

export type { CustomerCRMDetail, CustomerActivity, CustomerSaleItem } from '@/lib/customer-crm-actions'
export type { CustomerCreditSummary, CreditPaymentRecord, CreditAgingBucket } from '@/lib/credit-actions'
export type { Segment } from '@/lib/segment-actions'
