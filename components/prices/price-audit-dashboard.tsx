'use client'

import { useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { formatKSh } from '@/lib/currency'

function formatAnomalyType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

interface PriceAnomaly {
  id: string
  product_id: string
  anomaly_type: string
  description: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  current_selling_price: number
  current_purchase_price: number
  suggested_selling_price?: number
  suggested_purchase_price?: number
  suggestion_reason?: string
  status: string
  created_at: string
  products: {
    id: string
    sku: string
    name: string
    category_id: string
    price_trust_level: string
    price_review_status: string
  }
}

const ITEMS_PER_PAGE = 10

export function PriceAuditDashboard() {
  const [anomalies, setAnomalies] = useState<PriceAnomaly[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [page, setPage] = useState(1)
  const [selectedAnomaly, setSelectedAnomaly] = useState<PriceAnomaly | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [actionType, setActionType] = useState<'approve' | 'correct' | 'protect'>('approve')
  const [correctedSellingPrice, setCorrectedSellingPrice] = useState<number | null>(null)
  const [correctedCostPrice, setCorrectedCostPrice] = useState<number | null>(null)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    async function fetchAnomalies() {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch('/api/prices/review')
        if (!response.ok) throw new Error('Failed to fetch anomalies')

        const data = await response.json()
        setAnomalies(data.anomalies || [])
        setPage(1)
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        setError(message)
        toast({
          title: 'Error',
          description: message,
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    }

    fetchAnomalies()
  }, [retryCount, toast])

  function handleAction(anomaly: PriceAnomaly, type: 'approve' | 'correct' | 'protect') {
    setSelectedAnomaly(anomaly)
    setActionType(type)
    setCorrectedSellingPrice(anomaly.suggested_selling_price ?? null)
    setCorrectedCostPrice(anomaly.suggested_purchase_price ?? null)
    setReason(anomaly.suggestion_reason || '')
    setDialogOpen(true)
  }

  async function submitAction() {
    if (!selectedAnomaly) return

    try {
      setSubmitting(true)
      const response = await fetch('/api/prices/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionType,
          productId: selectedAnomaly.product_id,
          newSellingPrice: correctedSellingPrice,
          newPurchasePrice: correctedCostPrice,
          reason: reason || undefined,
          protectionLevel: 'high',
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Action failed')
      }

      toast({
        title: 'Success',
        description: `Price ${actionType}d successfully`,
      })

      setDialogOpen(false)
      setRetryCount((c) => c + 1)
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div role="region" aria-label="Loading price audit data" className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-10 w-full rounded-lg" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div role="region" aria-label="Error loading price audit data" className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <p className="text-sm text-destructive font-medium">{error}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setRetryCount((c) => c + 1)}>
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        </div>
        <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
        <p className="text-center text-sm text-muted-foreground">Could not load price audit data</p>
      </div>
    )
  }

  if (anomalies.length === 0) {
    return (
      <div role="region" aria-label="No anomalies detected" className="p-8 text-center">
        <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
        <p className="text-lg font-semibold">All prices approved ✓</p>
        <p className="text-gray-500 mt-2">No anomalies detected</p>
      </div>
    )
  }

  const criticalCount = anomalies.filter((a) => a.severity === 'critical').length
  const highCount = anomalies.filter((a) => a.severity === 'high').length
  const mediumCount = anomalies.filter((a) => a.severity === 'medium').length
  const totalPages = Math.max(1, Math.ceil(anomalies.length / ITEMS_PER_PAGE))
  const paginatedAnomalies = anomalies.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div role="region" aria-label="Price anomaly summary" className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        <div className="p-4 border rounded-lg">
          <p className="text-sm text-gray-500">Total Anomalies</p>
          <p className="text-2xl font-bold">{anomalies.length}</p>
        </div>
        <div className="p-4 border rounded-lg border-red-200 bg-red-50">
          <p className="text-sm text-red-700">Critical</p>
          <p className="text-2xl font-bold text-red-700">{criticalCount}</p>
        </div>
        <div className="p-4 border rounded-lg border-orange-200 bg-orange-50">
          <p className="text-sm text-orange-700">High</p>
          <p className="text-2xl font-bold text-orange-700">{highCount}</p>
        </div>
        <div className="p-4 border rounded-lg border-yellow-200 bg-yellow-50">
          <p className="text-sm text-yellow-700">Medium</p>
          <p className="text-2xl font-bold text-yellow-700">{mediumCount}</p>
        </div>
      </div>

      {/* Anomalies Table */}
      <div className="border rounded-lg">
        <Table aria-label="Price anomalies requiring review">
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Product</TableHead>
              <TableHead>Anomaly Type</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Current Price</TableHead>
              <TableHead>Suggested</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedAnomalies.map((anomaly) => (
              <TableRow key={anomaly.id} className="hover:bg-gray-50">
                <TableCell>
                  <div>
                    <p className="font-semibold">{anomaly.products.name}</p>
                    <p className="text-xs text-gray-500">{anomaly.products.sku}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    <p className="font-medium">{formatAnomalyType(anomaly.anomaly_type)}</p>
                    <p className="text-xs text-gray-500 max-w-xs">{anomaly.description}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      anomaly.severity === 'critical'
                        ? 'destructive'
                        : anomaly.severity === 'high'
                          ? 'secondary'
                          : anomaly.severity === 'medium'
                            ? 'default'
                            : 'outline'
                    }
                  >
                    {anomaly.severity}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    <p>
                      Sell: <span className="font-semibold">{formatKSh(anomaly.current_selling_price)}</span>
                    </p>
                    <p>
                      Cost: <span className="font-semibold">{formatKSh(anomaly.current_purchase_price)}</span>
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {anomaly.suggested_selling_price ? (
                      <>
                        <p>
                          Sell: <span className="text-green-600 font-semibold">{formatKSh(anomaly.suggested_selling_price)}</span>
                        </p>
                        {anomaly.suggested_purchase_price ? (
                          <p>
                            Cost: <span className="text-green-600 font-semibold">{formatKSh(anomaly.suggested_purchase_price)}</span>
                          </p>
                        ) : null}
                        <p className="text-xs text-gray-500 mt-1">{anomaly.suggestion_reason}</p>
                      </>
                    ) : (
                      <p className="text-gray-400">—</p>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction(anomaly, 'approve')}
                    className="text-green-600"
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction(anomaly, 'correct')}
                    className="text-blue-600"
                  >
                    Correct
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction(anomaly, 'protect')}
                    className="text-amber-600"
                  >
                    Protect
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {totalPages > 1 && (
          <div role="region" aria-label="Pagination" className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-sm text-muted-foreground">
              Showing {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, anomalies.length)} of{' '}
              {anomalies.length}
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
              >
                Previous
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <Button
                  key={p}
                  variant={p === page ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPage(p)}
                  aria-label={`Go to page ${p}`}
                >
                  {p}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Next page"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Review Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' && 'Approve Price'}
              {actionType === 'correct' && 'Correct Price'}
              {actionType === 'protect' && 'Protect Price'}
            </DialogTitle>
            <DialogDescription>
              {selectedAnomaly?.products.name} ({selectedAnomaly?.products.sku})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Current prices */}
            <div className="p-3 bg-gray-50 rounded-lg text-sm">
              <p className="font-semibold mb-2">Current Prices:</p>
              <p>
                Selling: <span className="font-mono">{formatKSh(selectedAnomaly?.current_selling_price ?? 0)}</span>
              </p>
              <p>
                Cost: <span className="font-mono">{formatKSh(selectedAnomaly?.current_purchase_price ?? 0)}</span>
              </p>
            </div>

            {/* Correction fields */}
            {actionType === 'correct' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="selling">New Selling Price (KSh)</Label>
                  <Input
                    id="selling"
                    type="number"
                    step="0.01"
                    value={correctedSellingPrice ?? ''}
                    onChange={(e) => setCorrectedSellingPrice(e.target.value === '' ? null : parseFloat(e.target.value))}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cost">New Cost Price (KSh)</Label>
                  <Input
                    id="cost"
                    type="number"
                    step="0.01"
                    value={correctedCostPrice ?? ''}
                    onChange={(e) => setCorrectedCostPrice(e.target.value === '' ? null : parseFloat(e.target.value))}
                    placeholder="0"
                  />
                </div>
              </>
            )}

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="reason">Notes / Reason</Label>
              <Input
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  actionType === 'approve'
                    ? 'Optional notes for approval'
                    : actionType === 'correct'
                      ? 'Reason for price correction'
                      : 'Reason to protect this price'
                }
              />
            </div>

            {/* Warning for critical anomalies */}
            {selectedAnomaly?.severity === 'critical' && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-700">
                  <p className="font-semibold">Critical Issue</p>
                  <p>
                    {selectedAnomaly.anomaly_type === 'COST_GT_SELLING'
                      ? 'This product loses money on every sale.'
                      : 'This price is unrealistic and must be corrected.'}
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitAction} disabled={submitting}>
              {submitting ? 'Saving...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
