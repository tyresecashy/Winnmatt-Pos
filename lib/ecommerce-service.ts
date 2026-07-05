'use server'

import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EcommerceStore {
  id: string
  name: string
  slug: string
  description: string | null
  logo_url: string | null
  banner_url: string | null
  currency: string
  status: 'active' | 'inactive' | 'maintenance'
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface EcommerceOrder {
  id: string
  order_number: string
  store_id: string
  customer_id: string | null
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded'
  subtotal: number
  tax_amount: number
  shipping_amount: number
  discount_amount: number
  total_amount: number
  currency: string
  payment_method: string | null
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded'
  payment_reference: string | null
  shipping_address: Record<string, unknown> | null
  billing_address: Record<string, unknown> | null
  notes: string | null
  created_at: string
  updated_at: string
  confirmed_at: string | null
  shipped_at: string | null
  delivered_at: string | null
  cancelled_at: string | null
  items?: EcommerceOrderItem[]
}

export interface EcommerceOrderItem {
  id: string
  order_id: string
  product_id: string
  variant_id: string | null
  quantity: number
  unit_price: number
  total_price: number
  tax_rate: number
  discount_amount: number
  product?: {
    name: string
    sku: string
    image_url?: string
  }
}

export interface CartItem {
  id: string
  cart_id: string
  product_id: string
  quantity: number
  product?: {
    name: string
    sku: string
    selling_price: number
    image_url?: string
  }
}

export interface ShoppingCart {
  id: string
  session_id: string
  customer_id: string | null
  items: CartItem[]
  total: number
  created_at: string
  updated_at: string
}

// ─── E-commerce Service ─────────────────────────────────────────────────────

/**
 * Get all online stores
 */
export async function getStores(): Promise<EcommerceStore[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('ecommerce_stores')
      .select('*')
      .order('name')

    if (error) throw error
    return (data || []) as EcommerceStore[]
  } catch (error) {
    logger.error('[Ecommerce] Failed to get stores:', error)
    return []
  }
}

/**
 * Get a store by slug
 */
export async function getStoreBySlug(slug: string): Promise<EcommerceStore | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('ecommerce_stores')
      .select('*')
      .eq('slug', slug)
      .single()

    if (error) return null
    return data as EcommerceStore
  } catch (error) {
    logger.error('[Ecommerce] Failed to get store:', error)
    return null
  }
}

/**
 * Create a new store
 */
export async function createStore(
  name: string,
  slug: string,
  description?: string
): Promise<{ success: boolean; data?: EcommerceStore; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin
      .from('ecommerce_stores')
      .insert({ name, slug, description })
      .select()
      .single()

    if (error) throw error
    return { success: true, data: data as EcommerceStore }
  } catch (error) {
    logger.error('[Ecommerce] Failed to create store:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Get all orders
 */
export async function getOrders(
  filters: {
    storeId?: string
    status?: string
    paymentStatus?: string
    limit?: number
    offset?: number
  } = {}
): Promise<{ orders: EcommerceOrder[]; total: number }> {
  try {
    const { storeId, status, paymentStatus, limit = 50, offset = 0 } = filters

    let query = supabaseAdmin
      .from('ecommerce_orders')
      .select('*', { count: 'exact' })

    if (storeId) query = query.eq('store_id', storeId)
    if (status) query = query.eq('status', status)
    if (paymentStatus) query = query.eq('payment_status', paymentStatus)

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error
    return { orders: (data || []) as EcommerceOrder[], total: count || 0 }
  } catch (error) {
    logger.error('[Ecommerce] Failed to get orders:', error)
    return { orders: [], total: 0 }
  }
}

/**
 * Get order by ID with items
 */
export async function getOrder(orderId: string): Promise<EcommerceOrder | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('ecommerce_orders')
      .select(`
        *,
        items:ecommerce_order_items(
          *,
          product:products(name, sku, image_url)
        )
      `)
      .eq('id', orderId)
      .single()

    if (error) return null
    return data as EcommerceOrder
  } catch (error) {
    logger.error('[Ecommerce] Failed to get order:', error)
    return null
  }
}

