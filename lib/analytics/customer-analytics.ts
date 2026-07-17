import { supabaseAdmin } from '@/lib/supabase-server'

export interface CustomerMetrics {
  totalCustomers: number;
  newCustomers: number;
  activeCustomers: number;
  averageOrderValue: number;
  customerRetentionRate: number;
  churnRisk?: number;
}

export interface RFMSegment {
  segment: string;
  count: number;
  percentage: number;
  averageRevenue: number;
  description: string;
}

export interface CustomerLifetimeValue {
  customerId: string;
  customerName: string;
  email: string;
  totalOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  firstOrderDate: string;
  lastOrderDate: string;
  lifetimeValue: number;
  predictedNextOrderDays: number;
}

export interface PurchasePattern {
  pattern: string;
  count: number;
  percentage: number;
  averageValue: number;
}

export interface ChurnRisk {
  customerId: string;
  customerName: string;
  email: string;
  lastOrderDate: string;
  daysSinceLastOrder: number;
  previousOrders: number;
  totalSpent: number;
  riskScore: number;
}

export class CustomerAnalyticsService {
  async getCustomerMetrics(startDate: string, endDate: string): Promise<CustomerMetrics> {
    const prevStartDate = new Date(startDate);
    prevStartDate.setMonth(prevStartDate.getMonth() - 1);
    const prevEndDate = new Date(startDate);

    // All 5 queries are independent — run in parallel
    const [
      { count: totalCustomers },
      { count: newCustomers },
      { data: activeSales },
      { data: sales },
      { data: prevSales },
    ] = await Promise.all([
      supabaseAdmin.from('customers').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('customers').select('*', { count: 'exact', head: true }).gte('created_at', startDate).lte('created_at', endDate),
      supabaseAdmin.from('sales').select('customer_id').gte('created_at', startDate).lte('created_at', endDate).eq('payment_status', 'completed').neq('sale_status', 'returned').not('customer_id', 'is', null),
      supabaseAdmin.from('sales').select('total_amount').gte('created_at', startDate).lte('created_at', endDate).eq('payment_status', 'completed').neq('sale_status', 'returned'),
      supabaseAdmin.from('sales').select('customer_id').gte('created_at', prevStartDate.toISOString()).lte('created_at', prevEndDate.toISOString()).eq('payment_status', 'completed').neq('sale_status', 'returned').not('customer_id', 'is', null),
    ]);

    const uniqueActiveCustomers = new Set(activeSales?.map(s => s.customer_id)).size;
    const totalRevenue = sales?.reduce((sum, s) => sum + (s.total_amount || 0), 0) || 0;
    const averageOrderValue = sales?.length ? totalRevenue / sales.length : 0;

    const prevCustomers = new Set(prevSales?.map(s => s.customer_id));
    const currentCustomers = new Set(activeSales?.map(s => s.customer_id));
    const retainedCustomers = Array.from(prevCustomers).filter(id => currentCustomers.has(id));
    const retentionRate = prevCustomers.size ? (retainedCustomers.length / prevCustomers.size) * 100 : 0;

    return {
      totalCustomers: totalCustomers || 0,
      newCustomers: newCustomers || 0,
      activeCustomers: uniqueActiveCustomers,
      averageOrderValue,
      customerRetentionRate: retentionRate,
    };
  }

  async getRFMSegments(): Promise<RFMSegment[]> {
    const { data: customers } = await supabaseAdmin
      .from('customers')
      .select('id, name, email');

    if (!customers) return [];

    const now = new Date();
    const rfmData = await Promise.all(
      customers.map(async (customer) => {
        const { data: orders } = await supabaseAdmin
          .from('sales')
          .select('created_at, total_amount')
          .eq('customer_id', customer.id)
          .eq('payment_status', 'completed')
          .neq('sale_status', 'returned');

        if (!orders || orders.length === 0) {
          return {
            customerId: customer.id,
            recency: 999,
            frequency: 0,
            monetary: 0,
          };
        }

        const lastOrder = orders.reduce((latest, order) => 
          new Date(order.created_at ?? '') > new Date(latest.created_at ?? '') ? order : latest
        );

        const daysSinceLastOrder = Math.floor(
          (now.getTime() - new Date(lastOrder.created_at ?? '').getTime()) / (1000 * 60 * 60 * 24)
        );

        const totalSpent = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);

        return {
          customerId: customer.id,
          recency: daysSinceLastOrder,
          frequency: orders.length,
          monetary: totalSpent,
        };
      })
    );

