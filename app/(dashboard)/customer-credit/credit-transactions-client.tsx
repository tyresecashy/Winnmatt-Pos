'use client'

import { useState } from 'react'
import { CreditCard, DollarSign, AlertTriangle, Users, TrendingUp, Calendar, Search, Plus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatKSh } from '@/lib/currency'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { recordCreditPayment, updateCreditLimit } from '@/lib/credit-actions'
import { useToast } from '@/components/ui/use-toast'

interface CustomerSummary {
  customer_id: string
  customer_name: string
  phone: string | null
  credit_limit: number
  credit_balance: number
  credit_usage_pct: number | null
  credit_status: string
  total_credit_sales: number
  total_payments: number
  last_payment_date: string | null
  last_credit_sale_date: string | null
}

interface PaymentRecord {
  id: string
  customer_id: string
  customer_name?: string
  amount_cents: number
  payment_date: string
  payment_method: string
  reference_number: string | null
  notes: string | null
  recorded_by_name?: string
  created_at: string
}

interface CustomerOption {
  id: string
  name: string
  phone: string | null
  credit_limit: number
  credit_balance: number
}

function getStatusColor(status: string) {
  switch (status) {
    case 'maxed': return 'destructive'
    case 'high': return 'warning'
    case 'active': return 'default'
    default: return 'secondary'
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'maxed': return 'Maxed Out'
    case 'high': return 'High Usage'
    case 'active': return 'Active'
    default: return 'Clear'
  }
}

function computeAging(summaries: CustomerSummary[]) {
  const now = new Date()
  const buckets = [
    { label: 'Current (0-30 days)', total_cents: 0, count: 0 },
    { label: '31-60 days', total_cents: 0, count: 0 },
    { label: '61-90 days', total_cents: 0, count: 0 },
    { label: '90+ days', total_cents: 0, count: 0 },
  ]
  for (const s of summaries) {
    if (s.credit_balance <= 0) continue
    const days = s.last_credit_sale_date
      ? Math.floor((now.getTime() - new Date(s.last_credit_sale_date).getTime()) / (1000 * 60 * 60 * 24))
      : 999
    if (days <= 30) { buckets[0].total_cents += s.credit_balance; buckets[0].count++ }
    else if (days <= 60) { buckets[1].total_cents += s.credit_balance; buckets[1].count++ }
    else if (days <= 90) { buckets[2].total_cents += s.credit_balance; buckets[2].count++ }
    else { buckets[3].total_cents += s.credit_balance; buckets[3].count++ }
  }
  return buckets
}

