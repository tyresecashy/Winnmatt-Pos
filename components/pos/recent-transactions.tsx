"use client"
import { logger } from '@/lib/logger';

import { useEffect, useRef, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { formatKSh } from "@/lib/currency"
import { getRecentTransactions } from "@/lib/dashboard-actions"
import { X, Receipt } from "lucide-react"

interface RecentTransactionsProps {
  onClose: () => void
}

interface RecentCashSale {
  id: string
  receiptNo: string
  customer: string
  items: number
  total: number
  paymentMethod: string
  timestamp: string
}

function formatRelativeTime(dateString: string) {
  const timestamp = new Date(dateString).getTime()
  const diffMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000))

  if (diffMinutes < 1) return "Just now"
  if (diffMinutes === 1) return "1 min ago"
  if (diffMinutes < 60) return `${diffMinutes} mins ago`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours === 1) return "1 hr ago"
  if (diffHours < 24) return `${diffHours} hrs ago`

  return new Date(dateString).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    timeZone: "Africa/Nairobi",
  })
}

export function RecentTransactions({ onClose }: RecentTransactionsProps) {
  const { profile } = useAuth()
  const [recentSales, setRecentSales] = useState<RecentCashSale[]>([])
  const [loading, setLoading] = useState(true)
  const recentSalesCountRef = useRef(0)
  const fetchPromiseRef = useRef<Promise<void> | null>(null)
  const lastFetchAtRef = useRef(0)

  useEffect(() => {
    recentSalesCountRef.current = recentSales.length
  }, [recentSales.length])

  useEffect(() => {
    let cancelled = false

    const fetchRecentCashSales = async (options?: { minIntervalMs?: number; force?: boolean }) => {
      const branchId = profile?.branch_id
      if (!branchId) {
        if (!cancelled) {
          setRecentSales([])
          setLoading(false)
        }
        return
      }

      const minIntervalMs = options?.minIntervalMs ?? 0
      const now = Date.now()
      if (!options?.force && fetchPromiseRef.current) {
        return fetchPromiseRef.current
      }

      if (!options?.force && now - lastFetchAtRef.current < minIntervalMs) {
        return
      }

      const fetchPromise = (async () => {
        try {
          if (!cancelled && recentSalesCountRef.current === 0) {
            setLoading(true)
          }

          const transactions = await getRecentTransactions(branchId, 20)
          const cashSales = transactions
            .filter((sale) => sale.paymentMethod === "Cash")
            .slice(0, 8)

          if (!cancelled) {
            setRecentSales(cashSales)
            lastFetchAtRef.current = Date.now()
          }
        } catch (error) {
          logger.error("Failed to load recent cash sales:", error)
          if (!cancelled) {
            setRecentSales([])
          }
        } finally {
          if (!cancelled) {
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

    void fetchRecentCashSales()

    const intervalId = window.setInterval(() => {
      void fetchRecentCashSales({ minIntervalMs: 10000 })
    }, 30000)

    const handleFocus = () => {
      void fetchRecentCashSales({ minIntervalMs: 10000 })
    }

    const handleSaleCompleted = () => {
      void fetchRecentCashSales({ force: true })
    }

    window.addEventListener("focus", handleFocus)
    window.addEventListener("pos:sale-completed", handleSaleCompleted)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      window.removeEventListener("focus", handleFocus)
      window.removeEventListener("pos:sale-completed", handleSaleCompleted)
    }
  }, [profile?.branch_id])

  return (
    <div className="w-[320px] flex flex-col bg-card border-l">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Recent Cash Sales</span>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {loading ? (
            <div className="p-4 text-sm text-center text-muted-foreground">
              Loading recent cash sales...
            </div>
          ) : recentSales.length === 0 ? (
            <div className="p-4 text-sm text-center text-muted-foreground">
              No recent cash sales to show.
            </div>
          ) : recentSales.map((sale) => (
            <div
              key={sale.id}
              className="p-3 rounded-lg border bg-background"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-mono font-medium">{sale.receiptNo}</p>
                  <p className="text-xs text-muted-foreground">{formatRelativeTime(sale.timestamp)}</p>
                </div>
                <Badge variant="secondary" className="bg-primary/10 text-primary">
                  Cash
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm">{sale.customer}</p>
                  <p className="text-xs text-muted-foreground">{sale.items} items</p>
                </div>
                <p className="font-bold text-primary">{formatKSh(sale.total)}</p>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="p-3 border-t bg-muted/30">
        <p className="text-sm text-center text-muted-foreground">
          Showing up to 8 recent cash sales
        </p>
      </div>
    </div>
  )
}
