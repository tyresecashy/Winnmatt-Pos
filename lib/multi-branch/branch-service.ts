import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface Branch {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  manager_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BranchMetrics {
  branchId: string;
  branchName: string;
  totalSales: number;
  totalTransactions: number;
  averageOrderValue: number;
  totalCustomers: number;
  totalProducts: number;
  lowStockItems: number;
  activeEmployees: number;
  revenueGrowth: number;
}

export interface InterBranchTransfer {
  id: string;
  from_branch_id: string;
  to_branch_id: string;
  status: 'pending' | 'approved' | 'in_transit' | 'received' | 'cancelled';
  items: TransferItem[];
  total_value: number;
  requested_by: string;
  approved_by: string | null;
  shipped_at: string | null;
  received_at: string | null;
  notes: string;
  created_at: string;
}

export interface TransferItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
}

export interface BranchPerformance {
  branchId: string;
  branchName: string;
  rank: number;
  salesGrowth: number;
  customerGrowth: number;
  inventoryTurnover: number;
  employeeEfficiency: number;
  customerSatisfaction: number;
}

export class BranchService {
  async getBranches(): Promise<Branch[]> {
    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching branches:', error);
      return [];
    }

    return data || [];
  }

  async getBranch(branchId: string): Promise<Branch | null> {
    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .eq('id', branchId)
      .single();

    if (error) {
      console.error('Error fetching branch:', error);
      return null;
    }

    return data;
  }

  async createBranch(branch: Omit<Branch, 'id' | 'created_at' | 'updated_at'>): Promise<Branch | null> {
    const { data, error } = await supabase
      .from('branches')
      .insert(branch)
      .select()
      .single();

    if (error) {
      console.error('Error creating branch:', error);
      return null;
    }

    return data;
  }

  async updateBranch(branchId: string, updates: Partial<Branch>): Promise<Branch | null> {
    const { data, error } = await supabase
      .from('branches')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', branchId)
      .select()
      .single();

    if (error) {
      console.error('Error updating branch:', error);
      return null;
    }

    return data;
  }

  async getBranchMetrics(startDate: string, endDate: string): Promise<BranchMetrics[]> {
    const branches = await this.getBranches();
    
    const metrics = await Promise.all(
      branches.map(async (branch) => {
        // Get sales data
        const { data: sales } = await supabase
          .from('sales')
          .select('total_amount, id')
          .eq('branch_id', branch.id)
          .gte('created_at', startDate)
          .lte('created_at', endDate)
          .eq('sale_status', 'completed');

        // Get customers
        const { data: customers } = await supabase
          .from('customers')
          .select('id')
          .eq('branch_id', branch.id);

        // Get inventory (stock levels per product per branch)
        const { data: inventory } = await supabase
          .from('inventory')
          .select('product_id, quantity')
          .eq('branch_id', branch.id);

        // Get products (for reorder_level)
        const { data: products } = await supabase
          .from('products')
          .select('id, reorder_level');

        // Get employees
        const { data: employees } = await supabase
          .from('employee_profiles')
          .select('id')
          .eq('branch_id', branch.id)
          .eq('employment_status', 'active');

        const totalSales = sales?.reduce((sum, s) => sum + (s.total_amount || 0), 0) || 0;
        const totalTransactions = sales?.length || 0;
        const averageOrderValue = totalTransactions ? totalSales / totalTransactions : 0;
        const lowStockItems = products?.filter(p => {
          const stock = inventory?.find(i => i.product_id === p.id)?.quantity || 0;
          return stock <= (p.reorder_level || 0);
        }).length || 0;

        // Get previous period for comparison
        const start_date = new Date(startDate);
        const end_date = new Date(endDate);
        const period_length = end_date.getTime() - start_date.getTime();
        const prev_start = new Date(start_date.getTime() - period_length).toISOString();
        const prev_end = start_date.toISOString();

        const { data: prevSales } = await supabase
          .from('sales')
          .select('total_amount')
          .eq('branch_id', branch.id)
          .gte('created_at', prev_start)
          .lte('created_at', prev_end)
          .eq('sale_status', 'completed');

        const prevRevenue = prevSales?.reduce((sum, s) => sum + (s.total_amount || 0), 0) || 0;
        const revenueGrowth = prevRevenue ? ((totalSales - prevRevenue) / prevRevenue) * 100 : 0;

        return {
          branchId: branch.id,
          branchName: branch.name,
          totalSales,
          totalTransactions,
          averageOrderValue,
          totalCustomers: customers?.length || 0,
          totalProducts: products?.length || 0,
          lowStockItems,
          activeEmployees: employees?.length || 0,
          revenueGrowth,
        };
      })
    );

    return metrics;
  }

  async getInterBranchTransfers(status?: string): Promise<InterBranchTransfer[]> {
    let query = supabase
      .from('inter_branch_transfers')
      .select(`
        *,
        from_branch:branches!from_branch_id(name),
        to_branch:branches!to_branch_id(name),
        requested_by_user:employee_profiles!requested_by(staff_number, user:users!employee_profiles_user_id_fkey(full_name)),
        approved_by_user:employee_profiles!approved_by(staff_number, user:users!employee_profiles_user_id_fkey(full_name))
      `)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching transfers:', error);
      return [];
    }

    return data || [];
  }

  async createTransferRequest(transfer: Omit<InterBranchTransfer, 'id' | 'created_at' | 'status'>): Promise<InterBranchTransfer | null> {
    const { data, error } = await supabase
      .from('inter_branch_transfers')
      .insert({
        ...transfer,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating transfer:', error);
      return null;
    }

    return data;
  }

  async updateTransferStatus(transferId: string, status: string, userId: string): Promise<boolean> {
    const updates: any = { status };
    
    if (status === 'approved') {
      updates.approved_by = userId;
    } else if (status === 'in_transit') {
      updates.shipped_at = new Date().toISOString();
    } else if (status === 'received') {
      updates.received_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('inter_branch_transfers')
      .update(updates)
      .eq('id', transferId);

    if (error) {
      console.error('Error updating transfer:', error);
      return false;
    }

    // If received, update inventory at both branches
    if (status === 'received') {
      await this.processTransferInventory(transferId);
    }

    return true;
  }

  private async processTransferInventory(transferId: string): Promise<void> {
    // Get transfer details
    const { data: transfer } = await supabase
      .from('inter_branch_transfers')
      .select('*')
      .eq('id', transferId)
      .single();

    if (!transfer) return;

    // Decrement stock at source branch
    for (const item of transfer.items) {
      await supabase.rpc('decrement_product_stock', {
        p_product_id: item.product_id,
        p_quantity: item.quantity,
        p_branch_id: transfer.from_branch_id,
      });

      // Increment stock at destination branch
      await supabase.rpc('increment_product_stock', {
        p_product_id: item.product_id,
        p_quantity: item.quantity,
        p_branch_id: transfer.to_branch_id,
      });
    }
  }

  async getBranchPerformanceRankings(): Promise<BranchPerformance[]> {
    const endDate = new Date().toISOString();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const startDateStr = startDate.toISOString();

    const metrics = await this.getBranchMetrics(startDateStr, endDate);

    // Calculate performance scores
    const performance: BranchPerformance[] = metrics.map((metric) => {
      // Simple scoring algorithm
      const salesScore = Math.min(100, (metric.totalSales / 1000000) * 100); // Normalize to 1M
      const customerScore = Math.min(100, (metric.totalCustomers / 1000) * 100); // Normalize to 1000
      const inventoryScore = Math.max(0, 100 - metric.lowStockItems * 5); // Penalty for low stock
      const efficiencyScore = metric.activeEmployees > 0 
        ? Math.min(100, (metric.totalTransactions / metric.activeEmployees) * 10)
        : 0;

      const overallScore = (salesScore + customerScore + inventoryScore + efficiencyScore) / 4;

      return {
        branchId: metric.branchId,
        branchName: metric.branchName,
        rank: 0, // Will be calculated after sorting
        salesGrowth: metric.revenueGrowth,
        customerGrowth: 0, // Would need previous period data
        inventoryTurnover: inventoryScore,
        employeeEfficiency: efficiencyScore,
        customerSatisfaction: customerScore,
      };
    });

    // Sort by overall score and assign ranks
    performance.sort((a, b) => {
      const scoreA = (a.salesGrowth + a.customerGrowth + a.inventoryTurnover + a.employeeEfficiency) / 4;
      const scoreB = (b.salesGrowth + b.customerGrowth + b.inventoryTurnover + b.employeeEfficiency) / 4;
      return scoreB - scoreA;
    });

    performance.forEach((p, index) => {
      p.rank = index + 1;
    });

    return performance;
  }

  async getCentralizedInventory(): Promise<any[]> {
    const { data: products } = await supabase
      .from('products')
      .select(`
        id,
        name,
        sku,
        category,
        branch_inventory:branch_inventory(
          branch_id,
          branch:branches(name),
          quantity
        )
      `);

    if (!products) return [];

    return products.map((product) => {
      const branchStock = (product.branch_inventory || []).map((bi: any) => ({
        branchId: bi.branch_id,
        branchName: bi.branch?.name || 'Unknown',
        quantity: bi.quantity || 0,
      }));

      const totalStock = branchStock.reduce((sum, bs) => sum + bs.quantity, 0);

      return {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        category: product.category,
        totalStock,
        branchStock,
      };
    });
  }

  async getUserBranchAccess(userId: string): Promise<string[]> {
    const { data: userBranches } = await supabase
      .from('user_branches')
      .select('branch_id')
      .eq('user_id', userId);

    return userBranches?.map((ub) => ub.branch_id) || [];
  }

  async assignUserToBranch(userId: string, branchId: string): Promise<boolean> {
    const { error } = await supabase
      .from('user_branches')
      .insert({ user_id: userId, branch_id: branchId });

    return !error;
  }

  async removeUserFromBranch(userId: string, branchId: string): Promise<boolean> {
    const { error } = await supabase
      .from('user_branches')
      .delete()
      .eq('user_id', userId)
      .eq('branch_id', branchId);

    return !error;
  }
}

export const branchService = new BranchService();
