'use client'
import { logger } from '@/lib/logger';

import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Search, Receipt, Calendar, Download, Eye, AlertCircle, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatKSh } from '@/lib/currency'
import { formatTime, formatDate } from '@/lib/date-time'
import { serverVoidSale, serverGetSaleAuditTrail } from '@/lib/void-sale-actions'

interface Sale {
  id: string
  receipt_number: string
  customer_name: string
  customer_phone: string
  branch_name: string
  branch_code: string
  branch_id?: string
  payment_method: string
  total_amount: number
  cashier_name: string
  created_at: string
  subtitle: number
  tax_amount: number
  discount_amount: number
  payment_status: string
  sale_status?: string
  void_reason?: string | null
  voided_by?: string | null
  voided_at?: string | null
  notes: string | null
}

interface Branch {
  id: string
  name: string
}

interface SalesHistoryClientProps {
  initialSales: Sale[]
  totalSales: string
  totalTransactions: number
  averageTransaction: string
  branches: Branch[]
  paymentMethods: string[]
  currentUserId: string
  currentBranchId: string
  userRole: string
}

const paymentMethodMap: Record<string, string> = {
  'cash': 'Cash',
  'card': 'Card',
  'bank_transfer': 'Bank Transfer',
  'cheque': 'Cheque',
  'credit': 'Credit',
  'mpesa': 'M-Pesa',
  'paybill': 'Paybill',
}

const paymentMethodColors: Record<string, string> = {
  'cash': 'bg-green-100 text-green-700',
  'card': 'bg-blue-100 text-blue-700',
  'bank_transfer': 'bg-purple-100 text-purple-700',
  'cheque': 'bg-orange-100 text-orange-700',
  'credit': 'bg-yellow-100 text-yellow-700',
  'mpesa': 'bg-green-100 text-green-700',
  'paybill': 'bg-blue-100 text-blue-700',
}

const saleStatusColors: Record<string, string> = {
  'completed': 'bg-green-100 text-green-700',
  'voided': 'bg-red-100 text-red-700',
  'returned': 'bg-orange-100 text-orange-700',
  'failed': 'bg-red-100 text-red-700',
}

