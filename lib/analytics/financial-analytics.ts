import { supabaseAdmin } from '@/lib/supabase-server'

export interface FinancialMetrics {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
  revenueGrowth: number;
  expenseGrowth: number;
}

export interface PLTrend {
  period: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  operatingExpenses: number;
  netProfit: number;
  grossMargin: number;
  netMargin: number;
}

export interface CashFlowForecast {
  period: string;
  openingBalance: number;
  inflows: number;
  outflows: number;
  closingBalance: number;
  netCashFlow: number;
}

export interface ExpenseBreakdown {
  category: string;
  amount: number;
  percentage: number;
  trend: number;
}

export interface MarginAnalysis {
  category: string;
  revenue: number;
  cost: number;
  margin: number;
  marginPercentage: number;
}

export class FinancialAnalyticsService {
  async getFinancialMetrics(startDate: string, endDate: string): Promise<FinancialMetrics> {
    const start_date = new Date(startDate);
    const end_date = new Date(endDate);
    const period_length = end_date.getTime() - start_date.getTime();
    const prev_start = new Date(start_date.getTime() - period_length).toISOString();
    const prev_end = start_date.toISOString();

    // All 5 queries are independent — run in parallel
    const [
      { data: sales },
      { data: saleItems },
      { data: expenses },
      { data: prevSales },
      { data: prevExpenseData },
    ] = await Promise.all([
      supabaseAdmin.from('sales').select('total_amount').gte('created_at', startDate).lte('created_at', endDate).eq('payment_status', 'completed'),
      supabaseAdmin.from('sale_items').select('quantity, products(purchase_price)').gte('created_at', startDate).lte('created_at', endDate),
      supabaseAdmin.from('expenses').select('amount').gte('created_at', startDate).lte('created_at', endDate).eq('status', 'approved'),
      supabaseAdmin.from('sales').select('total_amount').gte('created_at', prev_start).lte('created_at', prev_end).eq('payment_status', 'completed'),
      supabaseAdmin.from('expenses').select('amount').gte('created_at', prev_start).lte('created_at', prev_end).eq('status', 'approved'),
    ]);

    const expensesRows = expenses as unknown as Array<Record<string, unknown>> | null;
    const prevExpenseRows = prevExpenseData as unknown as Array<Record<string, unknown>> | null;

    const totalRevenue = sales?.reduce((sum, s) => sum + (s.total_amount || 0), 0) || 0;
    const totalCOGS = saleItems?.reduce((sum, item) => {
      const prod = (item.products as Array<{ purchase_price: number }> | { purchase_price: number } | null)
      const costPrice = (Array.isArray(prod) ? prod[0] : prod)?.purchase_price || 0;
      return sum + (costPrice * item.quantity);
    }, 0) || 0;
    const totalExpenses = expensesRows?.reduce((sum, e) => sum + ((e.amount as number) || 0), 0) || 0;

    const grossProfit = totalRevenue - totalCOGS;
    const netProfit = grossProfit - totalExpenses;
    const profitMargin = totalRevenue ? (netProfit / totalRevenue) * 100 : 0;

    const prevRevenue = prevSales?.reduce((sum, s) => sum + (s.total_amount || 0), 0) || 0;
    const prevExpenses = prevExpenseRows?.reduce((sum, e) => sum + ((e.amount as number) || 0), 0) || 0;

    const revenueGrowth = prevRevenue ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;
    const expenseGrowth = prevExpenses ? ((totalExpenses - prevExpenses) / prevExpenses) * 100 : 0;

    return {
      totalRevenue,
      totalExpenses,
      netProfit,
      profitMargin,
      revenueGrowth,
      expenseGrowth,
    };
  }

