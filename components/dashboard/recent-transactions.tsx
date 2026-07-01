"use client"

import { useEffect, useRef, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AlertCircle, RefreshCw } from "lucide-react"
import { getRecentTransactions } from "@/lib/dashboard-actions"
import { formatKSh } from "@/lib/currency"

interface Transaction {
  id: string
  receiptNo: string
  customer: string
  items: number
  total: number
  paymentMethod: string
  timestamp: string
}

const paymentMethodColors: Record<string, string> = {
  "Cash": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  "M-Pesa": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  "Paybill": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  "Credit": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  "Card": "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  "Bank Transfer": "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  "Cheque": "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400",
}

export function RecentTransactions() {
  const { profile } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const fetchPromiseRef = useRef<Promise<void> | null>(null)
  const lastFetchAtRef = useRef(0)
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    const fetchTransactions = async (options?: { force?: boolean; minIntervalMs?: number }) => {
      const branchId = profile?.branch_id
      if (!branchId) {
        if (!cancelled) {
          setTransactions([])
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
          const data = await getRecentTransactions(branchId, 5)
          if (!cancelled) {
            setError(null)
            setTransactions(data)
            hasLoadedRef.current = true
            lastFetchAtRef.current = Date.now()
          }
        } catch (error) {
          console.error('Error fetching recent transactions:', error)
          if (!cancelled) setError('Failed to load recent transactions')
          if (!cancelled && !hasLoadedRef.current) {
            setTransactions([])
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

    void fetchTransactions({ force: true })

    let intervalId: number | null = null

    function startPolling() {
      stopPolling()
      intervalId = window.setInterval(() => {
        void fetchTransactions({ minIntervalMs: 15000 })
      }, 30000)
    }

    function stopPolling() {
      if (intervalId !== null) {
        window.clearInterval(intervalId)
        intervalId = null
      }
    }

    startPolling()

    const handleFocus = () => {
      void fetchTransactions({ minIntervalMs: 15000 })
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling()
      } else {
        startPolling()
        void fetchTransactions({ force: true })
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      cancelled = true
      stopPolling()
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [profile?.branch_id, retryCount])

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-KE', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Africa/Nairobi',
    })
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>Latest sales</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between py-2 animate-pulse">
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-muted rounded w-24"></div>
                  <div className="h-3 bg-muted rounded w-16"></div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-6 bg-muted rounded w-16"></div>
                  <div className="h-4 bg-muted rounded w-20"></div>
                </div>
              </div>
            ))}
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Transactions</CardTitle>
        <CardDescription>Latest sales</CardDescription>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No transactions yet</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Receipt</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell className="font-mono text-xs">
                    {sale.receiptNo}
                  </TableCell>
                  <TableCell>
                    <p className="text-sm font-medium">{sale.customer}</p>
                  </TableCell>
                  <TableCell>{sale.items}</TableCell>
                  <TableCell>
                    <Badge 
                      variant="secondary" 
                      className={paymentMethodColors[sale.paymentMethod] || ""}
                    >
                      {sale.paymentMethod}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatKSh(sale.total)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatTime(sale.timestamp)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
