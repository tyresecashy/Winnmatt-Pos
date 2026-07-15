'use client'

import { useCallback, useEffect, useMemo, useState, startTransition } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { useToast } from '@/components/ui/use-toast'
import { formatKSh } from '@/lib/currency'
import {
  getSuppliers, getSupplierById,
  type Supplier,
} from '@/lib/modules/suppliers'
import {
  Truck, Plus, Search, Loader2, DollarSign, Clock, TrendingUp,
  AlertCircle, CheckCircle, RefreshCw, ArrowRight, Phone, Mail,
  CreditCard, Wallet, Calendar, Building2,
} from 'lucide-react'

// ─── Extended Supplier Type ───────────────────────────────────────────────────

interface SupplierWithAP extends Supplier {
  outstanding_balance: number
  credit_limit: number
  credit_days: number
  total_purchase_amount: number
  total_orders: number
  status: string
  company_name: string
  tax_number: string
  bank_name: string
  bank_account: string
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AccountsPayablePage() {
  const { toast } = useToast()

  // ── Data State ──
  const [suppliers, setSuppliers] = useState<SupplierWithAP[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')

  // ── UI State ──
  const [searchTerm, setSearchTerm] = useState('')
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierWithAP | null>(null)
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [detailSupplier, setDetailSupplier] = useState<SupplierWithAP | null>(null)
  const [saving, setSaving] = useState(false)

  // ── Payment Form ──
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'bank_transfer',
    reference_number: '',
    notes: '',
  })

