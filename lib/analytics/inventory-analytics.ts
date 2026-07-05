import { supabaseAdmin } from '@/lib/supabase-server'

export interface InventoryMetrics {
  totalProducts: number;
  totalStockValue: number;
  lowStockItems: number;
  outOfStockItems: number;
  overstockItems: number;
}

export interface StockTurnover {
  productId: string;
  productName: string;
  category: string;
  currentStock: number;
  totalSold: number;
  turnoverRate: number;
  daysOfSupply: number;
}

export interface ShrinkageReport {
  productId: string;
  productName: string;
  expectedStock: number;
  actualStock: number;
  shrinkage: number;
  shrinkageRate: number;
  value: number;
}

export interface ReorderPrediction {
  productId: string;
  productName: string;
  currentStock: number;
  reorderLevel: number;
  averageDailySales: number;
  daysUntilReorder: number;
  suggestedReorderQuantity: number;
}

export interface DeadStockItem {
  productId: string;
  productName: string;
  category: string;
  currentStock: number;
  lastSoldAt: string;
  daysSinceLastSale: number;
  valueAtRisk: number;
}

export interface SupplierPerformance {
  supplierId: string;
  supplierName: string;
  totalOrders: number;
  onTimeDelivery: number;
  qualityScore: number;
  averageLeadTime: number;
  totalValue: number;
}

export class InventoryAnalyticsService {
  async getInventoryMetrics(): Promise<InventoryMetrics> {
    // Get products with their inventory quantities
    const { data: products } = await supabaseAdmin
      .from('products')
      .select('id, name, purchase_price, reorder_level');

    if (!products) return {
      totalProducts: 0,
      totalStockValue: 0,
      lowStockItems: 0,
      outOfStockItems: 0,
      overstockItems: 0,
    };

    // Get inventory quantities
    const { data: inventory } = await supabaseAdmin
      .from('inventory')
      .select('product_id, quantity');

    const inventoryMap = new Map<string, number>();
    inventory?.forEach(inv => {
      inventoryMap.set(inv.product_id, inv.quantity || 0);
    });

    let totalStockValue = 0;
    let lowStockItems = 0;
    let outOfStockItems = 0;
    let overstockItems = 0;

    products.forEach((product) => {
      const currentStock = inventoryMap.get(product.id) || 0;
      totalStockValue += currentStock * (product.purchase_price || 0);
      
      if (currentStock === 0) {
        outOfStockItems++;
      } else if (currentStock <= (product.reorder_level || 0)) {
        lowStockItems++;
      } else if (currentStock > (product.reorder_level || 0) * 3) {
        overstockItems++;
      }
    });

    return {
      totalProducts: products.length,
      totalStockValue,
      lowStockItems,
      outOfStockItems,
      overstockItems,
    };
  }

  async getStockTurnover(startDate: string, endDate: string, limit: number = 20): Promise<StockTurnover[]> {
    const { data: salesItems } = await supabaseAdmin
      .from('sale_items')
      .select('product_id, quantity')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    const { data: products } = await supabaseAdmin
      .from('products')
      .select('id, name, category_id');

    const { data: inventory } = await supabaseAdmin
      .from('inventory')
      .select('product_id, quantity');

    if (!salesItems || !products) return [];

    const inventoryMap = new Map<string, number>();
    inventory?.forEach(inv => {
      inventoryMap.set(inv.product_id, inv.quantity || 0);
    });

    const salesMap = new Map<string, number>();
    salesItems.forEach((item) => {
      const current = salesMap.get(item.product_id) || 0;
      salesMap.set(item.product_id, current + item.quantity);
    });

    const periodDays = (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24);

    const turnoverData: StockTurnover[] = products.map((product) => {
      const totalSold = salesMap.get(product.id) || 0;
      const currentStock = inventoryMap.get(product.id) || 0;
      const averageDailySales = totalSold / periodDays;
      const turnoverRate = averageDailySales > 0 ? (totalSold / (currentStock || 1)) : 0;
      const daysOfSupply = averageDailySales > 0 ? currentStock / averageDailySales : Infinity;

      return {
        productId: product.id,
        productName: product.name,
        category: product.category_id || 'Uncategorized',
        currentStock,
        totalSold,
        turnoverRate,
        daysOfSupply,
      };
    });

    return turnoverData.sort((a, b) => b.turnoverRate - a.turnoverRate).slice(0, limit);
  }

