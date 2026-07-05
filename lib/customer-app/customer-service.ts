import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface CustomerProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  loyalty_points: number;
  total_spent: number;
  member_since: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
}

export interface CustomerOrder {
  id: string;
  order_number: string;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'picked_up' | 'delivered' | 'cancelled';
  type: 'pickup' | 'delivery';
  items: CustomerOrderItem[];
  subtotal: number;
  tax: number;
  delivery_fee: number;
  total: number;
  delivery_address?: string;
  estimated_ready_time?: string;
  created_at: string;
}

export interface CustomerOrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface LoyaltyReward {
  id: string;
  name: string;
  description: string;
  points_required: number;
  reward_type: 'discount' | 'free_item' | 'cashback';
  reward_value: number;
  is_available: boolean;
  expires_at?: string;
}

export interface DigitalReceipt {
  id: string;
  receipt_number: string;
  order_id: string;
  store_name: string;
  store_address: string;
  items: any[];
  subtotal: number;
  tax: number;
  total: number;
  payment_method: string;
  payment_status: string;
  created_at: string;
  qr_code: string;
}

export interface StoreLocation {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  latitude: number;
  longitude: number;
  operating_hours: string;
  is_open: boolean;
  distance?: number;
}

export class CustomerAppService {
  // Profile
  async getCustomerProfile(customerId: string): Promise<CustomerProfile | null> {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }

    // Calculate tier based on total spent
    const totalSpent = data.total_spent || 0;
    let tier: CustomerProfile['tier'] = 'bronze';
    if (totalSpent >= 100000) tier = 'platinum';
    else if (totalSpent >= 50000) tier = 'gold';
    else if (totalSpent >= 20000) tier = 'silver';

