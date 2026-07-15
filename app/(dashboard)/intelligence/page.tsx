'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/components/ui/use-toast'
import { EmptyState } from '@/components/ui/empty-state'
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  Target,
  ShoppingCart,
  Truck,
  DollarSign,
  Package,
  RefreshCw,
  Eye,
  AlertCircle,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  Minus,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────

// Type-only imports are erased at compile time — no bundling impact
import type { Anomaly, TrendAnalysis } from '@/lib/modules/product-intelligence/types'

type TabValue = 'overview' | 'anomalies' | 'trends'

// ─── Helpers ────────────────────────────────────────────────────

const severityColor: Record<string, 'destructive' | 'warning' | 'default' | 'secondary'> = {
  critical: 'destructive',
  high: 'warning',
  medium: 'default',
  low: 'secondary',
}

function TrendIcon({ direction }: { direction: string }) {
  switch (direction) {
    case 'up':
      return <ArrowUp className="h-5 w-5 text-green-500" />
    case 'down':
      return <ArrowDown className="h-5 w-5 text-red-500" />
    case 'volatile':
      return <Activity className="h-5 w-5 text-yellow-500" />
    default:
      return <Minus className="h-5 w-5 text-muted-foreground" />
  }
}

function AnomalyIcon({ severity }: { severity: string }) {
  switch (severity) {
    case 'critical':
      return <AlertCircle className="h-5 w-5 text-red-500" />
    case 'high':
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />
    case 'medium':
      return <AlertTriangle className="h-5 w-5 text-blue-500" />
    default:
      return <Info className="h-5 w-5 text-muted-foreground" />
  }
}

function Info(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
    </svg>
  )
}

// ─── Page ───────────────────────────────────────────────────────

