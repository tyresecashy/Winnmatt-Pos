'use server'

import { supabaseAdmin } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'
import type { Database } from '@/lib/db.types'

function requireEnv(name: string, value: string | undefined): string {
  if (!value || value.includes('placeholder')) {
    throw new Error(`[ENV] Missing required environment variable: ${name}`)
  }

  return value
}

// Client for auth operations
const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL)
const supabaseServiceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY)
const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey)

export async function getProducts() {
  try {
    const { data, error } = await supabaseAdmin
      .from('products')
      .select(`
        *,
        category:categories(id, name, icon)
      `)
      .order('name')

    if (error) throw error
    return data || []
  } catch (error) {
    logger.error('Error fetching products:', error)
    return []
  }
}

export async function authenticateUser(email: string, password: string) {
  try {
    const { data, error } = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw error
    return { success: true, user: data.user, session: data.session }
  } catch (error: unknown) {
    logger.error('Authentication error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Authentication failed' 
    }
  }
}

export async function getProductsByCategory(categoryId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('category_id', categoryId)
      .order('name')

    if (error) throw error
    return data || []
  } catch (error) {
    logger.error('Error fetching products by category:', error)
    return []
  }
}

export async function getInventory(branchId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('inventory')
      .select(`
        *,
        product:products(id, sku, name, selling_price, category_id)
      `)
      .eq('branch_id', branchId)

    if (error) throw error
    return data || []
  } catch (error) {
    logger.error('Error fetching inventory:', error)
    return []
  }
}

export async function getCategories() {
  try {
    const { data, error } = await supabaseAdmin
      .from('categories')
      .select('*')
      .order('name')

    if (error) throw error
    return data || []
  } catch (error) {
    logger.error('Error fetching categories:', error)
    return []
  }
}

export async function getCustomers() {
  try {
    const { data, error } = await supabaseAdmin
      .from('customers')
      .select('*')
      .order('name')

    if (error) throw error
    return data || []
  } catch (error) {
    logger.error('Error fetching customers:', error)
    return []
  }
}

export async function getSuppliers() {
  try {
    const { data, error } = await supabaseAdmin
      .from('suppliers')
      .select('*')
      .order('name')

    if (error) throw error
    return data || []
  } catch (error) {
    logger.error('Error fetching suppliers:', error)
    return []
  }
}

export async function getBranches() {
  try {
    const { data, error } = await supabaseAdmin
      .from('branches')
      .select('*')
      .order('name')

    if (error) throw error
    return data || []
  } catch (error) {
    logger.error('Error fetching branches:', error)
    return []
  }
}

export async function getSales(branchId: string, limit: number = 50) {
  try {
    const { data, error } = await supabaseAdmin
      .from('sales')
      .select(`
        *,
        customer:customers(id, name),
        sale_items(*, product:products(sku, name))
      `)
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  } catch (error) {
    logger.error('Error fetching sales:', error)
    return []
  }
}

export async function createSale(saleData: Database['public']['Tables']['sales']['Insert']) {
  try {
    const { data, error } = await supabaseAdmin
      .from('sales')
      .insert([saleData])
      .select()

    if (error) throw error
    return data?.[0] || null
  } catch (error) {
    logger.error('Error creating sale:', error)
    return null
  }
}

export async function createSaleItems(items: Database['public']['Tables']['sale_items']['Insert'][]) {
  try {
    const { data, error } = await supabaseAdmin
      .from('sale_items')
      .insert(items)
      .select()

    if (error) throw error
    return data || []
  } catch (error) {
    logger.error('Error creating sale items:', error)
    return []
  }
}

export async function reduceInventory(productId: string, branchId: string, quantity: number) {
  try {
    // Use rpc to call a PostgreSQL function or use increment
    const { data, error } = await supabaseAdmin
      .from('inventory')
      .update({ quantity: supabaseAdmin.rpc('increment', { quantity }) } as unknown as Record<string, unknown>)
      .eq('product_id', productId)
      .eq('branch_id', branchId)
      .select()

    if (error) {
      // Fallback: fetch current, then update
      const { data: current } = await supabaseAdmin
        .from('inventory')
        .select('quantity')
        .eq('product_id', productId)
        .eq('branch_id', branchId)
        .single()

      if (current) {
        const newQuantity = Math.max(0, (current.quantity || 0) - quantity)
        const { data: updated, error: updateError } = await supabaseAdmin
          .from('inventory')
          .update({ quantity: newQuantity })
          .eq('product_id', productId)
          .eq('branch_id', branchId)
          .select()

        if (updateError) throw updateError
        return updated?.[0] || null
      }
      throw error
    }
    return data?.[0] || null
  } catch (error) {
    logger.error('Error reducing inventory:', error)
    return null
  }
}

export async function recordStockMovement(movement: Database['public']['Tables']['stock_movements']['Insert']) {
  try {
    const { data, error } = await supabaseAdmin
      .from('stock_movements')
      .insert([movement])
      .select()

    if (error) throw error
    return data?.[0] || null
  } catch (error) {
    logger.error('Error recording stock movement:', error)
    return null
  }
}
