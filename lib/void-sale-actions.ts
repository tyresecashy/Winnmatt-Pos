'use server'

import { voidSale, returnSale, getSaleAuditTrail } from '@/lib/sales-actions'

export async function serverVoidSale(
  saleId: string,
  branchId: string,
  voidReason: string,
  userId: string
) {
  return voidSale(saleId, branchId, voidReason, userId)
}

export async function serverReturnSale(
  saleId: string,
  branchId: string,
  returnReason: string,
  userId: string,
  returnDetails?: any
) {
  return returnSale(saleId, branchId, returnReason, userId, returnDetails)
}

export async function serverGetSaleAuditTrail(saleId: string) {
  return getSaleAuditTrail(saleId)
}