export function CreditTransactionsClient({
  summaries,
  payments,
  customers,
}: {
  summaries: CustomerSummary[]
  payments: PaymentRecord[]
  customers: CustomerOption[]
}) {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState('overview')
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [showLimitDialog, setShowLimitDialog] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Payment form
  const [payCustomerId, setPayCustomerId] = useState('')
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('cash')
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0])
  const [payRef, setPayRef] = useState('')
  const [payNotes, setPayNotes] = useState('')

  // Limit form
  const [newLimit, setNewLimit] = useState('')

  // Compute KPI data
  const totalOutstanding = summaries.reduce((sum, s) => sum + s.credit_balance, 0)
  const totalLimits = summaries.reduce((sum, s) => sum + s.credit_limit, 0)
  const utilizationPct = totalLimits > 0 ? Math.round((totalOutstanding / totalLimits) * 100) : 0
  const atRiskCount = summaries.filter(s => s.credit_status === 'maxed' || s.credit_status === 'high').length
  const agingBuckets = computeAging(summaries)

  // Filter
  const filtered = summaries.filter(s =>
    s.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.phone && s.phone.includes(searchQuery))
  )

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault()
    if (!payCustomerId || !payAmount) return
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.set('customer_id', payCustomerId)
      fd.set('amount_cents', String(Math.round(parseFloat(payAmount))))
      fd.set('payment_date', payDate)
      fd.set('payment_method', payMethod)
      fd.set('reference_number', payRef || '')
      fd.set('notes', payNotes || '')
      const result = await recordCreditPayment(fd)
      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' })
      } else {
        toast({ title: 'Success', description: 'Payment recorded' })
        setShowPaymentDialog(false)
        setPayCustomerId(''); setPayAmount(''); setPayRef(''); setPayNotes('')
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUpdateLimit() {
    if (!showLimitDialog || !newLimit) return
    setSubmitting(true)
    try {
      const result = await updateCreditLimit(showLimitDialog, Math.round(parseFloat(newLimit)))
      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' })
      } else {
        toast({ title: 'Success', description: 'Credit limit updated' })
        setShowLimitDialog(null)
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customer Credit</h1>
          <p className="text-muted-foreground">Manage customer credit accounts, payments, and aging</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowPaymentDialog(true)}>
            <Plus className="mr-2 h-4 w-4" /> Record Payment
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatKSh(totalOutstanding)}</div>
            <p className="text-xs text-muted-foreground">Across {summaries.filter(s => s.credit_balance > 0).length} customers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Credit Limit</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatKSh(totalLimits)}</div>
            <p className="text-xs text-muted-foreground">Combined limit</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Utilization</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{utilizationPct}%</div>
            <p className="text-xs text-muted-foreground">Of total credit used</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">At Risk</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{atRiskCount}</div>
            <p className="text-xs text-muted-foreground">Customers at or near limit</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Credit Overview</TabsTrigger>
          <TabsTrigger value="aging">Aging Report</TabsTrigger>
          <TabsTrigger value="payments">Payment History</TabsTrigger>
        </TabsList>

        {/* Tab 1: Credit Overview */}
        <TabsContent value="overview" className="space-y-4">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by customer name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Limit</TableHead>
                  <TableHead className="text-right">Usage</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Last Credit Sale</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">No customers with credit</TableCell>
                  </TableRow>
                ) : filtered.map((s) => (
                  <TableRow key={s.customer_id}>
                    <TableCell className="font-medium">{s.customer_name}</TableCell>
                    <TableCell>{s.phone || '-'}</TableCell>
                    <TableCell className="text-right font-mono">{formatKSh(s.credit_balance)}</TableCell>
                    <TableCell className="text-right font-mono">{formatKSh(s.credit_limit)}</TableCell>
                    <TableCell className="text-right">{s.credit_usage_pct !== null ? `${s.credit_usage_pct}%` : '-'}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(s.credit_status) as any}>
                        {getStatusLabel(s.credit_status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {s.last_credit_sale_date ? new Date(s.last_credit_sale_date).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setShowPaymentDialog(true)
                            setPayCustomerId(s.customer_id)
                          }}
                        >
                          Pay
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowLimitDialog(s.customer_id)
                            setNewLimit(String(s.credit_limit))
                          }}
                        >
                          Limit
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Tab 2: Aging Report */}
        <TabsContent value="aging" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            {agingBuckets.map((bucket, i) => {
              const pct = totalOutstanding > 0 ? (bucket.total_cents / totalOutstanding) * 100 : 0
              const colors = ['bg-blue-500', 'bg-yellow-500', 'bg-orange-500', 'bg-red-500']
              return (
                <Card key={i} className={bucket.total_cents > 0 ? 'border-l-4' : ''}
                  style={{ borderLeftColor: bucket.total_cents > 0 ? ['#3b82f6', '#eab308', '#f97316', '#ef4444'][i] : undefined }}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">{bucket.label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatKSh(bucket.total_cents)}</div>
                    <p className="text-xs text-muted-foreground">{bucket.count} customers ({pct.toFixed(1)}%)</p>
                    <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${colors[i]}`} style={{ width: `${pct}%` }} />
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Aging Details by Customer</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right">Limit</TableHead>
                    <TableHead>Aging Bucket</TableHead>
                    <TableHead className="text-right">Days Since Last Sale</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaries
                    .filter(s => s.credit_balance > 0)
                    .sort((a, b) => {
                      const aDays = a.last_credit_sale_date
                        ? Math.floor((Date.now() - new Date(a.last_credit_sale_date).getTime()) / (1000 * 60 * 60 * 24))
                        : 999
                      const bDays = b.last_credit_sale_date
                        ? Math.floor((Date.now() - new Date(b.last_credit_sale_date).getTime()) / (1000 * 60 * 60 * 24))
                        : 999
                      return bDays - aDays
                    })
                    .map(s => {
                      const days = s.last_credit_sale_date
                        ? Math.floor((Date.now() - new Date(s.last_credit_sale_date).getTime()) / (1000 * 60 * 60 * 24))
                        : 999
                      const bucketLabel = days <= 30 ? 'Current' : days <= 60 ? '31-60 days' : days <= 90 ? '61-90 days' : '90+ days'
                      const bucketColor = days <= 30 ? 'bg-blue-100 text-blue-800' : days <= 60 ? 'bg-yellow-100 text-yellow-800' : days <= 90 ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800'
                      return (
                        <TableRow key={s.customer_id}>
                          <TableCell className="font-medium">{s.customer_name}</TableCell>
                          <TableCell className="text-right font-mono">{formatKSh(s.credit_balance)}</TableCell>
                          <TableCell className="text-right font-mono">{formatKSh(s.credit_limit)}</TableCell>
                          <TableCell>
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${bucketColor}`}>{bucketLabel}</span>
                          </TableCell>
                          <TableCell className="text-right">{days >= 999 ? 'N/A' : `${days}d`}</TableCell>
                        </TableRow>
                      )
                    })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Payment History */}
        <TabsContent value="payments" className="space-y-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Recorded By</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">No payments recorded yet</TableCell>
                  </TableRow>
                ) : payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-xs">{new Date(p.payment_date).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium">{p.customer_name}</TableCell>
                    <TableCell className="text-right font-mono">{formatKSh(p.amount_cents)}</TableCell>
                    <TableCell className="capitalize">{p.payment_method.replace(/_/g, ' ')}</TableCell>
                    <TableCell className="text-xs">{p.reference_number || '-'}</TableCell>
                    <TableCell className="text-xs">{p.recorded_by_name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{p.notes || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Record Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Credit Payment</DialogTitle>
            <DialogDescription>Record a payment made by a customer against their credit balance</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRecordPayment} className="space-y-4">
            <div className="space-y-2">
              <Label>Customer</Label>
              <Select value={payCustomerId} onValueChange={setPayCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.filter(c => c.credit_balance > 0 || c.credit_limit > 0).map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({formatKSh(c.credit_balance)} outstanding)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount (KES)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={payMethod} onValueChange={setPayMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="mpesa">M-Pesa</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Payment Date</Label>
                <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reference Number</Label>
              <Input placeholder="e.g. M-Pesa code, cheque no." value={payRef} onChange={(e) => setPayRef(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input placeholder="Optional notes" value={payNotes} onChange={(e) => setPayNotes(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowPaymentDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Recording...' : 'Record Payment'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Update Credit Limit Dialog */}
      <Dialog open={!!showLimitDialog} onOpenChange={(o) => { if (!o) setShowLimitDialog(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Credit Limit</DialogTitle>
            <DialogDescription>
              {showLimitDialog && (
                <>Current balance: {formatKSh(customers.find(c => c.id === showLimitDialog)?.credit_balance || 0)}</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>New Credit Limit (KES)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={newLimit}
                onChange={(e) => setNewLimit(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowLimitDialog(null)}>Cancel</Button>
              <Button onClick={handleUpdateLimit} disabled={submitting}>
                {submitting ? 'Updating...' : 'Update Limit'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