  // ── Load Data ──
  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const suppliersData = await getSuppliers()
      // Enrich with AP-specific fields
      const enriched: SupplierWithAP[] = suppliersData.map((s: Supplier) => ({
        ...s,
        outstanding_balance: s.balance || 0,
        credit_limit: s.credit_limit ?? 0,
        credit_days: s.credit_days ?? 30,
        total_purchase_amount: s.total_purchase_amount ?? 0,
        total_orders: s.total_orders ?? 0,
        status: s.status || 'active',
        company_name: s.company_name ?? '',
        tax_number: s.tax_number ?? '',
        bank_name: s.bank_name ?? '',
        bank_account: s.bank_account ?? '',
      }))
      setSuppliers(enriched)
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { startTransition(() => { loadData() }) }, [loadData])

  // ── Filtered Suppliers ──
  const filteredSuppliers = useMemo(() => {
    let result = suppliers
    if (activeTab === 'outstanding') {
      result = result.filter(s => s.outstanding_balance > 0)
    } else if (activeTab === 'overdue') {
      result = result.filter(s => s.outstanding_balance > 0 && s.credit_days > 0)
    } else if (activeTab === 'inactive') {
      result = result.filter(s => s.status !== 'active')
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(s =>
        s.name.toLowerCase().includes(term) ||
        (s.company_name || '').toLowerCase().includes(term) ||
        (s.contact_person || '').toLowerCase().includes(term) ||
        (s.phone || '').includes(term)
      )
    }
    return result
  }, [suppliers, activeTab, searchTerm])

  // ── Summary Stats ──
  const totalPayable = useMemo(() =>
    suppliers.reduce((sum, s) => sum + s.outstanding_balance, 0), [suppliers])

  const totalPurchases = useMemo(() =>
    suppliers.reduce((sum, s) => sum + s.total_purchase_amount, 0), [suppliers])

  const suppliersWithBalance = useMemo(() =>
    suppliers.filter(s => s.outstanding_balance > 0).length, [suppliers])

  const activeSupplierCount = useMemo(() =>
    suppliers.filter(s => s.status === 'active').length, [suppliers])

  // ── Record Payment ──
  const handleRecordPayment = async () => {
    if (!selectedSupplier) return
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      toast({ title: 'Validation', description: 'Enter a valid payment amount', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      const { recordSupplierPayment } = await import('@/lib/modules/suppliers')
      const result = await recordSupplierPayment({
        supplierId: selectedSupplier.id,
        amountKSh: parseFloat(paymentForm.amount),
        paymentDate: paymentForm.payment_date,
        paymentMethod: paymentForm.payment_method,
        referenceNumber: paymentForm.reference_number || undefined,
        notes: paymentForm.notes || undefined,
      })

      if (!result.success) throw new Error(result.error || 'Payment failed')

      toast({ title: 'Payment recorded', description: `KES ${paymentForm.amount} paid to ${selectedSupplier.name}` })
      setShowPaymentDialog(false)
      setSelectedSupplier(null)
      setPaymentForm({ amount: '', payment_date: new Date().toISOString().split('T')[0], payment_method: 'bank_transfer', reference_number: '', notes: '' })
      loadData()
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // ── Open Detail ──
  const openDetail = async (supplier: SupplierWithAP) => {
    setDetailSupplier(supplier)
    setShowDetailDialog(true)
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-72 mt-1" /></div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>)}
        </div>
        <Card><CardContent className="p-4"><Skeleton className="h-[300px] w-full" /></CardContent></Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Truck className="h-6 w-6" />
            Accounts Payable
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track supplier balances, manage payments, and monitor purchase obligations
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Total Payable</p>
              <DollarSign className="h-4 w-4 text-red-600" />
            </div>
            <p className="text-2xl font-bold">{formatKSh(totalPayable)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Total Purchases</p>
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </div>
            <p className="text-2xl font-bold">{formatKSh(totalPurchases)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Suppliers with Balance</p>
              <AlertCircle className="h-4 w-4 text-amber-600" />
            </div>
            <p className="text-2xl font-bold">{suppliersWithBalance}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Active Suppliers</p>
              <CheckCircle className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold">{activeSupplierCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs + Search */}
      <div className="flex items-center justify-between gap-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <TabsList>
            <TabsTrigger value="all">All Suppliers</TabsTrigger>
            <TabsTrigger value="outstanding">With Balance</TabsTrigger>
            <TabsTrigger value="overdue">Active</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search suppliers..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
      </div>

      {/* Supplier Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supplier</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Payment Terms</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead className="text-right">Total Orders</TableHead>
                <TableHead className="text-right">Total Purchases</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSuppliers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No suppliers found
                  </TableCell>
                </TableRow>
              ) : (
                filteredSuppliers.map((supplier) => (
                  <TableRow key={supplier.id} className="group cursor-pointer hover:bg-muted/50" onClick={() => openDetail(supplier)}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{supplier.name}</p>
                        {supplier.company_name && (
                          <p className="text-xs text-muted-foreground">{supplier.company_name}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{supplier.contact_person || '-'}</p>
                        <p className="text-muted-foreground">{supplier.phone}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{supplier.payment_terms || 'Net 30'}</TableCell>
                    <TableCell className={`text-right font-bold ${supplier.outstanding_balance > 0 ? 'text-red-600' : ''}`}>
                      {formatKSh(supplier.outstanding_balance)}
                    </TableCell>
                    <TableCell className="text-right">{supplier.total_orders}</TableCell>
                    <TableCell className="text-right">{formatKSh(supplier.total_purchase_amount)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        supplier.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-50 text-slate-500 border-slate-200'
                      }>
                        {supplier.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {supplier.outstanding_balance > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100"
                          onClick={(e) => { e.stopPropagation(); setSelectedSupplier(supplier); setShowPaymentDialog(true) }}
                        >
                          <DollarSign className="h-3 w-3 mr-1" />
                          Pay
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Supplier Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              {detailSupplier?.name}
            </DialogTitle>
            <DialogDescription>{detailSupplier?.company_name || detailSupplier?.contact_person}</DialogDescription>
          </DialogHeader>

          {detailSupplier && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Contact Person</p>
                  <p className="font-medium">{detailSupplier.contact_person || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Phone</p>
                  <p className="font-medium">{detailSupplier.phone}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-medium">{detailSupplier.email || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Payment Terms</p>
                  <p className="font-medium">{detailSupplier.payment_terms || 'Net 30'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tax Number</p>
                  <p className="font-medium font-mono">{detailSupplier.tax_number || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge variant="outline" className={
                    detailSupplier.status === 'active'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-50 text-slate-500 border-slate-200'
                  }>
                    {detailSupplier.status}
                  </Badge>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">Outstanding</p>
                    <p className="text-lg font-bold text-red-600">{formatKSh(detailSupplier.outstanding_balance)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">Total Orders</p>
                    <p className="text-lg font-bold">{detailSupplier.total_orders}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">Total Value</p>
                    <p className="text-lg font-bold">{formatKSh(detailSupplier.total_purchase_amount)}</p>
                  </CardContent>
                </Card>
              </div>

              {detailSupplier.bank_name && (
                <div className="text-sm">
                  <p className="text-muted-foreground mb-1">Banking Details</p>
                  <p className="font-medium">{detailSupplier.bank_name}</p>
                  <p className="text-muted-foreground font-mono">{detailSupplier.bank_account}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Supplier Payment</DialogTitle>
            <DialogDescription>
              Record a payment to {selectedSupplier?.name}
              {selectedSupplier && (
                <span className="block text-sm font-medium text-foreground mt-1">
                  Outstanding: {formatKSh(selectedSupplier.outstanding_balance)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount (KES) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={paymentForm.payment_date}
                  onChange={(e) => setPaymentForm(f => ({ ...f, payment_date: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Payment Method</Label>
              <div className="flex gap-2">
                {['bank_transfer', 'cheque', 'cash', 'mpesa'].map((method) => (
                  <Button
                    key={method}
                    variant={paymentForm.payment_method === method ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPaymentForm(f => ({ ...f, payment_method: method }))}
                    className="capitalize"
                  >
                    {method.replace('_', ' ')}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Reference Number</Label>
              <Input
                placeholder="e.g. Bank reference, cheque number"
                value={paymentForm.reference_number}
                onChange={(e) => setPaymentForm(f => ({ ...f, reference_number: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                placeholder="Optional notes"
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>Cancel</Button>
            <Button onClick={handleRecordPayment} disabled={saving || !paymentForm.amount}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