/**
 * Create a new order
 */
export async function createOrder(
  storeId: string,
  items: { productId: string; quantity: number; unitPrice: number }[],
  options: {
    customerId?: string
    shippingAddress?: Record<string, unknown>
    billingAddress?: Record<string, unknown>
    notes?: string
    paymentMethod?: string
  } = {}
): Promise<{ success: boolean; data?: EcommerceOrder; error?: string }> {
  try {
    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0)
    const taxAmount = 0 // Calculate based on tax rules
    const shippingAmount = 0 // Calculate based on shipping method
    const totalAmount = subtotal + taxAmount + shippingAmount - 0 // discount

    // Create order
    const { data: order, error: orderError } = await supabaseAdmin
      .from('ecommerce_orders')
      .insert({
        store_id: storeId,
        customer_id: options.customerId || null,
        subtotal,
        tax_amount: taxAmount,
        shipping_amount: shippingAmount,
        total_amount: totalAmount,
        payment_method: options.paymentMethod || null,
        shipping_address: options.shippingAddress || null,
        billing_address: options.billingAddress || null,
        notes: options.notes || null,
      })
      .select()
      .single()

    if (orderError) throw orderError

    // Create order items
    const orderItems = items.map(item => ({
      order_id: order.id,
      product_id: item.productId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total_price: item.unitPrice * item.quantity,
    }))

    const { error: itemsError } = await supabaseAdmin
      .from('ecommerce_order_items')
      .insert(orderItems)

    if (itemsError) throw itemsError

    // Emit order.created event
    const { emitEvent } = await import('@/lib/automation/events')
    await emitEvent('order.created', {
      order_id: order.id,
      order_number: order.order_number,
      total_amount: totalAmount,
      customer_id: options.customerId,
    }, { source: 'ecommerce', entity_type: 'order', entity_id: order.id })

    return { success: true, data: order as EcommerceOrder }
  } catch (error) {
    logger.error('[Ecommerce] Failed to create order:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Update order status
 */
export async function updateOrderStatus(
  orderId: string,
  status: EcommerceOrder['status']
): Promise<{ success: boolean; error?: string }> {
  try {
    const updates: Record<string, unknown> = { status }

    // Set timestamp based on status
    switch (status) {
      case 'confirmed':
        updates.confirmed_at = new Date().toISOString()
        break
      case 'shipped':
        updates.shipped_at = new Date().toISOString()
        break
      case 'delivered':
        updates.delivered_at = new Date().toISOString()
        break
      case 'cancelled':
        updates.cancelled_at = new Date().toISOString()
        break
    }

    const { error } = await supabaseAdmin
      .from('ecommerce_orders')
      .update(updates)
      .eq('id', orderId)

    if (error) throw error

    // Emit event
    const { emitEvent } = await import('@/lib/automation/events')
    await emitEvent(`order.${status}`, {
      order_id: orderId,
      status,
    }, { source: 'ecommerce', entity_type: 'order', entity_id: orderId })

    return { success: true }
  } catch (error) {
    logger.error('[Ecommerce] Failed to update order status:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Get or create shopping cart
 */
export async function getOrCreateCart(
  sessionId: string,
  customerId?: string
): Promise<ShoppingCart> {
  try {
    // Try to get existing cart
    let { data: cart } = await supabaseAdmin
      .from('ecommerce_cart')
      .select('*')
      .eq('session_id', sessionId)
      .single()

    // Create new cart if not exists
    if (!cart) {
      const { data: newCart } = await supabaseAdmin
        .from('ecommerce_cart')
        .insert({ session_id: sessionId, customer_id: customerId || null })
        .select()
        .single()
      cart = newCart
    }

    // Get cart items
    const { data: items } = await supabaseAdmin
      .from('ecommerce_cart_items')
      .select(`
        *,
        product:products(name, sku, selling_price, image_url)
      `)
      .eq('cart_id', cart.id)

    const cartItems = (items || []) as CartItem[]
    const total = cartItems.reduce((sum, item) => {
      const price = item.product?.selling_price || 0
      return sum + (price * item.quantity)
    }, 0)

    return {
      ...cart,
      items: cartItems,
      total,
    } as ShoppingCart
  } catch (error) {
    logger.error('[Ecommerce] Failed to get/create cart:', error)
    return {
      id: '',
      session_id: sessionId,
      customer_id: customerId,
      items: [],
      total: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  }
}

/**
 * Add item to cart
 */
export async function addToCart(
  cartId: string,
  productId: string,
  quantity: number = 1
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if item already in cart
    const { data: existing } = await supabaseAdmin
      .from('ecommerce_cart_items')
      .select('*')
      .eq('cart_id', cartId)
      .eq('product_id', productId)
      .single()

    if (existing) {
      // Update quantity
      const { error } = await supabaseAdmin
        .from('ecommerce_cart_items')
        .update({ quantity: existing.quantity + quantity })
        .eq('id', existing.id)

      if (error) throw error
    } else {
      // Add new item
      const { error } = await supabaseAdmin
        .from('ecommerce_cart_items')
        .insert({ cart_id: cartId, product_id: productId, quantity })

      if (error) throw error
    }

    return { success: true }
  } catch (error) {
    logger.error('[Ecommerce] Failed to add to cart:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Remove item from cart
 */
export async function removeFromCart(
  cartId: string,
  productId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from('ecommerce_cart_items')
      .delete()
      .eq('cart_id', cartId)
      .eq('product_id', productId)

    if (error) throw error
    return { success: true }
  } catch (error) {
    logger.error('[Ecommerce] Failed to remove from cart:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Sync product to online store
 */
export async function syncProduct(
  productId: string,
  storeId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get product details
    const { data: product } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('id', productId)
      .single()

    if (!product) {
      return { success: false, error: 'Product not found' }
    }

    // Sync logic would go here (integrate with Shopify, WooCommerce, etc.)
    // For now, just update the sync status

    const { error } = await supabaseAdmin
      .from('ecommerce_product_sync')
      .upsert({
        product_id: productId,
        store_id: storeId,
        sync_status: 'synced',
        last_synced_at: new Date().toISOString(),
        online_data: product,
      })

    if (error) throw error
    return { success: true }
  } catch (error) {
    logger.error('[Ecommerce] Failed to sync product:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Validate discount code
 */
export async function validateDiscountCode(
  code: string,
  orderAmount: number
): Promise<{ valid: boolean; discount?: number; error?: string }> {
  try {
    const { data: discountCode, error } = await supabaseAdmin
      .from('ecommerce_discount_codes')
      .select('*')
      .eq('code', code.toUpperCase())
      .eq('is_active', true)
      .single()

    if (error || !discountCode) {
      return { valid: false, error: 'Invalid discount code' }
    }

    // Check expiration
    if (discountCode.expires_at && new Date(discountCode.expires_at) < new Date()) {
      return { valid: false, error: 'Discount code has expired' }
    }

    // Check usage limit
    if (discountCode.usage_limit && discountCode.used_count >= discountCode.usage_limit) {
      return { valid: false, error: 'Discount code usage limit reached' }
    }

    // Check minimum order amount
    if (discountCode.min_order_amount && orderAmount < discountCode.min_order_amount) {
      return { valid: false, error: `Minimum order amount is ${discountCode.min_order_amount}` }
    }

    // Calculate discount
    let discount = 0
    if (discountCode.discount_type === 'percentage') {
      discount = (orderAmount * discountCode.discount_value) / 100
      if (discountCode.max_discount_amount) {
        discount = Math.min(discount, discountCode.max_discount_amount)
      }
    } else {
      discount = discountCode.discount_value
    }

    return { valid: true, discount }
  } catch (error) {
    logger.error('[Ecommerce] Failed to validate discount code:', error)
    return { valid: false, error: 'Failed to validate discount code' }
  }
}
