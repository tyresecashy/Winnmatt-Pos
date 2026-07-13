'use client';

import { logger } from '@/lib/logger';
import { useState, useEffect, useCallback, startTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
} from 'recharts';
import {
  Store,
  TrendingUp,
  TrendingDown,
  Users,
  Package,
  DollarSign,
  RefreshCw,
  Plus,
  ArrowRightLeft,
} from 'lucide-react';
import { branchService, BranchMetrics, InterBranchTransfer } from '@/lib/multi-branch/branch-service';

export default function BranchDashboard() {
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<BranchMetrics[]>([]);
  const [transfers, setTransfers] = useState<InterBranchTransfer[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [dateRange, setDateRange] = useState('30d');

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
    }

    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };
  }, []);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange(dateRange);
      
      const [branchList, branchMetrics, transferList] = await Promise.all([
        branchService.getBranches(),
        branchService.getBranchMetrics(startDate, endDate),
        branchService.getInterBranchTransfers(),
      ]);

      setBranches(branchList);
      setMetrics(branchMetrics);
      setTransfers(transferList);
    } catch (error) {
      logger.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [dateRange, getDateRange]);

  useEffect(() => {
    startTransition(() => { loadDashboardData() });
  }, [dateRange, loadDashboardData]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
    }).format(amount / 100);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-KE').format(num);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-blue-100 text-blue-800';
      case 'in_transit':
        return 'bg-purple-100 text-purple-800';
      case 'received':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  // Calculate totals
  const totalSales = metrics.reduce((sum, m) => sum + m.totalSales, 0);
  const totalTransactions = metrics.reduce((sum, m) => sum + m.totalTransactions, 0);
  const totalCustomers = metrics.reduce((sum, m) => sum + m.totalCustomers, 0);
  const totalEmployees = metrics.reduce((sum, m) => sum + m.activeEmployees, 0);

  // Prepare chart data
  const branchComparisonData = metrics.map((m) => ({
    name: m.branchName,
    sales: m.totalSales / 100, // Convert to KES
    transactions: m.totalTransactions,
    customers: m.totalCustomers,
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading branch data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Multi-Branch Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of all branches and inter-branch operations
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
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={loadDashboardData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Branch
          </Button>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalSales)}</div>
            <p className="text-xs text-muted-foreground">
              Across {branches.length} branches
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totalTransactions)}</div>
            <p className="text-xs text-muted-foreground">
              {Math.round(totalTransactions / branches.length)} avg per branch
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totalCustomers)}</div>
            <p className="text-xs text-muted-foreground">
              Active across all branches
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEmployees}</div>
            <p className="text-xs text-muted-foreground">
              Working across all branches
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Branch Comparison Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Branch Performance Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={branchComparisonData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                <Tooltip />
                <Bar yAxisId="left" dataKey="sales" fill="#8884d8" name="Sales (KES)" />
                <Bar yAxisId="right" dataKey="transactions" fill="#82ca9d" name="Transactions" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Branch Details & Transfers */}
      <Tabs defaultValue="branches" className="space-y-4">
        <TabsList>
          <TabsTrigger value="branches">Branch Details</TabsTrigger>
          <TabsTrigger value="transfers">Inter-Branch Transfers</TabsTrigger>
          <TabsTrigger value="inventory">Centralized Inventory</TabsTrigger>
        </TabsList>

        <TabsContent value="branches" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {metrics.map((metric) => (
              <Card key={metric.branchId}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg">{metric.branchName}</CardTitle>
                  <Badge variant={metric.revenueGrowth >= 0 ? 'default' : 'destructive'}>
                    {metric.revenueGrowth >= 0 ? '+' : ''}
                    {metric.revenueGrowth.toFixed(1)}%
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Sales</span>
                    <span className="font-medium">{formatCurrency(metric.totalSales)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Transactions</span>
                    <span className="font-medium">{formatNumber(metric.totalTransactions)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Customers</span>
                    <span className="font-medium">{formatNumber(metric.totalCustomers)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Employees</span>
                    <span className="font-medium">{metric.activeEmployees}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Low Stock Items</span>
                    <span className={`font-medium ${metric.lowStockItems > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {metric.lowStockItems}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="transfers" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Recent Transfers</h3>
            <Button>
              <ArrowRightLeft className="h-4 w-4 mr-2" />
              New Transfer
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-4 font-medium">Transfer ID</th>
                    <th className="text-left p-4 font-medium">From</th>
                    <th className="text-left p-4 font-medium">To</th>
                    <th className="text-left p-4 font-medium">Status</th>
                    <th className="text-left p-4 font-medium">Value</th>
                    <th className="text-left p-4 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.slice(0, 10).map((transfer) => (
                    <tr key={transfer.id} className="border-b hover:bg-muted/50">
                      <td className="p-4 font-mono text-sm">{transfer.id.slice(0, 8)}...</td>
                      <td className="p-4">{(transfer as InterBranchTransfer & { from_branch?: { name: string } }).from_branch?.name || 'N/A'}</td>
                      <td className="p-4">{(transfer as InterBranchTransfer & { to_branch?: { name: string } }).to_branch?.name || 'N/A'}</td>
                      <td className="p-4">
                        <Badge className={getStatusColor(transfer.status)}>
                          {transfer.status.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="p-4">{formatCurrency(transfer.total_value)}</td>
                      <td className="p-4 text-muted-foreground">
                        {new Date(transfer.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Centralized Inventory View</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                View and manage inventory across all branches
              </p>
              <Button variant="outline">
                <Package className="h-4 w-4 mr-2" />
                View Full Inventory
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
