import { supabaseAdmin } from '@/lib/supabase-server'

export interface SalesMetrics {
  totalRevenue: number;
  totalTransactions: number;
  averageOrderValue: number;
  revenueGrowth: number;
  transactionGrowth: number;
}

export interface ProductPerformance {
  productId: string;
  productName: string;
  category: string;
  totalSold: number;
  revenue: number;
  profit: number;
  profitMargin: number;
}

export interface PeakHours {
  hour: number;
  transactions: number;
  revenue: number;
}

export interface CategoryBreakdown {
  category: string;
  revenue: number;
  percentage: number;
  transactions: number;
}

export interface PaymentMethodDistribution {
  method: string;
  count: number;
  total: number;
  percentage: number;
}

export interface SalesTrend {
  date: string;
  revenue: number;
  transactions: number;
  averageOrderValue: number;
}

export class SalesAnalyticsService {
  async getSalesMetrics(startDate: string, endDate: string): Promise<SalesMetrics> {
    const start_date = new Date(startDate);
    const end_date = new Date(endDate);
    const period_length = end_date.getTime() - start_date.getTime();
    const prev_start = new Date(start_date.getTime() - period_length).toISOString();
    const prev_end = start_date.toISOString();

    // current and previous period are independent — run in parallel
    const [{ data: currentPeriod }, { data: previousPeriod }] = await Promise.all([
      supabaseAdmin.from('sales').select('total_amount, id').gte('created_at', startDate).lte('created_at', endDate).eq('payment_status', 'completed').neq('sale_status', 'returned'),
      supabaseAdmin.from('sales').select('total_amount, id').gte('created_at', prev_start).lte('created_at', prev_end).eq('payment_status', 'completed').neq('sale_status', 'returned'),
    ]);

    const currentRevenue = currentPeriod?.reduce((sum, sale) => sum + (sale.total_amount || 0), 0) || 0;
    const previousRevenue = previousPeriod?.reduce((sum, sale) => sum + (sale.total_amount || 0), 0) || 0;

    return {
      totalRevenue: currentRevenue,
      totalTransactions: currentPeriod?.length || 0,
      averageOrderValue: currentPeriod?.length ? currentRevenue / currentPeriod.length : 0,
      revenueGrowth: previousRevenue ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0,
      transactionGrowth: previousPeriod?.length
        ? (((currentPeriod?.length || 0) - previousPeriod.length) / previousPeriod.length) * 100
        : 0,
    };
  }

  async getProductPerformance(startDate: string, endDate: string, limit: number = 20): Promise<ProductPerformance[]> {
    const { data: salesItems } = await supabaseAdmin
      .from('sale_items')
      .select(`
        product_id,
        quantity,
        unit_price,
        line_total,
        products (
          name,
          category_id,
          purchase_price
        )
      `)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (!salesItems) return [];

    const productMap = new Map<string, {
      productName: string;
      category: string;
      totalSold: number;
      revenue: number;
      cost: number;
    }>();

    salesItems.forEach((item) => {
      const existing = productMap.get(item.product_id);
      const prod = (item.products as Array<{ name: string; category_id: string; purchase_price: number }> | { name: string; category_id: string; purchase_price: number } | null)
      const prodObj = Array.isArray(prod) ? prod[0] : prod
      const productName = prodObj?.name || 'Unknown';
      const category = prodObj?.category_id || 'Uncategorized';
      const costPrice = prodObj?.purchase_price || 0;

      if (existing) {
        existing.totalSold += item.quantity;
        existing.revenue += item.line_total || 0;
        existing.cost += costPrice * item.quantity;
      } else {
        productMap.set(item.product_id, {
          productName,
          category,
          totalSold: item.quantity,
          revenue: item.line_total || 0,
          cost: costPrice * item.quantity,
        });
      }
    });

    const products: ProductPerformance[] = Array.from(productMap.entries()).map(([productId, data]) => ({
      productId,
      productName: data.productName,
      category: data.category,
      totalSold: data.totalSold,
      revenue: data.revenue,
      profit: data.revenue - data.cost,
      profitMargin: data.revenue ? ((data.revenue - data.cost) / data.revenue) * 100 : 0,
    }));

    return products.sort((a, b) => b.revenue - a.revenue).slice(0, limit);
  }

