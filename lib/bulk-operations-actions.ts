'use server'
import { logger } from '@/lib/logger'
import { authenticateServerAction } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'

export interface BulkProduct {
  id: string
  sku: string
  name: string
  selling_price: number
  purchase_price: number
  category_id: string | null
  category_name: string | null
  barcode: string | null
  reorder_level: number
}

export interface BulkCategory {
  id: string
  name: string
}

export interface BulkBranch {
  id: string
  name: string
}

export interface BulkSupplier {
  id: string
  name: string
}

export interface BulkOperationData {
  products: BulkProduct[]
  categories: BulkCategory[]
  branches: BulkBranch[]
  suppliers: BulkSupplier[]
}

export interface BulkInventory {
  product_id: string
  branch_id: string
  quantity: number
}

export interface BulkOperationData {
  products: BulkProduct[]
  categories: BulkCategory[]
  branches: BulkBranch[]
  suppliers: BulkSupplier[]
  inventory: BulkInventory[]
}

export async function getBulkOperationData(): Promise<BulkOperationData> {
  const empty = { products: [], categories: [], branches: [], suppliers: [], inventory: [] }
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return empty

    const [productsRes, categoriesRes, branchesRes, suppliersRes, invRes] = await Promise.all([
      supabaseAdmin.from('products').select('id, sku, name, selling_price, purchase_price, category_id, barcode, reorder_level').order('name'),
      supabaseAdmin.from('categories').select('id, name').order('name'),
      supabaseAdmin.from('branches').select('id, name').order('name'),
      supabaseAdmin.from('suppliers').select('id, name').order('name'),
      supabaseAdmin.from('inventory').select('product_id, branch_id, quantity'),
    ])

    const products: BulkProduct[] = ((productsRes.data || []) as any[]).map((p) => ({
      ...p,
      category_name: null,
    })) as BulkProduct[]

    if (categoriesRes.data && categoriesRes.data.length > 0) {
      const catMap = new Map((categoriesRes.data as Record<string, unknown>[]).map((c) => [c.id, c.name]))
      for (const p of products) {
        if (p.category_id && catMap.has(p.category_id)) {
          p.category_name = (catMap.get(p.category_id) as string) ?? ''
        }
      }
    }

    return {
      products,
      categories: (categoriesRes.data || []) as BulkCategory[],
      branches: (branchesRes.data || []) as BulkBranch[],
      suppliers: (suppliersRes.data || []) as BulkSupplier[],
      inventory: (invRes.data || []) as BulkInventory[],
    }
  } catch (error) {
    logger.error('Error fetching bulk operation data:', error)
    return empty
  }
}

export async function bulkUpdateProductPrice(
  productIds: string[],
  newPrice: number
): Promise<{ success: boolean; updated: number; failed: number; error?: string }> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return { success: false, updated: 0, failed: 0, error: 'Unauthorized' }

    const results = await Promise.allSettled(
      productIds.map(id =>
        supabaseAdmin
          .from('products')
          .update({ selling_price: Math.round(newPrice), updated_at: new Date().toISOString() })
          .eq('id', id)
      )
    )

    const updated = results.filter(r => r.status === 'fulfilled' && !r.value?.error).length
    const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value?.error)).length
    return { success: failed === 0, updated, failed }
  } catch (error) {
    return { success: false, updated: 0, failed: productIds.length, error: String(error) }
  }
}

export async function bulkUpdateProductCategory(
  productIds: string[],
  categoryId: string
): Promise<{ success: boolean; updated: number; failed: number; error?: string }> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return { success: false, updated: 0, failed: 0, error: 'Unauthorized' }

    const results = await Promise.allSettled(
      productIds.map(id =>
        supabaseAdmin
          .from('products')
          .update({ category_id: categoryId, updated_at: new Date().toISOString() })
          .eq('id', id)
      )
    )

    const updated = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length
    return { success: failed === 0, updated, failed }
  } catch (error) {
    return { success: false, updated: 0, failed: productIds.length, error: String(error) }
  }
}

export async function bulkAdjustInventory(
  adjustments: Array<{
    productId: string
    branchId: string
    quantity: number
    reason: string
  }>
): Promise<{ success: boolean; updated: number; failed: number; error?: string }> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return { success: false, updated: 0, failed: 0, error: 'Unauthorized' }

    let updated = 0
    let failed = 0

    for (const adj of adjustments) {
      const { data: inventory } = await supabaseAdmin
        .from('inventory')
        .select('id, quantity')
        .eq('product_id', adj.productId)
        .eq('branch_id', adj.branchId)
        .maybeSingle()

      if (!inventory) {
        failed++
        continue
      }

      const newQty = Math.max(0, inventory.quantity + adj.quantity)
      const appliedAdj = newQty - inventory.quantity

      const { error: updateErr } = await supabaseAdmin
        .from('inventory')
        .update({ quantity: newQty })
        .eq('id', inventory.id)

      if (updateErr) { failed++; continue }

      await supabaseAdmin.from('stock_movements').insert({
        product_id: adj.productId,
        branch_id: adj.branchId,
        type: 'adjustment',
        quantity: appliedAdj,
        notes: adj.reason,
      }).maybeSingle()

      updated++
    }

    return { success: failed === 0, updated, failed }
  } catch (error) {
    return { success: false, updated: 0, failed: adjustments.length, error: String(error) }
  }
}
