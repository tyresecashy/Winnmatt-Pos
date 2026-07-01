'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { getSales } from '@/lib/sales-actions'
import { SalesHistoryClient } from './client'
import { formatKSh } from '@/lib/currency'

export default function SalesHistoryPage() {
  const { profile } = useAuth()
  const [sales, setSales] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const fetchPromiseRef = useRef<Promise<void> | null>(null)
  const lastFetchAtRef = useRef(0)
  const hasSalesRef = useRef(false)

  useEffect(() => {
    hasSalesRef.current = sales.length > 0
  }, [sales.length])

  const loadSales = useCallback(async (options?: { force?: boolean; minIntervalMs?: number }) => {
    const branchId = profile?.branch_id
    if (!branchId) {
      setSales([])
      setLoading(false)
      return
    }

    const now = Date.now()
    if (!options?.force && fetchPromiseRef.current) {
      return fetchPromiseRef.current
    }

    if (!options?.force && now - lastFetchAtRef.current < (options?.minIntervalMs ?? 0)) {
      return
    }

    const shouldShowLoading = !hasSalesRef.current
    if (shouldShowLoading) {
      setLoading(true)
    }

    const fetchPromise = (async () => {
      try {
        const fetchedSales = await getSales(branchId, 50)
        setSales(fetchedSales)
        lastFetchAtRef.current = Date.now()
      } catch (error) {
        console.error('Failed to load sales:', error)
        if (!hasSalesRef.current) {
          setSales([])
        }
      } finally {
        if (shouldShowLoading) {
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
  }, [profile?.branch_id])

  useEffect(() => {
    const timer = setTimeout(() => void loadSales({ force: true }))

    const intervalId = window.setInterval(() => {
      void loadSales({ minIntervalMs: 30000 })
    }, 60000)

    const handleFocus = () => {
      void loadSales({ minIntervalMs: 15000 })
    }

    window.addEventListener('focus', handleFocus)

    return () => {
      clearTimeout(timer)
      window.clearInterval(intervalId)
      window.removeEventListener('focus', handleFocus)
    }
  }, [loadSales])

  const { totalSales, totalTransactions, averageTransaction } = useMemo(() => {
    const total = sales.reduce((sum, sale) => sum + sale.total_amount, 0)
    const count = sales.length

    return {
      totalSales: total,
      totalTransactions: count,
      averageTransaction: count > 0 ? Math.round(total / count) : 0,
    }
  }, [sales])

  const paymentMethods = useMemo(
    () => Array.from(new Set(sales.map((sale) => sale.payment_method).filter(Boolean))),
    [sales]
  )

  const branches = useMemo(() => {
    const branchesById = new Map<string, { id: string; name: string }>()

    for (const sale of sales) {
      if (!sale.branch_id || branchesById.has(sale.branch_id)) {
        continue
      }

      branchesById.set(sale.branch_id, {
        id: sale.branch_id,
        name: sale.branch?.name || 'Unknown Branch',
      })
    }

    return Array.from(branchesById.values())
  }, [sales])

  const formattedSales = useMemo(() => {
    return sales.map((sale) => ({
      id: sale.id,
      receipt_number: sale.receipt_number,
      customer_name: sale.customer?.name || 'Walk-in',
      customer_phone: sale.customer?.phone || '',
      branch_name: sale.branch?.name || 'Unknown',
      branch_code: sale.branch?.code || '',
      branch_id: sale.branch_id,
      payment_method: sale.payment_method,
      total_amount: sale.total_amount,
      cashier_name: sale.cashier?.full_name || 'Unknown',
      created_at: sale.created_at,
      subtitle: sale.subtotal,
      tax_amount: sale.tax_amount,
      discount_amount: sale.discount_amount,
      payment_status: sale.payment_status,
      sale_status: sale.sale_status || (sale.payment_status === 'failed' ? 'voided' : 'completed'),
      void_reason: sale.void_reason,
      voided_by: sale.voided_by,
      voided_at: sale.voided_at,
      notes: sale.notes,
    }))
  }, [sales])

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-56 mt-2" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-[150px]" />
            <Skeleton className="h-10 w-[130px]" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-32 mt-2" />
              </CardHeader>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-0">
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!profile) {
    return <div className="p-6">Please log in to view sales history</div>
  }

  return (
    <SalesHistoryClient
      initialSales={formattedSales}
      totalSales={formatKSh(totalSales)}
      totalTransactions={totalTransactions}
      averageTransaction={formatKSh(averageTransaction)}
      branches={branches}
      paymentMethods={paymentMethods}
      currentUserId={profile.id}
      currentBranchId={profile.branch_id ?? ''}
      userRole={profile.role}
    />
  )
}
