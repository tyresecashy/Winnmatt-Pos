'use client'

import { useDashboardQuery } from '@/hooks/use-dashboard-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, MapPin, RefreshCw, TrendingUp } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { getBranchPerformanceToday } from '@/lib/modules/dashboard'
import { formatKSh } from '@/lib/currency'

interface BranchData {
  id: string
  name: string
  sales: number
  transactions: number
  percentage: number
}

export function BranchComparison() {
  const { data: branches, loading, error, retry } = useDashboardQuery<BranchData[]>(
    getBranchPerformanceToday,
    [],
    { pollIntervalMs: 60000, minIntervalMs: 30000 }
  )

  const totalSales = branches.reduce((sum, branch) => sum + branch.sales, 0)

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Branch Performance</CardTitle>
        <CardDescription>Today&apos;s sales by location</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-2 w-full" />
              </div>
            ))}
          </div>
        ) : branches.length > 0 ? (
          <>
            {branches.map((branch) => (
              <div key={branch.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{branch.name}</p>
                      <p className="text-xs text-muted-foreground">{branch.transactions} transactions</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatKSh(branch.sales)}</p>
                    <p className="text-xs text-muted-foreground">{branch.percentage.toFixed(1)}% of total</p>
                  </div>
                </div>
                <Progress value={branch.percentage} className="h-2" />
              </div>
            ))}

            <div className="pt-4 border-t">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 text-green-600">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Combined Total</p>
                    <p className="text-xs text-muted-foreground">All branches</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">{formatKSh(totalSales)}</p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <EmptyState title="No branch data" compact />
        )}
        {error && (
          <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={retry} className="ml-auto">
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
