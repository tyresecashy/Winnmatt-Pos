'use server'

import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SearchResult {
  entity_type: 'product' | 'customer' | 'employee' | 'supplier'
  entity_id: string
  title: string
  subtitle: string | null
  metadata: Record<string, unknown>
  rank: number
}

export interface SearchFilters {
  branchId?: string
  entityTypes?: ('product' | 'customer' | 'employee' | 'supplier')[]
  limit?: number
}

// ─── Search Action ──────────────────────────────────────────────────────────

/**
 * Global search across all entities using PostgreSQL full-text search.
 */
export async function globalSearch(
  query: string,
  filters: SearchFilters = {}
): Promise<{ success: boolean; data?: SearchResult[]; error?: string }> {
  try {
    if (!query || query.trim().length === 0) {
      return { success: true, data: [] }
    }

    const { branchId, entityTypes, limit = 50 } = filters

    const { data, error } = await supabaseAdmin.rpc('search_all', {
      search_query: query.trim(),
      branch_id: branchId || null,
      entity_types: entityTypes || null,
      result_limit: limit,
    })

    if (error) {
      logger.error('[Search] RPC error:', error)
      // Fall back to basic LIKE search if full-text search fails
      return await fallbackSearch(query, filters)
    }

    return { success: true, data: (data || []) as SearchResult[] }
  } catch (error) {
    logger.error('[Search] Error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Search failed' }
  }
}

/**
 * Fallback search using LIKE queries (if full-text search is not available)
 */
async function fallbackSearch(
  query: string,
  filters: SearchFilters
): Promise<{ success: boolean; data?: SearchResult[]; error?: string }> {
  try {
    const { branchId, entityTypes, limit = 50 } = filters
    const searchPattern = `%${query.trim()}%`
    const results: SearchResult[] = []

    // Search products
    if (!entityTypes || entityTypes.includes('product')) {
      const { data: products } = await supabaseAdmin
        .from('products')
        .select('id, name, sku, description, selling_price, purchase_price, category_id, status')
        .or(`name.ilike.${searchPattern},sku.ilike.${searchPattern},description.ilike.${searchPattern}`)
        .limit(limit)

      for (const p of products || []) {
        results.push({
          entity_type: 'product',
          entity_id: p.id,
          title: p.name,
          subtitle: p.sku,
          metadata: {
            selling_price: p.selling_price,
            purchase_price: p.purchase_price,
            category_id: p.category_id,
            status: p.status,
          },
          rank: 0.5,
        })
      }
    }

    // Search customers
    if (!entityTypes || entityTypes.includes('customer')) {
      const { data: customers } = await supabaseAdmin
        .from('customers')
        .select('id, name, phone, email, loyalty_points, tier')
        .or(`name.ilike.${searchPattern},phone.ilike.${searchPattern},email.ilike.${searchPattern}`)
        .limit(limit)

      for (const c of customers || []) {
        results.push({
          entity_type: 'customer',
          entity_id: c.id,
          title: c.name,
          subtitle: c.phone,
          metadata: {
            email: c.email,
            loyalty_points: c.loyalty_points,
            tier: c.tier,
          },
          rank: 0.4,
        })
      }
    }

    // Search employees
    if (!entityTypes || entityTypes.includes('employee')) {
      const { data: employees } = await supabaseAdmin
        .from('employee_profiles')
        .select(`
          id,
          staff_number,
          position,
          department_id,
          user:users!employee_profiles_user_id_fkey(full_name, email)
        `)
        .or(`staff_number.ilike.${searchPattern}`)
        .limit(limit)

      for (const e of employees || []) {
        const fullName = (e as any).user?.full_name || 'Unknown'
        results.push({
          entity_type: 'employee',
          entity_id: e.id,
          title: fullName,
          subtitle: e.staff_number,
          metadata: {
            email: (e as any).user?.email,
            position: e.position,
            department: e.department_id,
          },
          rank: 0.3,
        })
      }
    }

    // Search suppliers
    if (!entityTypes || entityTypes.includes('supplier')) {
      const { data: suppliers } = await supabaseAdmin
        .from('suppliers')
        .select('id, name, contact_name, email, phone, status')
        .or(`name.ilike.${searchPattern},contact_name.ilike.${searchPattern},email.ilike.${searchPattern}`)
        .limit(limit)

      for (const s of suppliers || []) {
        results.push({
          entity_type: 'supplier',
          entity_id: s.id,
          title: s.name,
          subtitle: s.contact_name,
          metadata: {
            email: s.email,
            phone: s.phone,
            status: s.status,
          },
          rank: 0.2,
        })
      }
    }

    // Sort by rank descending
    results.sort((a, b) => b.rank - a.rank)

    // Limit results
    return { success: true, data: results.slice(0, limit) }
  } catch (error) {
    logger.error('[Search] Fallback search error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Search failed' }
  }
}

/**
 * Get recent searches for a user (stored in localStorage client-side)
 */
export async function getRecentSearches(): Promise<string[]> {
  // This is handled client-side via localStorage
  return []
}

/**
 * Get popular searches (could be implemented with analytics)
 */
export async function getPopularSearches(): Promise<string[]> {
  // Placeholder for future analytics
  return ['milk', 'bread', 'sugar', 'rice', 'cooking oil']
}
