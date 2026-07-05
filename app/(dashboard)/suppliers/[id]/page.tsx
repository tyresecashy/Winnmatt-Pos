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
  Shield, Users, CreditCard, Banknote, Link, ExternalLink,
  Award, AlertTriangle, CheckCircle2, XCircle, Clock, Download,
  Plus, Pencil, FileSignature,
} from 'lucide-react'
import { formatKSh } from '@/lib/currency'
import { toast } from '@/components/ui/use-toast'

// ─── Mock Data ────────────────────────────────────────────────────────────

const MOCK_SUPPLIER = {
  id: '1',
  name: 'Coca-Cola Beverages Kenya',
  code: 'SUP-001',
  company_name: 'Coca-Cola Beverages Kenya Ltd',
  contact_person: 'James Ochieng',
  phone: '+254 712 345 678',
  email: 'j.ochieng@cocacola.co.ke',
  address: 'Mombasa Road, Nairobi',
  tax_number: 'P051234567Z',
  payment_terms: 'Net 45',
  credit_limit: 2500000,
  bank_details: {
    bank: 'Equity Bank',
    account_name: 'Coca-Cola Kenya Ltd',
    account_number: '1234567890',
    branch: 'Upperhill',
  },
  balance: 540000,
  performance_score: 92,
  quality_score: 95,
  late_delivery_pct: 8,
  total_purchase_amount: 12800000,
  total_orders: 145,
  outstanding_orders: 3,
  status: 'active' as const,
  website: 'https://cocacola.co.ke',
  created_at: '2024-01-15',
  avg_delivery_days: 2,
  lead_time: 2,
}

const MOCK_CONTACTS = [
  { id: '1', name: 'James Ochieng', role: 'Account Manager', phone: '+254 712 345 678', email: 'j.ochieng@cocacola.co.ke', is_primary: true },
  { id: '2', name: 'Mary Wanjiku', role: 'Sales Executive', phone: '+254 723 456 789', email: 'm.wanjiku@cocacola.co.ke', is_primary: false },
  { id: '3', name: 'Peter Kamau', role: 'Delivery Coordinator', phone: '+254 734 567 890', email: 'p.kamau@cocacola.co.ke', is_primary: false },
]

const MOCK_PRODUCTS = [
  { id: '1', product_name: 'Coca-Cola 500ml', sku: 'CC-500', unit_price: 55, negotiated_price: 52, discount: 5, lead_time: 2, is_preferred: true, quality_rating: 5, last_purchased: '2026-06-28' },
  { id: '2', product_name: 'Fanta Orange 500ml', sku: 'FO-500', unit_price: 55, negotiated_price: 50, discount: 9, lead_time: 3, is_preferred: true, quality_rating: 4, last_purchased: '2026-06-25' },
  { id: '3', product_name: 'Sprite 500ml', sku: 'SP-500', unit_price: 55, negotiated_price: 51, discount: 7, lead_time: 2, is_preferred: false, quality_rating: 5, last_purchased: '2026-06-20' },
  { id: '4', product_name: 'Dasani Water 1L', sku: 'DW-1L', unit_price: 45, negotiated_price: 42, discount: 6, lead_time: 1, is_preferred: false, quality_rating: 5, last_purchased: '2026-06-30' },
]

const MOCK_DOCUMENTS = [
  { id: '1', name: 'Supply Agreement 2026.pdf', type: 'contract', uploaded_at: '2026-01-10', size: '2.4 MB', status: 'active', expiry: '2026-12-31' },
  { id: '2', name: 'KRA Tax Compliance.pdf', type: 'certificate', uploaded_at: '2026-03-15', size: '856 KB', status: 'active', expiry: '2027-03-14' },
  { id: '3', name: 'Quality Certificate KBS.pdf', type: 'certificate', uploaded_at: '2026-02-01', size: '1.2 MB', status: 'active', expiry: '2027-01-31' },
  { id: '4', name: 'Invoice - June 2026.pdf', type: 'invoice', uploaded_at: '2026-07-01', size: '145 KB', status: 'active', expiry: null },
]

const MOCK_PERFORMANCE = [
  { month: 'Jan 2026', on_time: 92, quality: 95, response: 88, overall: 92 },
  { month: 'Feb 2026', on_time: 95, quality: 97, response: 90, overall: 94 },
  { month: 'Mar 2026', on_time: 88, quality: 93, response: 85, overall: 89 },
  { month: 'Apr 2026', on_time: 90, quality: 96, response: 92, overall: 93 },
  { month: 'May 2026', on_time: 94, quality: 98, response: 89, overall: 94 },
  { month: 'Jun 2026', on_time: 91, quality: 95, response: 91, overall: 92 },
]