    const getScore = (value: number, values: number[], lowerIsBetter: boolean = false) => {
      const sorted = Array.from(new Set(values)).sort((a, b) => lowerIsBetter ? b - a : a - b);
      const percentile = sorted.indexOf(value) / sorted.length;
      if (percentile <= 0.2) return 5;
      if (percentile <= 0.4) return 4;
      if (percentile <= 0.6) return 3;
      if (percentile <= 0.8) return 2;
      return 1;
    };

    const recencies = rfmData.map(d => d.recency);
    const frequencies = rfmData.map(d => d.frequency);
    const monetaries = rfmData.map(d => d.monetary);

    const segments = new Map<string, { count: number; totalRevenue: number }>();

    rfmData.forEach((data) => {
      const rScore = getScore(data.recency, recencies, true);
      const fScore = getScore(data.frequency, frequencies);
      const mScore = getScore(data.monetary, monetaries);

      let segment: string;
      if (rScore >= 4 && fScore >= 4 && mScore >= 4) {
        segment = 'Champions';
      } else if (rScore >= 3 && fScore >= 3 && mScore >= 3) {
        segment = 'Loyal Customers';
      } else if (rScore >= 4 && fScore <= 2) {
        segment = 'New Customers';
      } else if (rScore >= 3 && fScore >= 1 && mScore >= 2) {
        segment = 'Potential Loyalists';
      } else if (rScore <= 2 && fScore >= 3 && mScore >= 3) {
        segment = 'At Risk';
      } else if (rScore <= 2 && fScore <= 2 && mScore >= 3) {
        segment = 'Cant Lose Them';
      } else if (rScore <= 2 && fScore <= 2 && mScore <= 2) {
        segment = 'Lost';
      } else {
        segment = 'Need Attention';
      }

      const existing = segments.get(segment) || { count: 0, totalRevenue: 0 };
      existing.count++;
      existing.totalRevenue += data.monetary;
      segments.set(segment, existing);
    });

    const totalCustomers = customers.length;

    const segmentDescriptions: Record<string, string> = {
      'Champions': 'Recent buyers with high frequency and spending',
      'Loyal Customers': 'Regular buyers with good spending',
      'New Customers': 'Recent first-time buyers',
      'Potential Loyalists': 'Recent buyers with potential to become loyal',
      'At Risk': 'Previously active customers who haven\'t returned',
      'Cant Lose Them': 'High-value customers at risk of churning',
      'Lost': 'Customers who haven\'t purchased in a long time',
      'Need Attention': 'Customers with average metrics',
    };

