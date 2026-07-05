'use client'
import { logger } from '@/lib/logger';

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TrendingUp, ShoppingCart, Users, Package, RefreshCw, AlertCircle } from 'lucide-react'
import { getTodayDashboardStats } from '@/lib/dashboard-actions'
import { formatKSh } from '@/lib/currency'
import { AnimatedCounter } from '@/components/ui/animated-counter'

interface DashboardStatsData {
  totalSales: number
  transactionCount: number
  averageBasket: number
  activeCustomers: number
}

export function DashboardStats() {
  const { profile } = useAuth()
  const [stats, setStats] = useState<DashboardStatsData>({
    totalSales: 0,
    transactionCount: 0,
    averageBasket: 0,
    activeCustomers: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const fetchPromiseRef = useRef<Promise<void> | null>(null)
  const lastFetchAtRef = useRef(0)
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    async function loadStats(options?: { force?: boolean; minIntervalMs?: number }) {
      const branchId = profile?.branch_id
      if (!branchId) {
        if (!cancelled) {
          setStats({
            totalSales: 0,
            transactionCount: 0,
            averageBasket: 0,
            activeCustomers: 0,
          })
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
          const data = await getTodayDashboardStats(branchId)
          if (!cancelled) {
            setStats(data)
            setError(null)
            hasLoadedRef.current = true
            lastFetchAtRef.current = Date.now()
          }
        } catch (error) {
          if (!cancelled) {
            setError('Failed to load dashboard stats. The server may be unavailable.')
            logger.error('Error loading dashboard stats:', error)
          }
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

    void loadStats({ force: true })

    const intervalId = window.setInterval(() => {
      void loadStats({ minIntervalMs: 30000 })
    }, 60000)

    const handleFocus = () => {
      void loadStats({ minIntervalMs: 15000 })
    }

    window.addEventListener('focus', handleFocus)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      window.removeEventListener('focus', handleFocus)
    }
  }, [profile?.branch_id, retryCount])

  const dashboardStats = [
    {
      title: "Today's Sales",
      rawValue: stats.totalSales,
      icon: TrendingUp,
      description: 'total revenue',
      isCurrency: true,
    },
    {
      title: 'Transactions',
      rawValue: stats.transactionCount,
      icon: ShoppingCart,
      description: 'completed sales',
      isCurrency: false,
    },
    {
      title: 'Avg. Basket Size',
      rawValue: stats.averageBasket,
      icon: Package,
      description: 'per transaction',
      isCurrency: true,
    },
    {
      title: 'Active Customers',
      rawValue: stats.activeCustomers,
      icon: Users,
      description: 'today',
      isCurrency: false,
    },
  ]

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {dashboardStats.map((stat) => (
          <Card key={stat.title} className="overflow-hidden card-hover">
            <CardContent className="p-6">
              <div className="space-y-2 animate-pulse">
                <div className="h-4 bg-muted rounded w-1/2"></div>
                <div className="h-8 bg-muted rounded w-3/4"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {dashboardStats.map((stat) => (
          <Card key={stat.title} className="overflow-hidden card-hover border-destructive/30">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </p>
                  <p className="text-2xl font-bold tracking-tight text-destructive/60">--</p>
                  <p className="text-xs text-destructive/60">unavailable</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                  <stat.icon className="h-5 w-5 text-destructive/60" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        <div className="col-span-full flex items-center justify-center gap-2 p-2">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRetryCount((c) => c + 1)}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {dashboardStats.map((stat) => (
        <Card key={stat.title} className="overflow-hidden card-hover">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </p>
                <p className="text-2xl font-bold tracking-tight">
                  {stat.isCurrency ? (
                    <><span className="text-sm font-medium text-muted-foreground mr-0.5">KSh</span><AnimatedCounter value={Math.round(stat.rawValue)} /></>
                  ) : (
                    <AnimatedCounter value={stat.rawValue} />
                  )}
                </p>
                <p className="text-xs text-muted-foreground">{stat.description}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <stat.icon className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
