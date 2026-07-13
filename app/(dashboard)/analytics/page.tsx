'use client';
import { logger } from '@/lib/logger';

import { useState, useEffect, useCallback, startTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  Clock,
  Download,
  RefreshCw,
  BarChart3,
  Landmark,
} from 'lucide-react';
import { analyticsService } from '@/lib/analytics';
import type { ReportResult } from '@/lib/analytics';
import type { ProductPerformance, PeakHours, CategoryBreakdown } from '@/lib/analytics/sales-analytics';
import { AIInsightSection } from '@/components/ai/ai-insight-section'
import { analyzeDashboardAI } from '@/lib/modules/ai'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

interface DashboardMetricsData {
  sales: { totalRevenue: number; totalTransactions: number; averageOrderValue: number; revenueGrowth?: number; transactionGrowth?: number };
  inventory: { totalProducts: number; totalStockValue: number; lowStockItems: number; outOfStockItems: number; stockTurnover?: number; shrinkageValue?: number; supplierPerformance?: { supplier: string; deliveryRate: number }[] };
  customer: { activeCustomers: number; newCustomers: number; totalCustomers: number; averageOrderValue: number; customerRetentionRate?: number; segments?: { segment: string; count: number }[] };
  workforce: { activeWorkers: number; averageTaskCompletionRate?: number; averageEfficiencyScore?: number; totalTasks: number; taskEfficiency?: { workerName: string; completionRate: number }[] };
  financial: { totalRevenue: number; totalExpenses: number; netProfit: number; profitMargin?: number; revenueGrowth?: number; expenseGrowth?: number; expenseBreakdown?: { category: string; amount: number; percentage: number }[] };
}

