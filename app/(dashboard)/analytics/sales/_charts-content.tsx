'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts'
import { CustomTooltip } from '@/components/charts/custom-tooltip'
import { EmptyState } from '@/components/ui/empty-state'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d']

interface ChartContentProps {
  trend: { date: string; revenue: number }[]
  peakHours: { hour?: number | string; count?: number; transactions?: number }[]
  categoryBreakdown: { name?: string; category?: string; revenue: number }[]
  paymentMethods: { method?: string; payment_method?: string; amount?: number; total_amount?: number }[]
  topProducts: { productName?: string; name?: string; revenue: number }[]
  fmt: (n: number) => string
  onDrillDown: (type: string, value: string) => void
}

export default function SalesChartContent({
  trend, peakHours, categoryBreakdown, paymentMethods, topProducts, fmt, onDrillDown,
}: ChartContentProps) {
  return (
    <>
      <div className="grid gap-6 md:grid-cols-2">
        <Card><CardHeader><CardTitle>Revenue Trend</CardTitle></CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip content={<CustomTooltip />} /><Line type="monotone" dataKey="revenue" stroke="#8884d8" strokeWidth={2} /></LineChart>
            </ResponsiveContainer>
          </CardContent></Card>
        <Card><CardHeader><CardTitle>Peak Hours</CardTitle></CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={peakHours}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="hour" /><YAxis /><Tooltip content={<CustomTooltip currency={false} suffix=" txns" />} /><Bar dataKey="transactions" fill="#82ca9d" cursor="pointer" onClick={(data) => { const d = data as unknown as Record<string, unknown>; d?.hour && onDrillDown('hour', String(d.hour)) }} /></BarChart>
            </ResponsiveContainer>
          </CardContent></Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card><CardHeader><CardTitle>Category Breakdown</CardTitle></CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categoryBreakdown} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`} outerRadius={100} dataKey="revenue" nameKey="name" cursor="pointer" onClick={(data) => data?.name && onDrillDown('category', String(data.name))}>
                  {categoryBreakdown.map((_, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie><Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent></Card>
        <Card><CardHeader><CardTitle>Payment Methods</CardTitle></CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={paymentMethods} cx="50%" cy="50%" labelLine={false} label={({ method, percent }) => `${method} (${((percent ?? 0) * 100).toFixed(0)}%)`} outerRadius={100} dataKey="amount" nameKey="method">
                  {paymentMethods.map((_, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie><Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent></Card>
        <Card><CardHeader><CardTitle>Top Products</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topProducts.slice(0, 8).map((p, i: number) => (
                <div key={i} className="flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 transition-colors" onClick={() => onDrillDown('product', p.productName || p.name || '')}>
                  <span className="text-sm font-medium truncate max-w-[180px]">{p.productName || p.name}</span>
                  <span className="text-sm font-mono">{fmt(p.revenue || 0)}</span>
                </div>
              ))}
              {topProducts.length === 0 && <EmptyState title="No data" compact />}
            </div>
          </CardContent></Card>
      </div>
    </>
  )
}
