'use client'

import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { getWeeklySalesTrend } from '@/lib/modules/dashboard'
import { formatKSh } from '@/lib/currency'
import { useDashboardQuery } from '@/hooks/use-dashboard-query'

interface TrendData {
  day: string
  sales: number
  transactions: number
}

export function SalesTrendChart() {
  const { profile } = useAuth()
  const branchId = profile?.branch_id

  const { data, loading, error, retry } = useDashboardQuery(
    async () => {
      if (!branchId) return []
      return getWeeklySalesTrend(branchId)
    },
    [] as TrendData[],
    { deps: [branchId] }
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly Sales Trend</CardTitle>
        <CardDescription>Sales performance over the past 7 days</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="w-full chart-height-md">
          {loading ? (
            <div className="flex items-center justify-center w-full h-full">
              <div className="space-y-3 w-full px-4">
                <Skeleton className="h-[250px] w-full rounded-lg" />
                <div className="flex justify-between">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <Skeleton key={i} className="h-4 w-10" />
                  ))}
                </div>
              </div>
            </div>
          ) : data.length === 0 ? (
            <div className="flex items-center justify-center w-full h-full text-muted-foreground">
              No sales data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} className="text-xs fill-muted-foreground" />
                <YAxis tickLine={false} axisLine={false} className="text-xs fill-muted-foreground" tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const dataPoint = payload[0].payload as TrendData
                      return (
                        <div className="rounded-lg border bg-background p-3 shadow-md">
                          <p className="text-sm font-medium">{label}</p>
                          <p className="text-sm text-muted-foreground">Sales: <span className="font-medium text-foreground">{formatKSh(dataPoint.sales)}</span></p>
                          <p className="text-sm text-muted-foreground">Transactions: <span className="font-medium text-foreground">{dataPoint.transactions}</span></p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Area type="monotone" dataKey="sales" stroke="hsl(var(--chart-1))" strokeWidth={2} fill="url(#salesGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
        {error && (
          <div className="flex items-center gap-2 p-3 mt-3 text-sm text-destructive bg-destructive/10 rounded-md">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={retry} className="ml-auto">
              <RefreshCw className="h-3 w-3 mr-1" /> Retry
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
