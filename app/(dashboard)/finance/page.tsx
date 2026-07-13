'use client'

import { logger } from '@/lib/logger'
import Link from 'next/link'
import { startTransition, useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Wallet,
  CreditCard,
  Package,
  Building2,
  FileText,
  RefreshCw,
  Landmark,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { getFinanceStats, getAccountBalances, type Account } from '@/lib/modules/finance'

interface FinanceStats {
  totalRevenue: number
  totalExpenses: number
  netProfit: number
  cashPosition: number
  accountsReceivable: number
  accountsPayable: number
  inventoryValue: number
  monthlyEntries: number
}

interface BalanceEntry {
  account_id: string
  account_number: string
  account_name: string
  account_type: string
  normal_balance: string
  total_debit: number
  total_credit: number
  balance: number
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d']

function formatKSh(cents: number): string {
  return `KSh ${(cents / 100).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function FinanceDashboard() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<FinanceStats | null>(null)
  const [balances, setBalances] = useState<BalanceEntry[]>([])
  const [viewMode, setViewMode] = useState<'overview' | 'accounts'>('overview')

  const loadData = async () => {
    setLoading(true)
    try {
        const [statsData, balancesData] = await Promise.all([
          getFinanceStats(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), new Date().toISOString()),
          getAccountBalances(),
        ])
        setStats(statsData as any)
        setBalances(balancesData as any)
    } catch (error) {
      logger.error('Failed to load finance data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    startTransition(() => { loadData() })
  }, [])

  const accountTypeColors: Record<string, string> = {
    asset: '#0088FE',
    liability: '#FF8042',
    equity: '#00C49F',
    revenue: '#FFBB28',
    expense: '#FF6B6B',
    cogs: '#8884d8',
  }

  const balancesByType = balances.reduce<Record<string, { count: number; total: number }>>((acc, b) => {
    const type = b.account_type || 'other'
    if (!acc[type]) acc[type] = { count: 0, total: 0 }
    acc[type].count++
    acc[type].total += Math.abs(b.balance)
    return acc
  }, {})

  const pieData = Object.entries(balancesByType).map(([type, data]) => ({
    name: type.charAt(0).toUpperCase() + type.slice(1),
    value: Math.round(data.total / 100),
  }))

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-24 w-full" /></CardContent></Card>
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-destructive">Failed to load finance data</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Finance</h1>
          <p className="text-muted-foreground">Month-to-date financial overview</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Revenue (MTD)</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatKSh(stats.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">Net revenue this month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Expenses (MTD)</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatKSh(stats.totalExpenses)}</div>
            <p className="text-xs text-muted-foreground">Total expenses + COGS</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatKSh(stats.netProfit)}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.totalRevenue > 0
                ? `${((stats.netProfit / stats.totalRevenue) * 100).toFixed(1)}% margin`
                : 'No revenue data'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Monthly Entries</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.monthlyEntries}</div>
            <p className="text-xs text-muted-foreground">Journal entries posted</p>
          </CardContent>
        </Card>
      </div>

      {/* Position Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Cash Position</CardTitle>
            <Wallet className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatKSh(stats.cashPosition)}</div>
            <p className="text-xs text-muted-foreground">Cash + bank accounts</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Accounts Receivable</CardTitle>
            <CreditCard className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{formatKSh(stats.accountsReceivable)}</div>
            <p className="text-xs text-muted-foreground">Outstanding customer credit</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Accounts Payable</CardTitle>
            <Building2 className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{formatKSh(stats.accountsPayable)}</div>
            <p className="text-xs text-muted-foreground">Outstanding supplier payments</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Inventory Value</CardTitle>
            <Package className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatKSh(stats.inventoryValue)}</div>
            <p className="text-xs text-muted-foreground">Stock on hand (at cost)</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart Section */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Account Balances by Type</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={({ name, value }) => `${name}: KSh ${value.toLocaleString()}`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={((value: number) => `KSh ${value.toLocaleString()}`) as any} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState title="No account data available" compact />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(balancesByType).map(([type, data]) => (
                <div key={type} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: accountTypeColors[type] || '#888' }}
                    />
                    <span className="text-sm capitalize">{type}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{formatKSh(data.total)}</div>
                    <div className="text-xs text-muted-foreground">{data.count} accounts</div>
                  </div>
                </div>
              ))}
              {Object.keys(balancesByType).length === 0 && (
                <EmptyState title="No balances recorded yet" compact />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-3">
        <Link
          href="/accounts-payable"
          className="inline-flex items-center justify-center gap-2 h-20 rounded-lg border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors flex-col"
        >
          <Building2 className="h-5 w-5" />
          <span className="text-sm font-medium">Accounts Payable</span>
        </Link>
        <Link
          href="/accounts-receivable"
          className="inline-flex items-center justify-center gap-2 h-20 rounded-lg border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors flex-col"
        >
          <CreditCard className="h-5 w-5" />
          <span className="text-sm font-medium">Accounts Receivable</span>
        </Link>
        <Link
          href="/financial-periods"
          className="inline-flex items-center justify-center gap-2 h-20 rounded-lg border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors flex-col"
        >
          <Landmark className="h-5 w-5" />
          <span className="text-sm font-medium">Financial Periods</span>
        </Link>
      </div>
    </div>
  )
}
