import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface SupplierUser {
  id: string;
  supplier_id: string;
  email: string;
  name: string;
  role: 'admin' | 'viewer';
  is_active: boolean;
  last_login: string | null;
  created_at: string;
}

export interface SupplierOrder {
  id: string;
  order_number: string;
  supplier_id: string;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  total_amount: number;
  expected_delivery_date: string;
  actual_delivery_date: string | null;
  items: SupplierOrderItem[];
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface SupplierOrderItem {
  product_id: string;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface SupplierInvoice {
  id: string;
  invoice_number: string;
  supplier_id: string;
  purchase_order_id: string | null;
  amount: number;
  tax_amount: number;
  total_amount: number;
  due_date: string;
  status: 'draft' | 'submitted' | 'approved' | 'paid' | 'overdue';
  items: SupplierInvoiceItem[];
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface SupplierInvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface SupplierProduct {
  id: string;
  supplier_id: string;
  product_name: string;
  sku: string;
  description: string;
  category: string;
  unit_price: number;
  minimum_order_quantity: number;
  lead_time_days: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SupplierPerformance {
  totalOrders: number;
  onTimeDeliveryRate: number;
  qualityScore: number;
  averageLeadTime: number;
  totalRevenue: number;
  paymentTerms: string;
}

export class SupplierPortalService {
  // Authentication
  async login(email: string, password: string): Promise<SupplierUser | null> {
    // In production, this would use proper authentication
    // For now, mock authentication
    const { data: user } = await supabase
      .from('supplier_users')
      .select('*')
      .eq('email', email)
      .eq('is_active', true)
      .single();

    if (!user) return null;

    // In production, verify password hash
    // For now, just return the user
    return user;
  }

  async registerSupplier(supplierData: any): Promise<SupplierUser | null> {
    // Create supplier user
    const { data: user, error } = await supabase
      .from('supplier_users')
      .insert({
        ...supplierData,
        is_active: true,
        role: 'admin',
      })
      .select()
      .single();

    if (error) {
      console.error('Error registering supplier:', error);
      return null;
    }

    return user;
  }

  // Dashboard
  async getSupplierDashboard(supplierId: string): Promise<any> {
    const [
      orders,
      invoices,
      performance,
    ] = await Promise.all([
      this.getSupplierOrders(supplierId),
      this.getSupplierInvoices(supplierId),
      this.getSupplierPerformance(supplierId),
    ]);

    const pendingOrders = orders.filter(o => o.status === 'pending').length;
    const pendingInvoices = invoices.filter(i => i.status === 'submitted').length;
    const overdueInvoices = invoices.filter(i => i.status === 'overdue').length;

    return {
      pendingOrders,
      pendingInvoices,
      overdueInvoices,
      recentOrders: orders.slice(0, 5),
      performance,
    };
  }

  // Orders
  async getSupplierOrders(supplierId: string, status?: string): Promise<SupplierOrder[]> {
    let query = supabase
      .from('purchase_orders')
      .select(`
        *,
        items:purchase_order_items(
          product_id,
          products(name, sku),
          quantity,
          unit_price,
          line_total
        )
      `)
      .eq('supplier_id', supplierId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching orders:', error);
      return [];
    }

    return (data || []).map(order => ({
      id: order.id,
      order_number: order.order_number || order.id.slice(0, 8),
      supplier_id: order.supplier_id,
      status: order.status,
      total_amount: order.total_amount || 0,
      expected_delivery_date: order.expected_delivery_date,
      actual_delivery_date: order.actual_delivery_date,
      items: (order.items || []).map((item: any) => ({
        product_id: item.product_id,
        product_name: item.products?.name || 'Unknown',
        sku: item.products?.sku || '',
        quantity: item.quantity,
        unit_price: item.unit_price || 0,
        total_price: item.line_total || 0,
      })),
      notes: order.notes || '',
      created_at: order.created_at,
      updated_at: order.updated_at || order.created_at,
    }));
  }

  async getOrder(orderId: string): Promise<SupplierOrder | null> {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select(`
        *,
        items:purchase_order_items(
          product_id,
          products(name, sku),
          quantity,
          unit_price,
          line_total
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
      order_number: data.order_number || data.id.slice(0, 8),
      supplier_id: data.supplier_id,
      status: data.status,
      total_amount: data.total_amount || 0,
      expected_delivery_date: data.expected_delivery_date,
      actual_delivery_date: data.actual_delivery_date,
      items: (data.items || []).map((item: any) => ({
        product_id: item.product_id,
        product_name: item.products?.name || 'Unknown',
        sku: item.products?.sku || '',
        quantity: item.quantity,
        unit_price: item.unit_price || 0,
        total_price: item.line_total || 0,
      })),
      notes: data.notes || '',
      created_at: data.created_at,
      updated_at: data.updated_at || data.created_at,
    };
  }

  async updateOrderStatus(orderId: string, status: string, notes?: string): Promise<boolean> {
    const updates: any = { status };
    if (notes) updates.notes = notes;
    if (status === 'shipped') updates.shipped_at = new Date().toISOString();
    if (status === 'delivered') updates.actual_delivery_date = new Date().toISOString();

    const { error } = await supabase
      .from('purchase_orders')
      .update(updates)
      .eq('id', orderId);

    return !error;
  }

  // Invoices
  async getSupplierInvoices(supplierId: string, status?: string): Promise<SupplierInvoice[]> {
    let query = supabase
      .from('supplier_invoices')
      .select('*')
      .eq('supplier_id', supplierId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching invoices:', error);
      return [];
    }

    return (data || []).map(invoice => ({
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      supplier_id: invoice.supplier_id,
      purchase_order_id: invoice.purchase_order_id,
      amount: invoice.amount_cents || 0,
      tax_amount: invoice.tax_amount_cents || 0,
      total_amount: invoice.total_amount_cents || 0,
      due_date: invoice.due_date,
      status: invoice.status,
      items: invoice.items || [],
      notes: invoice.notes || '',
      created_at: invoice.created_at,
      updated_at: invoice.updated_at || invoice.created_at,
    }));
  }

  async createInvoice(invoice: Omit<SupplierInvoice, 'id' | 'created_at' | 'updated_at'>): Promise<SupplierInvoice | null> {
    const { data, error } = await supabase
      .from('supplier_invoices')
      .insert({
        ...invoice,
        status: 'draft',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating invoice:', error);
      return null;
    }

    return data;
  }

  async updateInvoice(invoiceId: string, updates: Partial<SupplierInvoice>): Promise<boolean> {
    const { error } = await supabase
      .from('supplier_invoices')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', invoiceId);

    return !error;
  }

  async submitInvoice(invoiceId: string): Promise<boolean> {
    return this.updateInvoice(invoiceId, { status: 'submitted' });
  }

  // Products
  async getSupplierProducts(supplierId: string): Promise<SupplierProduct[]> {
    const { data, error } = await supabase
      .from('supplier_products')
      .select('*')
      .eq('supplier_id', supplierId)
      .order('product_name');

    if (error) {
      console.error('Error fetching products:', error);
      return [];
    }

    return (data || []).map(product => ({
      id: product.id,
      supplier_id: product.supplier_id,
      product_name: product.product_name,
      sku: product.sku,
      description: product.description || '',
      category: product.category || '',
      unit_price: product.unit_price_cents || 0,
      minimum_order_quantity: product.minimum_order_quantity || 1,
      lead_time_days: product.lead_time_days || 7,
      is_active: product.is_active !== false,
      created_at: product.created_at,
      updated_at: product.updated_at || product.created_at,
    }));
  }

  async createProduct(product: Omit<SupplierProduct, 'id' | 'created_at' | 'updated_at'>): Promise<SupplierProduct | null> {
    const { data, error } = await supabase
      .from('supplier_products')
      .insert({
        ...product,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating product:', error);
      return null;
    }

    return data;
  }

  async updateProduct(productId: string, updates: Partial<SupplierProduct>): Promise<boolean> {
    const { error } = await supabase
      .from('supplier_products')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', productId);

    return !error;
  }

  // Performance
  async getSupplierPerformance(supplierId: string): Promise<SupplierPerformance> {
    const { data: orders } = await supabase
      .from('purchase_orders')
      .select('status, expected_delivery_date, actual_delivery_date, total_amount')
      .eq('supplier_id', supplierId);

    if (!orders || orders.length === 0) {
      return {
        totalOrders: 0,
        onTimeDeliveryRate: 0,
        qualityScore: 0,
        averageLeadTime: 0,
        totalRevenue: 0,
        paymentTerms: 'Net 30',
      };
    }

    const totalOrders = orders.length;
    const deliveredOrders = orders.filter(o => o.status === 'delivered' && o.actual_delivery_date && o.expected_delivery_date);
    const onTimeOrders = deliveredOrders.filter(o => new Date(o.actual_delivery_date!) <= new Date(o.expected_delivery_date!));
    const onTimeDeliveryRate = deliveredOrders.length ? (onTimeOrders.length / deliveredOrders.length) * 100 : 0;

    const leadTimes = deliveredOrders.map(o => {
      const created = new Date(o.expected_delivery_date);
      const delivered = new Date(o.actual_delivery_date!);
      return Math.ceil((delivered.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    });
    const averageLeadTime = leadTimes.length ? leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length : 0;

    const totalRevenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);

    return {
      totalOrders,
      onTimeDeliveryRate,
      qualityScore: 85, // Would need quality inspection data
      averageLeadTime,
      totalRevenue,
      paymentTerms: 'Net 30',
    };
  }

  // Notifications
  async getSupplierNotifications(supplierId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('supplier_notifications')
      .select('*')
      .eq('supplier_id', supplierId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }

    return data || [];
  }

  async markNotificationRead(notificationId: string): Promise<boolean> {
    const { error } = await supabase
      .from('supplier_notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    return !error;
  }
}

export const supplierPortalService = new SupplierPortalService();