    return {
      id: data.id,
      name: data.name,
      email: data.email,
      phone: data.phone,
      loyalty_points: data.loyalty_points || 0,
      total_spent: totalSpent,
      member_since: data.created_at,
      tier,
    };
  }

  async updateProfile(customerId: string, updates: Partial<CustomerProfile>): Promise<boolean> {
    const { error } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', customerId);

    return !error;
  }

  // Orders
  async getCustomerOrders(customerId: string, limit: number = 20): Promise<CustomerOrder[]> {
    const { data, error } = await supabase
      .from('customer_orders')
      .select(`
        *,
        items:customer_order_items(
          product_id,
          products(name),
          quantity,
          unit_price_cents,
          total_cents
        )
      `)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching orders:', error);
      return [];
    }

    return (data || []).map(order => ({
      id: order.id,
      order_number: order.order_number,
      status: order.status,
      type: order.type || 'pickup',
      items: (order.items || []).map((item: any) => ({
        product_id: item.product_id,
        product_name: item.products?.name || 'Unknown',
        quantity: item.quantity,
        unit_price: item.unit_price_cents || 0,
        total_price: item.total_cents || 0,
      })),
      subtotal: order.subtotal_cents || 0,
      tax: order.tax_cents || 0,
      delivery_fee: order.delivery_fee_cents || 0,
      total: order.total_cents || 0,
      delivery_address: order.delivery_address,
      estimated_ready_time: order.estimated_ready_time,
      created_at: order.created_at,
    }));
  }

  async getOrder(orderId: string): Promise<CustomerOrder | null> {
    const { data, error } = await supabase
      .from('customer_orders')
      .select(`
        *,
        items:customer_order_items(
          product_id,
          products(name),
          quantity,
          unit_price_cents,
          total_cents
        )
      `)
      .eq('id', orderId)
      .single();

    if (error) {
      console.error('Error fetching order:', error);
      return null;
    }

    return {
      id: data.id,
      order_number: data.order_number,
      status: data.status,
      type: data.type || 'pickup',
      items: (data.items || []).map((item: any) => ({
        product_id: item.product_id,
        product_name: item.products?.name || 'Unknown',
        quantity: item.quantity,
        unit_price: item.unit_price_cents || 0,
        total_price: item.total_cents || 0,
      })),
      subtotal: data.subtotal_cents || 0,
      tax: data.tax_cents || 0,
      delivery_fee: data.delivery_fee_cents || 0,
      total: data.total_cents || 0,
      delivery_address: data.delivery_address,
      estimated_ready_time: data.estimated_ready_time,
      created_at: data.created_at,
    };
  }

  async createOrder(order: Omit<CustomerOrder, 'id' | 'created_at' | 'status'>): Promise<CustomerOrder | null> {
    const { data, error } = await supabase
      .from('customer_orders')
      .insert({
        ...order,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating order:', error);
      return null;
    }

    return data;
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    const { error } = await supabase
      .from('customer_orders')
      .update({ status: 'cancelled' })
      .eq('id', orderId);

    return !error;
  }

  // Loyalty
  async getLoyaltyPoints(customerId: string): Promise<number> {
    const { data, error } = await supabase
      .from('customers')
      .select('loyalty_points')
      .eq('id', customerId)
      .single();

    if (error) return 0;
    return data?.loyalty_points || 0;
  }

  async getAvailableRewards(): Promise<LoyaltyReward[]> {
    const { data, error } = await supabase
      .from('loyalty_rewards')
      .select('*')
      .eq('is_available', true)
      .order('points_required');

    if (error) {
      console.error('Error fetching rewards:', error);
      return [];
    }

    return (data || []).map(reward => ({
      id: reward.id,
      name: reward.name,
      description: reward.description,
      points_required: reward.points_required,
      reward_type: reward.reward_type,
      reward_value: reward.reward_value,
      is_available: reward.is_available,
      expires_at: reward.expires_at,
    }));
  }

  async redeemReward(customerId: string, rewardId: string): Promise<boolean> {
    // Get reward details
    const { data: reward } = await supabase
      .from('loyalty_rewards')
      .select('*')
      .eq('id', rewardId)
      .single();

    if (!reward) return false;

    // Check if customer has enough points
    const points = await this.getLoyaltyPoints(customerId);
    if (points < reward.points_required) return false;

    // Deduct points and create redemption record
    const { error: deductError } = await supabase
      .from('customers')
      .update({ loyalty_points: points - reward.points_required })
      .eq('id', customerId);

    if (deductError) return false;

    // Record redemption
    const { error: recordError } = await supabase
      .from('loyalty_redemptions')
      .insert({
        customer_id: customerId,
        reward_id: rewardId,
        points_used: reward.points_required,
      });

    return !recordError;
  }

  async earnPoints(customerId: string, orderId: string, amount: number): Promise<boolean> {
    // Earn 1 point per KES 100 spent
    const pointsToEarn = Math.floor(amount / 10000);

    const { data: customer } = await supabase
      .from('customers')
      .select('loyalty_points')
      .eq('id', customerId)
      .single();

    if (!customer) return false;

    const { error } = await supabase
      .from('customers')
      .update({ loyalty_points: (customer.loyalty_points || 0) + pointsToEarn })
      .eq('id', customerId);

    return !error;
  }

  // Receipts
  async getCustomerReceipts(customerId: string, limit: number = 20): Promise<DigitalReceipt[]> {
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching receipts:', error);
      return [];
    }

    return (data || []).map(sale => ({
      id: sale.id,
      receipt_number: sale.receipt_number,
      order_id: sale.id,
      store_name: 'WinnMatt Supermarket',
      store_address: '123 Main Street, Nairobi',
      items: sale.items || [],
      subtotal: sale.subtotal_cents || 0,
      tax: sale.tax_cents || 0,
      total: sale.total_amount_cents || 0,
      payment_method: sale.payment_method || 'Cash',
      payment_status: sale.status || 'completed',
      created_at: sale.created_at,
      qr_code: `RECEIPT-${sale.id}`,
    }));
  }

  async getReceipt(receiptId: string): Promise<DigitalReceipt | null> {
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .eq('id', receiptId)
      .single();

    if (error) {
      console.error('Error fetching receipt:', error);
      return null;
    }

    return {
      id: data.id,
      receipt_number: data.receipt_number,
      order_id: data.id,
      store_name: 'WinnMatt Supermarket',
      store_address: '123 Main Street, Nairobi',
      items: data.items || [],
      subtotal: data.subtotal_cents || 0,
      tax: data.tax_cents || 0,
      total: data.total_amount_cents || 0,
      payment_method: data.payment_method || 'Cash',
      payment_status: data.status || 'completed',
      created_at: data.created_at,
      qr_code: `RECEIPT-${data.id}`,
    };
  }

  // Store Locator
  async getStoreLocations(customerLat?: number, customerLng?: number): Promise<StoreLocation[]> {
    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching store locations:', error);
      return [];
    }

    const stores = (data || []).map(branch => ({
      id: branch.id,
      name: branch.name,
      address: branch.address,
      city: branch.city,
      phone: branch.phone,
      latitude: branch.latitude || 0,
      longitude: branch.longitude || 0,
      operating_hours: branch.operating_hours || '8:00 AM - 9:00 PM',
      is_open: this.isStoreOpen(branch.operating_hours),
      distance: 0,
    }));

    // Calculate distance if customer location provided
    if (customerLat && customerLng) {
      stores.forEach(store => {
        store.distance = this.calculateDistance(
          customerLat,
          customerLng,
          store.latitude,
          store.longitude
        );
      });
      stores.sort((a, b) => (a.distance || 0) - (b.distance || 0));
    }

    return stores;
  }

  private isStoreOpen(operatingHours: string): boolean {
    // Simple check - in production, parse operating hours properly
    const now = new Date();
    const hour = now.getHours();
    return hour >= 8 && hour < 21; // 8 AM to 9 PM
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    // Haversine formula
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Products
  async searchProducts(query: string, limit: number = 20): Promise<any[]> {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, category_id, selling_price')
      .or(`name.ilike.%${query}%`)
      .limit(limit);

    if (error) {
      console.error('Error searching products:', error);
      return [];
    }

    return (data || []).map(product => ({
      id: product.id,
      name: product.name,
      category: product.category_id,
      price: product.selling_price || 0,
    }));
  }

  async getProduct(productId: string): Promise<any | null> {
    const { data: productData, error } = await supabase
      .from('products')
      .select('id, name, description, category_id, selling_price')
      .eq('id', productId)
      .single();

    if (error) {
      console.error('Error fetching product:', error);
      return null;
    }

    // Get stock from inventory
    const { data: inventory } = await supabase
      .from('inventory')
      .select('quantity')
      .eq('product_id', productId)
      .limit(1);

    const currentStock = inventory?.reduce((sum, i) => sum + (i.quantity || 0), 0) || 0;

    return {
      id: productData.id,
      name: productData.name,
      category: productData.category_id,
      price: productData.selling_price || 0,
      description: productData.description,
      inStock: currentStock > 0,
    };
  }
}

export const customerAppService = new CustomerAppService();
