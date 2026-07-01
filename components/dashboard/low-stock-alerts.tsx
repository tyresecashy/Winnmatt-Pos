'use client'
import { logger } from '@/lib/logger';

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, AlertTriangle, Package, RefreshCw } from 'lucide-react'
import { getLowStockAlertsForBranch } from '@/lib/dashboard-actions'

interface LowStockAlert {
  product: string
  branch: string
  currentStock: number
}

export function LowStockAlerts() {
  const { profile } = useAuth()
  const [alerts, setAlerts] = useState<LowStockAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const fetchPromiseRef = useRef<Promise<void> | null>(null)
  const lastFetchAtRef = useRef(0)
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    async function loadAlerts(options?: { force?: boolean; minIntervalMs?: number }) {
      const branchId = profile?.branch_id
      if (!branchId) {
        if (!cancelled) {
          setAlerts([])
          setLoading(false)
        }
        return
      }

      const now = Date.now()
      if (!options?.force && fetchPromiseRef.current) {
        return fetchPromiseRef.current
      }

      if (!options?.force && now - lastFetchAtRef.current < (options?.minIntervalMs ?? 0)) {
        return
      }

      const shouldShowLoading = !hasLoadedRef.current
      if (shouldShowLoading) {
        setLoading(true)
      }

      const fetchPromise = (async () => {
        try {
          const alertsData = await getLowStockAlertsForBranch(branchId, 5)
          if (!cancelled) {
            setError(null)
            setAlerts(alertsData)
            hasLoadedRef.current = true
            lastFetchAtRef.current = Date.now()
          }
        } catch (error) {
          logger.error('Error loading low stock alerts:', error)
          if (!cancelled) setError('Failed to load low stock alerts')
        } finally {
          if (!cancelled && shouldShowLoading) {
            setLoading(false)
          }
        }
      })()

      fetchPromiseRef.current = fetchPromise

      try {
        await fetchPromise
      } finally {
        if (fetchPromiseRef.current === fetchPromise) {
          fetchPromiseRef.current = null
        }
      }
    }

    void loadAlerts({ force: true })

    const intervalId = window.setInterval(() => {
      void loadAlerts({ minIntervalMs: 30000 })
    }, 60000)

    const handleFocus = () => {
      void loadAlerts({ minIntervalMs: 15000 })
    }

    window.addEventListener('focus', handleFocus)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      window.removeEventListener('focus', handleFocus)
    }
  }, [profile?.branch_id, retryCount])

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
                <div key={i} className="h-12 bg-muted rounded animate-pulse"></div>
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
            <Button variant="outline" size="sm" onClick={() => setRetryCount(c => c + 1)} className="ml-auto">
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
