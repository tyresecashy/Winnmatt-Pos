'use client'

import dynamic from 'next/dynamic'
import { DashboardStats } from "@/components/dashboard/dashboard-stats"
import { SalesTrendChart } from "@/components/dashboard/sales-trend-chart"
import { BranchComparison } from "@/components/dashboard/branch-comparison"
import { TopProducts } from "@/components/dashboard/top-products"
import { LowStockAlerts } from "@/components/dashboard/low-stock-alerts"
import { RecentTransactions } from "@/components/dashboard/recent-transactions"
import { SeasonalInsights } from "@/components/dashboard/seasonal-insights"
import { RecentAutomations } from "@/components/dashboard/recent-automations"
import { PeriodSelector } from "@/components/dashboard/period-selector"
import { DateRangeProvider } from "@/contexts/date-range-context"
import { Button } from '@/components/ui/button'
import { RefreshCw, Download } from 'lucide-react'
import { useState, useCallback } from 'react'
import { AIInsightSection } from '@/components/ai/ai-insight-section'
import { analyzeDashboardAI } from '@/lib/modules/ai'

const PaymentBreakdown = dynamic(
  () => import('@/components/dashboard/payment-breakdown').then((mod) => mod.PaymentBreakdown),
  { ssr: false }
)

function DashboardContent() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = useCallback(() => {
    setRefreshing(true)
    setRefreshKey((k) => k + 1)
    setTimeout(() => setRefreshing(false), 800)
  }, [])

  const handleExport = useCallback(() => {
    // Trigger export by finding all dashboard cards
    window.dispatchEvent(new CustomEvent('dashboard:export'))
  }, [])

  return (
    <div className="p-6 space-y-6 fade-in">
      {/* Header with period selector + actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here&apos;s your business overview.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodSelector />
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
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
      </div>

      <AIInsightSection
        title="AI Business Summary"
        description="Executive snapshot of your business performance"
        analyzeFn={analyzeDashboardAI}
      />

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

export default function DashboardPage() {
  return (
    <DateRangeProvider>
      <DashboardContent />
    </DateRangeProvider>
  )
}
