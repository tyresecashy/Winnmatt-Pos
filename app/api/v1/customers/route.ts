/**
 * Customers API — GET/POST /api/v1/customers
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type APIContext } from '@/lib/api/middleware'
import { apiPaginated, apiCreated, apiInternal, apiBadRequest, parseSearchParams, getPaginationParams } from '@/lib/api/response'

export async function GET(request: NextRequest) {
  return withAuth(request, async (ctx: APIContext) => {
    try {
      const params = parseSearchParams(request)
      const { page, limit, offset } = getPaginationParams(request)

      let query = ctx.supabase
        .from('customers')
        .select('*', { count: 'exact' })

      if (params.search) {
        query = query.or(`name.ilike.%${params.search}%,phone.ilike.%${params.search}%,email.ilike.%${params.search}%`)
      }

      if (params.type) {
        query = query.eq('type', params.type)
      }

      if (params.tier) {
        query = query.eq('tier', params.tier)
      }

      query = query.order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      const { data, count, error } = await query

      if (error) {
        return apiInternal(`Database error: ${error.message}`)
      }

      return apiPaginated(data || [], count || 0, page, limit)
    } catch (error) {
      console.error('[Customers API] Error:', error)
      return apiInternal()
    }
  })
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (ctx: APIContext) => {
    try {
      const body = await request.json()

      if (!body.name) {
        return apiBadRequest('Customer name is required')
      }

      const { data, error } = await ctx.supabase
        .from('customers')
        .insert({
          name: body.name,
          phone: body.phone || null,
          email: body.email || null,
          type: body.type || 'individual',
          loyalty_points: body.loyalty_points || 0,
          credit_limit: body.credit_limit || 0,
          credit_balance: body.credit_balance || 0,
          notes: body.notes || null,
          tags: body.tags || null,
        })
        .select()
        .single()

      if (error) {
        return apiInternal(`Create failed: ${error.message}`)
      }

      return apiCreated(data)
    } catch (error) {
      console.error('[Customers API] Error:', error)
      return apiInternal()
    }
  })
}
