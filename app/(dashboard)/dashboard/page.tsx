import { DashboardStats } from "@/components/dashboard/dashboard-stats"
import { SalesTrendChart } from "@/components/dashboard/sales-trend-chart"
import { BranchComparison } from "@/components/dashboard/branch-comparison"
import { TopProducts } from "@/components/dashboard/top-products"
import { LowStockAlerts } from "@/components/dashboard/low-stock-alerts"
import { RecentTransactions } from "@/components/dashboard/recent-transactions"
import { SeasonalInsights } from "@/components/dashboard/seasonal-insights"
import { PaymentBreakdown } from "@/components/dashboard/payment-breakdown"

export default function DashboardPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here&apos;s your business overview for today.
          </p>
        </div>
      </div>

      <DashboardStats />

      <div className="grid gap-6 lg:grid-cols-7">
        <div className="lg:col-span-4">
          <SalesTrendChart />
        </div>
        <div className="lg:col-span-3">
          <BranchComparison />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <TopProducts />
        <PaymentBreakdown />
        <LowStockAlerts />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentTransactions />
        </div>
        <SeasonalInsights />
      </div>
    </div>
  )
}
