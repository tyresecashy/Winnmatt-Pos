'use client'
import { logger } from '@/lib/logger'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/components/ui/use-toast'
import { formatKSh } from '@/lib/currency'
import { getSales, returnSale, getSaleById, type SaleItem } from '@/lib/sales-actions'
import { Search, RotateCcw, ArrowLeft, Package, Store, User, Calendar, FileText } from 'lucide-react'

// Extended sale type with items and customer info
interface SaleRecord {
  id: string
  receipt_number: string
  total_amount: number
  payment_method: string
  sale_status: string | null
  return_reason: string | null
  returned_at: string | null
  returned_amount: number | null
  created_at: string
  customer_id: string | null
  cashier_id: string
  branch_id: string
  customer?: { id: string; name: string; phone: string } | null
  items?: SaleItem[]
  returned_qty?: number | null
}

export default function ReturnsPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [sales, setSales] = useState<SaleRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null)
  const [saleDetail, setSaleDetail] = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [showReturnDialog, setShowReturnDialog] = useState(false)
  const [returnReason, setReturnReason] = useState('')
  const [returnOption, setReturnOption] = useState<'full' | 'partial'>('full')
  const [partialReturnItems, setPartialReturnItems] = useState<Record<string, boolean>>({})
  const [processingReturn, setProcessingReturn] = useState(false)

  const loadSales = useCallback(async () => {
    const branchId = profile?.branch_id
    if (!branchId) {
      setSales([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const fetchedSales = await getSales(branchId, 100)
      setSales(fetchedSales as SaleRecord[])
    } catch (error) {
      logger.error('Failed to load sales:', error)
    } finally {
      setLoading(false)
    }
  }, [profile?.branch_id])

  useEffect(() => {
    void loadSales()
  }, [loadSales])

  // Compute summary KPIs
  const returnedSales = sales.filter(s => s.sale_status === 'returned')
  const totalRefundedCents = returnedSales.reduce((sum, s) => sum + Number(s.returned_amount || s.total_amount || 0), 0)
  const completedCount = sales.filter(s => s.sale_status !== 'returned' && s.sale_status !== 'voided').length
  const returnRate = completedCount > 0 ? Math.round((returnedSales.length / (completedCount + returnedSales.length)) * 100) : 0
  const todayReturns = returnedSales.filter(s => {
    if (!s.returned_at) return false
    return new Date(s.returned_at).toDateString() === new Date().toDateString()
  })

  // Apply filters
  const statusFiltered = statusFilter === 'all' ? sales
    : statusFilter === 'returned' ? sales.filter(s => s.sale_status === 'returned')
    : statusFilter === 'voided' ? sales.filter(s => s.sale_status === 'voided')
    : sales.filter(s => s.sale_status !== 'returned' && s.sale_status !== 'voided')

  const filteredSales = searchQuery
    ? statusFiltered.filter(
        (s) =>
          s.receipt_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.customer?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.customer?.phone?.includes(searchQuery)
      )
    : statusFiltered

  const handleViewSale = async (sale: SaleRecord) => {
    setSelectedSale(sale)
    setDetailLoading(true)
    try {
      const detail = await getSaleById(sale.id)
      setSaleDetail(detail)
    } catch (error) {
      logger.error('Failed to load sale detail:', error)
    } finally {
      setDetailLoading(false)
    }
  }

  const isEligibleForReturn = (sale: SaleRecord) => {
    return (
      sale.sale_status !== 'voided' &&
      sale.sale_status !== 'returned' &&
      sale.payment_method !== 'credit'
    )
  }

  const handleStartReturn = (sale: SaleRecord) => {
    setSelectedSale(sale)
    setReturnReason('')
    setReturnOption('full')
    setShowReturnDialog(true)
  }

  const handleProcessReturn = async () => {
    if (!selectedSale || !returnReason.trim() || !profile?.id || !profile?.branch_id) {
      toast({ title: 'Error', description: 'Please provide a return reason', variant: 'destructive' })
      return
    }

    setProcessingReturn(true)
    try {
      const result = await returnSale(
        selectedSale.id,
        profile.branch_id,
        returnReason.trim(),
        profile.id
      )

      if (result.success) {
        toast({ title: 'Return Processed', description: result.message })
        setShowReturnDialog(false)
        setSelectedSale(null)
        setSaleDetail(null)
        void loadSales()
      } else {
        toast({ title: 'Return Failed', description: result.error || 'Unknown error', variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Error', description: 'An unexpected error occurred', variant: 'destructive' })
    } finally {
      setProcessingReturn(false)
    }
  }

  const canReturn = selectedSale && isEligibleForReturn(selectedSale)

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Returns &amp; Refunds</h1>
          <p className="text-sm text-muted-foreground">Process customer returns and issue refunds</p>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Total Returned (All Time)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{returnedSales.length}</p>
            <p className="text-xs text-muted-foreground">{formatKSh(totalRefundedCents)} refunded</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Return Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${returnRate > 10 ? 'text-red-600' : returnRate > 5 ? 'text-amber-600' : 'text-green-600'}`}>
              {returnRate}%
            </p>
            <p className="text-xs text-muted-foreground">of {completedCount + returnedSales.length} total sales</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Today&apos;s Returns</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{todayReturns.length}</p>
            <p className="text-xs text-muted-foreground">
              {formatKSh(todayReturns.reduce((s, r) => s + Number(r.returned_amount || r.total_amount || 0), 0))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Eligible for Return</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">
              {sales.filter(s => isEligibleForReturn(s)).length}
            </p>
            <p className="text-xs text-muted-foreground">completed, not yet returned</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by receipt, customer, or phone..."
            className="pl-9 max-w-md"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Tabs value={statusFilter} onValueChange={setStatusFilter} className="ml-auto">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="returned">Returned</TabsTrigger>
            <TabsTrigger value="voided">Voided</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Sales List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Completed Sales</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : filteredSales.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {searchQuery ? 'No matching sales found' : 'No sales yet'}
                </p>
              ) : (
                <ScrollArea className="h-[600px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Receipt</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSales.map((sale) => (
                        <TableRow
                          key={sale.id}
                          className={`cursor-pointer ${
                            selectedSale?.id === sale.id ? 'bg-muted/50' : ''
                          }`}
                          onClick={() => handleViewSale(sale)}
                        >
                          <TableCell className="font-medium">
                            {sale.receipt_number}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(sale.created_at).toLocaleDateString('en-KE', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </TableCell>
                          <TableCell>
                            {sale.customer?.name ? (
                              <div className="flex items-center gap-1.5">
                                <User className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-sm">{sale.customer.name}</span>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">Walk-in</span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {formatKSh(sale.total_amount)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                sale.sale_status === 'returned'
                                  ? 'secondary'
                                  : sale.sale_status === 'voided'
                                  ? 'destructive'
                                  : 'default'
                              }
                            >
                              {sale.sale_status === 'returned'
                                ? 'Returned'
                                : sale.sale_status === 'voided'
                                ? 'Voided'
                                : 'Completed'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {isEligibleForReturn(sale) && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleStartReturn(sale)
                                }}
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Return
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sale Detail Panel */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sale Details</CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedSale ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                  <Package className="mb-3 h-12 w-12 opacity-20" />
                  <p className="text-sm">Select a sale to view details</p>
                </div>
              ) : detailLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : saleDetail ? (
                <div className="space-y-4">
                  <div className="rounded-lg bg-muted p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Receipt</span>
                      <span className="font-mono text-sm">{saleDetail.receipt_number}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm font-medium">Date</span>
                      <span className="text-sm">
                        {new Date(saleDetail.created_at).toLocaleDateString('en-KE', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm font-medium">Branch</span>
                      <span className="text-sm">{saleDetail.branch?.name || '-'}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm font-medium">Cashier</span>
                      <span className="text-sm">{saleDetail.cashier?.full_name || '-'}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm font-medium">Customer</span>
                      <span className="text-sm">{saleDetail.customer?.name || 'Walk-in'}</span>
                    </div>
                  </div>

                  {/* Items */}
                  <div>
                    <h4 className="mb-2 text-sm font-medium">Items ({saleDetail.items?.length || 0})</h4>
                    <div className="space-y-2">
                      {(saleDetail.items || []).map((item: any) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between rounded-md border p-2.5"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {item.product?.name || 'Unknown Product'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {item.quantity} x {formatKSh(item.unit_price)}
                            </p>
                          </div>
                          <span className="ml-3 font-mono text-sm">
                            {formatKSh(item.line_total)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Totals */}
                  <div className="rounded-lg border p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span>Subtotal</span>
                      <span className="font-mono">{formatKSh(saleDetail.subtotal || saleDetail.total_amount)}</span>
                    </div>
                    {saleDetail.discount_amount > 0 && (
                      <div className="mt-1 flex items-center justify-between text-sm text-muted-foreground">
                        <span>Discount</span>
                        <span className="font-mono">-{formatKSh(saleDetail.discount_amount)}</span>
                      </div>
                    )}
                    <div className="mt-1 flex items-center justify-between text-sm font-medium">
                      <span>Total</span>
                      <span className="font-mono">{formatKSh(saleDetail.total_amount)}</span>
                    </div>
                    {saleDetail.returned_amount > 0 && (
                      <div className="mt-1 flex items-center justify-between text-sm text-destructive">
                        <span>Returned</span>
                        <span className="font-mono">-{formatKSh(saleDetail.returned_amount)}</span>
                      </div>
                    )}
                  </div>

                  {/* Return status */}
                  {saleDetail.sale_status === 'returned' && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950">
                      <div className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
                        <RotateCcw className="h-4 w-4" />
                        Returned
                      </div>
                      <p className="mt-1 text-amber-600 dark:text-amber-500">
                        {saleDetail.return_reason || 'No reason given'}
                      </p>
                      <p className="mt-0.5 text-xs text-amber-500">
                        {saleDetail.returned_at
                          ? new Date(saleDetail.returned_at).toLocaleDateString('en-KE', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : ''}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Could not load sale details
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Return Dialog */}
      <Dialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Return</DialogTitle>
            <DialogDescription>
              Return items for sale {selectedSale?.receipt_number}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Return type */}
            <div className="space-y-2">
              <Label>Return Type</Label>
              <Tabs
                value={returnOption}
                onValueChange={(v) => {
                  setReturnOption(v as 'full' | 'partial')
                  if (v === 'full') setPartialReturnItems({})
                }}
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="full">Full Return (All Items)</TabsTrigger>
                  <TabsTrigger value="partial">Partial Return</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Partial return — item selection */}
            {returnOption === 'partial' && saleDetail?.items && (
              <div className="space-y-2">
                <Label className="text-sm">Select Items to Return</Label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto rounded-lg border p-2">
                  {(saleDetail.items as any[]).map((item: any) => (
                    <label
                      key={item.id}
                      className="flex items-center gap-3 rounded-md p-2 hover:bg-muted/50 cursor-pointer text-sm"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        checked={!!partialReturnItems[item.id]}
                        onChange={(e) => {
                          setPartialReturnItems(prev => ({
                            ...prev,
                            [item.id]: e.target.checked,
                          }))
                        }}
                        disabled={processingReturn}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium">{item.product?.name || 'Unknown Product'}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantity} x {formatKSh(item.unit_price)} = {formatKSh(item.line_total)}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {item.quantity} avail
                      </span>
                    </label>
                  ))}
                  {saleDetail.items.length > 0 && (
                    <div className="flex items-center justify-between border-t pt-2 mt-1 text-xs text-muted-foreground">
                      <button
                        type="button"
                        className="hover:text-foreground"
                        onClick={() => {
                          const all: Record<string, boolean> = {}
                          ;(saleDetail.items as any[]).forEach((i: any) => { all[i.id] = true })
                          setPartialReturnItems(all)
                        }}
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        className="hover:text-foreground"
                        onClick={() => setPartialReturnItems({})}
                      >
                        Clear All
                      </button>
                      <span>
                        {Object.keys(partialReturnItems).length} of {saleDetail.items.length} selected
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sale summary */}
            {selectedSale && (
              <div className="rounded-lg bg-muted p-3">
                <div className="flex items-center justify-between text-sm">
                  <span>Sale Total</span>
                  <span className="font-mono font-medium">{formatKSh(selectedSale.total_amount)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-sm">
                  <span>Date</span>
                  <span>
                    {new Date(selectedSale.created_at).toLocaleDateString('en-KE', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                {selectedSale.customer?.name && (
                  <div className="mt-1 flex items-center justify-between text-sm">
                    <span>Customer</span>
                    <span>{selectedSale.customer.name}</span>
                  </div>
                )}
              </div>
            )}

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="return-reason">Return Reason *</Label>
              <Textarea
                id="return-reason"
                placeholder="e.g. Customer requested refund, defective product..."
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                rows={3}
              />
            </div>

            {/* Warning */}
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950">
              <p className="font-medium text-amber-700 dark:text-amber-400">
                What happens when you return:
              </p>
              <ul className="mt-1 list-disc pl-4 text-amber-600 dark:text-amber-500">
                <li>Inventory is restored for all returned items</li>
                <li>Loyalty points are reversed (if applicable)</li>
                <li>Payment is marked as returned</li>
                <li>This action cannot be undone</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReturnDialog(false)}>
              Cancel
            </Button>
            <Button
              disabled={!returnReason.trim() || processingReturn || !canReturn}
              onClick={handleProcessReturn}
              className="gap-1.5"
            >
              {processingReturn ? (
                <>Processing...</>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4" />
                  Process Return
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
