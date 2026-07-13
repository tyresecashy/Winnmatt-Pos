"use client"

import { useCallback } from "react"
import { useDashboardQuery } from '@/hooks/use-dashboard-query'
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
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle, RefreshCw } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
import { getRecentTransactions } from "@/lib/modules/dashboard"
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
  const branchId = profile?.branch_id

  const fetcher = useCallback(
    () => branchId ? getRecentTransactions(branchId, 5) : Promise.resolve([]),
    [branchId]
  )

  const { data: transactions, loading, error, retry } = useDashboardQuery<Transaction[]>(
    fetcher,
    [],
    { deps: [branchId], pollIntervalMs: 30000, minIntervalMs: 15000 }
  )

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-KE', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Africa/Nairobi',
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Transactions</CardTitle>
        <CardDescription>Latest sales</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between py-2">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <div className="flex items-center gap-4">
                  <Skeleton className="h-6 w-16 rounded-md" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <EmptyState title="No transactions yet" compact />
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
