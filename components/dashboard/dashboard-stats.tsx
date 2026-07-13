'use client'

import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { TrendingUp, ShoppingCart, Users, Package, RefreshCw, AlertCircle } from 'lucide-react'
import { getTodayDashboardStats } from '@/lib/modules/dashboard'
import { KpiCard } from '@/components/ui/kpi-card/kpi-card'
import { useDashboardQuery } from '@/hooks/use-dashboard-query'

interface DashboardStatsData {
  totalSales: number
  transactionCount: number
  averageBasket: number
  activeCustomers: number
}

const FALLBACK: DashboardStatsData = {
  totalSales: 0,
  transactionCount: 0,
  averageBasket: 0,
  activeCustomers: 0,
}

const STAT_DEFS = [
  { title: "Today's Sales", rawValue: (s: DashboardStatsData) => s.totalSales, icon: TrendingUp, description: 'total revenue', isCurrency: true, tone: 'primary' as const },
  { title: 'Transactions', rawValue: (s: DashboardStatsData) => s.transactionCount, icon: ShoppingCart, description: 'completed sales', isCurrency: false, tone: 'default' as const },
  { title: 'Avg. Basket Size', rawValue: (s: DashboardStatsData) => s.averageBasket, icon: Package, description: 'per transaction', isCurrency: true, tone: 'success' as const },
  { title: 'Active Customers', rawValue: (s: DashboardStatsData) => s.activeCustomers, icon: Users, description: 'today', isCurrency: false, tone: 'warning' as const },
]

export function DashboardStats() {
  const { profile } = useAuth()
  const branchId = profile?.branch_id

  const { data: stats, loading, error, retry } = useDashboardQuery(
    async () => {
      if (!branchId) return FALLBACK
      return getTodayDashboardStats(branchId)
    },
    FALLBACK,
    { deps: [branchId] }
  )

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_DEFS.map((stat) => (
          <KpiCard key={stat.title} label="" value="---" icon={null as unknown as React.ReactNode} tone="default" size="lg" compact className="animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STAT_DEFS.map((stat) => (
            <KpiCard key={stat.title} label={stat.title} value="--" caption="unavailable" tone="danger" size="lg" icon={null as unknown as React.ReactNode} />
          ))}
        </div>
        <div className="flex items-center justify-center gap-2 p-2">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={retry}>
            <RefreshCw className="h-3 w-3 mr-1" /> Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {STAT_DEFS.map((stat) => {
        const val = stat.rawValue(stats)
        return (
          <KpiCard
            key={stat.title}
            label={stat.title}
            value={stat.isCurrency ? `KSh ${Math.round(val).toLocaleString()}` : Math.round(val).toLocaleString()}
            caption={stat.description}
            tone={stat.tone}
            size="lg"
            icon={<stat.icon className="h-5 w-5" />}
          />
        )
      })}
    </div>
  )
}
