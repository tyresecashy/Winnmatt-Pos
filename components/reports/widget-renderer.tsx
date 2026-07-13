'use client'

import React from 'react'
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
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  AlertTriangle,
} from 'lucide-react'

type WidgetType = 'metric' | 'chart' | 'table' | 'list'

interface WidgetConfig {
  title: string
  type: WidgetType
  config?: {
    title?: string
    aggregation?: string
    field?: string
    format?: string
    chartType?: string
    xAxis?: string
    yAxis?: string
    columns?: string[]
  }
}

interface WidgetRendererProps {
  widget: WidgetConfig
  data: Record<string, unknown>
  loading?: boolean
  error?: string
}

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
]

function formatValue(value: number | undefined | null, format?: string): string {
  if (value == null) return '—'
  if (format === 'currency') {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(value)
  }
  if (format === 'percentage') return `${Math.round(value)}%`
  return new Intl.NumberFormat('en-KE').format(value)
}

/* ─── Metric Icon ─── */

function MetricIcon({ field }: { field?: string }) {
  const f = field || ''
  if (f.includes('revenue') || f.includes('Revenue')) return <DollarSign className="h-5 w-5" />
  if (f.includes('transaction') || f.includes('Transaction')) return <ShoppingCart className="h-5 w-5" />
  if (f.includes('customer') || f.includes('Customer')) return <Users className="h-5 w-5" />
  if (f.includes('stock') || f.includes('Stock')) return <Package className="h-5 w-5" />
  return <TrendingUp className="h-5 w-5" />
}

/* ─── Metric Widget ─── */

interface MetricData {
  metrics?: { totalRevenue?: number; revenueGrowth?: number }
  totalRevenue?: number
  revenueGrowth?: number
  [key: string]: unknown
}

