/**
 * Products API — GET /api/v1/products
 *
 * List products with filtering, pagination, and sorting.
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
        .from('products')
        .select('*', { count: 'exact' })

      // Filters
      if (params.branch_id) {
        query = query.eq('branch_id', params.branch_id)
      } else if (ctx.branchId) {
        query = query.eq('branch_id', ctx.branchId)
      }

      if (params.category_id) {
        query = query.eq('category_id', params.category_id)
      }

      if (params.search) {
        query = query.or(`name.ilike.%${params.search}%,sku.ilike.%${params.search}%,barcode.eq.${params.search}`)
      }

      if (params.status) {
        query = query.eq('status', params.status)
      } else {
        query = query.eq('status', 'active')
      }

      // Sort and paginate
      query = query.order(column, { ascending })
        .range(offset, offset + limit - 1)

      const { data, count, error } = await query

      if (error) {
        logger.error('[Products API] Database query failed', { message: error.message, code: error.code })
        return apiInternal()
      }

      return apiPaginated(data || [], count || 0, page, limit)
    } catch (error) {
      logger.error('[Products API] Error:', error)
      return apiInternal()
    }
  })
}
