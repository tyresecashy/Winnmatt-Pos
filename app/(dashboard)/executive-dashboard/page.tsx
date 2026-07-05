'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DollarSign, ShoppingCart, Users, RefreshCw, TrendingUp, TrendingDown,
  ArrowUpRight, ArrowDownRight, Package, AlertTriangle, CheckCircle2,
  Clock, Truck, PiggyBank, CreditCard, BarChart3, Brain, Building2,
  Receipt, Percent, Boxes, Store, Leaf, Lightbulb,
} from 'lucide-react'
import {
  getExecutiveKPI,
  getBranchPerformance,
  getHourlySales,
  getTopProducts,
  getAIInsights,
  type ExecutiveKPI,
  type BranchPerformance,
  type SalesHourly,
  type TopProduct,
  type AIInsight,
} from '@/lib/executive-dashboard-actions'
import { formatKSh } from '@/lib/currency'

function formatCompact(amount: number): string {
  if (amount >= 1000000) return `KSh ${(amount / 1000000).toFixed(1)}M`
  if (amount >= 1000) return `KSh ${(amount / 1000).toFixed(0)}K`
  return `KSh ${amount}`
}

function formatNumber(n: number): string {
  return n.toLocaleString()
}

export default function ExecutiveDashboardPage() {
  const [kpi, setKpi] = useState<ExecutiveKPI | null>(null)
  const [branches, setBranches] = useState<BranchPerformance[]>([])
  const [hourlySales, setHourlySales] = useState<SalesHourly[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [insights, setInsights] = useState<AIInsight[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedHour, setSelectedHour] = useState<number | null>(null)

  async function loadAll() {
    setLoading(true)
    try {
      const [kpiData, branchData, hourlyData, productsData, insightsData] = await Promise.all([
        getExecutiveKPI(),
        getBranchPerformance(),
        getHourlySales(),
        getTopProducts(10),
        getAIInsights(),
      ])
      setKpi(kpiData)
      setBranches(branchData)
      setHourlySales(hourlyData)
      setTopProducts(productsData)
      setInsights(insightsData)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  const maxHourlySales = Math.max(...hourlySales.map(h => h.sales), 1)
  const peakHour = [...hourlySales].sort((a, b) => b.sales - a.sales)[0]

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-72" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Executive Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Real-time business intelligence &mdash; {new Date().toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadAll}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* ── AI Insights Bar ── */}
      {insights.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Brain className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-300">AI Business Insights</p>
                {insights.slice(0, 4).map((insight, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-sm">
                    {insight.type === 'positive' && <TrendingUp className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />}
                    {insight.type === 'negative' && <TrendingDown className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />}
                    {insight.type === 'warning' && <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />}
                    {insight.type === 'info' && <Lightbulb className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />}
                    <span className="text-muted-foreground">{insight.message}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── KPI Cards ── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          icon={<DollarSign className="h-5 w-5" />}
          label="Today's Revenue"
          value={formatCompact(kpi?.today_revenue || 0)}
          sub={`${formatNumber(kpi?.today_transactions || 0)} transactions`}
          color="green"
        />
        <KpiCard
          icon={<PiggyBank className="h-5 w-5" />}
          label="Gross Profit"
          value={formatCompact(kpi?.today_gross_profit || 0)}
          sub={`${kpi?.today_margin_pct || 0}% margin`}
          color="blue"
        />
        <KpiCard
          icon={<ShoppingCart className="h-5 w-5" />}
          label="Avg Basket"
          value={formatCompact(kpi?.today_avg_basket || 0)}
          sub={`${formatNumber(kpi?.today_customers_served || 0)} customers served`}
          color="purple"
        />
        <KpiCard
          icon={<Receipt className="h-5 w-5" />}
          label="Refunds"
          value={formatCompact(kpi?.today_refunds || 0)}
          sub={`${formatNumber(kpi?.today_discounts || 0)} in discounts`}
          color="red"
        />
        <KpiCard
          icon={<Boxes className="h-5 w-5" />}
          label="Stock Value"
          value={formatCompact(kpi?.stock_value || 0)}
          sub={`${formatNumber(kpi?.total_inventory_items || 0)} items tracked`}
          color="amber"
        />

        <KpiCard
          icon={<CreditCard className="h-5 w-5" />}
          label="Cash in Drawers"
          value={formatCompact(kpi?.cash_in_drawers || 0)}
          sub={`${formatNumber(kpi?.outstanding_credit || 0)} outstanding credit`}
          color="emerald"
        />
        <KpiCard
          icon={<Package className="h-5 w-5" />}
          label="Pending POs"
          value={formatNumber(kpi?.pending_pos || 0)}
          sub={`${formatNumber(kpi?.transfers_in_transit || 0)} transfers in transit`}
          color="orange"
        />
        <KpiCard
          icon={<Users className="h-5 w-5" />}
          label="Staff Clocked In"
          value={formatNumber(kpi?.employees_clocked_in || 0)}
          sub="Currently on shift"
          color="indigo"
        />
        <KpiCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Critical Stock"
          value={formatNumber(kpi?.critical_stock_count || 0)}
          sub="Products below safety stock"
          color="rose"
        />
        <KpiCard
          icon={<BarChart3 className="h-5 w-5" />}
          label="Inventory Health"
          value={`${kpi && kpi.total_inventory_items > 0 ? Math.round(((kpi.total_inventory_items - kpi.critical_stock_count) / kpi.total_inventory_items) * 100) : 0}%`}
          sub={`${formatNumber((kpi?.total_inventory_items || 0) - (kpi?.critical_stock_count || 0))} healthy items`}
          color="teal"
        />
      </div>

      {/* Row 2: Branch Rankings + Hourly Heat Map */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Branch Rankings ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Store className="h-4 w-4" /> Branch Rankings
            </CardTitle>
            <CardDescription>Today's sales by branch</CardDescription>
          </CardHeader>
          <CardContent>
            {branches.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No branch data available</p>
            ) : (
              <div className="space-y-3">
                {branches.map((b, idx) => (
                  <div key={b.id}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`font-mono text-xs w-5 ${idx === 0 ? 'text-amber-500 font-bold' : 'text-muted-foreground'}`}>
                          {idx === 0 ? '🏆' : `#${idx + 1}`}
                        </span>
                        <span className="font-medium">{b.name}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5">{b.code}</Badge>
                      </div>
                      <div className="text-right">
                        <span className="font-medium">{formatCompact(b.today_sales)}</span>
                        <span className="text-xs text-muted-foreground ml-2">({b.sales_pct}%)</span>
                      </div>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${idx === 0 ? 'bg-green-500' : idx === 1 ? 'bg-blue-500' : 'bg-primary'}`}
                        style={{ width: `${Math.max(b.sales_pct, 2)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Hourly Sales Heat Map ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" /> Hourly Sales
            </CardTitle>
            <CardDescription>
              {peakHour && peakHour.sales > 0
                ? `Peak at ${peakHour.hour}:00 — ${formatCompact(peakHour.sales)}`
                : 'No sales data for today'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hourlySales.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No hourly data yet</p>
            ) : (
              <div className="space-y-1">
                {/* Hourly bars */}
                <div className="flex items-end gap-0.5 h-32">
                  {hourlySales.filter(h => h.hour >= 6 && h.hour <= 22).map(h => {
                    const pct = maxHourlySales > 0 ? (h.sales / maxHourlySales) * 100 : 0
                    const isPeak = peakHour?.hour === h.hour
                    const isSelected = selectedHour === h.hour
                    return (
                      <div
                        key={h.hour}
                        className="flex-1 flex flex-col items-center cursor-pointer group"
                        onMouseEnter={() => setSelectedHour(h.hour)}
                        onMouseLeave={() => setSelectedHour(null)}
                      >
                        <div className="relative w-full flex justify-center">
                          {(isSelected || isPeak) && (
                            <span className="absolute -top-5 text-[10px] text-muted-foreground whitespace-nowrap">
                              {formatCompact(h.sales)}
                            </span>
                          )}
                          <div
                            className={`w-full rounded-t-sm transition-all ${
                              isPeak ? 'bg-green-500' : isSelected ? 'bg-primary/80' : 'bg-primary/40'
                            }`}
                            style={{ height: `${Math.max(pct, 3)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground mt-1">{h.hour}</span>
                      </div>
                    )
                  })}
                </div>
                {/* Selected hour detail */}
                {selectedHour !== null && hourlySales[selectedHour] && (
                  <div className="mt-2 p-2 bg-muted rounded text-xs flex justify-between">
                    <span>{selectedHour}:00 - {(selectedHour + 1) % 24}:00</span>
                    <span className="font-medium">{formatCompact(hourlySales[selectedHour].sales)} ({hourlySales[selectedHour].transactions} tx)</span>
                  </div>
                )}
                <div className="flex justify-between text-[10px] text-muted-foreground pt-1">
                  <span>06:00</span>
                  <span>22:00</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Top Products + Remaining KPIs */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Top Products ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Top Products Today
            </CardTitle>
            <CardDescription>Highest revenue-generating products</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No sales data yet</p>
            ) : (
              <div className="divide-y">
                {topProducts.map((p, idx) => (
                  <div key={p.id} className="flex items-center justify-between px-6 py-2.5 text-sm hover:bg-muted/50">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="text-xs text-muted-foreground w-5 shrink-0">#{idx + 1}</span>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.sku} &middot; {p.quantity} sold</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="font-medium">{formatCompact(p.revenue)}</p>
                      <p className={`text-xs ${p.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {p.profit >= 0 ? '+' : ''}{formatCompact(p.profit)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Quick Metrics Summary ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Summary
            </CardTitle>
            <CardDescription>Key operational metrics at a glance</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <MetricBox
              icon={<DollarSign className="h-4 w-4" />}
              label="Revenue"
              value={formatCompact(kpi?.today_revenue || 0)}
              color="green"
            />
            <MetricBox
              icon={<PiggyBank className="h-4 w-4" />}
              label="Profit"
              value={formatCompact(kpi?.today_gross_profit || 0)}
              color="blue"
            />
            <MetricBox
              icon={<Percent className="h-4 w-4" />}
              label="Margin"
              value={`${kpi?.today_margin_pct || 0}%`}
              color="purple"
            />
            <MetricBox
              icon={<ShoppingCart className="h-4 w-4" />}
              label="Avg Basket"
              value={formatCompact(kpi?.today_avg_basket || 0)}
              color="amber"
            />
            <MetricBox
              icon={<CreditCard className="h-4 w-4" />}
              label="Outstanding Credit"
              value={formatCompact(kpi?.outstanding_credit || 0)}
              color="rose"
            />
            <MetricBox
              icon={<Truck className="h-4 w-4" />}
              label="In Transit"
              value={formatNumber(kpi?.transfers_in_transit || 0)}
              color="orange"
            />
            <MetricBox
              icon={<Users className="h-4 w-4" />}
              label="Clocked In"
              value={formatNumber(kpi?.employees_clocked_in || 0)}
              color="indigo"
            />
            <MetricBox
              icon={<Package className="h-4 w-4" />}
              label="Pending POs"
              value={formatNumber(kpi?.pending_pos || 0)}
              color="teal"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────

function KpiCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub: string; color: string
}) {
  const colorMap: Record<string, string> = {
    green: 'border-green-200 dark:border-green-900',
    blue: 'border-blue-200 dark:border-blue-900',
    purple: 'border-purple-200 dark:border-purple-900',
    red: 'border-red-200 dark:border-red-900',
    amber: 'border-amber-200 dark:border-amber-900',
    emerald: 'border-emerald-200 dark:border-emerald-900',
    orange: 'border-orange-200 dark:border-orange-900',
    indigo: 'border-indigo-200 dark:border-indigo-900',
    rose: 'border-rose-200 dark:border-rose-900',
    teal: 'border-teal-200 dark:border-teal-900',
  }
  return (
    <Card className={`card-hover border-l-4 ${colorMap[color] || 'border-l-muted'}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{label}</p>
          <div className="text-muted-foreground">{icon}</div>
        </div>
        <p className="text-2xl font-bold mt-1 tracking-tight">{value}</p>
        <p className="text-xs text-muted-foreground mt-1 truncate">{sub}</p>
      </CardContent>
    </Card>
  )
}

function MetricBox({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: string; color: string
}) {
  const colorMap: Record<string, string> = {
    green: 'text-green-600 bg-green-50 dark:bg-green-950/30',
    blue: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30',
    purple: 'text-purple-600 bg-purple-50 dark:bg-purple-950/30',
    amber: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30',
    rose: 'text-rose-600 bg-rose-50 dark:bg-rose-950/30',
    orange: 'text-orange-600 bg-orange-50 dark:bg-orange-950/30',
    indigo: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30',
    teal: 'text-teal-600 bg-teal-50 dark:bg-teal-950/30',
  }
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <div className={`rounded-md p-1.5 ${colorMap[color] || ''}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-sm font-semibold">{value}</p>
        </div>
      </div>
    </div>
  )
}
