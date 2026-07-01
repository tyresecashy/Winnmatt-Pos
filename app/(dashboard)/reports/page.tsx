'use client'
import { logger } from '@/lib/logger';

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts'
import { Download, Calendar, TrendingUp, TrendingDown, Package, Users as UsersIcon, AlertCircle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import {
  getSalesStats,
  getTopSellingProducts,
  getSlowMovingProducts,
  getInventoryValueByCategory,
  getBranchPerformanceStats,
  getCashierPerformanceStats,
  getDailySalesTrend,
  getStockMovementSummary,
  getLowStockProducts,
} from '@/lib/reports-actions'
import { formatKSh } from '@/lib/currency'
import { formatDate } from '@/lib/date-time'

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))', '#999']

type PeriodType = 'today' | 'week' | 'month' | 'quarter'

/**
 * Calculate date range based on period
 */
function getDateRange(period: PeriodType) {
  const now = new Date()
  const startDate = new Date()

  switch (period) {
    case 'today':
      startDate.setHours(0, 0, 0, 0)
      break
    case 'week':
      startDate.setDate(now.getDate() - now.getDay())
      startDate.setHours(0, 0, 0, 0)
      break
    case 'month':
      startDate.setDate(1)
      startDate.setHours(0, 0, 0, 0)
      break
    case 'quarter':
      const quarter = Math.floor(now.getMonth() / 3)
      startDate.setMonth(quarter * 3)
      startDate.setDate(1)
      startDate.setHours(0, 0, 0, 0)
      break
  }

  return {
    startDate: startDate.toISOString(),
    endDate: now.toISOString(),
  }
}

