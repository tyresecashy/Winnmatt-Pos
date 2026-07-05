'use client'

import { useState } from 'react'
import { FileText, Download, Plus, Search, Filter, Eye, Send, CheckCircle, XCircle, DollarSign, Calendar, AlertTriangle } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { createInvoiceFromSale, updateInvoiceStatus, recordInvoicePayment, deleteInvoice, getInvoiceStats } from '@/lib/invoice-actions'
import { useToast } from '@/components/ui/use-toast'

interface Invoice {
  id: string
  invoice_number: string
  customer_id: string
  customer_name: string
  customer_phone: string | null
  branch_id: string
  branch_name: string
  sale_id: string | null
  total_amount_cents: number
  paid_amount_cents: number
  status: string
  due_date: string
  issued_date: string
  paid_date: string | null
  notes: string | null
  item_count: number
  created_by_name: string
  created_at: string
}

interface CustomerOption {
  id: string
  name: string
  phone: string | null
}

interface BranchOption {
  id: string
  name: string
}

interface CreditSale {
  id: string
  sale_number: string
  customer_id: string
  total_amount: number
  created_at: string
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'warning' }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  sent: { label: 'Sent', variant: 'default' },
  paid: { label: 'Paid', variant: 'default' },
  overdue: { label: 'Overdue', variant: 'destructive' },
  cancelled: { label: 'Cancelled', variant: 'outline' },
  partially_paid: { label: 'Partially Paid', variant: 'warning' },
}