  async getShrinkageReport(startDate: string, endDate: string): Promise<ShrinkageReport[]> {
    const { data: purchases } = await supabaseAdmin
      .from('purchase_order_items')
      .select('product_id, quantity')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    const { data: salesItems } = await supabaseAdmin
      .from('sale_items')
      .select('product_id, quantity')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    const { data: products } = await supabaseAdmin
      .from('products')
      .select('id, name, purchase_price');

    const { data: inventory } = await supabaseAdmin
      .from('inventory')
      .select('product_id, quantity');

    if (!products) return [];

    const inventoryMap = new Map<string, number>();
    inventory?.forEach(inv => {
      inventoryMap.set(inv.product_id, inv.quantity || 0);
    });

    const stockMap = new Map<string, number>();
    products.forEach((product) => {
      stockMap.set(product.id, inventoryMap.get(product.id) || 0);
    });

    purchases?.forEach((purchase) => {
      const current = stockMap.get(purchase.product_id) || 0;
      stockMap.set(purchase.product_id, current + purchase.quantity);
    });

    salesItems?.forEach((sale) => {
      const current = stockMap.get(sale.product_id) || 0;
      stockMap.set(sale.product_id, current - sale.quantity);
    });

    const shrinkageData: ShrinkageReport[] = [];
    
    products.forEach((product) => {
      const expectedStock = stockMap.get(product.id) || 0;
      const actualStock = inventoryMap.get(product.id) || 0;
      const shrinkage = expectedStock - actualStock;
      
      if (shrinkage > 0) {
        shrinkageData.push({
          productId: product.id,
          productName: product.name,
          expectedStock,
          actualStock,
          shrinkage,
          shrinkageRate: expectedStock ? (shrinkage / expectedStock) * 100 : 0,
          value: shrinkage * (product.purchase_price || 0),
        });
      }
    });

    return shrinkageData.sort((a, b) => b.value - a.value);
  }

