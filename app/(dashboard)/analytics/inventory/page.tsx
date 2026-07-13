'use client'

import { useState, useEffect, startTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts'
import { CustomTooltip } from '@/components/charts/custom-tooltip'
import { ArrowLeft, Package, AlertTriangle, RefreshCw, TrendingDown } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { inventoryAnalyticsService } from '@/lib/analytics/inventory-analytics'
import type { InventoryMetrics, StockTurnover, SupplierPerformance, DeadStockItem, ReorderPrediction } from '@/lib/analytics/inventory-analytics'
import { AIInsightSection } from '@/components/ai/ai-insight-section'
import { analyzeInventoryAI } from '@/lib/modules/ai'
import { EmptyState } from '@/components/ui/empty-state'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d']

export default function InventoryAnalyticsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<InventoryMetrics | null>(null)
  const [turnover, setTurnover] = useState<StockTurnover[]>([])
  const [suppliers, setSuppliers] = useState<SupplierPerformance[]>([])
  const [deadStock, setDeadStock] = useState<DeadStockItem[]>([])
  const [reorder, setReorder] = useState<ReorderPrediction[]>([])

  const loadData = async () => {
    setLoading(true)
    try {
      const end = new Date()
      const start = new Date()
      start.setDate(start.getDate() - 90)
      const [m, st, sp, ds, rp] = await Promise.all([
        inventoryAnalyticsService.getInventoryMetrics(),
        inventoryAnalyticsService.getStockTurnover(start.toISOString(), end.toISOString(), 20),
        inventoryAnalyticsService.getSupplierPerformance(start.toISOString(), end.toISOString()),
        inventoryAnalyticsService.getDeadStock(30),
        inventoryAnalyticsService.getReorderPredictions(),
      ])
      setMetrics(m)
      setTurnover(st)
      setSuppliers(sp)
      setDeadStock(ds)
      setReorder(rp)
    } finally { setLoading(false) }
  }

  useEffect(() => { startTransition(() => { loadData() }) }, [])

  const fmt = (n: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(n)

  if (loading) return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-md" />
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-9 w-28 ml-auto" />
      </div>
      <div className="grid gap-4 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}><CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader><CardContent><Skeleton className="h-7 w-28" /></CardContent></Card>
        ))}
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9 w-32" />)}
      </div>
      <Card><CardHeader><Skeleton className="h-5 w-44" /></CardHeader><CardContent><Skeleton className="h-[350px] w-full rounded-lg" /></CardContent></Card>
    </div>
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/analytics')}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-3xl font-bold">Inventory Analytics</h1>
        <Button variant="outline" size="sm" className="ml-auto" onClick={loadData}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</Button>
      </div>

      <AIInsightSection
        title="AI Inventory Insights"
        description="AI analysis of stock health, turnover, and reorder needs"
        analyzeFn={() => analyzeInventoryAI({
          metrics: {
            totalProducts: metrics?.totalProducts || 0,
            totalStockValue: metrics?.totalStockValue || 0,
            lowStockItems: metrics?.lowStockItems || 0,
            outOfStockItems: metrics?.outOfStockItems || 0,
            overstockItems: metrics?.overstockItems || 0,
          },
          turnover: (turnover || []).slice(0, 10).map(t => ({
            productName: t.productName || 'Unknown',
            turnoverRate: t.turnoverRate || 0,
            daysOfSupply: t.daysOfSupply || 0,
          })),
          deadStock: (deadStock || []).map(d => ({
            productName: d.productName || 'Unknown',
            daysSinceLastSale: d.daysSinceLastSale || 0,
            valueAtRisk: d.valueAtRisk || 0,
          })),
          reorderPredictions: (reorder || []).map(r => ({
            productName: r.productName || 'Unknown',
            currentStock: r.currentStock || 0,
            averageDailySales: r.averageDailySales || 0,
            daysUntilReorder: r.daysUntilReorder || 0,
          })),
        })}
      />

      <div className="grid gap-4 md:grid-cols-5">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total Stock Value</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{fmt(metrics?.totalStockValue || 0)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Stock Turnover</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{((metrics as unknown as Record<string, unknown>)?.stockTurnover as number || 0).toFixed(1)}x</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Low Stock Items</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold text-warning">{metrics?.lowStockItems || 0}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Out of Stock</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold text-destructive">{metrics?.outOfStockItems || 0}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Shrinkage</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{fmt((metrics as unknown as Record<string, unknown>)?.shrinkageValue as number || 0)}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="turnover">
        <TabsList>
          <TabsTrigger value="turnover">Stock Turnover</TabsTrigger>
          <TabsTrigger value="suppliers">Supplier Performance</TabsTrigger>
          <TabsTrigger value="deadstock">Dead Stock</TabsTrigger>
          <TabsTrigger value="reorder">Reorder Predictions</TabsTrigger>
        </TabsList>

        <TabsContent value="turnover" className="mt-4">
          <Card><CardHeader><CardTitle>Stock Turnover by Category</CardTitle></CardHeader>
            <CardContent className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={turnover}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="category" /><YAxis /><Tooltip content={<CustomTooltip currency={false} suffix="x" />} />                <Bar dataKey="turnover" fill="#8884d8" cursor="pointer" onClick={(data: any) => data?.category && router.push(`/products?category=${encodeURIComponent(String(data.category))}`)} /></BarChart>
              </ResponsiveContainer>
            </CardContent></Card>
        </TabsContent>

        <TabsContent value="suppliers" className="mt-4">
          <Card><CardHeader><CardTitle>Supplier On-Time Delivery</CardTitle></CardHeader>
            <CardContent className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={suppliers} layout="vertical"><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" domain={[0, 100]} /><YAxis type="category" dataKey="supplier" /><Tooltip content={<CustomTooltip currency={false} suffix="%" />} /><Bar dataKey="deliveryRate" fill="#00C49F" /></BarChart>
              </ResponsiveContainer>
            </CardContent></Card>
        </TabsContent>

        <TabsContent value="deadstock" className="mt-4">
          <Card><CardHeader><CardTitle>Dead Stock Items</CardTitle></CardHeader>
            <CardContent>
              {deadStock.length === 0 ? <EmptyState title="No dead stock items" compact /> : (
                <table className="w-full"><thead><tr className="border-b text-xs text-muted-foreground"><th className="text-left p-2 font-medium">Product</th><th className="text-right p-2 font-medium">Qty</th><th className="text-right p-2 font-medium">Value</th><th className="text-right p-2 font-medium">Days Unsold</th></tr></thead>
                  <tbody>{deadStock.map((item, i: number) => (
                    <tr key={i} className="border-b last:border-0 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => router.push(`/products?search=${encodeURIComponent(item.productName)}`)}><td className="p-2 text-sm font-medium">{item.productName}</td><td className="p-2 text-right">{item.currentStock || 0}</td><td className="p-2 text-right">{fmt(item.valueAtRisk || 0)}</td><td className="p-2 text-right">{item.daysSinceLastSale || 0}d</td></tr>
                  ))}</tbody></table>
              )}
            </CardContent></Card>
        </TabsContent>

        <TabsContent value="reorder" className="mt-4">
          <Card><CardHeader><CardTitle>Reorder Recommendations</CardTitle></CardHeader>
            <CardContent>
              {reorder.length === 0 ? <EmptyState title="No reorder recommendations" compact /> : (
                <table className="w-full"><thead><tr className="border-b text-xs text-muted-foreground"><th className="text-left p-2 font-medium">Product</th><th className="text-right p-2 font-medium">Stock</th><th className="text-right p-2 font-medium">Reorder Point</th><th className="text-right p-2 font-medium">Suggested Order</th><th className="text-right p-2 font-medium">Urgency</th></tr></thead>
                  <tbody>{reorder.map((item, i: number) => (
                    <tr key={i} className="border-b last:border-0 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => router.push(`/products?search=${encodeURIComponent(item.productName)}`)}><td className="p-2 text-sm font-medium">{item.productName}</td><td className="p-2 text-right">{item.currentStock || 0}</td><td className="p-2 text-right">{item.reorderLevel || 0}</td><td className="p-2 text-right">{item.suggestedReorderQuantity || 0}</td><td className="p-2 text-right">{(() => { const urgency = item.daysUntilReorder <= 3 ? 'high' : item.daysUntilReorder <= 7 ? 'medium' : 'low'; return <span className={`px-2 py-0.5 rounded text-xs font-medium ${urgency === 'high' ? 'bg-red-100 text-red-700' : urgency === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{urgency}</span>; })()}</td></tr>
                  ))}</tbody></table>
              )}
            </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