  async getPLTrend(startDate: string, endDate: string, interval: 'daily' | 'weekly' | 'monthly' = 'monthly'): Promise<PLTrend[]> {
    const [{ data: sales }, { data: saleItems }, { data: expenses }    ] = await Promise.all([
      supabaseAdmin.from('sales').select('created_at, total_amount').gte('created_at', startDate).lte('created_at', endDate).eq('payment_status', 'completed'),
      supabaseAdmin.from('sale_items').select('created_at, quantity, products(purchase_price)').gte('created_at', startDate).lte('created_at', endDate),
      supabaseAdmin.from('expenses').select('created_at, amount').gte('created_at', startDate).lte('created_at', endDate).eq('status', 'approved'),
    ]);

    if (!sales || !saleItems || !expenses) return [];

    const expensesRows = expenses as unknown as Array<Record<string, unknown>>;

    const periodMap = new Map<string, {
      revenue: number;
      cogs: number;
      operatingExpenses: number;
    }>();

    const start = new Date(startDate);
    const end = new Date(endDate);
    const current = new Date(start);

    while (current <= end) {
      let periodKey: string;
      
      if (interval === 'daily') {
        periodKey = current.toISOString().split('T')[0];
        current.setDate(current.getDate() + 1);
      } else if (interval === 'weekly') {
        const weekStart = new Date(current);
        weekStart.setDate(current.getDate() - current.getDay());
        periodKey = weekStart.toISOString().split('T')[0];
        current.setDate(current.getDate() + 7);
      } else {
        periodKey = `${current.getFullYear()}-${(current.getMonth() + 1).toString().padStart(2, '0')}`;
        current.setMonth(current.getMonth() + 1);
      }

      if (!periodMap.has(periodKey)) {
        periodMap.set(periodKey, { revenue: 0, cogs: 0, operatingExpenses: 0 });
      }
    }

    sales.forEach((sale) => {
      const periodKey = this.getPeriodKey(sale.created_at ?? '', interval);
      const existing = periodMap.get(periodKey);
      if (existing) {
        existing.revenue += sale.total_amount || 0;
      }
    });

    saleItems.forEach((item) => {
      const periodKey = this.getPeriodKey(item.created_at ?? '', interval);
      const existing = periodMap.get(periodKey);
      if (existing) {
        const prod = (item.products as Array<{ purchase_price: number }> | { purchase_price: number } | null)
      const costPrice = (Array.isArray(prod) ? prod[0] : prod)?.purchase_price || 0;
        existing.cogs += costPrice * item.quantity;
      }
    });

    expensesRows.forEach((expense) => {
      const periodKey = this.getPeriodKey((expense.created_at as string) ?? '', interval);
      const existing = periodMap.get(periodKey);
      if (existing) {
        existing.operatingExpenses += (expense.amount as number) || 0;
      }
    });

    return Array.from(periodMap.entries()).map(([period, data]) => {
      const grossProfit = data.revenue - data.cogs;
      const netProfit = grossProfit - data.operatingExpenses;
      const grossMargin = data.revenue ? (grossProfit / data.revenue) * 100 : 0;
      const netMargin = data.revenue ? (netProfit / data.revenue) * 100 : 0;

      return {
        period,
        revenue: data.revenue,
        cogs: data.cogs,
        grossProfit,
        operatingExpenses: data.operatingExpenses,
        netProfit,
        grossMargin,
        netMargin,
      };
    }).sort((a, b) => a.period.localeCompare(b.period));
  }

  async getCashFlowForecast(startDate: string, endDate: string): Promise<CashFlowForecast[]> {
    const [{ data: transactions }, { data: openingBalanceData }] = await Promise.all([
      supabaseAdmin.from('bank_transactions').select('amount, type, transaction_date').gte('transaction_date', startDate).lte('transaction_date', endDate),
      supabaseAdmin.from('bank_accounts').select('balance').single(),
    ]);

    const transactionsRows = transactions as unknown as Array<Record<string, unknown>> | null;
    const openingBalanceRow = openingBalanceData as unknown as Record<string, unknown> | null;

    const periodMap = new Map<string, { inflows: number; outflows: number }>();

    const start = new Date(startDate);
    const end = new Date(endDate);
    const current = new Date(start);

    while (current <= end) {
      const weekStart = new Date(current);
      weekStart.setDate(current.getDate() - current.getDay());
      const periodKey = weekStart.toISOString().split('T')[0];
      
      if (!periodMap.has(periodKey)) {
        periodMap.set(periodKey, { inflows: 0, outflows: 0 });
      }
      
      current.setDate(current.getDate() + 7);
    }

    transactionsRows?.forEach((txn) => {
      const periodKey = this.getWeekKey(txn.transaction_date as string);
      const existing = periodMap.get(periodKey);
      if (existing) {
        if (txn.type === 'credit') {
          existing.inflows += (txn.amount as number) || 0;
        } else {
          existing.outflows += (txn.amount as number) || 0;
        }
      }
    });

    let openingBalance = (openingBalanceRow?.balance as number) || 0;

    return Array.from(periodMap.entries()).map(([period, data]) => {
      const netCashFlow = data.inflows - data.outflows;
      const closingBalance = openingBalance + netCashFlow;

      const result = {
        period,
        openingBalance,
        inflows: data.inflows,
        outflows: data.outflows,
        closingBalance,
        netCashFlow,
      };

      openingBalance = closingBalance;
      return result;
    }).sort((a, b) => a.period.localeCompare(b.period));
  }