    return Array.from(segments.entries()).map(([segment, data]) => ({
      segment,
      count: data.count,
      percentage: totalCustomers ? (data.count / totalCustomers) * 100 : 0,
      averageRevenue: data.count ? data.totalRevenue / data.count : 0,
      description: segmentDescriptions[segment] || '',
    })).sort((a, b) => b.count - a.count);
  }

  async getCustomerLifetimeValue(limit: number = 20): Promise<CustomerLifetimeValue[]> {
    const { data: customers } = await supabaseAdmin
      .from('customers')
      .select('id, name, email');

    if (!customers) return [];

    const clvData = await Promise.all(
      customers.map(async (customer) => {
        const { data: orders } = await supabaseAdmin
          .from('sales')
          .select('created_at, total_amount')
          .eq('customer_id', customer.id)
          .eq('payment_status', 'completed')
          .neq('sale_status', 'returned')
          .order('created_at');

        if (!orders || orders.length === 0) {
          return null;
        }

        const totalSpent = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
        const averageOrderValue = totalSpent / orders.length;

        const firstOrder = orders[0];
        const lastOrder = orders[orders.length - 1];

        const orderDates = orders.map(o => new Date(o.created_at ?? '').getTime());
        const avgDaysBetweenOrders = orders.length > 1
          ? (orderDates[orderDates.length - 1] - orderDates[0]) / (orders.length - 1) / (1000 * 60 * 60 * 24)
          : 30;

        const monthsActive = (new Date(lastOrder.created_at ?? '').getTime() - new Date(firstOrder.created_at ?? '').getTime()) / (1000 * 60 * 60 * 24 * 30);
        const monthlyValue = monthsActive > 0 ? totalSpent / monthsActive : totalSpent;
        const predictedNextOrderDays = Math.max(1, avgDaysBetweenOrders);

        return {
          customerId: customer.id,
          customerName: customer.name,
          email: customer.email,
          totalOrders: orders.length,
          totalSpent,
          averageOrderValue,
          firstOrderDate: firstOrder.created_at,
          lastOrderDate: lastOrder.created_at,
          lifetimeValue: monthlyValue * 12,
          predictedNextOrderDays,
        };
      })
    );

    return clvData
      .filter((data): data is CustomerLifetimeValue => data !== null)
      .sort((a, b) => b.lifetimeValue - a.lifetimeValue)
      .slice(0, limit);
  }

  async getPurchasePatterns(): Promise<PurchasePattern[]> {
    const { data: sales } = await supabaseAdmin
      .from('sales')
      .select('customer_id, total_amount, created_at')
      .eq('payment_status', 'completed')
      .neq('sale_status', 'returned')
      .not('customer_id', 'is', null);

    if (!sales) return [];

    const patterns = new Map<string, { count: number; totalValue: number }>();

    const customerPurchases = new Map<string, { orders: Record<string, unknown>[]; totalValue: number }>();
    sales.forEach((sale) => {
      const cid = sale.customer_id ?? '';
      const existing = customerPurchases.get(cid) || { orders: [], totalValue: 0 };
      existing.orders.push(sale);
      existing.totalValue += sale.total_amount || 0;
      customerPurchases.set(cid, existing);
    });

    customerPurchases.forEach((data) => {
      const { orders, totalValue } = data;
      const avgOrderValue = totalValue / orders.length;

      let pattern: string;
      if (orders.length === 1) {
        pattern = 'One-time Buyer';
      } else if (orders.length <= 3) {
        pattern = 'Occasional Buyer';
      } else if (avgOrderValue > 10000) {
        pattern = 'High-Value Regular';
      } else if (orders.length > 10) {
        pattern = 'Frequent Shopper';
      } else {
        pattern = 'Regular Buyer';
      }

      const existing = patterns.get(pattern) || { count: 0, totalValue: 0 };
      existing.count++;
      existing.totalValue += totalValue;
      patterns.set(pattern, existing);
    });

    const totalCustomers = customerPurchases.size;

    return Array.from(patterns.entries()).map(([pattern, data]) => ({
      pattern,
      count: data.count,
      percentage: totalCustomers ? (data.count / totalCustomers) * 100 : 0,
      averageValue: data.count ? data.totalValue / data.count : 0,
    })).sort((a, b) => b.count - a.count);
  }

  async getChurnRisk(daysSinceLastOrder: number = 30): Promise<ChurnRisk[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysSinceLastOrder);

    const { data: customers } = await supabaseAdmin
      .from('customers')
      .select('id, name, email');

    if (!customers) return [];

    const churnData = await Promise.all(
      customers.map(async (customer) => {
        const { data: orders } = await supabaseAdmin
          .from('sales')
          .select('created_at, total_amount')
          .eq('customer_id', customer.id)
          .eq('payment_status', 'completed')
          .neq('sale_status', 'returned')
          .order('created_at');

        if (!orders || orders.length === 0) {
          return null;
        }

        const lastOrder = orders.reduce((latest, order) => 
          new Date(order.created_at ?? '') > new Date(latest.created_at ?? '') ? order : latest
        );

        const daysSinceLastOrder = Math.floor(
          (Date.now() - new Date(lastOrder.created_at ?? '').getTime()) / (1000 * 60 * 60 * 24)
        );

        const totalSpent = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);

        let riskScore = 0;
        
        if (daysSinceLastOrder > 90) riskScore += 40;
        else if (daysSinceLastOrder > 60) riskScore += 30;
        else if (daysSinceLastOrder > 30) riskScore += 20;
        
        if (orders.length === 1) riskScore += 30;
        else if (orders.length <= 3) riskScore += 20;
        else if (orders.length <= 5) riskScore += 10;
        
        if (totalSpent < 5000) riskScore += 20;
        else if (totalSpent < 10000) riskScore += 10;

        return {
          customerId: customer.id,
          customerName: customer.name,
          email: customer.email,
          lastOrderDate: lastOrder.created_at,
          daysSinceLastOrder,
          previousOrders: orders.length,
          totalSpent,
          riskScore: Math.min(100, riskScore),
        };
      })
    );

    return churnData
      .filter((data): data is ChurnRisk => data !== null && data.daysSinceLastOrder > daysSinceLastOrder)
      .sort((a, b) => b.riskScore - a.riskScore);
  }
}

export const customerAnalyticsService = new CustomerAnalyticsService();
