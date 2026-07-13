'use client'

import { useCallback } from 'react'
import { useDashboardQuery } from '@/hooks/use-dashboard-query'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, AlertTriangle, Package, RefreshCw } from 'lucide-react'
import { getLowStockAlertsForBranch } from '@/lib/modules/dashboard'

interface LowStockAlert {
  product: string
  branch: string
  currentStock: number
}

export function LowStockAlerts() {
  const { profile } = useAuth()
  const branchId = profile?.branch_id

  const fetcher = useCallback(
    () => branchId ? getLowStockAlertsForBranch(branchId, 5) : Promise.resolve([]),
    [branchId]
  )

  const { data: alerts, loading, error, retry } = useDashboardQuery<LowStockAlert[]>(
    fetcher,
    [],
    { deps: [branchId], pollIntervalMs: 60000, minIntervalMs: 30000 }
  )

  return (
    <Card className="border-destructive/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <CardTitle>Low Stock Alerts</CardTitle>
        </div>
        <CardDescription>Items requiring attention</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : alerts.length > 0 ? (
            alerts.map((alert, index) => (
              <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    alert.currentStock === 0 ? 'bg-destructive/10 text-destructive' : 'bg-warning/20 text-warning-foreground'
                  }`}
                >
                  <Package className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{alert.product}</p>
                  <p className="text-xs text-muted-foreground truncate">{alert.branch}</p>
                </div>
                <Badge
                  variant={alert.currentStock === 0 ? 'destructive' : 'secondary'}
                  className={
                    alert.currentStock === 0 ? '' : 'bg-warning/20 text-warning-foreground hover:bg-warning/30'
                  }
                >
                  {alert.currentStock === 0 ? 'Out of Stock' : `${alert.currentStock} left`}
                </Badge>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-sm">All items have adequate stock</p>
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