  async getExpenseBreakdown(startDate: string, endDate: string): Promise<ExpenseBreakdown[]> {
    const start_date = new Date(startDate);
    const end_date = new Date(endDate);
    const period_length = end_date.getTime() - start_date.getTime();
    const prev_start = new Date(start_date.getTime() - period_length).toISOString();
    const prev_end = start_date.toISOString();

    const [{ data: expenses }, { data: prevExpenses }] = await Promise.all([
      supabaseAdmin.from('expenses').select('amount, expense_categories(name)').gte('created_at', startDate).lte('created_at', endDate).eq('status', 'approved'),
      supabaseAdmin.from('expenses').select('amount, expense_categories(name)').gte('created_at', prev_start).lte('created_at', prev_end).eq('status', 'approved'),
    ]);

    if (!expenses) return [];

    const expensesRows = expenses as unknown as Array<Record<string, unknown>>;
    const prevExpensesRows = prevExpenses as unknown as Array<Record<string, unknown>> | null;

    const categoryMap = new Map<string, number>();
    let totalExpenses = 0;

    expensesRows.forEach((expense) => {
      const category = (Array.isArray(expense.expense_categories) ? (expense.expense_categories as Array<{ name: string }>)[0] : (expense.expense_categories as { name: string } | null))?.name || 'Uncategorized';
      const existing = categoryMap.get(category) || 0;
      categoryMap.set(category, existing + ((expense.amount as number) || 0));
      totalExpenses += (expense.amount as number) || 0;
    });

    const prevCategoryMap = new Map<string, number>();
    prevExpensesRows?.forEach((expense) => {
      const category = (Array.isArray(expense.expense_categories) ? (expense.expense_categories as Array<{ name: string }>)[0] : (expense.expense_categories as { name: string } | null))?.name || 'Uncategorized';
      const existing = prevCategoryMap.get(category) || 0;
      prevCategoryMap.set(category, existing + ((expense.amount as number) || 0));
    });

    return Array.from(categoryMap.entries()).map(([category, amount]) => {
      const prevAmount = prevCategoryMap.get(category) || 0;
      const trend = prevAmount ? ((amount - prevAmount) / prevAmount) * 100 : 0;

      return {
        category,
        amount,
        percentage: totalExpenses ? (amount / totalExpenses) * 100 : 0,
        trend,
      };
    }).sort((a, b) => b.amount - a.amount);
  }

  async getMarginAnalysis(startDate: string, endDate: string): Promise<MarginAnalysis[]> {
    const { data: saleItems } = await supabaseAdmin
      .from('sale_items')
      .select(`
        quantity,
        unit_price,
        line_total,
        products (
          category_id,
          purchase_price
        )
      `)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (!saleItems) return [];

    const categoryMap = new Map<string, { revenue: number; cost: number }>();

    saleItems.forEach((item) => {
      const prod2 = (item.products as Array<{ category_id: string }> | { category_id: string } | null)
      const category = (Array.isArray(prod2) ? prod2[0] : prod2)?.category_id || 'Uncategorized';
      const prod = (item.products as Array<{ purchase_price: number }> | { purchase_price: number } | null)
      const costPrice = (Array.isArray(prod) ? prod[0] : prod)?.purchase_price || 0;
      
      const existing = categoryMap.get(category) || { revenue: 0, cost: 0 };
      existing.revenue += item.line_total || 0;
      existing.cost += costPrice * item.quantity;
      categoryMap.set(category, existing);
    });

    return Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      revenue: data.revenue,
      cost: data.cost,
      margin: data.revenue - data.cost,
      marginPercentage: data.revenue ? ((data.revenue - data.cost) / data.revenue) * 100 : 0,
    })).sort((a, b) => b.marginPercentage - a.marginPercentage);
  }

  private getPeriodKey(dateString: string, interval: string): string {
    const date = new Date(dateString);
    
    if (interval === 'daily') {
      return date.toISOString().split('T')[0];
    } else if (interval === 'weekly') {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      return weekStart.toISOString().split('T')[0];
    } else {
      return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    }
  }

  private getWeekKey(dateString: string): string {
    const date = new Date(dateString);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    return weekStart.toISOString().split('T')[0];
  }
}

export const financialAnalyticsService = new FinancialAnalyticsService();
