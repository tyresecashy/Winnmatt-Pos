'use client'

import { useState, useEffect, useCallback, startTransition } from 'react'
import dynamic from 'next/dynamic'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { salesAnalyticsService } from '@/lib/analytics/sales-analytics'
import type { SalesMetrics, ProductPerformance, PeakHours, CategoryBreakdown, PaymentMethodDistribution, SalesTrend } from '@/lib/analytics/sales-analytics'
import { AIInsightSection } from '@/components/ai/ai-insight-section'
import { analyzeSalesAI } from '@/lib/modules/ai'
import { ChartSkeleton } from '@/components/charts/chart-skeleton'

const SalesChartContent = dynamic(() => import('./_charts-content'), {
  ssr: false,
  loading: () => <ChartSkeleton count={2} />,
})

export default function SalesAnalyticsPage() {
  const router = useRouter()
  const [dateRange, setDateRange] = useState('30d')
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<SalesMetrics | null>(null)
  const [trend, setTrend] = useState<SalesTrend[]>([])
  const [peakHours, setPeakHours] = useState<PeakHours[]>([])
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdown[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodDistribution[]>([])
  const [topProducts, setTopProducts] = useState<ProductPerformance[]>([])
  const [drillDown, setDrillDown] = useState<{ type: string; value: string } | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const end = new Date(); const start = new Date()
      if (dateRange === '7d') start.setDate(start.getDate() - 7)
      else if (dateRange === '30d') start.setDate(start.getDate() - 30)
      else if (dateRange === '90d') start.setDate(start.getDate() - 90)
      else start.setFullYear(start.getFullYear() - 1)
      const { startDate, endDate } = { startDate: start.toISOString(), endDate: end.toISOString() }
      const [m, t, ph, cb, pm, tp] = await Promise.all([
        salesAnalyticsService.getSalesMetrics(startDate, endDate),
        salesAnalyticsService.getSalesTrend(startDate, endDate),
        salesAnalyticsService.getPeakHours(startDate, endDate),
        salesAnalyticsService.getCategoryBreakdown(startDate, endDate),
        salesAnalyticsService.getPaymentMethodDistribution(startDate, endDate),
        salesAnalyticsService.getTopSellingProducts(startDate, endDate, 8),
      ])
      setMetrics(m)
      setTrend(t)
      setPeakHours(ph)
      setCategoryBreakdown(cb)
      setPaymentMethods(pm)
      setTopProducts(tp)
    } finally { setLoading(false) }
  }, [dateRange])

  useEffect(() => { startTransition(() => { loadData() }) }, [dateRange, loadData])

  useEffect(() => {
    startTransition(() => {
      if (drillDown) {
        if (drillDown.type === 'hour') {
          router.push(`/sales-history?search=peak+${drillDown.value}`)
        } else if (drillDown.type === 'category') {
          router.push(`/products?category=${encodeURIComponent(drillDown.value)}`)
        } else if (drillDown.type === 'product') {
          router.push(`/products?search=${encodeURIComponent(drillDown.value)}`)
        }
        setDrillDown(null)
      }
    })
  }, [drillDown, router])

  const fmt = (n: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(n)

  if (loading) return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-md" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-9 w-[180px]" />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}><CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader><CardContent><Skeleton className="h-8 w-32" /></CardContent></Card>
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Card><CardHeader><Skeleton className="h-5 w-36" /></CardHeader><CardContent><Skeleton className="h-[300px] w-full rounded-lg" /></CardContent></Card>
        <Card><CardHeader><Skeleton className="h-5 w-36" /></CardHeader><CardContent><Skeleton className="h-[300px] w-full rounded-lg" /></CardContent></Card>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        <Card><CardHeader><Skeleton className="h-5 w-36" /></CardHeader><CardContent><Skeleton className="h-[300px] w-full rounded-lg" /></CardContent></Card>
        <Card><CardHeader><Skeleton className="h-5 w-32" /></CardHeader><CardContent><Skeleton className="h-[300px] w-full rounded-lg" /></CardContent></Card>
        <Card><CardHeader><Skeleton className="h-5 w-28" /></CardHeader><CardContent><div className="space-y-3">{Array.from({ length: 5 }).map((_, j) => <Skeleton key={j} className="h-5 w-full" />)}</div></CardContent></Card>
      </div>
    </div>
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/analytics')}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-3xl font-bold">Sales Analytics</h1>
        </div>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="1y">Last year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <AIInsightSection
        title="AI Sales Insights"
        description="AI-powered analysis of your sales trends and opportunities"
        analyzeFn={() => analyzeSalesAI({
          metrics: {
            totalRevenue: metrics?.totalRevenue || 0,
            totalTransactions: metrics?.totalTransactions || 0,
            averageOrderValue: metrics?.averageOrderValue || 0,
            growthRate: trend.length > 1
              ? ((trend[trend.length-1]?.revenue || 0) - (trend[0]?.revenue || 0)) / (trend[0]?.revenue || 1) * 100
              : 0,
          },
          trendSummary: {
            direction: trend.length > 1
              ? (trend[trend.length-1]?.revenue || 0) > (trend[0]?.revenue || 0) ? 'upward' : 'downward'
              : 'stable',
            bestDay: trend.length > 0 ? [...trend].sort((a, b) => b.revenue - a.revenue)[0]?.date : undefined,
            worstDay: trend.length > 0 ? [...trend].sort((a, b) => a.revenue - b.revenue)[0]?.date : undefined,
            volatility: trend.length > 1 ? 'moderate' : 'unknown',
          },
          topProducts: (topProducts || []).slice(0, 8).map((p: { productName?: string; name?: string; revenue: number; totalSold?: number; quantity?: number }) => ({
            name: p.productName || p.name || 'Unknown',
            revenue: p.revenue || 0,
            sold: p.totalSold || p.quantity || 0,
          })),
          categoryBreakdown: (categoryBreakdown || []).map((c: { name?: string; category?: string; revenue: number }) => ({
            name: c.name || c.category || 'Unknown',
            revenue: c.revenue || 0,
          })),
          paymentMethods: (paymentMethods || []).map((p: { method?: string; payment_method?: string; amount?: number; total_amount?: number }) => ({
            method: p.method || p.payment_method || 'Unknown',
            amount: p.amount || p.total_amount || 0,
          })),
          peakHours: (peakHours || []).map((h: { hour?: number | string; count?: number; transactions?: number }) => ({
            hour: String(h.hour || ''),
            transactions: h.transactions || h.count || 0,
          })),
        })}
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Revenue</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{fmt(metrics?.totalRevenue || 0)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Transactions</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{metrics?.totalTransactions || 0}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Avg Order Value</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{fmt(metrics?.averageOrderValue || 0)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Items Sold</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{(metrics as unknown as { totalItemsSold?: number })?.totalItemsSold || 0}</p></CardContent></Card>
      </div>

      <SalesChartContent
        trend={trend}
        peakHours={peakHours}
        categoryBreakdown={categoryBreakdown}
        paymentMethods={paymentMethods}
        topProducts={topProducts}
        fmt={fmt}
        onDrillDown={(type, value) => setDrillDown({ type, value })}
      />
    </div>
  )
}