export function SalesHistoryClient({
  initialSales,
  totalSales,
  totalTransactions,
  averageTransaction,
  branches,
  paymentMethods,
  currentUserId,
  currentBranchId,
  userRole,
}: SalesHistoryClientProps) {
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState('')
  const [branchFilter, setBranchFilter] = useState<string>('all')
  const [paymentFilter, setPaymentFilter] = useState<string>('all')
  const [sales, setSales] = useState(initialSales)
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [showVoidDialog, setShowVoidDialog] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [isVoiding, setIsVoiding] = useState(false)
  const [auditTrail, setAuditTrail] = useState<any[]>([])
  const [showAuditTrail, setShowAuditTrail] = useState(false)
  const deferredSearchTerm = useDeferredValue(searchTerm)

  // Pagination
  const [pageSize, setPageSize] = useState(15)
  const [currentPage, setCurrentPage] = useState(1)

  // Reset to page 1 when filters change
  useEffect(() => {
    const timer = setTimeout(() => setCurrentPage(1))
    return () => clearTimeout(timer)
  }, [branchFilter, deferredSearchTerm, paymentFilter])

  const getNormalizedSaleStatus = (sale: Sale) =>
    sale.sale_status || (sale.payment_status === 'failed' ? 'voided' : 'completed')

  useEffect(() => {
    const timer = setTimeout(() => setSales(initialSales))
    return () => clearTimeout(timer)
  }, [initialSales])

  // Filter sales on client
  const filteredSales = useMemo(() => {
    const normalizedSearch = deferredSearchTerm.trim().toLowerCase()

    return sales.filter((sale) => {
      const matchesSearch =
        !normalizedSearch ||
        sale.receipt_number.toLowerCase().includes(normalizedSearch) ||
        sale.customer_name.toLowerCase().includes(normalizedSearch) ||
        sale.customer_phone.includes(deferredSearchTerm)

      const matchesBranch = branchFilter === 'all' || sale.branch_name === branchFilter

      const matchesPayment =
        paymentFilter === 'all' || sale.payment_method === paymentFilter

      return matchesSearch && matchesBranch && matchesPayment
    })
  }, [branchFilter, deferredSearchTerm, paymentFilter, sales])

  // Calculate stats for filtered results
  const filteredTotal = filteredSales.reduce((sum, s) => sum + s.total_amount, 0)
  const filteredCount = filteredSales.length
  const filteredAverage = filteredCount > 0 ? Math.round(filteredTotal / filteredCount) : 0

  // Paginate filtered results
  const totalPages = Math.max(1, Math.ceil(filteredSales.length / pageSize))
  const paginatedSales = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize
    return filteredSales.slice(startIdx, startIdx + pageSize)
  }, [filteredSales, currentPage, pageSize])

  const handleViewDetails = (sale: Sale) => {
    setSelectedSale(sale)
    setShowDetails(true)
    // Load audit trail for this sale
    loadAuditTrail(sale.id)
  }

  const loadAuditTrail = async (saleId: string) => {
    try {
      const trail = await serverGetSaleAuditTrail(saleId)
      setAuditTrail(trail || [])
    } catch (error) {
      logger.error('Failed to load audit trail:', error)
      setAuditTrail([])
    }
  }

  const handleVoidSale = async () => {
    if (!selectedSale) return
    if (!voidReason.trim()) {
      toast({
        title: 'Reason required',
        description: 'Please enter a reason for voiding this sale.',
        variant: 'destructive',
      })
      return
    }

    setIsVoiding(true)
    try {
      const result = await serverVoidSale(
        selectedSale.id,
        currentBranchId,
        voidReason,
        currentUserId
      )

      if (result.success) {
        const voidedAt = new Date().toISOString()
        setSales((currentSales) =>
          currentSales.map((sale) =>
            sale.id === selectedSale.id
              ? {
                  ...sale,
                  payment_status: 'failed',
                  sale_status: 'voided',
                  void_reason: voidReason,
                  voided_by: currentUserId,
                  voided_at: voidedAt,
                }
              : sale
          )
        )
        setSelectedSale((currentSale) =>
          currentSale && currentSale.id === selectedSale.id
            ? {
                ...currentSale,
                payment_status: 'failed',
                sale_status: 'voided',
                void_reason: voidReason,
                voided_by: currentUserId,
                voided_at: voidedAt,
              }
            : currentSale
        )
        setShowVoidDialog(false)
        setShowDetails(false)
        setVoidReason('')
        toast({
          title: 'Sale voided',
          description: result.message,
        })
      } else {
        toast({
          title: 'Void failed',
          description: result.error || 'Failed to void sale.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      logger.error('Error voiding sale:', error)
      toast({
        title: 'Void failed',
        description: 'An error occurred while voiding the sale.',
        variant: 'destructive',
      })
    } finally {
      setIsVoiding(false)
    }
  }

  const handleExport = () => {
    // Generate CSV
    const headers = [
      'Receipt No.',
      'Date',
      'Time',
      'Customer',
      'Phone',
      'Branch',
      'Payment Method',
      'Subtotal',
      'Tax',
      'Discount',
      'Total',
      'Cashier',
      'Status',
    ]

    const rows = filteredSales.map((sale) => [
      sale.receipt_number,
      formatDate(sale.created_at),
      formatTime(sale.created_at),
      sale.customer_name,
      sale.customer_phone || '-',
      sale.branch_name,
      paymentMethodMap[sale.payment_method] || sale.payment_method,
      sale.subtitle.toString(),
      sale.tax_amount.toString(),
      sale.discount_amount.toString(),
      sale.total_amount.toString(),
      sale.cashier_name,
      sale.payment_status,
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n')

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sales-history-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales History</h1>
          <p className="text-muted-foreground">
            View and search past transactions from the database
          </p>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Sales (Shown)</CardDescription>
            <CardTitle className="text-2xl">{formatKSh(filteredTotal)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Transactions</CardDescription>
            <CardTitle className="text-3xl">{filteredCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Average Transaction</CardDescription>
            <CardTitle className="text-2xl">{formatKSh(filteredAverage)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by receipt, customer, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Branch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.name}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Payment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                {paymentMethods.map((method) => (
                  <SelectItem key={method} value={method}>
                    {paymentMethodMap[method] || method}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredSales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                {sales.length === 0
                  ? <Receipt className="h-6 w-6 text-muted-foreground" />
                  : <Search className="h-6 w-6 text-muted-foreground" />
                }
              </div>
              <p className="text-lg font-medium">
                {sales.length === 0 ? 'No sales yet' : 'No sales match your filters'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {sales.length === 0
                  ? 'Sales will appear here once you start processing transactions.'
                  : 'Try different dates or search terms.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Receipt No.</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Cashier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedSales.length === 0 && filteredSales.length > 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-4 text-muted-foreground">
                      No sales on this page
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedSales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Receipt className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-sm">{sale.receipt_number}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{formatDate(sale.created_at)}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(sale.created_at)}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div>{sale.customer_name}</div>
                      {sale.customer_phone && (
                        <div className="text-xs text-muted-foreground">
                          {sale.customer_phone}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {sale.branch_name}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          paymentMethodColors[sale.payment_method] ||
                          ''
                        }
                      >
                        {paymentMethodMap[sale.payment_method] ||
                          sale.payment_method}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatKSh(sale.total_amount)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {sale.cashier_name}
                    </TableCell>
                    <TableCell>
                      <Badge className={saleStatusColors[getNormalizedSaleStatus(sale)] || 'bg-muted text-muted-foreground'}>
                        {getNormalizedSaleStatus(sale)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleViewDetails(sale)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )))}
              </TableBody>
            </Table>
          )}
          {filteredSales.length > 0 && (
            <div className="flex items-center justify-between px-2 pt-4">
              <div className="flex items-center gap-2">
                <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1) }}>
                  <SelectTrigger className="h-8 w-[70px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[15, 25, 50, 100].map((size) => (
                      <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Showing {Math.min((currentPage - 1) * pageSize + 1, filteredSales.length)}–
                  {Math.min(currentPage * pageSize, filteredSales.length)} of {filteredSales.length} sales
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sales Details Modal */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Sale Details</DialogTitle>
            <DialogDescription>
              Complete transaction information for {selectedSale?.receipt_number}
            </DialogDescription>
          </DialogHeader>

          {selectedSale && (
            <div className="space-y-4">
              {/* Header Info */}
              <div className="grid grid-cols-2 gap-4 pb-4 border-b">
                <div>
                  <p className="text-xs text-muted-foreground">Receipt Number</p>
                  <p className="font-mono font-semibold">
                    {selectedSale.receipt_number}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Date & Time</p>
                  <p className="font-medium">
                    {formatDate(selectedSale.created_at)} at{' '}
                    {formatTime(selectedSale.created_at)}
                  </p>
                </div>
              </div>

              {/* Customer & Cashier */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Customer</p>
                  <p className="font-medium">{selectedSale.customer_name}</p>
                  {selectedSale.customer_phone && (
                    <p className="text-sm text-muted-foreground">
                      {selectedSale.customer_phone}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cashier</p>
                  <p className="font-medium">{selectedSale.cashier_name}</p>
                </div>
              </div>

              {/* Branch & Payment */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Branch</p>
                  <p className="font-medium">{selectedSale.branch_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Payment Method</p>
                  <Badge
                    className={
                      paymentMethodColors[selectedSale.payment_method] || ''
                    }
                  >
                    {paymentMethodMap[selectedSale.payment_method] ||
                      selectedSale.payment_method}
                  </Badge>
                </div>
              </div>

              {/* Amounts */}
              <div className="bg-muted/30 p-4 rounded-lg space-y-2 border">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatKSh(selectedSale.subtitle)}</span>
                </div>
                {selectedSale.discount_amount > 0 && (
                  <div className="flex justify-between text-orange-600">
                    <span>Discount</span>
                    <span>-{formatKSh(selectedSale.discount_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax (16% VAT)</span>
                  <span>{formatKSh(selectedSale.tax_amount)}</span>
                </div>
                <div className="flex justify-between font-semibold text-lg border-t pt-2">
                  <span>Total</span>
                  <span>{formatKSh(selectedSale.total_amount)}</span>
                </div>
              </div>

              {/* Status & Notes */}
              <div>
                <p className="text-xs text-muted-foreground">Sale Status</p>
                <Badge 
                  variant="outline" 
                  className={saleStatusColors[getNormalizedSaleStatus(selectedSale)] || ''}
                >
                  {getNormalizedSaleStatus(selectedSale).toUpperCase()}
                </Badge>
              </div>

              {getNormalizedSaleStatus(selectedSale) === 'voided' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <p className="font-semibold text-red-700">This sale has been voided</p>
                  </div>
                  <p className="text-sm text-red-600"><strong>Reason:</strong> {selectedSale.void_reason}</p>
                  <p className="text-sm text-red-600"><strong>Voided at:</strong> {formatDate(selectedSale.voided_at || '')}</p>
                </div>
              )}

              <div>
                <p className="text-xs text-muted-foreground">Payment Status</p>
                <Badge variant="outline" className="capitalize">
                  {selectedSale.payment_status}
                </Badge>
              </div>

              {selectedSale.notes && (
                <div>
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p className="text-sm">{selectedSale.notes}</p>
                </div>
              )}

              {/* Audit Trail Button */}
              {auditTrail && auditTrail.length > 0 && (
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => setShowAuditTrail(true)}
                >
                  <AlertCircle className="h-4 w-4 mr-2" />
                  View Audit Trail ({auditTrail.length})
                </Button>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            {selectedSale && 
              getNormalizedSaleStatus(selectedSale) !== 'voided' && 
              ['manager', 'admin'].includes(userRole) && (
              <Button
                variant="destructive"
                onClick={() => setShowVoidDialog(true)}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Void Sale
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setShowDetails(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Void Sale Confirmation Dialog */}
      <Dialog open={showVoidDialog} onOpenChange={setShowVoidDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              Void Sale - Confirmation Required
            </DialogTitle>
            <DialogDescription>
              This action will reverse the sale, restore inventory, and record an audit trail.
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm font-semibold text-red-700 mb-2">Sale to void:</p>
              <p className="text-sm">{selectedSale?.receipt_number} - {formatKSh(selectedSale?.total_amount || 0)}</p>
            </div>

            <div>
              <label className="text-sm font-medium">Void Reason *</label>
              <Input
                placeholder="e.g., Wrong item scanned, Customer returned item, Incorrect payment..."
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Required: Explain why this sale is being voided
              </p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-700">
                ⚠️ <strong>Impact:</strong> Inventory will be restored, sale removed from reports
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowVoidDialog(false)
                setVoidReason('')
              }}
              disabled={isVoiding}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleVoidSale}
              disabled={isVoiding || !voidReason.trim()}
            >
              {isVoiding ? 'Voiding...' : 'Confirm Void'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Audit Trail Dialog */}
      <Dialog open={showAuditTrail} onOpenChange={setShowAuditTrail}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Audit Trail - {selectedSale?.receipt_number}</DialogTitle>
            <DialogDescription>
              Complete history of modifications to this sale
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {auditTrail.length === 0 ? (
              <p className="text-sm text-muted-foreground">No modifications recorded</p>
            ) : (
              <div className="space-y-3">
                {auditTrail.map((entry, idx) => (
                  <div key={idx} className="border rounded-lg p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <Badge variant="outline" className="capitalize">
                          {entry.action}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(entry.created_at)} at {formatTime(entry.created_at)}
                        </p>
                      </div>
                      <span className="text-sm font-medium">{entry.performed_by_user?.full_name}</span>
                    </div>
                    {entry.reason && (
                      <p className="text-sm"><strong>Reason:</strong> {entry.reason}</p>
                    )}
                    {entry.details && (
                      <div className="text-xs text-muted-foreground mt-2">
                        <p><strong>Details:</strong> {JSON.stringify(entry.details, null, 2)}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAuditTrail(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
