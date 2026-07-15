'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  ArrowLeft, Building2, Phone, Mail, User, MapPin, Calendar,
  DollarSign, Star, FileText, Package, TrendingUp, Truck,
  Shield, CreditCard, Plus, Pencil, Clock, Banknote, AlertTriangle,
} from 'lucide-react'
import { formatKSh } from '@/lib/currency'
import { EmptyState } from '@/components/ui/empty-state'
import { toast } from '@/components/ui/use-toast'
import {
  getSupplierById, getSupplierOrders, getSupplierPayments,
  type Supplier,
} from '@/lib/modules/suppliers'

export default function SupplierDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState('overview')

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
        toast({ title: 'Error', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' })
      } finally {
        setLoading(false)
      }
    }
    if (params.id) load()
  }, [params.id])

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
          actions={[{ label: 'Back to Suppliers', onClick: () => router.push('/suppliers'), variant: 'outline', icon: ArrowLeft }]}
        />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/suppliers')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{supplier.name}</h1>
            <Badge variant={supplier.status === 'active' ? 'default' : supplier.status === 'blacklisted' ? 'destructive' : 'secondary'} className="uppercase">
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
          <Button variant="outline" size="sm" onClick={() => router.push(`/suppliers/${params.id}/edit`)}>
            <Pencil className="h-4 w-4 mr-2" /> Edit
          </Button>
          <Button variant="outline" size="sm" onClick={() => router.push(`/purchase-orders?supplier=${params.id}&action=new`)}>
            <Plus className="h-4 w-4 mr-2" /> New Order
          </Button>
        </div>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Outstanding Balance</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{formatKSh(supplier.balance ?? 0)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Total Purchases</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{formatKSh(supplier.total_purchase_amount ?? 0)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Total Orders</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{supplier.total_orders}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Lead Time</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{supplier.lead_time || '-'} days</p></CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="overview"><Building2 className="h-4 w-4 mr-2" /> Overview</TabsTrigger>
          <TabsTrigger value="orders"><Package className="h-4 w-4 mr-2" /> Orders ({orders.length})</TabsTrigger>
          <TabsTrigger value="payments"><Banknote className="h-4 w-4 mr-2" /> Payments ({payments.length})</TabsTrigger>
        </TabsList>

        {/* ── Overview ─────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-lg">Company Details</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-xs text-muted-foreground">Supplier Code</p><p className="font-mono">{supplier.code || '-'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Company Name</p><p className="font-medium">{supplier.company_name || '-'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Tax Number</p><p className="font-mono">{supplier.tax_number || '-'}</p></div>
                  {supplier.website && <div><p className="text-xs text-muted-foreground">Website</p><p>{supplier.website}</p></div>}
                  <div><p className="text-xs text-muted-foreground">Member Since</p><p>{new Date(supplier.created_at ?? '').toLocaleDateString('en-KE', { year: 'numeric', month: 'long' })}</p></div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Contact & Location</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {supplier.address && <div className="flex items-center gap-3"><MapPin className="h-4 w-4 text-muted-foreground" /><span>{supplier.address}</span></div>}
                <div className="flex items-center gap-3"><User className="h-4 w-4 text-muted-foreground" /><span>{supplier.contact_person || '-'}</span></div>
                <div className="flex items-center gap-3"><Phone className="h-4 w-4 text-muted-foreground" /><span dir="ltr">{supplier.phone}</span></div>
                <div className="flex items-center gap-3"><Mail className="h-4 w-4 text-muted-foreground" /><span>{supplier.email || '-'}</span></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Payment & Credit</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-xs text-muted-foreground">Payment Terms</p><p className="font-medium">{supplier.payment_terms || 'Net 30'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Credit Limit</p><p className="font-medium">{formatKSh(supplier.credit_limit ?? 0)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Current Balance</p><p className="font-medium">{formatKSh(supplier.balance ?? 0)}</p></div>
                  {(supplier.credit_limit ?? 0) > 0 && (
                    <div><p className="text-xs text-muted-foreground">Credit Utilization</p>
                      <p className="font-medium">{((supplier.balance ?? 0) / (supplier.credit_limit ?? 1) * 100).toFixed(1)}%</p>
                    </div>
                  )}
                </div>
                {(supplier.bank_name || supplier.bank_account) && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Bank Details</p>
                      <p className="text-sm">{supplier.bank_name || 'N/A'} {supplier.bank_account ? `- ${supplier.bank_account}` : ''}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Performance Summary</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Rating</p>
                    <p className="text-2xl font-bold">{supplier.rating || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Quality Score</p>
                    <p className="text-2xl font-bold">{supplier.quality_score || 0}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Late Delivery</p>
                    <p className="text-2xl font-bold text-amber-600">{supplier.late_delivery_pct || 0}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Outstanding Orders</p>
                    <p className="text-2xl font-bold">{supplier.outstanding_orders}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Orders ────────────────────────────────────────── */}
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
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((po) => (
                      <tr key={po.id} className="border-b last:border-0 hover:bg-muted/50 cursor-pointer" onClick={() => router.push(`/purchase-orders?detail=${po.id}`)}>
                        <td className="p-3 font-mono text-xs">{po.po_number}</td>
                        <td className="p-3 text-sm">{new Date(po.order_date).toLocaleDateString()}</td>
                        <td className="p-3"><Badge variant="outline">{po.status}</Badge></td>
                        <td className="p-3 text-right">{(po.items || []).length}</td>
                        <td className="p-3 text-right font-medium">{formatKSh(po.total_amount)}</td>
                        <td className="p-3 text-right">{(po.items || []).filter((i: { received_quantity?: number }) => (i.received_quantity ?? 0) > 0).length} / {(po.items || []).length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Payments ──────────────────────────────────────── */}
        <TabsContent value="payments" className="space-y-4 mt-4">
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
    </div>
  )
}
