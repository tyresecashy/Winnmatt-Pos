'use client'

import { useState, useEffect, useCallback, startTransition } from 'react'
import dynamic from 'next/dynamic'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, TrendingUp, Landmark, RefreshCw, DollarSign, TrendingDown } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { financialAnalyticsService } from '@/lib/analytics/financial-analytics'
import type { FinancialMetrics, PLTrend, CashFlowForecast, ExpenseBreakdown, MarginAnalysis } from '@/lib/analytics/financial-analytics'
import { AIInsightSection } from '@/components/ai/ai-insight-section'
import { analyzeFinanceAI } from '@/lib/modules/ai'
import { ChartSkeleton } from '@/components/charts/chart-skeleton'

const FinanceChartContent = dynamic(() => import('./_charts-content'), {
  ssr: false,
  loading: () => <ChartSkeleton count={1} />,
})

export default function FinancialAnalyticsPage() {
  const router = useRouter()
  const [dateRange, setDateRange] = useState('30d')
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<FinancialMetrics | null>(null)
  const [plTrend, setPlTrend] = useState<PLTrend[]>([])
  const [cashFlow, setCashFlow] = useState<CashFlowForecast[]>([])
  const [expenseBreakdown, setExpenseBreakdown] = useState<ExpenseBreakdown[]>([])
  const [marginAnalysis, setMarginAnalysis] = useState<MarginAnalysis[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const end = new Date(); const start = new Date()
      if (dateRange === '7d') start.setDate(start.getDate() - 7)
      else if (dateRange === '30d') start.setDate(start.getDate() - 30)
      else if (dateRange === '90d') start.setDate(start.getDate() - 90)
      else start.setFullYear(start.getFullYear() - 1)
      const { startDate, endDate } = { startDate: start.toISOString(), endDate: end.toISOString() }
      const [m, pl, cf, exp, margin] = await Promise.all([
        financialAnalyticsService.getFinancialMetrics(startDate, endDate),
        financialAnalyticsService.getPLTrend(startDate, endDate),
        financialAnalyticsService.getCashFlowForecast(startDate, endDate),
        financialAnalyticsService.getExpenseBreakdown(startDate, endDate),
        financialAnalyticsService.getMarginAnalysis(startDate, endDate),
      ])
      setMetrics(m)
      setPlTrend(pl)
      setCashFlow(cf)
      setExpenseBreakdown(exp)
      setMarginAnalysis(margin)
    } finally { setLoading(false) }
  }, [dateRange])

  useEffect(() => { startTransition(() => { loadData() }) }, [dateRange, loadData])

  const fmt = (n: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(n)

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
      <div className="grid gap-4 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}><CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader><CardContent><Skeleton className="h-7 w-28" /></CardContent></Card>
        ))}
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9 w-28" />)}
      </div>
      <Card><CardHeader><Skeleton className="h-5 w-40" /></CardHeader><CardContent><Skeleton className="h-[350px] w-full rounded-lg" /></CardContent></Card>
    </div>
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/analytics')}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-3xl font-bold">Financial Analytics</h1>
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
        title="AI Financial Insights"
        description="AI analysis of profitability, cash flow, and expense trends"
        analyzeFn={() => analyzeFinanceAI({
          metrics: {
            totalRevenue: metrics?.totalRevenue || 0,
            totalExpenses: metrics?.totalExpenses || 0,
            netProfit: metrics?.netProfit || 0,
            profitMargin: metrics?.profitMargin || 0,
            revenueGrowth: metrics?.revenueGrowth || 0,
            expenseGrowth: metrics?.expenseGrowth || 0,
          },
          plTrend: (plTrend || []).map(p => ({
            date: p.period || 'Unknown',
            revenue: p.revenue || 0,
            expenses: (p.cogs || 0) + (p.operatingExpenses || 0),
            profit: p.netProfit || 0,
          })),
          cashFlow: (cashFlow || []).map(c => ({
            period: c.period || 'Unknown',
            inflow: c.inflows || 0,
            outflow: c.outflows || 0,
          })),
          expenseBreakdown: (expenseBreakdown || []).map(e => ({
            category: e.category || 'Unknown',
            amount: e.amount || 0,
            percentage: e.percentage || 0,
          })),
          marginAnalysis: (marginAnalysis || []).map(m => ({
            productName: m.category || 'Unknown',
            margin: m.marginPercentage || m.margin || 0,
          })),
        })}
      />

      <div className="grid gap-4 md:grid-cols-5">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total Revenue</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold text-success">{fmt(metrics?.totalRevenue || 0)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total Expenses</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold text-destructive">{fmt(metrics?.totalExpenses || 0)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Net Profit</CardTitle></CardHeader>
          <CardContent><p className={`text-xl font-bold ${(metrics?.netProfit || 0) >= 0 ? 'text-success' : 'text-destructive'}`}>{fmt(metrics?.netProfit || 0)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Profit Margin</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{(metrics?.profitMargin || 0).toFixed(1)}%</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Revenue Growth</CardTitle></CardHeader>
          <CardContent><p className={`text-xl font-bold ${((metrics?.revenueGrowth ?? 0) || 0) >= 0 ? 'text-success' : 'text-destructive'}`}>{(metrics?.revenueGrowth ?? 0) >= 0 ? '+' : ''}{(metrics?.revenueGrowth ?? 0).toFixed(1)}%</p></CardContent></Card>
      </div>

      <FinanceChartContent
        plTrend={plTrend}
        cashFlow={(cashFlow || []).map(c => ({ period: c.period, inflow: c.inflows || 0, outflow: c.outflows || 0, inflows: c.inflows, outflows: c.outflows }))}
        expenseBreakdown={expenseBreakdown}
        marginAnalysis={marginAnalysis}
        fmt={fmt}
      />
    </div>
  )
}
