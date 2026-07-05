'use client'
import { logger } from '@/lib/logger';

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { chartAnimations } from '@/lib/motion'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { getPaymentBreakdownToday } from '@/lib/dashboard-actions'
import { formatKSh } from '@/lib/currency'

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))']

interface PaymentMethod {
  name: string
  value: number
}

export function PaymentBreakdown() {
  const { profile } = useAuth()
  const [paymentData, setPaymentData] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const fetchPromiseRef = useRef<Promise<void> | null>(null)
  const lastFetchAtRef = useRef(0)
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    async function loadPaymentData(options?: { force?: boolean; minIntervalMs?: number }) {
      const branchId = profile?.branch_id
      if (!branchId) {
        if (!cancelled) {
          setPaymentData([])
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
          const data = await getPaymentBreakdownToday(branchId)
          if (!cancelled) {
            setError(null)
            setPaymentData(data)
            hasLoadedRef.current = true
            lastFetchAtRef.current = Date.now()
          }
        } catch (error) {
          logger.error('Error loading payment data:', error)
          if (!cancelled) setError('Failed to load payment data')
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

    void loadPaymentData({ force: true })

    const intervalId = window.setInterval(() => {
      void loadPaymentData({ minIntervalMs: 30000 })
    }, 60000)

    const handleFocus = () => {
      void loadPaymentData({ minIntervalMs: 15000 })
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
        <CardTitle>Payment Methods</CardTitle>
        <CardDescription>Today&apos;s payment distribution</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="w-full chart-height-sm">
          {loading ? (
            <div className="flex items-center justify-center w-full h-full">
              <div className="space-y-3 w-full px-4">
                <Skeleton className="h-[140px] w-[140px] rounded-full mx-auto" />
                <div className="grid grid-cols-2 gap-2 pt-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Skeleton className="h-3 w-3 rounded-full" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : paymentData.length === 0 ? (
            <div className="flex items-center justify-center w-full h-full text-muted-foreground">
              No payment data
            </div>
          ) : (
            <motion.div
              variants={chartAnimations.pie}
              initial="initial"
              animate="animate"
            >
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={paymentData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {paymentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload as PaymentMethod
                        return (
                          <div className="rounded-lg border bg-background p-3 shadow-md">
                            <p className="text-sm font-medium">{data.name}</p>
                            <p className="text-sm text-muted-foreground">{formatKSh(data.value)}</p>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </motion.div>
          )}
        </div>
        {paymentData.length > 0 && (
          <motion.div
            className="grid grid-cols-2 gap-2 pt-4"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.05, delayChildren: 0.15 },
              },
            }}
          >
            {paymentData.map((method, index) => (
              <motion.div
                key={method.name}
                className="flex items-center gap-2"
                variants={{
                  hidden: { opacity: 0, y: 8 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
                  },
                }}
              >
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <div>
                  <p className="text-xs font-medium">{method.name}</p>
                  <p className="text-xs text-muted-foreground">{formatKSh(method.value)}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
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