export default function ReportsPage() {
  const { profile } = useAuth()
  const [period, setPeriod] = useState<PeriodType>('today')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  // Sales stats
  const [salesStats, setSalesStats] = useState({
    totalSales: 0,
    transactionCount: 0,
    averageTransaction: 0,
    paymentMethods: {} as Record<string, { amount: number; count: number }>,
  })

  // Report data
  const [topProducts, setTopProducts] = useState<any[]>([])
  const [slowMovingProducts, setSlowMovingProducts] = useState<any[]>([])
  const [inventoryByCategory, setInventoryByCategory] = useState<{
    categories: Array<{ category: string; value: number; percentage: number }>
    totalValue: number
  }>({ categories: [], totalValue: 0 })
  const [branchStats, setBranchStats] = useState<any[]>([])
  const [cashierStats, setCashierStats] = useState<any[]>([])
  const [dailyTrend, setDailyTrend] = useState<any[]>([])
  const [stockMovementSummary, setStockMovementSummary] = useState<any>({})
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([])
  const [showAllTopProducts, setShowAllTopProducts] = useState(false)
  const [showAllSlowProducts, setShowAllSlowProducts] = useState(false)

  // Load all reports data
  useEffect(() => {
    async function loadReports() {
      if (!profile?.branch_id) return

      setLoading(true)
      try {
        const { startDate, endDate } = getDateRange(period)

        // Load all data in parallel
        const [stats, topProds, slowProds, inventory, branches, cashiers, trend, stockMov, lowStock] =
          await Promise.all([
            getSalesStats(profile.branch_id, startDate, endDate),
            getTopSellingProducts(profile.branch_id, startDate, endDate),
            getSlowMovingProducts(profile.branch_id, 7),
            getInventoryValueByCategory(profile.branch_id),
            getBranchPerformanceStats(startDate, endDate),
            getCashierPerformanceStats(profile.branch_id, startDate, endDate),
            getDailySalesTrend(profile.branch_id, startDate, endDate),
            getStockMovementSummary(profile.branch_id, startDate, endDate),
            getLowStockProducts(profile.branch_id),
          ])

        setSalesStats(stats)
        setTopProducts(topProds)
        setSlowMovingProducts(slowProds)
        setInventoryByCategory(inventory)
        setBranchStats(branches)
        setCashierStats(cashiers)
        setDailyTrend(trend)
        setStockMovementSummary(stockMov)
        setLowStockProducts(lowStock)
        setError(null)
      } catch (err) {
        logger.error('Error loading reports:', err)
        setError('Failed to load reports. The server may be unavailable.')
      } finally {
        setLoading(false)
      }
    }

    loadReports()
  }, [period, profile?.branch_id, retryCount])

  const [exporting, setExporting] = useState(false)

  const handleExport = () => {
    setExporting(true)
    // Use setTimeout to let the UI update before the sync CSV work
    setTimeout(() => {
      // Create CSV with sales data
      const rows = [
        ['Sales Report', '', '', ''],
        ['Period', period, '', ''],
        ['Generated', new Date().toLocaleString(), '', ''],
        ['', '', '', ''],
        ['Total Sales', formatKSh(salesStats.totalSales), '', ''],
        ['Transactions', salesStats.transactionCount, '', ''],
        ['Average Transaction', formatKSh(salesStats.averageTransaction), '', ''],
      ]

      const csv = rows.map((row) => row.map(String).map(escapeCsvField).join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `reports-${period}-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      setExporting(false)
    }, 50)
  }

  function escapeCsvField(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }

  if (loading) {
    return (
      <div role="region" aria-label="Loading reports" className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-[150px]" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
        <Skeleton className="h-10 w-full max-w-md" />
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-md" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-32 mt-2" />
              </CardHeader>
            </Card>
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56 mt-1" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[300px] w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56 mt-1" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-2 w-full" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div role="region" aria-label="Reports dashboard" className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">Analyze your business performance</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(val) => setPeriod(val as PeriodType)}>
            <SelectTrigger className="w-[150px]">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExport} disabled={exporting}>
            <Download className="mr-2 h-4 w-4" />
            {exporting ? 'Exporting...' : 'Export'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <p className="text-sm text-destructive font-medium">{error}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setRetryCount((c) => c + 1)}>
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        </div>
      )}

      <Tabs defaultValue="sales" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="branches">Branches</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="cashiers">Cashiers</TabsTrigger>
        </TabsList>

        {/* SALES TAB */}
        <TabsContent value="sales" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Sales</CardDescription>
                <CardTitle className="text-2xl">{formatKSh(salesStats.totalSales)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Transactions</CardDescription>
                <CardTitle className="text-2xl">{salesStats.transactionCount}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Avg. Transaction</CardDescription>
                <CardTitle className="text-2xl">{formatKSh(salesStats.averageTransaction)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Payment Methods</CardDescription>
                <CardTitle className="text-lg">
                  {Object.keys(salesStats.paymentMethods || {}).filter(
                    (m) => (salesStats.paymentMethods as any)[m]?.count > 0
                  ).length}{' '}
                  methods
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Daily Sales Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Daily Sales Trend</CardTitle>
                <CardDescription>Sales over the period</CardDescription>
              </CardHeader>
              <CardContent>
                <div role="img" aria-label="Daily sales trend chart" className="h-[300px]">
                  {dailyTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={dailyTrend}>
                        <defs>
                          <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                          dataKey="date"
                          className="text-xs fill-muted-foreground"
                          tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        />
                        <YAxis className="text-xs fill-muted-foreground" tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="rounded-lg border bg-background p-3 shadow-md">
                                  <p className="font-medium">{new Date(payload[0].payload.date).toLocaleDateString()}</p>
                                  <p className="text-sm text-muted-foreground">Sales: {formatKSh(payload[0].value as number)}</p>
                                </div>
                              )
                            }
                            return null
                          }}
                        />
                        <Area type="monotone" dataKey="sales" stroke="hsl(var(--chart-1))" fill="url(#salesGradient)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">No sales data</div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Payment Methods */}
            <Card>
              <CardHeader>
                <CardTitle>Payment Methods</CardTitle>
                <CardDescription>Sales breakdown by payment method</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(salesStats.paymentMethods || {})
                    .filter(([_, data]) => (data?.count || 0) > 0)
                    .sort((a, b) => (b[1]?.amount || 0) - (a[1]?.amount || 0))
                    .map(([method, data]) => {
                      const percent =
                        salesStats.totalSales > 0
                          ? Math.round(((data?.amount || 0) / salesStats.totalSales) * 100)
                          : 0
                      return (
                        <div key={method} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm capitalize font-medium">{method.replace('_', ' ')}</span>
                            <span className="text-sm text-muted-foreground">{percent}%</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${percent}%` }} />
                          </div>
                          <p className="text-xs text-muted-foreground">{formatKSh(data?.amount || 0)} • {data?.count || 0} transactions</p>
                        </div>
                      )
                    })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* BRANCHES TAB */}
        <TabsContent value="branches" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Branch Performance</CardTitle>
                <CardDescription>Sales by branch</CardDescription>
              </CardHeader>
              <CardContent>
                <div role="img" aria-label="Branch performance bar chart" className="h-[300px]">
                  {branchStats.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={branchStats}
                        layout="vertical"
                        margin={{ left: 150, right: 30, top: 5, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" className="text-xs fill-muted-foreground" tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                        <YAxis
                          dataKey="branch_name"
                          type="category"
                          className="text-xs fill-muted-foreground"
                          width={140}
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="rounded-lg border bg-background p-3 shadow-md">
                                  <p className="font-medium">{payload[0].payload.branch_name}</p>
                                  <p className="text-sm">Sales: {formatKSh(payload[0].value as number)}</p>
                                  <p className="text-sm text-muted-foreground">Transactions: {payload[0].payload.transactions}</p>
                                </div>
                              )
                            }
                            return null
                          }}
                        />
                        <Bar dataKey="sales" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">No branch data</div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Branch Comparison</CardTitle>
                <CardDescription>Key metrics by location</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {branchStats.map((branch) => (
                    <div key={branch.branch_id} className="space-y-2 p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{branch.branch_name}</span>
                        <span className="text-sm text-muted-foreground">{formatKSh(branch.sales)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{branch.transactions} transactions</span>
                        <span>Avg: {formatKSh(branch.transactions > 0 ? Math.round(branch.sales / branch.transactions) : 0)}</span>
                      </div>
                    </div>
                  ))}
                  {branchStats.length === 0 && <p className="text-muted-foreground text-sm">No branch data</p>}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* PRODUCTS TAB */}
        <TabsContent value="products" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Top Selling Products */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  Top Selling Products
                </CardTitle>
                <CardDescription>Best performers this period</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topProducts.length > 0 ? (
                    (showAllTopProducts ? topProducts : topProducts.slice(0, 5)).map((product, index) => (
                      <div key={product.product_id} className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{product.units_sold} units</p>
                        </div>
                        <span className="font-semibold text-sm">{formatKSh(product.revenue)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm">No sales data</p>
                  )}
                  {topProducts.length > 5 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-muted-foreground"
                      onClick={() => setShowAllTopProducts(!showAllTopProducts)}
                    >
                      {showAllTopProducts ? (
                        <>Show Less <ChevronUp className="ml-1 h-4 w-4" /></>
                      ) : (
                        <>Show All ({topProducts.length}) <ChevronDown className="ml-1 h-4 w-4" /></>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Slow Moving Products */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-yellow-600" />
                  Slow Moving Products
                </CardTitle>
                <CardDescription>Items not sold recently</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {slowMovingProducts.length > 0 ? (
                    (showAllSlowProducts ? slowMovingProducts : slowMovingProducts.slice(0, 5)).map((product) => (
                      <div key={product.product_id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        <Package className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{product.product}</p>
                          <p className="text-xs text-muted-foreground">{product.stock} in stock</p>
                        </div>
                        <span className="text-sm text-yellow-600 font-medium flex-shrink-0">
                          {product.days_since_last_sale} days
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm">No slow moving products</p>
                  )}
                  {slowMovingProducts.length > 5 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-muted-foreground"
                      onClick={() => setShowAllSlowProducts(!showAllSlowProducts)}
                    >
                      {showAllSlowProducts ? (
                        <>Show Less <ChevronUp className="ml-1 h-4 w-4" /></>
                      ) : (
                        <>Show All ({slowMovingProducts.length}) <ChevronDown className="ml-1 h-4 w-4" /></>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Low Stock Alert */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-red-600" />
                Low Stock / Out of Stock
              </CardTitle>
              <CardDescription>Products requiring attention</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {lowStockProducts.length > 0 ? (
                  lowStockProducts.map((product) => (
                    <div key={product.product_id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border-l-2 border-red-500">
                      <div>
                        <p className="text-sm font-medium">{product.product_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {product.current_stock} in stock {product.status === 'out_of_stock' ? '(OUT OF STOCK)' : `(Reorder: ${product.reorder_level})`}
                        </p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${
                        product.status === 'out_of_stock'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {product.status === 'out_of_stock' ? 'OUT' : 'LOW'}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-sm">All products have adequate stock</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* INVENTORY TAB */}
        <TabsContent value="inventory" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Inventory Value Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Inventory Value by Category</CardTitle>
                <CardDescription>Total value: {formatKSh(inventoryByCategory.totalValue)}</CardDescription>
              </CardHeader>
              <CardContent>
                <div role="img" aria-label="Inventory value by category pie chart" className="h-[300px]">
                  {inventoryByCategory.categories.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={inventoryByCategory.categories}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {inventoryByCategory.categories.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="rounded-lg border bg-background p-3 shadow-md">
                                  <p className="font-medium">{payload[0].payload.category}</p>
                                  <p className="text-sm">{formatKSh(payload[0].value as number)}</p>
                                  <p className="text-sm text-muted-foreground">{payload[0].payload.percentage}% of total</p>
                                </div>
                              )
                            }
                            return null
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">No inventory data</div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Category Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Category Breakdown</CardTitle>
                <CardDescription>Inventory value by category</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {inventoryByCategory.categories.length > 0 ? (
                    inventoryByCategory.categories.map((category, index) => (
                      <div key={category.category} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                        <div className="flex items-center gap-3 flex-1">
                          <div
                            className="h-3 w-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <div>
                            <p className="text-sm font-medium">{category.category}</p>
                            <p className="text-xs text-muted-foreground">{category.percentage}% of total</p>
                          </div>
                        </div>
                        <span className="font-medium text-sm">{formatKSh(category.value)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm">No category data</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Stock Movement Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Stock Movement Summary</CardTitle>
              <CardDescription>Stock in vs stock out for this period</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-6">
                {Object.entries(stockMovementSummary)
                  .filter(([_, qty]) => (qty as number) !== 0)
                  .map(([type, quantity]) => (
                    <div key={type} className="p-3 rounded-lg bg-muted/30">
                      <p className="text-xs text-muted-foreground capitalize">{type.replace('_', ' ')}</p>
                      <p className="text-2xl font-bold text-primary">{quantity as number}</p>
                      <p className="text-xs text-muted-foreground">units</p>
                    </div>
                  ))}
                {Object.values(stockMovementSummary).every((v) => v === 0) && (
                  <p className="text-muted-foreground text-sm col-span-6">No stock movements this period</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CASHIERS TAB */}
        <TabsContent value="cashiers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Cashier Performance</CardTitle>
              <CardDescription>Sales and transaction metrics by cashier</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {cashierStats.length > 0 ? (
                  cashierStats.map((cashier) => (
                    <div key={cashier.cashier_id} className="p-4 rounded-lg bg-muted/30 space-y-3 border">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                          <UsersIcon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{cashier.cashier_name}</p>
                          <p className="text-xs text-muted-foreground">Cashier</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-background rounded p-2">
                          <p className="text-lg font-bold">{formatKSh(cashier.sales)}</p>
                          <p className="text-xs text-muted-foreground">Total Sales</p>
                        </div>
                        <div className="bg-background rounded p-2">
                          <p className="text-lg font-bold">{cashier.transactions}</p>
                          <p className="text-xs text-muted-foreground">Transactions</p>
                        </div>
                        <div className="bg-background rounded p-2">
                          <p className="text-lg font-bold">{formatKSh(cashier.avg_transaction)}</p>
                          <p className="text-xs text-muted-foreground">Avg. Basket</p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-sm">No cashier data</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