export default function AnalyticsDashboard() {
  const [dateRange, setDateRange] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<DashboardMetricsData | null>(null);
  const [salesTrend, setSalesTrend] = useState<{ date: string; revenue: number; transactions: number }[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdown[]>([]);
  const [topProducts, setTopProducts] = useState<ProductPerformance[]>([]);
  const [peakHours, setPeakHours] = useState<PeakHours[]>([]);

  const getDateRange = useCallback((range: string) => {
    const end = new Date();
    const start = new Date();
    
    switch (range) {
      case '7d':
        start.setDate(start.getDate() - 7);
        break;
      case '30d':
        start.setDate(start.getDate() - 30);
        break;
      case '90d':
        start.setDate(start.getDate() - 90);
        break;
      case '1y':
        start.setFullYear(start.getFullYear() - 1);
        break;
    }

    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };
  }, []);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange(dateRange);
      
      const [
        dashboardMetrics,
        trendReport,
        categoriesReport,
        productsReport,
        hoursReport,
      ] = await Promise.all([
        analyticsService.getDashboardMetrics(startDate, endDate),
        analyticsService.generateCustomReport({
          templateId: 'daily-sales',
          parameters: { startDate, endDate },
        }),
        analyticsService.generateCustomReport({
          templateId: 'category-breakdown',
          parameters: { startDate, endDate },
        }),
        analyticsService.generateCustomReport({
          templateId: 'top-products',
          parameters: { startDate, endDate },
        }),
        analyticsService.generateCustomReport({
          templateId: 'peak-hours',
          parameters: { startDate, endDate },
        }),
      ]);

      setMetrics(dashboardMetrics as unknown as DashboardMetricsData);
      setSalesTrend((trendReport?.widgets?.[2]?.data || []) as { date: string; revenue: number; transactions: number }[]);
      setCategoryBreakdown((categoriesReport?.widgets?.[0]?.data || []) as CategoryBreakdown[]);
      setTopProducts((productsReport?.widgets?.[0]?.data || []) as ProductPerformance[]);
      setPeakHours((hoursReport?.widgets?.[0]?.data || []) as PeakHours[]);
    } catch (error) {
      logger.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [dateRange, getDateRange]);

  useEffect(() => {
    startTransition(() => { loadAnalytics() });
  }, [dateRange, loadAnalytics]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-KE').format(num);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-80" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-[180px]" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader><CardContent><Skeleton className="h-8 w-32" /></CardContent></Card>
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Card><CardHeader><Skeleton className="h-5 w-36" /></CardHeader><CardContent><Skeleton className="h-[300px] w-full rounded-lg" /></CardContent></Card>
          <Card><CardHeader><Skeleton className="h-5 w-36" /></CardHeader><CardContent><Skeleton className="h-[300px] w-full rounded-lg" /></CardContent></Card>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardHeader><Skeleton className="h-5 w-28" /></CardHeader><CardContent><div className="space-y-3">{Array.from({ length: 4 }).map((_, j) => <Skeleton key={j} className="h-5 w-full" />)}</div></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Business intelligence and performance insights
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={loadAnalytics}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* AI Insights */}
      <AIInsightSection
        title="AI Analytics Summary"
        description="Cross-domain AI snapshot of your business performance"
        analyzeFn={analyzeDashboardAI}
      />

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(metrics?.financial?.totalRevenue || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              <span className={(metrics?.financial?.revenueGrowth ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}>
                {(metrics?.financial?.revenueGrowth ?? 0) >= 0 ? '+' : ''}
                {metrics?.financial?.revenueGrowth?.toFixed(1)}%
              </span>{' '}
              from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(metrics?.sales?.totalTransactions || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              <span className={(metrics?.sales?.transactionGrowth ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}>
                {(metrics?.sales?.transactionGrowth ?? 0) >= 0 ? '+' : ''}
                {metrics?.sales?.transactionGrowth?.toFixed(1)}%
              </span>{' '}
              from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(metrics?.customer?.activeCustomers || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics?.customer?.newCustomers || 0} new this period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.inventory?.lowStockItems || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics?.inventory?.outOfStockItems || 0} out of stock
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="sales" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="inventory"><Package className="h-4 w-4 mr-1" /> Inventory</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="financial"><Landmark className="h-4 w-4 mr-1" /> Financial</TabsTrigger>
          <TabsTrigger value="workforce">Workforce</TabsTrigger>
          <TabsTrigger value="reports">Report Builder</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" asChild>
              <a href="/analytics/sales"><BarChart3 className="h-4 w-4 mr-2" /> Full Sales Analytics</a>
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={salesTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="revenue" stroke="#8884d8" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Peak Hours</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={peakHours}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hour" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="transactions" fill="#82ca9d" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" asChild>
              <a href="/analytics/inventory"><Package className="h-4 w-4 mr-2" /> Full Inventory Analytics</a>
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Category Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryBreakdown}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }: any) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="revenue"
                      >
                        {categoryBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Products</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topProducts.slice(0, 5).map((product, index: number) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="font-medium">{product.productName}</div>
                        <Badge variant="secondary">{product.category}</Badge>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{formatCurrency(product.revenue)}</div>
                        <div className="text-sm text-muted-foreground">
                          {product.totalSold} sold
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Inventory Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total Stock Value</span>
                    <span className="font-medium">{formatCurrency(metrics?.inventory?.totalStockValue || 0)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Low Stock Items</span>
                    <span className="font-medium">{metrics?.inventory?.lowStockItems || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Out of Stock</span>
                    <span className="font-medium">{metrics?.inventory?.outOfStockItems || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Stock Turnover</span>
                    <span className="font-medium">{metrics?.inventory?.stockTurnover || 0}x</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Shrinkage</span>
                    <span className="font-medium text-red-600">{formatCurrency(metrics?.inventory?.shrinkageValue || 0)}</span>
                  </div>
                  <Button variant="outline" size="sm" className="w-full mt-4" asChild>
                    <a href="/analytics/inventory"><BarChart3 className="h-4 w-4 mr-2" /> Full Inventory Analytics</a>
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Supplier Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metrics?.inventory?.supplierPerformance || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="supplier" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="deliveryRate" fill="#00C49F" name="On-Time Delivery %" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="financial" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Profit & Loss Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total Revenue</span>
                    <span className="font-medium text-green-600">{formatCurrency(metrics?.financial?.totalRevenue || 0)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total Expenses</span>
                    <span className="font-medium text-red-600">{formatCurrency(metrics?.financial?.totalExpenses || 0)}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Net Profit</span>
                    <span className={`font-bold text-lg ${(metrics?.financial?.netProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(metrics?.financial?.netProfit || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Profit Margin</span>
                    <span className="font-medium">{metrics?.financial?.profitMargin?.toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Revenue Growth</span>
                    <span className={`font-medium ${(metrics?.financial?.revenueGrowth || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {(metrics?.financial?.revenueGrowth ?? 0) >= 0 ? '+' : ''}{metrics?.financial?.revenueGrowth?.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Expense Growth</span>
                    <span className={`font-medium ${(metrics?.financial?.expenseGrowth || 0) <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {(metrics?.financial?.expenseGrowth ?? 0) >= 0 ? '+' : ''}{metrics?.financial?.expenseGrowth?.toFixed(1)}%
                    </span>
                  </div>
                  <Button variant="outline" size="sm" className="w-full mt-4" asChild>
                    <a href="/analytics/finance"><Landmark className="h-4 w-4 mr-2" /> Full Financial Analytics</a>
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Expense Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={metrics?.financial?.expenseBreakdown || []}
                        cx="50%" cy="50%"
                        labelLine={false}
                        label={({ category, percent }: any) => `${category} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="amount"
                        nameKey="category"
                      >
                        {(metrics?.financial?.expenseBreakdown || []).map((_, idx: number) => (
                          <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="customers" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" asChild>
              <a href="/analytics/customers"><Users className="h-4 w-4 mr-2" /> Full Customer Analytics</a>
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Customer Segments</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metrics?.customer?.segments || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="segment" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Customer Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Retention Rate</span>
                    <span className="font-medium">
                      {metrics?.customer?.customerRetentionRate?.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Average Order Value</span>
                    <span className="font-medium">
                      {formatCurrency(metrics?.customer?.averageOrderValue || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total Customers</span>
                    <span className="font-medium">
                      {formatNumber(metrics?.customer?.totalCustomers || 0)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="workforce" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" asChild>
              <a href="/analytics/workforce"><Clock className="h-4 w-4 mr-2" /> Full Workforce Analytics</a>
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Task Completion</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metrics?.workforce?.taskEfficiency || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="workerName" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="completionRate" fill="#82ca9d" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Workforce Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Active Workers</span>
                    <span className="font-medium">
                      {metrics?.workforce?.activeWorkers || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Avg Task Completion</span>
                    <span className="font-medium">
                      {metrics?.workforce?.averageTaskCompletionRate?.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Avg Efficiency Score</span>
                    <span className="font-medium">
                      {metrics?.workforce?.averageEfficiencyScore?.toFixed(1)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Custom Report Builder</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Generate custom reports on demand using pre-built templates.</p>
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Daily Sales</CardTitle></CardHeader>
                  <CardContent><p className="text-xs text-muted-foreground">Revenue, transactions, and item sales by day</p></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Category Breakdown</CardTitle></CardHeader>
                  <CardContent><p className="text-xs text-muted-foreground">Sales distribution across product categories</p></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Top Products</CardTitle></CardHeader>
                  <CardContent><p className="text-xs text-muted-foreground">Best-selling products ranked by revenue</p></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Peak Hours</CardTitle></CardHeader>
                  <CardContent><p className="text-xs text-muted-foreground">Transaction volume analysis by hour of day</p></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Profit & Loss</CardTitle></CardHeader>
                  <CardContent><p className="text-xs text-muted-foreground">Revenue, COGS, expenses, and net profit</p></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Inventory Status</CardTitle></CardHeader>
                  <CardContent><p className="text-xs text-muted-foreground">Current stock levels, reorder points, and shortages</p></CardContent>
                </Card>
              </div>
              <div className="flex gap-3 mt-6">
                <Button>Generate Report</Button>
                <Button variant="outline"><Download className="h-4 w-4 mr-2" /> Export as PDF</Button>
                <Button variant="outline"><Download className="h-4 w-4 mr-2" /> Export as CSV</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
