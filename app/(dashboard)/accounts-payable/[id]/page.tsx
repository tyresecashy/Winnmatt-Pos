'use client'

import { useState, useEffect, useCallback, startTransition } from 'react'
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
  ArrowLeft, Building2, Phone, Mail, User, MapPin,
  DollarSign, Package, Banknote, Calendar, Clock,
  CreditCard, FileText, Plus, AlertTriangle,
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
import {
  getSupplierById, getSupplierOrders, getSupplierPayments, recordSupplierPayment,
  type Supplier,
} from '@/lib/modules/suppliers'

interface PurchaseOrderItem {
  id: string
  product_id: string
  quantity: number
  unit_price: number
  line_total: number
  received_quantity: number
  product: { id: string; sku: string; name: string }
}

interface PurchaseOrder {
  id: string
  po_number: string | null
  ordered_at: string | null
  status: string
  total_amount: number | null
  items: PurchaseOrderItem[]
}

interface SupplierPaymentRecord {
  id: string
  amount: number
  payment_date: string
  payment_method: string
  reference_number: string | null
  notes: string | null
  created_at: string
}

export default function APDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [payments, setPayments] = useState<SupplierPaymentRecord[]>([])
  const [activeTab, setActiveTab] = useState('overview')

  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0])
  const [payMethod, setPayMethod] = useState('bank_transfer')
  const [payReference, setPayReference] = useState('')
  const [payNotes, setPayNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [now, setNow] = useState(0)
  useEffect(() => { startTransition(() => { setNow(Date.now()) }) }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [sup, ords, pays] = await Promise.all([
          getSupplierById(params.id as string),
          getSupplierOrders(params.id as string),
          getSupplierPayments(params.id as string),
        ])
        setSupplier(sup)
        setOrders(ords)
        setPayments(pays)
      } catch (err: unknown) {
        toast({ title: 'Error', description: err instanceof Error ? err.message : String(err), variant: 'destructive' })
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
      const result = await recordSupplierPayment({
        supplierId: params.id as string,
        amountKSh: parseFloat(payAmount),
        paymentDate: payDate,
        paymentMethod: payMethod,
        referenceNumber: payReference || undefined,
        notes: payNotes || undefined,
      })
      if (result.success) {
        toast({ title: 'Payment recorded' })
        setShowPaymentDialog(false)
        setPayAmount('')
        setPayReference('')
        setPayNotes('')
        // Reload
        const [sup, pays] = await Promise.all([
          getSupplierById(params.id as string),
          getSupplierPayments(params.id as string),
        ])
        setSupplier(sup)
        setPayments(pays)
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' })
      }
    } finally {
      setSubmitting(false)
    }
  }

  const totalOutstanding = orders
    .filter((o) => o.status !== 'received' && o.status !== 'cancelled')
    .reduce((s, o) => s + (o.total_amount || 0), 0)

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (!supplier) {
    return (
      <div className="p-6">
        <EmptyState
          icon={AlertTriangle}
          title="Supplier not found"
          actions={[{ label: 'Back to Accounts Payable', onClick: () => router.push('/accounts-payable'), variant: 'outline', icon: ArrowLeft }]}
        />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/accounts-payable')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{supplier.name}</h1>
            <Badge variant={supplier.status === 'active' ? 'default' : 'secondary'} className="uppercase">
              {supplier.status || 'active'}
            </Badge>
          </div>
          <div className="flex items-center gap-3 mt-1 text-muted-foreground">
            {supplier.code && <span className="font-mono text-sm">{supplier.code}</span>}
            {supplier.company_name && (
              <>
                <Separator orientation="vertical" className="h-4" />
                <span className="text-sm">{supplier.company_name}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setShowPaymentDialog(true)} disabled={!supplier.balance || supplier.balance <= 0}>
            <Banknote className="h-4 w-4 mr-2" /> Record Payment
          </Button>
          <Button variant="outline" size="sm" onClick={() => router.push(`/purchase-orders?supplier=${params.id}&action=new`)}>
            <Plus className="h-4 w-4 mr-2" /> New Order
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Outstanding Balance</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-red-600">{formatKSh(supplier.balance ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Open Order Total</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{formatKSh(totalOutstanding)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Credit Terms</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{supplier.payment_terms || 'Net 30'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Total Paid</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-green-600">
              {formatKSh(payments.reduce((s, p) => s + (p.amount || 0), 0))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="overview"><Building2 className="h-4 w-4 mr-2" /> Overview</TabsTrigger>
          <TabsTrigger value="orders"><Package className="h-4 w-4 mr-2" /> Orders ({orders.length})</TabsTrigger>
          <TabsTrigger value="payments"><Banknote className="h-4 w-4 mr-2" /> Payment History ({payments.length})</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-lg">Supplier Details</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-xs text-muted-foreground">Contact Person</p><p className="font-medium">{supplier.contact_person || '-'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Phone</p><p className="font-medium" dir="ltr">{supplier.phone || '-'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Email</p><p className="font-medium">{supplier.email || '-'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Address</p><p className="font-medium">{supplier.address || '-'}</p></div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Payment & Credit</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-xs text-muted-foreground">Payment Terms</p><p className="font-medium">{supplier.payment_terms || 'Net 30'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Credit Days</p><p className="font-medium">{supplier.credit_days || 0} days</p></div>
                  <div><p className="text-xs text-muted-foreground">Credit Limit</p><p className="font-medium">{formatKSh(supplier.credit_limit ?? 0)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Current Balance</p><p className="font-medium text-red-600">{formatKSh(supplier.balance ?? 0)}</p></div>
                </div>
                {(supplier.credit_limit ?? 0) > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Credit Utilization</p>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${((supplier.balance ?? 0) / (supplier.credit_limit ?? 1)) > 0.8 ? 'bg-red-500' : 'bg-blue-500'}`}
                        style={{ width: `${Math.min(((supplier.balance ?? 0) / (supplier.credit_limit ?? 1)) * 100, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{(((supplier.balance ?? 0) / (supplier.credit_limit ?? 1)) * 100).toFixed(1)}% utilized</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Performance</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-xs text-muted-foreground">Rating</p><p className="text-2xl font-bold">{supplier.rating || '-'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Quality Score</p><p className="text-2xl font-bold">{supplier.quality_score || 0}%</p></div>
                  <div><p className="text-xs text-muted-foreground">On-Time Delivery</p><p className="text-2xl font-bold text-green-600">{100 - (supplier.late_delivery_pct || 0)}%</p></div>
                  <div><p className="text-xs text-muted-foreground">Outstanding Orders</p><p className="text-2xl font-bold">{supplier.outstanding_orders ?? 0}</p></div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Aging Snapshot</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-sm">Current Balance</span>
                  <span className="font-bold text-red-600">{formatKSh(supplier.balance ?? 0)}</span>
                </div>
                <div className="space-y-2">
                  {payments.length > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Last Payment</span>
                      <span>{new Date(payments[0].payment_date || payments[0].created_at).toLocaleDateString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Aging Days</span>
                    <span className="font-medium">
                      {orders.length > 0 && orders[orders.length - 1].ordered_at
                        ? Math.max(0, Math.floor(
                            (now - new Date(orders[orders.length - 1].ordered_at!).getTime()) / (1000 * 60 * 60 * 24)
                          ))
                        : 0} days
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Orders */}
        <TabsContent value="orders" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => router.push(`/purchase-orders?supplier=${params.id}&action=new`)}>
              <Plus className="h-4 w-4 mr-2" /> New Order
            </Button>
          </div>
          {orders.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-muted-foreground"><EmptyState title="No purchase orders yet" compact /></CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="text-left p-3 font-medium">PO Number</th>
                      <th className="text-left p-3 font-medium">Date</th>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-right p-3 font-medium">Items</th>
                      <th className="text-right p-3 font-medium">Total</th>
                      <th className="text-right p-3 font-medium">Received</th>
                      <th className="text-right p-3 font-medium">Balance Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((po) => {
                      const receivedValue = (po.items || []).filter((i) => i.received_quantity > 0).length
                      const totalItems = (po.items || []).length
                      const balanceDue = po.status !== 'received' && po.status !== 'cancelled' ? (po.total_amount || 0) : 0
                      return (
                        <tr key={po.id} className="border-b last:border-0 hover:bg-muted/50 cursor-pointer" onClick={() => router.push(`/purchase-orders?detail=${po.id}`)}>
                          <td className="p-3 font-mono text-xs">{po.po_number}</td>
                          <td className="p-3 text-sm">{po.ordered_at ? new Date(po.ordered_at).toLocaleDateString() : '-'}</td>
                          <td className="p-3"><Badge variant="outline">{po.status}</Badge></td>
                          <td className="p-3 text-right">{totalItems}</td>
                          <td className="p-3 text-right font-medium">{formatKSh(po.total_amount ?? 0)}</td>
                          <td className="p-3 text-right">{receivedValue} / {totalItems}</td>
                          <td className="p-3 text-right font-medium text-red-600">{balanceDue > 0 ? formatKSh(balanceDue) : '-'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Payment History */}
        <TabsContent value="payments" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowPaymentDialog(true)} disabled={!supplier.balance || supplier.balance <= 0}>
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
                      <th className="text-left p-3 font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="p-3 text-sm">{new Date(p.payment_date || p.created_at).toLocaleDateString()}</td>
                        <td className="p-3"><Badge variant="secondary">{p.payment_method}</Badge></td>
                        <td className="p-3 text-xs font-mono">{p.reference_number || '-'}</td>
                        <td className="p-3 text-right font-medium text-green-600">{formatKSh(p.amount)}</td>
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
            <DialogDescription>Record a payment to {supplier.name}</DialogDescription>
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
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cheque">Cheque</option>
                  <option value="cash">Cash</option>
                  <option value="mpesa">M-Pesa</option>
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
