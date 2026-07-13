'use client'

import { useCallback } from 'react'
import { useDashboardQuery } from '@/hooks/use-dashboard-query'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { getTopProductsToday } from '@/lib/modules/dashboard'
import { formatKSh } from '@/lib/currency'

interface TopProduct {
  product: string
  unitsSold: number
  revenue: number
}

export function TopProducts() {
  const { profile } = useAuth()
  const branchId = profile?.branch_id

  const fetcher = useCallback(
    () => branchId ? getTopProductsToday(branchId, 5) : Promise.resolve([]),
    [branchId]
  )

  const { data: products, loading, error, retry } = useDashboardQuery<TopProduct[]>(
    fetcher,
    [],
    { deps: [branchId], pollIntervalMs: 60000, minIntervalMs: 30000 }
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Selling Products</CardTitle>
        <CardDescription>Best performers today</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : products.length > 0 ? (
            products.map((product, index) => (
              <div key={product.product} className="flex items-center gap-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-sm font-semibold">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{product.product}</p>
                  <p className="text-xs text-muted-foreground">{product.unitsSold} units sold</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatKSh(product.revenue)}</p>
                </div>
              </div>
            ))
          ) : (
            <EmptyState title="No sales data" compact />
          )}
        </div>
        {error && (
          <div className="flex items-center gap-2 p-3 mt-3 text-sm text-destructive bg-destructive/10 rounded-md">
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