function MetricWidget({ data, config }: { data: MetricData; config?: WidgetConfig['config'] }) {
  const value = config?.field ? (data?.[config.field] as number) : data?.metrics?.totalRevenue ?? data?.totalRevenue ?? 0
  const trend = data?.metrics?.revenueGrowth ?? data?.revenueGrowth

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{config?.title || 'Metric'}</p>
            <p className="text-2xl font-bold">
              {formatValue(value, config?.format)}
            </p>
          </div>
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <MetricIcon field={config?.field} />
          </div>
        </div>
        {trend != null && (
          <div className="mt-2 flex items-center gap-1 text-xs">
            {trend >= 0 ? (
              <TrendingUp className="h-3 w-3 text-success" />
            ) : (
              <TrendingDown className="h-3 w-3 text-destructive" />
            )}
            <span className={trend >= 0 ? 'text-success' : 'text-destructive'}>
              {Math.abs(trend).toFixed(1)}%
            </span>
            <span className="text-muted-foreground">vs previous period</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* ─── Chart Widget ─── */

function ChartWidget({ data, config }: { data: unknown[] | Record<string, unknown>; config?: WidgetConfig['config'] }) {
  const chartData = (Array.isArray(data) ? data : ((data as Record<string, unknown>)?.trend ?? [])) as Record<string, unknown>[]

  if (!chartData.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{config?.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
          No chart data available
        </CardContent>
      </Card>
    )
  }

  const xKey = config?.xAxis || 'date'
  const yKey = config?.yAxis || 'revenue'
  const chartType = config?.chartType || 'bar'

  const renderChart = () => {
    switch (chartType) {
      case 'line':
        return (
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey={xKey} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip
              contentStyle={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
                fontSize: '12px',
              }}
              formatter={((value: number) => [formatValue(value, 'currency'), yKey]) as any}
            />
            <Line
              type="monotone"
              dataKey={yKey}
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              dot={{ fill: 'hsl(var(--chart-1))', r: 3 }}
            />
          </LineChart>
        )

      case 'area':
        return (
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey={xKey} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip
              contentStyle={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
                fontSize: '12px',
              }}
              formatter={((value: number) => [formatValue(value, 'currency'), yKey]) as any}
            />
            <Area
              type="monotone"
              dataKey={yKey}
              stroke="hsl(var(--chart-1))"
              fill="hsl(var(--chart-1))"
              fillOpacity={0.15}
              strokeWidth={2}
            />
          </AreaChart>
        )

      case 'pie':
        return (
          <PieChart>
            <Pie
              data={chartData}
              dataKey={yKey}
              nameKey={xKey}
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}
            >
              {chartData.map((_: Record<string, unknown>, idx: number) => (
                <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
                fontSize: '12px',
              }}
              formatter={(value) => [formatValue(Number(value) || 0, 'currency'), yKey]}
            />
          </PieChart>
        )

      default: // bar
        return (
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey={xKey} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip
              contentStyle={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
                fontSize: '12px',
              }}
              formatter={(value: unknown) => [formatValue(Number(value) || 0, 'currency'), yKey] as [string, string]}
            />
            <Bar dataKey={yKey} fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
          </BarChart>
        )
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{config?.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

/* ─── Table Widget ─── */

function TableWidget({ data, config }: { data: Record<string, unknown>[] | { trend?: Record<string, unknown>[] }; config?: WidgetConfig['config'] }) {
  const rows: Record<string, unknown>[] = Array.isArray(data) ? data as Record<string, unknown>[] : (Array.isArray(data?.trend) ? data.trend as Record<string, unknown>[] : [])

  if (!rows.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{config?.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
          No table data available
        </CardContent>
      </Card>
    )
  }

  const columns = config?.columns || Object.keys(rows[0] || {})

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{config?.title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-auto max-h-[300px]">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead key={col} className="text-xs capitalize">
                    {col.replace(/_/g, ' ')}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, 50).map((row, idx: number) => (
                <TableRow key={idx}>
                  {columns.map((col) => (
                    <TableCell key={col} className="text-xs">
                      {typeof row[col] === 'number'
                        ? formatValue(row[col] as number, col.includes('price') || col.includes('revenue') || col.includes('total') || col.includes('value') ? 'currency' : undefined)
                        : (row[col] as React.ReactNode) ?? '—'}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

/* ─── List Widget ─── */

function ListWidget({ data, config }: { data: Record<string, unknown>[] | { trend?: Record<string, unknown>[] }; config?: WidgetConfig['config'] }) {
  const items: Record<string, unknown>[] = Array.isArray(data) ? data as Record<string, unknown>[] : (Array.isArray(data?.trend) ? data.trend as Record<string, unknown>[] : [])

  if (!items.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{config?.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
          No list data available
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{config?.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.slice(0, 20).map((item, idx: number) => {
          const label = (item.name || item.productName || item.category || item.method || item.date || `Item ${idx + 1}`) as string
          const value = (item.revenue ?? item.total ?? item.totalSold ?? item.count ?? 0) as number
          return (
            <div key={idx} className="flex items-center justify-between border-b border-border/50 pb-2 last:border-0 last:pb-0">
              <span className="text-sm truncate max-w-[70%]">{label}</span>
              <span className="text-sm font-medium tabular-nums">
                {formatValue(value, 'currency')}
              </span>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

/* ─── Loading / Error ─── */

function LoadingWidget({ title }: { title: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      </CardContent>
    </Card>
  )
}

function ErrorWidget({ title, message }: { title: string; message: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  )
}

/* ─── Main Renderer ─── */

export function WidgetRenderer({ widget, data, loading, error }: WidgetRendererProps) {
  if (loading) return <LoadingWidget title={widget.title} />
  if (error) return <ErrorWidget title={widget.title} message={error} />

  switch (widget.type) {
    case 'metric':
      return <MetricWidget data={data} config={widget.config} />
    case 'chart':
      return <ChartWidget data={data} config={widget.config} />
    case 'table':
      return <TableWidget data={data} config={widget.config} />
    case 'list':
      return <ListWidget data={data} config={widget.config} />
    default:
      return <ErrorWidget title={widget.title} message={`Unknown widget type: ${widget.type}`} />
  }
}
