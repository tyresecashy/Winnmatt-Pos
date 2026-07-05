'use client'

import { useState, useCallback } from 'react'
import { DashboardStats } from "@/components/dashboard/dashboard-stats"
import { SalesTrendChart } from "@/components/dashboard/sales-trend-chart"
import { BranchComparison } from "@/components/dashboard/branch-comparison"
import { TopProducts } from "@/components/dashboard/top-products"
import { LowStockAlerts } from "@/components/dashboard/low-stock-alerts"
import { RecentTransactions } from "@/components/dashboard/recent-transactions"
import { SeasonalInsights } from "@/components/dashboard/seasonal-insights"
import { PaymentBreakdown } from "@/components/dashboard/payment-breakdown"
import { RecentAutomations } from "@/components/dashboard/recent-automations"
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'

export default function DashboardPage() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = useCallback(() => {
    setRefreshing(true)
    setRefreshKey((k) => k + 1)
    // Brief visual feedback
    setTimeout(() => setRefreshing(false), 800)
  }, [])

  return (
    <div className="p-6 space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here&apos;s your business overview for today.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      <DashboardStats key={`stats-${refreshKey}`} />

      <div className="grid gap-6 lg:grid-cols-7">
        <div className="lg:col-span-4">
          <SalesTrendChart key={`trend-${refreshKey}`} />
        </div>
        <div className="lg:col-span-3">
          <BranchComparison key={`branches-${refreshKey}`} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <TopProducts key={`products-${refreshKey}`} />
        <PaymentBreakdown key={`payment-${refreshKey}`} />
        <LowStockAlerts key={`stock-${refreshKey}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentTransactions key={`txns-${refreshKey}`} />
        </div>
        <RecentAutomations key={`automations-${refreshKey}`} />
      </div>
    </div>
  )
}
