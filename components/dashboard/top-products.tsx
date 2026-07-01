'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { getTopProductsToday } from '@/lib/dashboard-actions'
import { formatKSh } from '@/lib/currency'

interface TopProduct {
  product: string
  unitsSold: number
  revenue: number
}

export function TopProducts() {
  const { profile } = useAuth()
  const [products, setProducts] = useState<TopProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const fetchPromiseRef = useRef<Promise<void> | null>(null)
  const lastFetchAtRef = useRef(0)
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    async function loadProducts(options?: { force?: boolean; minIntervalMs?: number }) {
      const branchId = profile?.branch_id
      if (!branchId) {
        if (!cancelled) {
          setProducts([])
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
          const topProds = await getTopProductsToday(branchId, 5)
          if (!cancelled) {
            setError(null)
            setProducts(topProds)
            hasLoadedRef.current = true
            lastFetchAtRef.current = Date.now()
          }
        } catch (error) {
          console.error('Error loading top products:', error)
          if (!cancelled) setError('Failed to load top products')
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

    void loadProducts({ force: true })

    const intervalId = window.setInterval(() => {
      void loadProducts({ minIntervalMs: 30000 })
    }, 60000)

    const handleFocus = () => {
      void loadProducts({ minIntervalMs: 15000 })
    }

    window.addEventListener('focus', handleFocus)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      window.removeEventListener('focus', handleFocus)
    }
  }, [profile?.branch_id, retryCount])

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
                <div key={i} className="h-12 bg-muted rounded animate-pulse"></div>
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
            <p className="text-muted-foreground text-sm">No sales data</p>
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
