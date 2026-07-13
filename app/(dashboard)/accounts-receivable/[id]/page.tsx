'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  ArrowLeft, User, Phone, Mail, MapPin, Calendar,
  DollarSign, CreditCard, ShoppingCart, Banknote,
  TrendingUp, Star, Package, Clock, Plus, AlertTriangle,
} from 'lucide-react'
import { formatKSh } from '@/lib/currency'
import { EmptyState } from '@/components/ui/empty-state'
import { toast } from '@/components/ui/use-toast'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { getCustomerWithStats, type CustomerWithStats } from '@/lib/modules/customers'
import {
  getCustomerCreditSummary, getCustomerPayments, recordCreditPayment,
  type CustomerCreditSummary, type CreditPaymentRecord,
} from '@/lib/modules/crm'

export default function ARDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [customer, setCustomer] = useState<CustomerWithStats | null>(null)
  const [creditSummary, setCreditSummary] = useState<CustomerCreditSummary | null>(null)
  const [payments, setPayments] = useState<CreditPaymentRecord[]>([])

  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0])
  const [payMethod, setPayMethod] = useState('cash')
  const [payReference, setPayReference] = useState('')
  const [payNotes, setPayNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [cust, credit, pays] = await Promise.all([
          getCustomerWithStats(params.id as string) as Promise<CustomerWithStats | null>,
          getCustomerCreditSummary(params.id as string).catch(() => null),
          getCustomerPayments(params.id as string) as Promise<CreditPaymentRecord[]>,
        ])
        setCustomer(cust)
        setCreditSummary(credit)
        setPayments(pays)
      } catch (err: unknown) {
        toast({ title: 'Error', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' })
      } finally {
        setLoading(false)
      }
    }
    if (params.id) load()
  }, [params.id])

  async function handlePayment(e: React.FormEvent) {
    e.preventDefault()
    if (!payAmount || parseFloat(payAmount) <= 0) return
    setSubmitting(true)
    try {
      const result = await recordCreditPayment({
        customer_id: params.id as string,
        amount_cents: Math.round(parseFloat(payAmount)),
        payment_date: payDate,
        payment_method: payMethod,
        reference_number: payReference || undefined,
        notes: payNotes || undefined,
      })
      if (result.success) {
        toast({ title: 'Payment recorded' })
        setShowPaymentDialog(false)
        setPayAmount('')
        setPayReference('')
        setPayNotes('')
        const [credit, pays] = await Promise.all([
          getCustomerCreditSummary(params.id as string).catch(() => null),
          getCustomerPayments(params.id as string) as Promise<CreditPaymentRecord[]>,
        ])
        setCreditSummary(credit)
        setPayments(pays)
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' })
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="p-6">
        <EmptyState
          icon={AlertTriangle}
          title="Customer not found"
          actions={[{ label: 'Back to Accounts Receivable', onClick: () => router.push('/accounts-receivable'), variant: 'outline', icon: ArrowLeft }]}
        />
      </div>
    )
  }

  const balance = creditSummary?.credit_balance || customer.credit_balance || 0
  const creditLimit = creditSummary?.credit_limit || customer.credit_limit || 0
  const usagePct = creditLimit > 0 ? (balance / creditLimit) * 100 : 0

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/accounts-receivable')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{customer.name}</h1>
            <Badge variant={creditSummary?.credit_status === 'active' ? 'default' : 'secondary'}>
              {creditSummary?.credit_status || 'active'}
            </Badge>
          </div>
          <div className="flex items-center gap-3 mt-1 text-muted-foreground">
            {customer.phone && <span dir="ltr">{customer.phone}</span>}
            {customer.email && (
              <>
                <Separator orientation="vertical" className="h-4" />
                <span>{customer.email}</span>
              </>
            )}
            {customer.type && (
              <>
                <Separator orientation="vertical" className="h-4" />
                <span className="capitalize">{customer.type}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setShowPaymentDialog(true)} disabled={balance <= 0}>
            <Banknote className="h-4 w-4 mr-2" /> Record Payment
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Outstanding Balance</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-red-600">{formatKSh(balance)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Credit Limit</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{formatKSh(creditLimit)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Usage</CardTitle></CardHeader>
          <CardContent>
            <p className={`text-xl font-bold ${usagePct > 80 ? 'text-red-600' : usagePct > 50 ? 'text-yellow-600' : 'text-green-600'}`}>
              {usagePct.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Total Paid</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-green-600">
              {formatKSh(payments.reduce((s, p) => s + (p.amount_cents || 0), 0))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Credit utilization bar */}
      {creditLimit > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Credit Utilization</span>
              <span className="font-medium">{usagePct.toFixed(1)}%</span>
            </div>
            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${usagePct > 80 ? 'bg-red-500' : usagePct > 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
                style={{ width: `${Math.min(usagePct, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="overview"><User className="h-4 w-4 mr-2" /> Overview</TabsTrigger>
          <TabsTrigger value="payments"><Banknote className="h-4 w-4 mr-2" /> Payment History ({payments.length})</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-lg">Customer Details</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-xs text-muted-foreground">Name</p><p className="font-medium">{customer.name}</p></div>
                  <div><p className="text-xs text-muted-foreground">Type</p><p className="font-medium capitalize">{customer.type || 'retail'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Phone</p><p className="font-medium" dir="ltr">{customer.phone || '-'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Email</p><p className="font-medium">{customer.email || '-'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Tier</p><p className="font-medium capitalize">{customer.tier || 'regular'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Loyalty Points</p><p className="font-medium">{customer.loyalty_points || 0}</p></div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Credit Summary</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-xs text-muted-foreground">Balance</p><p className="font-bold text-red-600">{formatKSh(balance)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Credit Limit</p><p className="font-bold">{formatKSh(creditLimit)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Total Credit Sales</p><p className="font-medium">{formatKSh(creditSummary?.total_credit_sales || 0)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Total Payments</p><p className="font-medium">{formatKSh(creditSummary?.total_payments || 0)}</p></div>
                </div>
                {creditSummary?.last_payment_date && (
                  <div className="text-sm text-muted-foreground">
                    Last payment: {new Date(creditSummary.last_payment_date).toLocaleDateString()}
                  </div>
                )}
                {creditSummary?.last_credit_sale_date && (
                  <div className="text-sm text-muted-foreground">
                    Last credit sale: {new Date(creditSummary.last_credit_sale_date).toLocaleDateString()}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Purchase Stats</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-xs text-muted-foreground">Total Purchases</p><p className="text-2xl font-bold">{formatKSh(customer.total_purchases || 0)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Purchase Count</p><p className="text-2xl font-bold">{customer.purchase_count || 0}</p></div>
                </div>
                {customer.last_visit && (
                  <div className="text-sm text-muted-foreground">
                    Last visit: {new Date(customer.last_visit).toLocaleDateString()}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Aging Snapshot</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-sm">Current AR Balance</span>
                  <span className="font-bold text-red-600">{formatKSh(balance)}</span>
                </div>
                <div className="space-y-2">
                  {payments.length > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Last Payment</span>
                      <span>{new Date(payments[0].payment_date || payments[0].created_at).toLocaleDateString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Active Since</span>
                    <span>{customer.created_at ? new Date(customer.created_at).toLocaleDateString() : '-'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Payment History */}
        <TabsContent value="payments" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowPaymentDialog(true)} disabled={balance <= 0}>
              <Banknote className="h-4 w-4 mr-2" /> Record Payment
            </Button>
          </div>
          {payments.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-muted-foreground"><EmptyState title="No payment records found" compact /></CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="text-left p-3 font-medium">Date</th>
                      <th className="text-left p-3 font-medium">Method</th>
                      <th className="text-left p-3 font-medium">Reference</th>
                      <th className="text-right p-3 font-medium">Amount</th>
                      <th className="text-left p-3 font-medium">Recorded By</th>
                      <th className="text-left p-3 font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="p-3 text-sm">{new Date(p.payment_date || p.created_at).toLocaleDateString()}</td>
                        <td className="p-3"><Badge variant="secondary">{p.payment_method}</Badge></td>
                        <td className="p-3 text-xs font-mono">{p.reference_number || '-'}</td>
                        <td className="p-3 text-right font-medium text-green-600">{formatKSh(p.amount_cents || 0)}</td>
                        <td className="p-3 text-sm">{p.recorded_by_name || '-'}</td>
                        <td className="p-3 text-sm text-muted-foreground">{p.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Record Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>Record a payment from {customer.name}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePayment} className="space-y-4">
            <div className="space-y-2">
              <Label>Amount (KSh)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Payment Date</Label>
                <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Method</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                >
                  <option value="cash">Cash</option>
                  <option value="mpesa">M-Pesa</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reference Number</Label>
              <Input value={payReference} onChange={(e) => setPayReference(e.target.value)} placeholder="Optional" />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="Optional" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowPaymentDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>Record Payment</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
