/**
 * Sales API — GET /api/v1/sales
 *
 * List sales with filtering and pagination.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type APIContext } from '@/lib/api/middleware'
import { apiPaginated, apiInternal, parseSearchParams, getPaginationParams, getSortParams } from '@/lib/api/response'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  return withAuth(request, async (ctx: APIContext) => {
    try {
      const params = parseSearchParams(request)
      const { page, limit, offset } = getPaginationParams(request)
      const { column, ascending } = getSortParams(request)

      let query = ctx.supabase
        .from('sales')
        .select('*', { count: 'exact' })

      // Filters
      if (params.branch_id) {
        query = query.eq('branch_id', params.branch_id)
      } else if (ctx.branchId) {
        query = query.eq('branch_id', ctx.branchId)
      }

      if (params.cashier_id) {
        query = query.eq('cashier_id', params.cashier_id)
      }

      if (params.customer_id) {
        query = query.eq('customer_id', params.customer_id)
      }

      if (params.start_date) {
        query = query.gte('created_at', params.start_date)
      }

      if (params.end_date) {
        query = query.lte('created_at', params.end_date)
      }

      if (params.status) {
        query = query.eq('sale_status', params.status)
      }

      if (params.payment_method) {
        query = query.eq('payment_method', params.payment_method)
      }

      // Sort and paginate
      query = query.order(column, { ascending })
        .range(offset, offset + limit - 1)

      const { data, count, error } = await query

      if (error) {
        logger.error('[Sales API] Database query failed', { message: error.message, code: error.code })
        return apiInternal()
      }

      return apiPaginated(data || [], count || 0, page, limit)
    } catch (error) {
      logger.error('[Sales API] Error:', error)
      return apiInternal()
    }
  })
}