  async getReorderPredictions(): Promise<ReorderPrediction[]> {
    const { data: products } = await supabaseAdmin
      .from('products')
      .select('id, name, reorder_level')
      .gt('reorder_level', 0);

    if (!products) return [];

    const { data: inventory } = await supabaseAdmin
      .from('inventory')
      .select('product_id, quantity');

    const inventoryMap = new Map<string, number>();
    inventory?.forEach(inv => {
      inventoryMap.set(inv.product_id, inv.quantity || 0);
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: salesItems } = await supabaseAdmin
      .from('sale_items')
      .select('product_id, quantity')
      .gte('created_at', thirtyDaysAgo.toISOString());

    const salesMap = new Map<string, number>();
    salesItems?.forEach((item) => {
      const current = salesMap.get(item.product_id) || 0;
      salesMap.set(item.product_id, current + item.quantity);
    });

    const predictions: ReorderPrediction[] = products.map((product) => {
      const totalSold = salesMap.get(product.id) || 0;
      const averageDailySales = totalSold / 30;
      const currentStock = inventoryMap.get(product.id) || 0;
      const reorderLevel = product.reorder_level || 0;
      
      const daysUntilReorder = averageDailySales > 0 
        ? Math.max(0, (currentStock - reorderLevel) / averageDailySales)
        : Infinity;

      const suggestedReorderQuantity = Math.ceil(averageDailySales * 14);

      return {
        productId: product.id,
        productName: product.name,
        currentStock,
        reorderLevel,
        averageDailySales,
        daysUntilReorder,
        suggestedReorderQuantity,
      };
    });

    return predictions.sort((a, b) => a.daysUntilReorder - b.daysUntilReorder);
  }

  async getDeadStock(daysSinceLastSale: number = 30): Promise<DeadStockItem[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysSinceLastSale);

    const { data: products } = await supabaseAdmin
      .from('products')
      .select('id, name, category_id, last_sold_at, purchase_price');

    const { data: inventory } = await supabaseAdmin
      .from('inventory')
      .select('product_id, quantity');

    if (!products) return [];

    const inventoryMap = new Map<string, number>();
    inventory?.forEach(inv => {
      inventoryMap.set(inv.product_id, inv.quantity || 0);
    });

    const deadStock: DeadStockItem[] = [];

    products.forEach((product) => {
      const currentStock = inventoryMap.get(product.id) || 0;
      if (currentStock > 0) {
        const lastSoldAt = product.last_sold_at ? new Date(product.last_sold_at) : null;
        const daysSince = lastSoldAt 
          ? Math.floor((Date.now() - lastSoldAt.getTime()) / (1000 * 60 * 60 * 24))
          : 999;

        if (daysSince >= daysSinceLastSale) {
          deadStock.push({
            productId: product.id,
            productName: product.name,
            category: product.category_id || 'Uncategorized',
            currentStock,
            lastSoldAt: product.last_sold_at || 'Never',
            daysSinceLastSale: daysSince,
            valueAtRisk: currentStock * (product.purchase_price || 0),
          });
        }
      }
    });

    return deadStock.sort((a, b) => b.valueAtRisk - a.valueAtRisk);
  }

  async getSupplierPerformance(startDate: string, endDate: string): Promise<SupplierPerformance[]> {
    const { data: purchaseOrders } = await supabaseAdmin
      .from('purchase_orders')
      .select(`
        id,
        supplier_id,
        total_amount,
        expected_delivery_date,
        actual_delivery_date,
        status,
        suppliers (
          name
        )
      `)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (!purchaseOrders) return [];

    const supplierMap = new Map<string, {
      supplierName: string;
      totalOrders: number;
      onTimeDelivery: number;
      totalLeadTime: number;
      deliveredOrders: number;
      totalValue: number;
    }>();

    purchaseOrders.forEach((order) => {
      const supplierId = order.supplier_id;
      if (!supplierId) return;

      const existing = supplierMap.get(supplierId) || {
        supplierName: (order.suppliers as any)?.name || 'Unknown',
        totalOrders: 0,
        onTimeDelivery: 0,
        totalLeadTime: 0,
        deliveredOrders: 0,
        totalValue: 0,
      };

      existing.totalOrders++;
      existing.totalValue += order.total_amount || 0;

      if (order.actual_delivery_date && order.expected_delivery_date) {
        const delivered = new Date(order.actual_delivery_date);
        const expected = new Date(order.expected_delivery_date);
        
        existing.deliveredOrders++;
        existing.totalLeadTime += Math.floor((delivered.getTime() - expected.getTime()) / (1000 * 60 * 60 * 24));
        
        if (delivered <= expected) {
          existing.onTimeDelivery++;
        }
      }

      supplierMap.set(supplierId, existing);
    });

    return Array.from(supplierMap.entries()).map(([supplierId, data]) => ({
      supplierId,
      supplierName: data.supplierName,
      totalOrders: data.totalOrders,
      onTimeDelivery: data.deliveredOrders ? (data.onTimeDelivery / data.deliveredOrders) * 100 : 0,
      qualityScore: 0,
      averageLeadTime: data.deliveredOrders ? data.totalLeadTime / data.deliveredOrders : 0,
      totalValue: data.totalValue,
    })).sort((a, b) => b.totalValue - a.totalValue);
  }
}

export const inventoryAnalyticsService = new InventoryAnalyticsService();