  async getPeakHours(startDate: string, endDate: string): Promise<PeakHours[]> {
    const { data: sales } = await supabaseAdmin
      .from('sales')
      .select('created_at, total_amount')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .eq('payment_status', 'completed')
      .neq('sale_status', 'returned');

    if (!sales) return [];

    const hourMap = new Map<number, { transactions: number; revenue: number }>();

    for (let i = 0; i < 24; i++) {
      hourMap.set(i, { transactions: 0, revenue: 0 });
    }

    sales.forEach((sale) => {
      const hour = new Date(String((sale as { created_at?: string }).created_at ?? '')).getHours();
      const hourData = hourMap.get(hour)!;
      hourData.transactions++;
      hourData.revenue += Number((sale as { total_amount?: number }).total_amount ?? 0);
    });

    return Array.from(hourMap.entries()).map(([hour, data]) => ({
      hour,
      ...data,
    }));
  }

  async getCategoryBreakdown(startDate: string, endDate: string): Promise<CategoryBreakdown[]> {
    const { data: salesItems } = await supabaseAdmin
      .from('sale_items')
      .select(`
        line_total,
        products (
          category_id
        )
      `)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (!salesItems) return [];

    const categoryMap = new Map<string, { revenue: number; count: number }>();
    let totalRevenue = 0;

    salesItems.forEach((item) => {
      const category = ((item.products as { category_id?: string })?.category_id) || 'Uncategorized';
      const existing = categoryMap.get(category) || { revenue: 0, count: 0 };
      existing.revenue += item.line_total || 0;
      existing.count++;
      categoryMap.set(category, existing);
      totalRevenue += item.line_total || 0;
    });

    return Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      revenue: data.revenue,
      percentage: totalRevenue ? (data.revenue / totalRevenue) * 100 : 0,
      transactions: data.count,
    })).sort((a, b) => b.revenue - a.revenue);
  }

  async getPaymentMethodDistribution(startDate: string, endDate: string): Promise<PaymentMethodDistribution[]> {
    const { data: sales } = await supabaseAdmin
      .from('sales')
      .select('payment_method, total_amount')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .eq('payment_status', 'completed')
      .neq('sale_status', 'returned');

    if (!sales) return [];

    const methodMap = new Map<string, { count: number; total: number }>();
    let grandTotal = 0;

    sales.forEach((sale) => {
      const method = sale.payment_method || 'Unknown';
      const existing = methodMap.get(method) || { count: 0, total: 0 };
      existing.count++;
      existing.total += sale.total_amount || 0;
      methodMap.set(method, existing);
      grandTotal += sale.total_amount || 0;
    });

    return Array.from(methodMap.entries()).map(([method, data]) => ({
      method,
      ...data,
      percentage: grandTotal ? (data.total / grandTotal) * 100 : 0,
    })).sort((a, b) => b.total - a.total);
  }

  async getSalesTrend(startDate: string, endDate: string): Promise<SalesTrend[]> {
    const { data: sales } = await supabaseAdmin
      .from('sales')
      .select('created_at, total_amount, id')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .eq('payment_status', 'completed')
      .neq('sale_status', 'returned')
      .order('created_at');

    if (!sales) return [];

    const dateMap = new Map<string, { revenue: number; transactions: number }>();

    sales.forEach((sale) => {
      const date = (String((sale as { created_at?: string }).created_at ?? '')).split('T')[0];
      const existing = dateMap.get(date) || { revenue: 0, transactions: 0 };
      existing.revenue += Number((sale as { total_amount?: number }).total_amount ?? 0);
      existing.transactions++;
      dateMap.set(date, existing);
    });

    return Array.from(dateMap.entries()).map(([date, data]) => ({
      date,
      revenue: data.revenue,
      transactions: data.transactions,
      averageOrderValue: data.transactions ? data.revenue / data.transactions : 0,
    }));
  }

  async getTopSellingProducts(startDate: string, endDate: string, limit: number = 10): Promise<ProductPerformance[]> {
    return this.getProductPerformance(startDate, endDate, limit);
  }

  async getSlowMovingProducts(startDate: string, endDate: string, daysSinceLastSale: number = 30): Promise<Record<string, unknown>[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysSinceLastSale);

    const { data: products } = await supabaseAdmin
      .from('products')
      .select('id, name, category_id, last_sold_at')
      .lt('last_sold_at', cutoffDate.toISOString());

    return (products || []) as unknown as Record<string, unknown>[];
  }
}

export const salesAnalyticsService = new SalesAnalyticsService();
