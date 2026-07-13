'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts'
import { CustomTooltip } from '@/components/charts/custom-tooltip'
import { EmptyState } from '@/components/ui/empty-state'
import { TrendingUp, DollarSign, TrendingDown, Landmark } from 'lucide-react'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d']

interface ChartContentProps {
  plTrend: { period?: string; date?: string; revenue: number; netProfit?: number; profit?: number; cogs?: number }[]
  cashFlow: { period?: string; inflow: number; outflow: number; inflows?: number; outflows?: number }[]
  expenseBreakdown: { category: string; amount: number; percentage: number; trend?: number }[]
  marginAnalysis: { productName?: string; name?: string; category?: string; margin: number; marginPercentage?: number }[]
  fmt: (n: number) => string
}

export default function FinanceChartContent({
  plTrend, cashFlow, expenseBreakdown, marginAnalysis, fmt,
}: ChartContentProps) {
  return (
    <Tabs defaultValue="pnl">
      <TabsList>
        <TabsTrigger value="pnl"><TrendingUp className="h-4 w-4 mr-2" /> P&L Trend</TabsTrigger>
        <TabsTrigger value="cashflow"><DollarSign className="h-4 w-4 mr-2" /> Cash Flow</TabsTrigger>
        <TabsTrigger value="expenses"><TrendingDown className="h-4 w-4 mr-2" /> Expense Breakdown</TabsTrigger>
        <TabsTrigger value="margin"><Landmark className="h-4 w-4 mr-2" /> Margin Analysis</TabsTrigger>
      </TabsList>

      <TabsContent value="pnl" className="mt-4">
        <Card><CardHeader><CardTitle>Profit & Loss Trend</CardTitle></CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={plTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="period" /><YAxis /><Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="revenue" stroke="#00C49F" strokeWidth={2} name="Revenue" />
                <Line type="monotone" dataKey="netProfit" stroke="#8884d8" strokeWidth={2} name="Net Profit" />
                <Line type="monotone" dataKey="cogs" stroke="#FF8042" strokeWidth={2} name="COGS" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent></Card>
      </TabsContent>

      <TabsContent value="cashflow" className="mt-4">
        <Card><CardHeader><CardTitle>Cash Flow Forecast</CardTitle></CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashFlow}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="period" /><YAxis /><Tooltip content={<CustomTooltip />} />
                <Bar dataKey="inflows" fill="#00C49F" name="Inflows" />
                <Bar dataKey="outflows" fill="#FF8042" name="Outflows" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent></Card>
      </TabsContent>

      <TabsContent value="expenses" className="mt-4">
        <div className="grid gap-6 md:grid-cols-2">
          <Card><CardHeader><CardTitle>Expense Categories</CardTitle></CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={expenseBreakdown} cx="50%" cy="50%" labelLine={false} label={({ category, percent }: any) => `${category} (${((percent ?? 0) * 100).toFixed(0)}%)`} outerRadius={100} dataKey="amount" nameKey="category">
                    {expenseBreakdown.map((_, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie><Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent></Card>
          <Card><CardHeader><CardTitle>Category Details</CardTitle></CardHeader>
            <CardContent><div className="space-y-3">
              {expenseBreakdown.map((item, i: number) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{item.category}</span>
                  <div className="text-right"><div className="text-sm font-mono">{fmt(item.amount || 0)}</div><div className="text-xs text-muted-foreground">{item.percentage?.toFixed(1)}% ({item.trend && (item.trend >= 0 ? '+' : '')}{item.trend?.toFixed(1)}%)</div></div>
                </div>
              ))}
              {expenseBreakdown.length === 0 && <EmptyState title="No data" compact />}
            </div></CardContent></Card>
        </div>
      </TabsContent>

      <TabsContent value="margin" className="mt-4">
        <Card><CardHeader><CardTitle>Margin Analysis by Category</CardTitle></CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={marginAnalysis}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="category" /><YAxis /><Tooltip content={<CustomTooltip currency={false} suffix="%" />} />
                <Bar dataKey="marginPercentage" fill="#8884d8" name="Margin %" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent></Card>
      </TabsContent>
    </Tabs>
  )
}
