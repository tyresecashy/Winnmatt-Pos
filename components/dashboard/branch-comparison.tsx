'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { AlertCircle, MapPin, RefreshCw, TrendingUp } from 'lucide-react'
import { getBranchPerformanceToday } from '@/lib/dashboard-actions'
import { formatKSh } from '@/lib/currency'

interface BranchData {
  id: string
  name: string
  sales: number
  transactions: number
  percentage: number
}

export function BranchComparison() {
  const { profile } = useAuth()
  const [branches, setBranches] = useState<BranchData[]>([])
  const [totalSales, setTotalSales] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const fetchPromiseRef = useRef<Promise<void> | null>(null)
  const lastFetchAtRef = useRef(0)
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    async function loadBranchData(options?: { force?: boolean; minIntervalMs?: number }) {
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
          const branchData = await getBranchPerformanceToday()
          if (!cancelled) {
            setError(null)
            setBranches(branchData)
            setTotalSales(branchData.reduce((sum, branch) => sum + branch.sales, 0))
            hasLoadedRef.current = true
            lastFetchAtRef.current = Date.now()
          }
        } catch (error) {
          console.error('Error loading branch data:', error)
          if (!cancelled) setError('Failed to load branch data')
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

    void loadBranchData({ force: true })

    const intervalId = window.setInterval(() => {
      void loadBranchData({ minIntervalMs: 30000 })
    }, 60000)

    const handleFocus = () => {
      void loadBranchData({ minIntervalMs: 15000 })
    }

    window.addEventListener('focus', handleFocus)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      window.removeEventListener('focus', handleFocus)
    }
  }, [profile?.branch_id, retryCount])

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
              <div key={i} className="space-y-2 animate-pulse">
                <div className="h-4 bg-muted rounded w-1/2"></div>
                <div className="h-2 bg-muted rounded w-full"></div>
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
          <p className="text-muted-foreground text-sm">No branch data</p>
        )}
        {error && (
          <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
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
