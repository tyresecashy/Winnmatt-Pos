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
  getCreditSummaries, getCreditAging,
  recordCreditPayment,
  type CustomerCreditSummary, type CreditAgingBucket,
} from '@/lib/modules/crm'
import {
  Users, Plus, Search, Loader2, DollarSign, Clock, TrendingUp,
  AlertCircle, CheckCircle, RefreshCw, ArrowRight, Phone, Mail,
  CreditCard, Wallet, Calendar,
} from 'lucide-react'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AccountsReceivablePage() {
  const { toast } = useToast()

  // ── Data State ──
  const [customers, setCustomers] = useState<CustomerCreditSummary[]>([])
  const [agingBuckets, setAgingBuckets] = useState<CreditAgingBucket[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')

  // ── UI State ──
  const [searchTerm, setSearchTerm] = useState('')
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerCreditSummary | null>(null)
  const [saving, setSaving] = useState(false)

  // ── Payment Form ──
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'cash',
    reference_number: '',
    notes: '',
  })

  // ── Load Data ──
  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [customersData, agingData] = await Promise.all([
        getCreditSummaries(),
        getCreditAging(),
      ])
      setCustomers(customersData)
      setAgingBuckets(agingData)
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { startTransition(() => { loadData() }) }, [loadData])

  // ── Filtered Customers ──
  const filteredCustomers = useMemo(() => {
    let result = customers
    if (activeTab === 'overdue') {
      result = result.filter(c => c.credit_balance > 0)
    } else if (activeTab === 'active') {
      result = result.filter(c => c.credit_status === 'active' || c.credit_status === 'good_standing')
    } else if (activeTab === 'over_limit') {
      result = result.filter(c => c.credit_limit > 0 && c.credit_balance > c.credit_limit)
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(c =>
        c.customer_name.toLowerCase().includes(term) ||
        (c.phone || '').includes(term)
      )
    }
    return result
  }, [customers, activeTab, searchTerm])

  // ── Summary Stats ──
  const totalReceivable = useMemo(() =>
    customers.reduce((sum, c) => sum + c.credit_balance, 0), [customers])

  const totalCreditSales = useMemo(() =>
    customers.reduce((sum, c) => sum + c.total_credit_sales, 0), [customers])

  const totalPayments = useMemo(() =>
    customers.reduce((sum, c) => sum + c.total_payments, 0), [customers])

  const overdueCount = useMemo(() =>
    customers.filter(c => c.credit_balance > 0).length, [customers])

  // ── Record Payment ──
  const handleRecordPayment = async () => {
    if (!selectedCustomer) return
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      toast({ title: 'Validation', description: 'Enter a valid payment amount', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      const formData = new FormData()
      formData.set('customer_id', selectedCustomer.customer_id)
      formData.set('amount_cents', String(parseFloat(paymentForm.amount)))
      formData.set('payment_date', paymentForm.payment_date)
      formData.set('payment_method', paymentForm.payment_method)
      if (paymentForm.reference_number) formData.set('reference_number', paymentForm.reference_number)
      if (paymentForm.notes) formData.set('notes', paymentForm.notes)

      const result = await recordCreditPayment(formData as any)
      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' })
      } else {
        toast({ title: 'Payment recorded', description: `KES ${paymentForm.amount} received from ${selectedCustomer.customer_name}` })
        setShowPaymentDialog(false)
        setSelectedCustomer(null)
        setPaymentForm({ amount: '', payment_date: new Date().toISOString().split('T')[0], payment_method: 'cash', reference_number: '', notes: '' })
        loadData()
      }
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // ── Open Payment Dialog ──
  const openPaymentDialog = (customer: CustomerCreditSummary) => {
    setSelectedCustomer(customer)
    setPaymentForm({
      amount: '',
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: 'cash',
      reference_number: '',
      notes: '',
    })
    setShowPaymentDialog(true)
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
            <Users className="h-6 w-6" />
            Accounts Receivable
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track customer credit balances, aging, and collect payments
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
              <p className="text-xs text-muted-foreground">Total Outstanding</p>
              <DollarSign className="h-4 w-4 text-red-600" />
            </div>
            <p className="text-2xl font-bold">{formatKSh(totalReceivable)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Total Credit Sales</p>
              <CreditCard className="h-4 w-4 text-blue-600" />
            </div>
            <p className="text-2xl font-bold">{formatKSh(totalCreditSales)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Total Collected</p>
              <CheckCircle className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold">{formatKSh(totalPayments)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Customers with Balance</p>
              <AlertCircle className="h-4 w-4 text-amber-600" />
            </div>
            <p className="text-2xl font-bold">{overdueCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Aging Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {agingBuckets.map((bucket) => (
          <Card key={bucket.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{bucket.label}</p>
              <p className="text-lg font-bold mt-1">{formatKSh(bucket.total_cents)}</p>
              <p className="text-xs text-muted-foreground">{bucket.customer_count} customers</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs + Search */}
      <div className="flex items-center justify-between gap-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <TabsList>
            <TabsTrigger value="all">All Customers</TabsTrigger>
            <TabsTrigger value="overdue">With Balance</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="over_limit">Over Limit</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search customers..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
      </div>

      {/* Customer Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-right">Credit Limit</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Usage</TableHead>
                <TableHead className="text-right">Total Sales</TableHead>
                <TableHead className="text-right">Payments</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No customers found
                  </TableCell>
                </TableRow>
              ) : (
                filteredCustomers.map((customer) => (
                  <TableRow key={customer.customer_id} className="group">
                    <TableCell className="font-medium">{customer.customer_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{customer.phone || '-'}</TableCell>
                    <TableCell className="text-right">{formatKSh(customer.credit_limit)}</TableCell>
                    <TableCell className={`text-right font-bold ${customer.credit_balance > 0 ? 'text-red-600' : ''}`}>
                      {formatKSh(customer.credit_balance)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {customer.credit_usage_pct != null ? `${customer.credit_usage_pct.toFixed(0)}%` : '-'}
                    </TableCell>
                    <TableCell className="text-right">{formatKSh(customer.total_credit_sales)}</TableCell>
                    <TableCell className="text-right text-emerald-600">{formatKSh(customer.total_payments)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        customer.credit_balance > 0
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }>
                        {customer.credit_balance > 0 ? 'Outstanding' : 'Settled'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {customer.credit_balance > 0 && (
                        <Button variant="outline" size="sm" className="opacity-0 group-hover:opacity-100" onClick={() => openPaymentDialog(customer)}>
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

      {/* Record Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Record a payment from {selectedCustomer?.customer_name}
              {selectedCustomer && (
                <span className="block text-sm font-medium text-foreground mt-1">
                  Outstanding: {formatKSh(selectedCustomer.credit_balance)}
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
                  max={selectedCustomer?.credit_balance || undefined}
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
                {['cash', 'mpesa', 'bank_transfer', 'cheque'].map((method) => (
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
                placeholder="e.g. M-Pesa code, cheque number"
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
