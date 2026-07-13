/**
 * Search API — GET /api/v1/search
 *
 * Global search across products, customers, sales, suppliers.
 * Uses PostgreSQL full-text search for fast, relevant results.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type APIContext } from '@/lib/api/middleware'
import { apiSuccess, apiBadRequest, apiInternal, parseSearchParams } from '@/lib/api/response'
import { logger } from '@/lib/logger'

interface SearchResult {
  entity_type: string
  id: string
  title: string
  subtitle: string
  meta?: Record<string, unknown>
}

interface ProductRow { id: string; name: string; sku: string; barcode: string | null; selling_price: number; status: string }
interface CustomerRow { id: string; name: string; phone: string | null; email: string | null; type: string; loyalty_points: number }
interface SaleRow { id: string; receipt_number: string; total_amount: number; payment_method: string; created_at: string }
interface SupplierRow { id: string; name: string; contact_person: string | null; phone: string | null; email: string | null }

export async function GET(request: NextRequest) {
  return withAuth(request, async (ctx: APIContext) => {
    try {
      const params = parseSearchParams(request)
      const query = params.q?.trim()

      if (!query || query.length < 2) {
        return apiBadRequest('Search query must be at least 2 characters')
      }

      const types = params.types?.split(',') || ['product', 'customer', 'sale', 'supplier']
      const limit = Math.min(50, parseInt(params.limit || '20', 10))
      const results: SearchResult[] = []

      // Search products
      if (types.includes('product')) {
        const { data } = await ctx.supabase
          .from('products')
          .select('id, name, sku, barcode, selling_price, status')
          .or(`name.ilike.%${query}%,sku.ilike.%${query}%,barcode.eq.${query}`)
          .eq('status', 'active')
          .limit(limit)

        if (data) {
          const rows = data as unknown as ProductRow[]
          results.push(...rows.map(p => ({
            entity_type: 'product',
            id: p.id,
            title: p.name,
            subtitle: `SKU: ${p.sku}${p.barcode ? ` | Barcode: ${p.barcode}` : ''}`,
            meta: { price: p.selling_price },
          })))
        }
      }

      // Search customers
      if (types.includes('customer')) {
        const { data } = await ctx.supabase
          .from('customers')
          .select('id, name, phone, email, type, loyalty_points')
          .or(`name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`)
          .limit(limit)

        if (data) {
          const rows = data as unknown as CustomerRow[]
          results.push(...rows.map(c => ({
            entity_type: 'customer',
            id: c.id,
            title: c.name,
            subtitle: `${c.phone || 'No phone'}${c.email ? ` | ${c.email}` : ''}`,
            meta: { type: c.type, loyalty_points: c.loyalty_points },
          })))
        }
      }

      // Search sales
      if (types.includes('sale')) {
        const { data } = await ctx.supabase
          .from('sales')
          .select('id, receipt_number, total_amount, payment_method, created_at')
          .or(`receipt_number.ilike.%${query}%`)
          .order('created_at', { ascending: false })
          .limit(limit)

        if (data) {
          const rows = data as unknown as SaleRow[]
          results.push(...rows.map(s => ({
            entity_type: 'sale',
            id: s.id,
            title: `Sale #${s.receipt_number}`,
            subtitle: `KSh ${s.total_amount.toLocaleString()} | ${s.payment_method}`,
            meta: { amount: s.total_amount, date: s.created_at },
          })))
        }
      }

      // Search suppliers
      if (types.includes('supplier')) {
        const { data } = await ctx.supabase
          .from('suppliers')
          .select('id, name, contact_person, phone, email')
          .or(`name.ilike.%${query}%,contact_person.ilike.%${query}%,phone.ilike.%${query}%`)
          .limit(limit)

        if (data) {
          const rows = data as unknown as SupplierRow[]
          results.push(...rows.map(s => ({
            entity_type: 'supplier',
            id: s.id,
            title: s.name,
            subtitle: `${s.contact_person || 'No contact'}${s.phone ? ` | ${s.phone}` : ''}`,
          })))
        }
      }

      // Sort by relevance (exact matches first, then partial)
      results.sort((a, b) => {
        const aExact = a.title.toLowerCase().includes(query.toLowerCase()) ? 0 : 1
        const bExact = b.title.toLowerCase().includes(query.toLowerCase()) ? 0 : 1
        return aExact - bExact
      })

      return apiSuccess(results.slice(0, limit))
    } catch (error) {
      logger.error('[Search API] Error:', error)
      return apiInternal()
    }
  })
}
