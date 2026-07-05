'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import {
  TrendingUp, TrendingDown, DollarSign, Package, AlertTriangle,
  CheckCircle2, BarChart3, ShoppingCart, Truck, Search,
  Filter, ArrowUpDown, RefreshCw, Percent, Boxes, Building2,
} from 'lucide-react'
import {
  getInventoryAnalytics,
  getReorderSuggestions,
  getTopPerformers,
  createPurchaseOrdersFromSuggestions,
  type AnalyticsProduct,
  type ReorderSuggestion,
} from '@/lib/inventory-analytics-actions'
import { useAuth } from '@/contexts/auth-context'
import { formatKSh } from '@/lib/currency'

function formatCompact(amount: number): string {
  if (amount >= 1000000) return `KSh ${(amount / 1000000).toFixed(1)}M`
  if (amount >= 1000) return `KSh ${(amount / 1000).toFixed(0)}K`
  return `KSh ${amount}`
}

export default function InventoryAnalyticsPage() {
  const { profile } = useAuth()
  const [products, setProducts] = useState<AnalyticsProduct[]>([])
  const [reorderSuggestions, setReorderSuggestions] = useState<ReorderSuggestion[]>([])
  const [topProfit, setTopProfit] = useState<AnalyticsProduct[]>([])
  const [topRevenue, setTopRevenue] = useState<AnalyticsProduct[]>([])
  const [slowest, setSlowest] = useState<AnalyticsProduct[]>([])
  const [summary, setSummary] = useState<{
    total_products: number; total_stock_value: number; total_margin: number;
    critical_count: number; reorder_count: number; ok_count: number; avg_margin_pct: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [stockFilter, setStockFilter] = useState<string>('all')
  const [creatingPOs, setCreatingPOs] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [analytics, reorder, performers] = await Promise.all([
        getInventoryAnalytics(),
        getReorderSuggestions(),
        getTopPerformers(),
      ])
      if (analytics.products) setProducts(analytics.products)
      if (analytics.summary) setSummary(analytics.summary)
      setReorderSuggestions(reorder)
      setTopProfit(performers.topProfit)
      setTopRevenue(performers.topRevenue)
      setSlowest(performers.slowest)
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to load analytics', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const filteredProducts = products.filter(p => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!p.name.toLowerCase().includes(q) && !p.sku.toLowerCase().includes(q)) return false
    }
    if (stockFilter === 'critical') return p.stock_status === 'critical'
    if (stockFilter === 'reorder') return p.stock_status !== 'ok'
    return true
  })

  const stockFilterOptions = [
    { value: 'all', label: 'All Products', count: products.length },
    { value: 'critical', label: 'Critical', count: products.filter(p => p.stock_status === 'critical').length, color: 'text-red-500' },
    { value: 'reorder', label: 'Needs Reorder', count: products.filter(p => p.stock_status !== 'ok').length, color: 'text-yellow-500' },
  ]

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Intelligence center — profit analysis, reorder engine, and performance insights
          </p>
        </div>
        <Button variant="outline" onClick={loadData}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</Button>
      </div>

      {/* Summary KPI Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Package className="h-4 w-4" /> Total Products
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{summary.total_products}</p>
              <div className="flex gap-2 mt-1 text-xs">
                <span className="text-green-500">{summary.ok_count} OK</span>
                <span className="text-yellow-500">{summary.reorder_count} Low</span>
                <span className="text-red-500">{summary.critical_count} Critical</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" /> Total Stock Value
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCompact(summary.total_stock_value)}</p>
              <p className="text-xs text-muted-foreground">At cost price</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Percent className="h-4 w-4" /> Average Margin
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{summary.avg_margin_pct}%</p>
              <p className="text-xs text-muted-foreground">
                Estimated monthly profit: {formatCompact(summary.total_margin)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Reorder Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{reorderSuggestions.length}</p>
              <p className="text-xs text-muted-foreground">
                Products needing immediate attention
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="reorder" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="reorder" className="flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" /> Reorder Engine
            {reorderSuggestions.length > 0 && (
              <Badge variant="destructive" className="ml-1 text-xs">{reorderSuggestions.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="products" className="flex items-center gap-1">
            <Package className="h-4 w-4" /> All Products
          </TabsTrigger>
          <TabsTrigger value="top-performers" className="flex items-center gap-1">
            <TrendingUp className="h-4 w-4" /> Top Performers
          </TabsTrigger>
          <TabsTrigger value="slow-movers" className="flex items-center gap-1">
            <TrendingDown className="h-4 w-4" /> Slow Movers
          </TabsTrigger>
        </TabsList>

        {/* ── REORDER ENGINE TAB ── */}
        <TabsContent value="reorder">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Auto-Reorder Engine</CardTitle>
                  <CardDescription>
                    Calculated using current stock, safety stock, avg daily sales, and supplier lead time
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" disabled={creatingPOs || reorderSuggestions.length === 0} onClick={async () => {
                  if (!profile?.branch_id) { toast({ title: 'No Branch', description: 'Your profile needs a branch to create POs', variant: 'destructive' }); return }
                  setCreatingPOs(true)
                  try {
                    const result = await createPurchaseOrdersFromSuggestions(profile.branch_id)
                    if (result.success && result.orders.length > 0) {
                      toast({ title: 'POs Created', description: `${result.orders.length} purchase order(s) created successfully` })
                      // Reload data
                      const [analytics, reorder] = await Promise.all([getInventoryAnalytics(), getReorderSuggestions()])
                      if (analytics.products) setProducts(analytics.products)
                      if (analytics.summary) setSummary(analytics.summary)
                      setReorderSuggestions(reorder)
                    } else if (result.orders.length === 0) {
                      toast({ title: 'No POs Created', description: result.message || 'No suppliers configured for reorder items', variant: 'default' })
                    } else {
                      toast({ title: 'Partial', description: result.message || 'Some orders could not be created', variant: 'default' })
                    }
                  } catch { toast({ title: 'Error', description: 'Failed to create purchase orders', variant: 'destructive' })
                  } finally { setCreatingPOs(false) }
                }}>
                  <ShoppingCart className="h-4 w-4 mr-2" /> {creatingPOs ? 'Creating...' : 'Create POs'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {reorderSuggestions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500" />
                  <p className="font-medium">All stock levels are healthy</p>
                  <p className="text-sm">No products need reordering right now</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reorderSuggestions.map((s) => (
                    <div key={s.product_id} className={`p-4 rounded-lg border ${
                      s.priority === 'critical' ? 'border-red-200 bg-red-50 dark:bg-red-950/20' :
                      s.priority === 'high' ? 'border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20' :
                      'border-gray-200'
                    }`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant={
                              s.priority === 'critical' ? 'destructive' :
                              s.priority === 'high' ? 'warning' : 'secondary'
                            } className="uppercase text-xs">
                              {s.priority}
                            </Badge>
                            <p className="font-medium">{s.name}</p>
                            <span className="text-xs text-muted-foreground">SKU: {s.sku}</span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-3 text-sm">
                            <div>
                              <p className="text-muted-foreground">Available</p>
                              <p className="font-bold">{s.available_stock} / {s.reorder_level}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Avg Daily Sales</p>
                              <p className="font-bold">{s.avg_daily_sales.toFixed(1)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Lead Time</p>
                              <p className="font-bold">{s.lead_time_days}d</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Suggested Qty</p>
                              <p className="font-bold text-lg">{s.suggested_order_qty}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Est. Cost</p>
                              <p className="font-bold">{formatKSh(s.estimated_cost)}</p>
                            </div>
                          </div>
                          {s.preferred_supplier_name && (
                            <div className="flex items-center gap-2 mt-2">
                              <Truck className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">
                                Preferred supplier: {s.preferred_supplier_name}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ALL PRODUCTS TAB ── */}
        <TabsContent value="products">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex gap-2">
                  {stockFilterOptions.map(opt => (
                    <Button
                      key={opt.value}
                      variant={stockFilter === opt.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setStockFilter(opt.value)}
                      className="text-xs"
                    >
                      {opt.label}
                      <span className={`ml-1 ${opt.color || ''}`}>({opt.count})</span>
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredProducts.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No products match your search</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-3 font-medium text-muted-foreground">Product</th>
                        <th className="pb-3 font-medium text-muted-foreground">Price</th>
                        <th className="pb-3 font-medium text-muted-foreground">Margin</th>
                        <th className="pb-3 font-medium text-muted-foreground">Stock</th>
                        <th className="pb-3 font-medium text-muted-foreground">Available</th>
                        <th className="pb-3 font-medium text-muted-foreground">Avg/Month</th>
                        <th className="pb-3 font-medium text-muted-foreground">Stock Value</th>
                        <th className="pb-3 font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map((p) => (
                        <tr key={p.id} className="border-b last:border-0 hover:bg-muted/50">
                          <td className="py-3">
                            <p className="font-medium">{p.name}</p>
                            <p className="text-xs text-muted-foreground">SKU: {p.sku}</p>
                          </td>
                          <td className="py-3">{formatKSh(p.selling_price)}</td>
                          <td className="py-3">
                            <span className={p.margin_pct > 20 ? 'text-green-600' : p.margin_pct > 10 ? 'text-yellow-600' : 'text-red-600'}>
                              {p.margin_pct}%
                            </span>
                          </td>
                          <td className="py-3">{p.total_stock}</td>
                          <td className="py-3">{p.available_stock}</td>
                          <td className="py-3">{p.avg_monthly_sales}</td>
                          <td className="py-3">{formatCompact(p.stock_value_cents)}</td>
                          <td className="py-3">
                            <Badge variant={
                              p.stock_status === 'critical' ? 'destructive' :
                              p.stock_status === 'reorder' ? 'warning' : 'default'
                            }>
                              {p.stock_status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TOP PERFORMERS TAB ── */}
        <TabsContent value="top-performers">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-500" /> Top Profit Makers
                </CardTitle>
                <CardDescription>Products generating the most profit monthly</CardDescription>
              </CardHeader>
              <CardContent>
                {topProfit.length === 0 ? (
                  <p className="text-muted-foreground">No data available</p>
                ) : (
                  <div className="space-y-3">
                    {topProfit.map((p, i) => (
                      <div key={p.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-muted-foreground w-6">#{i + 1}</span>
                          <div>
                            <p className="font-medium">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{p.category_name} | {p.sku}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">{formatKSh(p.margin_cents * p.avg_monthly_sales)}/mo</p>
                          <p className="text-xs text-muted-foreground">{p.margin_pct}% margin</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-blue-500" /> Top Revenue Generators
                </CardTitle>
                <CardDescription>Products with the highest monthly revenue</CardDescription>
              </CardHeader>
              <CardContent>
                {topRevenue.length === 0 ? (
                  <p className="text-muted-foreground">No data available</p>
                ) : (
                  <div className="space-y-3">
                    {topRevenue.map((p, i) => (
                      <div key={p.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-muted-foreground w-6">#{i + 1}</span>
                          <div>
                            <p className="font-medium">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{p.category_name}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{formatKSh(p.selling_price * p.avg_monthly_sales)}/mo</p>
                          <p className="text-xs text-muted-foreground">{p.avg_monthly_sales} units/mo</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── SLOW MOVERS TAB ── */}
        <TabsContent value="slow-movers">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-500" /> Slow Movers
              </CardTitle>
              <CardDescription>
                Products tying up cash — high stock value vs low sales velocity
              </CardDescription>
            </CardHeader>
            <CardContent>
              {slowest.length === 0 ? (
                <p className="text-muted-foreground">No data available</p>
              ) : (
                <div className="space-y-3">
                  {slowest.map((p, i) => (
                    <div key={p.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-muted-foreground w-6">#{i + 1}</span>
                        <div>
                          <p className="font-medium">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.category_name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatCompact(p.stock_value_cents)} in stock</p>
                        <p className="text-xs text-muted-foreground">{p.avg_monthly_sales} units/mo | {p.total_stock} in stock</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