export default function IntelligenceDashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [trends, setTrends] = useState<TrendAnalysis[]>([])
  const [activeTab, setActiveTab] = useState<TabValue>('overview')
  const [hasRun, setHasRun] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // Use server actions to avoid bundling server-only dependencies
      const { runIntelligenceScan } = await import('@/lib/pi-actions')
      const { anomalies: anomalyResults, trends: trendResults } = await runIntelligenceScan()

      setAnomalies(anomalyResults)
      setTrends(trendResults)
      setHasRun(true)
    } catch (error) {
      toast({
        title: 'Data Load Error',
        description: 'Failed to load intelligence data. Some PI tables may not exist yet.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  const handleScan = useCallback(async () => {
    setScanning(true)
    try {
      const { runIntelligenceScan } = await import('@/lib/pi-actions')
      const { anomalies: anomalyResults, trends: trendResults } = await runIntelligenceScan()

      setAnomalies(anomalyResults)
      setTrends(trendResults)
      setHasRun(true)
      toast({
        title: 'Scan Complete',
        description: `Found ${anomalyResults.length} anomalies and ${trendResults.length} trend signals`,
      })
    } catch (error) {
      toast({
        title: 'Scan Error',
        description: 'Intelligence scan failed',
        variant: 'destructive',
      })
    } finally {
      setScanning(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ─── Computed Stats ──────────────────────────────────────────

  const criticalAnomalies = anomalies.filter(a => a.severity === 'critical').length
  const highAnomalies = anomalies.filter(a => a.severity === 'high').length
  const upTrends = trends.filter(t => t.direction === 'up').length
  const downTrends = trends.filter(t => t.direction === 'down').length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Intelligence Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Anomaly detection, trend analysis, and business intelligence at a glance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleScan}
            disabled={scanning}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? 'Scanning...' : 'Run Full Scan'}
          </Button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> Critical Anomalies
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <p className={`text-2xl font-bold ${criticalAnomalies > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {criticalAnomalies}
                </p>
                <p className="text-xs text-muted-foreground">
                  {highAnomalies > 0 ? `${highAnomalies} high severity` : 'No high severity issues'}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4" /> Total Anomalies
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <p className="text-2xl font-bold">{anomalies.length}</p>
                <p className="text-xs text-muted-foreground">
                  Across sales, KPI, and inventory
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Upward Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <p className="text-2xl font-bold text-green-600">{upTrends}</p>
                <p className="text-xs text-muted-foreground">
                  {downTrends > 0 ? `${downTrends} declining` : 'No declines'}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4" /> Metrics Tracked
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <p className="text-2xl font-bold">{trends.length}</p>
                <p className="text-xs text-muted-foreground">
                  KPIs and revenue trends
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabValue)}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="anomalies" className="relative">
            Anomalies
            {anomalies.length > 0 && (
              <Badge variant="destructive" className="ml-2 text-xs px-1.5">
                {anomalies.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="trends">
            Trends
            {trends.length > 0 && (
              <Badge variant="default" className="ml-2 text-xs px-1.5">
                {trends.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ─── OVERVIEW TAB ──────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-6">
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-48" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Skeleton className="h-48" />
                <Skeleton className="h-48" />
              </div>
            </div>
          ) : !hasRun ? (
            <Card>
              <CardContent className="py-12 text-center">
                <BarChart3 className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-30" />
                <h3 className="text-lg font-medium mb-2">No Data Yet</h3>
                <p className="text-muted-foreground max-w-md mx-auto mb-4">
                  Run an intelligence scan to detect anomalies and analyze trends.
                </p>
                <Button onClick={handleScan} disabled={scanning}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${scanning ? 'animate-spin' : ''}`} />
                  Run Scan
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Recent Anomalies Summary */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Recent Anomalies</CardTitle>
                    <CardDescription>
                      Unusual patterns detected across your business data
                    </CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab('anomalies')}>
                    <Eye className="h-4 w-4 mr-1" /> View All
                  </Button>
                </CardHeader>
                <CardContent>
                  {anomalies.length === 0 ? (
                    <div className="flex items-center gap-3 py-6 text-center justify-center">
                      <CheckCircle2 className="h-8 w-8 text-green-500" />
                      <div className="text-left">
                        <p className="font-medium">No Anomalies Detected</p>
                        <p className="text-sm text-muted-foreground">
                          All metrics within expected ranges
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {anomalies.slice(0, 5).map((a, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                          <AnomalyIcon severity={a.severity} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium truncate">{a.entityName}</p>
                              <Badge variant={severityColor[a.severity] ?? 'default'} className="text-xs">
                                {a.severity}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {a.details}
                            </p>
                          </div>
                        </div>
                      ))}
                      {anomalies.length > 5 && (
                        <p className="text-xs text-muted-foreground text-center pt-2">
                          +{anomalies.length - 5} more anomalies
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Trends Summary */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Trend Analysis</CardTitle>
                    <CardDescription>
                      Direction and significance of key business metrics
                    </CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab('trends')}>
                    <Eye className="h-4 w-4 mr-1" /> View All
                  </Button>
                </CardHeader>
                <CardContent>
                  {trends.length === 0 ? (
                    <p className="text-muted-foreground text-center py-6">
                      No trend data available yet
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {trends.slice(0, 5).map((t, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                          <TrendIcon direction={t.direction} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium truncate">{t.entityName}</p>
                              <Badge
                                variant={t.significance === 'high' ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {t.significance}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {t.direction.toUpperCase()} ({t.changePct >= 0 ? '+' : ''}{t.changePct.toFixed(1)}%)
                            </p>
                          </div>
                        </div>
                      ))}
                      {trends.length > 5 && (
                        <p className="text-xs text-muted-foreground text-center pt-2">
                          +{trends.length - 5} more trends
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Links */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card
                  className="cursor-pointer hover:bg-accent transition-colors"
                  onClick={() => router.push('/product-intelligence')}
                >
                  <CardContent className="pt-6 text-center">
                    <Package className="h-8 w-8 mx-auto mb-2 text-primary" />
                    <p className="font-medium">Product Scoring</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      View product intelligence scores and rankings
                    </p>
                  </CardContent>
                </Card>

                <Card
                  className="cursor-pointer hover:bg-accent transition-colors"
                  onClick={() => router.push('/analytics')}
                >
                  <CardContent className="pt-6 text-center">
                    <BarChart3 className="h-8 w-8 mx-auto mb-2 text-primary" />
                    <p className="font-medium">Analytics</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Sales, inventory, and financial analytics
                    </p>
                  </CardContent>
                </Card>

                <Card
                  className="cursor-pointer hover:bg-accent transition-colors"
                  onClick={() => router.push('/stock-alerts')}
                >
                  <CardContent className="pt-6 text-center">
                    <Truck className="h-8 w-8 mx-auto mb-2 text-primary" />
                    <p className="font-medium">Reorder Alerts</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Smart reorder suggestions based on EOQ/ROP
                    </p>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* ─── ANOMALIES TAB ──────────────────────────────────── */}
        <TabsContent value="anomalies" className="space-y-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : anomalies.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-green-500 opacity-50" />
                <h3 className="text-lg font-medium mb-2">No Anomalies Detected</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  All monitored metrics are within expected statistical ranges.
                  Anomalies will appear here when unusual patterns are detected.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Severity Summary */}
              <div className="flex flex-wrap gap-2">
                <Badge variant="destructive">{criticalAnomalies} Critical</Badge>
                <Badge variant="warning">{highAnomalies} High</Badge>
                <Badge variant="default">
                  {anomalies.filter(a => a.severity === 'medium').length} Medium
                </Badge>
                <Badge variant="secondary">
                  {anomalies.filter(a => a.severity === 'low').length} Low
                </Badge>
              </div>

              {/* Anomaly List */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">All Anomalies</CardTitle>
                  <CardDescription>
                    Sorted by severity — {anomalies.length} total
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {anomalies
                      .sort((a, b) => {
                        const order = { critical: 0, high: 1, medium: 2, low: 3 }
                        return (order[a.severity as keyof typeof order] ?? 99) -
                               (order[b.severity as keyof typeof order] ?? 99)
                      })
                      .map((a, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                          <AnomalyIcon severity={a.severity} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium">{a.entityName}</p>
                              <Badge
                                variant={severityColor[a.severity] ?? 'default'}
                                className="text-xs"
                              >
                                {a.severity}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {a.entityType}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {a.direction}
                              </Badge>
                            </div>
                            <p className="text-sm mt-1">{a.details}</p>
                            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                              <span>Deviation: {a.deviation.toFixed(2)}σ</span>
                              <span>Expected: {a.expectedValue}</span>
                              <span>Actual: {a.actualValue}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ─── TRENDS TAB ─────────────────────────────────────── */}
        <TabsContent value="trends" className="space-y-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : trends.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <BarChart3 className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-30" />
                <h3 className="text-lg font-medium mb-2">No Trend Data</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Trend analysis requires KPI snapshots and forecast data.
                  Data will appear once the system has collected enough history.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Direction Summary */}
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-100">
                  <ArrowUp className="h-3 w-3 mr-1" /> {upTrends} Up
                </Badge>
                <Badge className="bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900 dark:text-red-100">
                  <ArrowDown className="h-3 w-3 mr-1" /> {downTrends} Down
                </Badge>
                <Badge variant="default">
                  <Activity className="h-3 w-3 mr-1" /> {trends.filter(t => t.direction === 'volatile').length} Volatile
                </Badge>
                <Badge variant="secondary">
                  <Minus className="h-3 w-3 mr-1" /> {trends.filter(t => t.direction === 'stable').length} Stable
                </Badge>
              </div>

              {/* Trend List */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">All Trends</CardTitle>
                  <CardDescription>
                    Linear regression-based trend analysis — {trends.length} metrics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {trends
                      .sort((a, b) => {
                        const order = { high: 0, medium: 1, low: 2 }
                        return (order[a.significance as keyof typeof order] ?? 99) -
                               (order[b.significance as keyof typeof order] ?? 99)
                      })
                      .map((t, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                          <TrendIcon direction={t.direction} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium">{t.entityName}</p>
                              <Badge
                                variant={t.significance === 'high' ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {t.significance}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {t.direction}
                              </Badge>
                            </div>
                            <p className="text-sm mt-1">{t.description}</p>
                            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                              <span>Change: {t.changePct >= 0 ? '+' : ''}{t.changePct.toFixed(1)}%</span>
                              <span>Period: {t.period}</span>
                              <span>Entity: {t.entityType}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