export function InvoicesClient({
  initialInvoices,
  customers,
  branches,
  creditSales,
}: {
  initialInvoices: Invoice[]
  customers: CustomerOption[]
  branches: BranchOption[]
  creditSales: CreditSale[]
}) {
  const { toast } = useToast()
  const [invoices, setInvoices] = useState(initialInvoices)
  const [activeTab, setActiveTab] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showDetailDialog, setShowDetailDialog] = useState<string | null>(null)
  const [showPayDialog, setShowPayDialog] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Create invoice form
  const [selectedSale, setSelectedSale] = useState('')
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().split('T')[0]
  })

  // Pay form
  const [payAmount, setPayAmount] = useState('')

  // Filter invoices by tab
  const displayed = invoices.filter(inv => {
    const matchesTab = activeTab === 'all' || inv.status === activeTab
    const sq = searchQuery.toLowerCase()
    const matchesSearch = !sq ||
      inv.invoice_number.toLowerCase().includes(sq) ||
      (inv.customer_name && inv.customer_name.toLowerCase().includes(sq))
    return matchesTab && matchesSearch
  })

  // Stats
  const totalOutstanding = invoices
    .filter(i => i.status !== 'paid' && i.status !== 'cancelled')
    .reduce((s, i) => s + (i.total_amount_cents - i.paid_amount_cents), 0)
  const overdueCount = invoices.filter(i => i.status === 'overdue').length
  const overdueTotal = invoices
    .filter(i => i.status === 'overdue')
    .reduce((s, i) => s + (i.total_amount_cents - i.paid_amount_cents), 0)
  const totalDue = invoices.reduce((s, i) => s + i.total_amount_cents, 0)

  async function handleCreateInvoice() {
    if (!selectedSale) return
    setSubmitting(true)
    try {
      const result = await createInvoiceFromSale(selectedSale, dueDate)
      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' })
      } else {
        toast({ title: 'Success', description: `Invoice ${result.invoice?.invoice_number || ''} created` })
        setShowCreateDialog(false)
        setSelectedSale('')
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleMarkPaid(invoiceId: string) {
    setSubmitting(true)
    try {
      const result = await updateInvoiceStatus(invoiceId, 'paid')
      if (result.error) toast({ title: 'Error', description: result.error, variant: 'destructive' })
      else toast({ title: 'Success', description: 'Invoice marked as paid' })
    } finally { setSubmitting(false) }
  }

  async function handleCancel(invoiceId: string) {
    setSubmitting(true)
    try {
      const result = await updateInvoiceStatus(invoiceId, 'cancelled')
      if (result.error) toast({ title: 'Error', description: result.error, variant: 'destructive' })
      else toast({ title: 'Success', description: 'Invoice cancelled' })
    } finally { setSubmitting(false) }
  }

  async function handleRecordPayment() {
    if (!showPayDialog || !payAmount) return
    setSubmitting(true)
    try {
      const result = await recordInvoicePayment(showPayDialog, Math.round(parseFloat(payAmount)))
      if (result.error) toast({ title: 'Error', description: result.error, variant: 'destructive' })
      else {
        toast({ title: 'Success', description: 'Payment recorded against invoice' })
        setShowPayDialog(null)
        setPayAmount('')
      }
    } finally { setSubmitting(false) }
  }

  async function handleDelete(invoiceId: string) {
    if (!confirm('Are you sure you want to delete this draft invoice?')) return
    setSubmitting(true)
    try {
      const result = await deleteInvoice(invoiceId)
      if (result.error) toast({ title: 'Error', description: result.error, variant: 'destructive' })
      else {
        toast({ title: 'Success', description: 'Draft invoice deleted' })
        setInvoices(prev => prev.filter(i => i.id !== invoiceId))
      }
    } finally { setSubmitting(false) }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground">Generate invoices from credit sales and track payments</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" /> Create Invoice
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Invoice Value</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatKSh(totalDue)}</div>
            <p className="text-xs text-muted-foreground">{invoices.length} invoices</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatKSh(totalOutstanding)}</div>
            <p className="text-xs text-muted-foreground">Unpaid balance</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{formatKSh(overdueTotal)}</div>
            <p className="text-xs text-muted-foreground">{overdueCount} overdue invoices</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Due This Month</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatKSh(
                invoices
                  .filter(i => {
                    const d = new Date(i.due_date)
                    const now = new Date()
                    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && i.status !== 'paid' && i.status !== 'cancelled'
                  })
                  .reduce((s, i) => s + (i.total_amount_cents - i.paid_amount_cents), 0)
              )}
            </div>
            <p className="text-xs text-muted-foreground">Due this month</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs + Search */}
      <div className="flex items-center justify-between gap-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="draft">Draft</TabsTrigger>
            <TabsTrigger value="sent">Sent</TabsTrigger>
            <TabsTrigger value="paid">Paid</TabsTrigger>
            <TabsTrigger value="overdue">Overdue</TabsTrigger>
            <TabsTrigger value="partially_paid">Partial</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-64">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search invoices..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Invoice Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayed.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">No invoices found</TableCell>
              </TableRow>
            ) : displayed.map((inv) => {
              const cfg = statusConfig[inv.status] || { label: inv.status, variant: 'secondary' as const }
              const balance = inv.total_amount_cents - inv.paid_amount_cents
              return (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono text-sm font-medium">{inv.invoice_number}</TableCell>
                  <TableCell>
                    <div>{inv.customer_name}</div>
                    {inv.customer_phone && <div className="text-xs text-muted-foreground">{inv.customer_phone}</div>}
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatKSh(inv.total_amount_cents)}</TableCell>
                  <TableCell className="text-right font-mono">{formatKSh(inv.paid_amount_cents)}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">{formatKSh(balance)}</TableCell>
                  <TableCell>
                    <Badge variant={cfg.variant as any}>{cfg.label}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {new Date(inv.due_date).toLocaleDateString()}
                    {inv.status !== 'paid' && inv.status !== 'cancelled' && new Date(inv.due_date) < new Date() && (
                      <div className="text-destructive text-xs font-medium">Overdue</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => setShowDetailDialog(inv.id)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      {inv.status === 'draft' && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => handleMarkPaid(inv.id)} title="Mark as sent">
                            <Send className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(inv.id)} title="Delete draft">
                            <XCircle className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </>
                      )}
                      {(inv.status === 'sent' || inv.status === 'partially_paid' || inv.status === 'overdue') && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => { setShowPayDialog(inv.id); setPayAmount(String(inv.total_amount_cents - inv.paid_amount_cents)) }} title="Record payment">
                            <DollarSign className="h-3.5 w-3.5 text-green-600" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleMarkPaid(inv.id)} title="Mark paid">
                            <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleCancel(inv.id)} title="Cancel">
                            <XCircle className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Create Invoice Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Invoice from Credit Sale</DialogTitle>
            <DialogDescription>Select a credit sale to generate an invoice</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Credit Sale</Label>
              <Select value={selectedSale} onValueChange={setSelectedSale}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a credit sale..." />
                </SelectTrigger>
                <SelectContent>
                  {creditSales.map(s => {
                    const cust = customers.find(c => c.id === s.customer_id)
                    return (
                      <SelectItem key={s.id} value={s.id}>
                        {s.sale_number || s.id.slice(0, 8)} - {cust?.name || 'Unknown'} ({formatKSh(Math.round(s.total_amount))})
                      </SelectItem>
                    )
                  })}
                  {creditSales.length === 0 && (
                    <SelectItem value="__none__" disabled>No credit sales available</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateInvoice} disabled={!selectedSale || submitting}>
              {submitting ? 'Creating...' : 'Create Invoice'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={!!showPayDialog} onOpenChange={(o) => { if (!o) setShowPayDialog(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>Record a payment against this invoice</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Payment Amount (KES)</Label>
              <Input type="number" step="0.01" min="0" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayDialog(null)}>Cancel</Button>
            <Button onClick={handleRecordPayment} disabled={!payAmount || submitting}>
              {submitting ? 'Recording...' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Detail Dialog */}
      <Dialog open={!!showDetailDialog} onOpenChange={(o) => { if (!o) setShowDetailDialog(null) }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Invoice Detail</DialogTitle>
          </DialogHeader>
          {showDetailDialog && (() => {
            const inv = invoices.find(i => i.id === showDetailDialog)
            if (!inv) return <p>Invoice not found</p>
            const cfg = statusConfig[inv.status] || { label: inv.status, variant: 'secondary' as const }
            return (
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold">{inv.invoice_number}</h3>
                    <p className="text-sm text-muted-foreground">{inv.customer_name}</p>
                    {inv.customer_phone && <p className="text-sm text-muted-foreground">{inv.customer_phone}</p>}
                  </div>
                  <Badge variant={cfg.variant as any} className="text-sm">{cfg.label}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Branch:</span> {inv.branch_name}</div>
                  <div><span className="text-muted-foreground">Issued:</span> {new Date(inv.issued_date).toLocaleDateString()}</div>
                  <div><span className="text-muted-foreground">Due Date:</span> {new Date(inv.due_date).toLocaleDateString()}</div>
                  <div><span className="text-muted-foreground">Paid Date:</span> {inv.paid_date ? new Date(inv.paid_date).toLocaleDateString() : '-'}</div>
                  <div><span className="text-muted-foreground">Created By:</span> {inv.created_by_name}</div>
                  <div><span className="text-muted-foreground">Items:</span> {inv.item_count}</div>
                </div>
                <div className="border-t pt-4">
                  <div className="flex justify-between text-sm">
                    <span>Total Amount</span>
                    <span className="font-mono font-semibold">{formatKSh(inv.total_amount_cents)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Paid</span>
                    <span className="font-mono">{formatKSh(inv.paid_amount_cents)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-t pt-2 mt-2">
                    <span>Balance Due</span>
                    <span className="font-mono">{formatKSh(inv.total_amount_cents - inv.paid_amount_cents)}</span>
                  </div>
                </div>
                {inv.notes && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Notes:</span> {inv.notes}
                  </div>
                )}
              </div>
            )
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(null)}>Close</Button>
            {showDetailDialog && invoices.find(i => i.id === showDetailDialog)?.status === 'sent' && (
              <Button onClick={async () => { await handleMarkPaid(showDetailDialog!); setShowDetailDialog(null) }}>
                Mark as Paid
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
