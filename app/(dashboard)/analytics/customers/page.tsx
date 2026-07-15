'use client'

import { useState, useEffect, useCallback, startTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { CustomTooltip } from '@/components/charts/custom-tooltip'
import { ArrowLeft, Users, RefreshCw, ShoppingCart, TrendingUp } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { customerAnalyticsService } from '@/lib/analytics/customer-analytics'
import type { CustomerMetrics, RFMSegment, CustomerLifetimeValue, PurchasePattern } from '@/lib/analytics/customer-analytics'
import { AIInsightSection } from '@/components/ai/ai-insight-section'
import { analyzeCustomerAI } from '@/lib/modules/ai'

export default function CustomerAnalyticsPage() {
  const router = useRouter()
  const [dateRange, setDateRange] = useState('30d')
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<CustomerMetrics | null>(null)
  const [rfm, setRfm] = useState<RFMSegment[]>([])
  const [ltv, setLtv] = useState<CustomerLifetimeValue[]>([])
  const [purchasePatterns, setPurchasePatterns] = useState<PurchasePattern[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const end = new Date(); const start = new Date()
      if (dateRange === '7d') start.setDate(start.getDate() - 7)
      else if (dateRange === '30d') start.setDate(start.getDate() - 30)
      else if (dateRange === '90d') start.setDate(start.getDate() - 90)
      else start.setFullYear(start.getFullYear() - 1)
      const { startDate, endDate } = { startDate: start.toISOString(), endDate: end.toISOString() }
      const [m, r, ltv, pp] = await Promise.all([
        customerAnalyticsService.getCustomerMetrics(startDate, endDate),
        customerAnalyticsService.getRFMSegments(),
        customerAnalyticsService.getCustomerLifetimeValue(20),
        customerAnalyticsService.getPurchasePatterns(),
      ])
      setMetrics(m)
      setRfm(r)
      setLtv(ltv)
      setPurchasePatterns(pp)
    } finally { setLoading(false) }
  }, [dateRange])

  useEffect(() => { startTransition(() => { loadData() }) }, [dateRange, loadData])

  const fmt = (n: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(n)
  const fmtN = (n: number) => new Intl.NumberFormat('en-KE').format(n)

  if (loading) return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-md" />
          <Skeleton className="h-8 w-52" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-[180px]" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}><CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader><CardContent><Skeleton className="h-8 w-28" /></CardContent></Card>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardHeader className="pb-2"><Skeleton className="h-4 w-28" /></CardHeader><CardContent><Skeleton className="h-7 w-24" /></CardContent></Card>
        <Card><CardHeader className="pb-2"><Skeleton className="h-4 w-20" /></CardHeader><CardContent><Skeleton className="h-7 w-24" /></CardContent></Card>
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-32" /><Skeleton className="h-9 w-32" /><Skeleton className="h-9 w-36" />
      </div>
      <Card><CardHeader><Skeleton className="h-5 w-36" /></CardHeader><CardContent><Skeleton className="h-[350px] w-full rounded-lg" /></CardContent></Card>
    </div>
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/analytics')}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-3xl font-bold">Customer Analytics</h1>
        </div>
        <div className="flex items-center gap-3">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={loadData}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</Button>
        </div>
      </div>

      <AIInsightSection
        title="AI Customer Insights"
        description="AI analysis of customer segments, retention, and growth opportunities"
        analyzeFn={() => analyzeCustomerAI({
          metrics: {
            totalCustomers: metrics?.totalCustomers || 0,
            activeCustomers: metrics?.activeCustomers || 0,
            newCustomers: metrics?.newCustomers || 0,
            averageOrderValue: metrics?.averageOrderValue || 0,
            customerRetentionRate: metrics?.customerRetentionRate || 0,
          },
          rfmSegments: (rfm || []).map(s => ({
            segment: s.segment || 'Unknown',
            count: s.count || 0,
            avgValue: s.averageRevenue || 0,
          })),
          ltv: (ltv || []).map(l => ({
            customerName: l.customerName || 'Unknown',
            lifetimeValue: l.totalSpent || 0,
          })),
        })}
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total Customers</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{fmtN(metrics?.totalCustomers || 0)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Active Customers</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{fmtN(metrics?.activeCustomers || 0)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">New Customers</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{fmtN(metrics?.newCustomers || 0)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Retention Rate</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{(metrics?.customerRetentionRate || 0).toFixed(1)}%</p></CardContent></Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Avg Order Value</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{fmt(metrics?.averageOrderValue || 0)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Churn Risk</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold text-destructive">{metrics?.churnRisk ? `${(metrics.churnRisk * 100).toFixed(1)}%` : '0%'}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="segments">
        <TabsList>
          <TabsTrigger value="segments"><Users className="h-4 w-4 mr-2" /> RFM Segments</TabsTrigger>
          <TabsTrigger value="ltv"><TrendingUp className="h-4 w-4 mr-2" /> Lifetime Value</TabsTrigger>
          <TabsTrigger value="patterns"><ShoppingCart className="h-4 w-4 mr-2" /> Purchase Patterns</TabsTrigger>
        </TabsList>

        <TabsContent value="segments" className="mt-4">
          <Card><CardHeader><CardTitle>Customer Segments</CardTitle></CardHeader>
            <CardContent className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rfm}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="segment" /><YAxis /><Tooltip content={<CustomTooltip currency={false} />} /><Bar dataKey="count" fill="#8884d8" cursor="pointer" onClick={(data) => { const d = data as unknown as Record<string, unknown>; d?.segment && router.push(`/customers?segment=${encodeURIComponent(String(d.segment))}`) }} /></BarChart>
              </ResponsiveContainer>
            </CardContent></Card>
        </TabsContent>

        <TabsContent value="ltv" className="mt-4">
          <Card><CardHeader><CardTitle>Customer Lifetime Value Trend</CardTitle></CardHeader>
            <CardContent className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ltv}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="cohort" /><YAxis /><Tooltip content={<CustomTooltip />} /><Bar dataKey="ltv" fill="#00C49F" cursor="pointer" onClick={() => router.push('/customers')} /></BarChart>
              </ResponsiveContainer>
            </CardContent></Card>
        </TabsContent>

        <TabsContent value="patterns" className="mt-4">
          <Card><CardHeader><CardTitle>Purchase Pattern Analysis</CardTitle></CardHeader>
            <CardContent className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={purchasePatterns}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="category" /><YAxis /><Tooltip content={<CustomTooltip currency={false} suffix="x" />} /><Bar dataKey="frequency" fill="#FFBB28" name="Frequency" cursor="pointer" onClick={(data) => { const d = data as unknown as Record<string, unknown>; d?.category && router.push(`/products?category=${encodeURIComponent(String(d.category))}`) }} /><Bar dataKey="avgSpend" fill="#FF8042" name="Avg Spend" /></BarChart>
              </ResponsiveContainer>
            </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