export default function SupplierDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  // In production, fetch from server action:
  // const supplier = await getSupplierById(params.id)
  // const contacts = await getSupplierContacts(params.id)
  // const products = await getSupplierProducts(params.id)
  // etc.

  useEffect(() => {
    setLoading(true)
    setTimeout(() => setLoading(false), 400)
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

  const sup = MOCK_SUPPLIER

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/suppliers')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{sup.name}</h1>
            <Badge variant={sup.status === 'active' ? 'default' : sup.status === 'blacklisted' ? 'destructive' : 'secondary'} className="uppercase">
              {sup.status}
            </Badge>
          </div>
          <div className="flex items-center gap-3 mt-1 text-muted-foreground">
            {sup.code && <span className="font-mono text-sm">{sup.code}</span>}
            {sup.company_name && (
              <>
                <Separator orientation="vertical" className="h-4" />
                <span className="text-sm">{sup.company_name}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Pencil className="h-4 w-4 mr-2" /> Edit
          </Button>
          <Button variant="outline" size="sm">
            <FileSignature className="h-4 w-4 mr-2" /> New Order
          </Button>
        </div>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Outstanding Balance</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{formatKSh(sup.balance)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Total Purchases</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{formatKSh(sup.total_purchase_amount)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Performance Score</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <p className="text-xl font-bold">{sup.performance_score}%</p>
              <Star className={`h-4 w-4 ${sup.performance_score >= 90 ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground'}`} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Quality Rating</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{sup.quality_score}%</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> Avg Delivery (Days)
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-xl font-bold">{sup.avg_delivery_days}</p></CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="overview"><Building2 className="h-4 w-4 mr-2" /> Overview</TabsTrigger>
          <TabsTrigger value="contacts"><Users className="h-4 w-4 mr-2" /> Contacts ({MOCK_CONTACTS.length})</TabsTrigger>
          <TabsTrigger value="products"><Package className="h-4 w-4 mr-2" /> Products ({MOCK_PRODUCTS.length})</TabsTrigger>
          <TabsTrigger value="documents"><FileText className="h-4 w-4 mr-2" /> Documents ({MOCK_DOCUMENTS.length})</TabsTrigger>
          <TabsTrigger value="performance"><TrendingUp className="h-4 w-4 mr-2" /> Performance</TabsTrigger>
        </TabsList>

        {/* ── Overview ─────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-lg">Company Details</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-xs text-muted-foreground">Company Name</p><p className="font-medium">{sup.company_name}</p></div>
                  <div><p className="text-xs text-muted-foreground">Supplier Code</p><p className="font-mono">{sup.code}</p></div>
                  <div><p className="text-xs text-muted-foreground">Tax Number</p><p className="font-mono">{sup.tax_number}</p></div>
                  <div><p className="text-xs text-muted-foreground">Website</p><p>{sup.website}</p></div>
                  <div><p className="text-xs text-muted-foreground">Member Since</p><p>{new Date(sup.created_at).toLocaleDateString('en-KE', { year: 'numeric', month: 'long' })}</p></div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Contact & Location</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3"><MapPin className="h-4 w-4 text-muted-foreground" /><span>{sup.address}</span></div>
                <div className="flex items-center gap-3"><User className="h-4 w-4 text-muted-foreground" /><span>{sup.contact_person}</span></div>
                <div className="flex items-center gap-3"><Phone className="h-4 w-4 text-muted-foreground" /><span dir="ltr">{sup.phone}</span></div>
                <div className="flex items-center gap-3"><Mail className="h-4 w-4 text-muted-foreground" /><span>{sup.email}</span></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Payment & Credit</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-xs text-muted-foreground">Payment Terms</p><p className="font-medium">{sup.payment_terms}</p></div>
                  <div><p className="text-xs text-muted-foreground">Credit Limit</p><p className="font-medium">{formatKSh(sup.credit_limit)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Current Balance</p><p className="font-medium">{formatKSh(sup.balance)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Credit Utilization</p>
                    <p className="font-medium">{((sup.balance / sup.credit_limit) * 100).toFixed(1)}%</p>
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Bank Details</p>
                  <p className="text-sm">{sup.bank_details.bank} - {sup.bank_details.account_name}</p>
                  <p className="text-xs text-muted-foreground">AC: {sup.bank_details.account_number} | {sup.bank_details.branch}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Performance Summary</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Total Orders</p>
                    <p className="text-2xl font-bold">{sup.total_orders}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Outstanding Orders</p>
                    <p className="text-2xl font-bold text-amber-600">{sup.outstanding_orders}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Late Deliveries</p>
                    <p className="text-2xl font-bold">{sup.late_delivery_pct}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Lead Time</p>
                    <p className="text-2xl font-bold">{sup.lead_time} days</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Contacts ─────────────────────────────────────── */}
        <TabsContent value="contacts" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button size="sm"><Plus className="h-4 w-4 mr-2" /> Add Contact</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {MOCK_CONTACTS.map(c => (
              <Card key={c.id}>
                <CardContent className="pt-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{c.name}</p>
                        <p className="text-sm text-muted-foreground">{c.role}</p>
                        <div className="mt-2 space-y-1">
                          <p className="text-sm flex items-center gap-2"><Phone className="h-3 w-3 text-muted-foreground" />{c.phone}</p>
                          <p className="text-sm flex items-center gap-2"><Mail className="h-3 w-3 text-muted-foreground" />{c.email}</p>
                        </div>
                      </div>
                    </div>
                    {c.is_primary && <Badge variant="default" className="shrink-0">Primary</Badge>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── Products ─────────────────────────────────────── */}
        <TabsContent value="products" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button size="sm"><Plus className="h-4 w-4 mr-2" /> Add Product</Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left p-3 font-medium">Product</th>
                    <th className="text-left p-3 font-medium">SKU</th>
                    <th className="text-right p-3 font-medium">List Price</th>
                    <th className="text-right p-3 font-medium">Negotiated</th>
                    <th className="text-right p-3 font-medium">Discount</th>
                    <th className="text-center p-3 font-medium">Preferred</th>
                    <th className="text-center p-3 font-medium">Rating</th>
                    <th className="text-right p-3 font-medium">Last Purchase</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_PRODUCTS.map(p => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="p-3 font-medium">{p.product_name}</td>
                      <td className="p-3 font-mono text-xs">{p.sku}</td>
                      <td className="p-3 text-right">{formatKSh(p.unit_price)}</td>
                      <td className="p-3 text-right font-bold text-green-600">{formatKSh(p.negotiated_price)}</td>
                      <td className="p-3 text-right">{p.discount}%</td>
                      <td className="p-3 text-center">
                        {p.is_preferred ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" /> : <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          {[1,2,3,4,5].map(s => <Star key={s} className={`h-3 w-3 ${s <= p.quality_rating ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground'}`} />)}
                        </div>
                      </td>
                      <td className="p-3 text-right text-sm text-muted-foreground">{new Date(p.last_purchased).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Documents ────────────────────────────────────── */}
        <TabsContent value="documents" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button size="sm"><Download className="h-4 w-4 mr-2" /> Upload Document</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {MOCK_DOCUMENTS.map(d => (
              <Card key={d.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="font-medium">{d.name}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <Badge variant="secondary" className="uppercase text-[10px]">{d.type}</Badge>
                        <span>{d.size}</span>
                        <span>Uploaded {new Date(d.uploaded_at).toLocaleDateString()}</span>
                      </div>
                      {d.expiry && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Expires {new Date(d.expiry).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <Button variant="ghost" size="icon"><Download className="h-4 w-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── Performance ──────────────────────────────────── */}
        <TabsContent value="performance" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">Monthly Performance Scores</CardTitle></CardHeader>
            <CardContent className="p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left p-3 font-medium">Month</th>
                    <th className="text-right p-3 font-medium">On-Time Delivery</th>
                    <th className="text-right p-3 font-medium">Product Quality</th>
                    <th className="text-right p-3 font-medium">Response Time</th>
                    <th className="text-right p-3 font-medium">Overall Score</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_PERFORMANCE.map(p => (
                    <tr key={p.month} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="p-3 font-medium">{p.month}</td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${p.on_time}%` }} />
                          </div>
                          <span className={p.on_time >= 90 ? 'text-green-600' : 'text-amber-600'}>{p.on_time}%</span>
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 rounded-full" style={{ width: `${p.quality}%` }} />
                          </div>
                          <span className={p.quality >= 90 ? 'text-green-600' : 'text-amber-600'}>{p.quality}%</span>
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-purple-500 rounded-full" style={{ width: `${p.response}%` }} />
                          </div>
                          <span className={p.response >= 90 ? 'text-green-600' : 'text-amber-600'}>{p.response}%</span>
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <Badge variant={p.overall >= 90 ? 'default' : p.overall >= 80 ? 'warning' : 'destructive'}>
                          {p.overall}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
