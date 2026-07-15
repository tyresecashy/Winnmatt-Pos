'use client'

import { useState, useEffect, useCallback, startTransition } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from '@/hooks/use-toast'
import { formatKSh } from '@/lib/currency'
import {
  getSupplierInvoices, getSupplierInvoice, createSupplierInvoice,
  approveSupplierInvoice, cancelSupplierInvoice, markInvoicePaid,
  type SupplierInvoice,
  getSuppliers,
} from '@/lib/modules/suppliers'
import { getPurchaseOrders } from '@/lib/modules/procurement'
import { Receipt, Plus, CheckCircle, XCircle, RefreshCw, FileText, DollarSign } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  submitted: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  overdue: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  cancelled: 'bg-muted text-muted-foreground',
}

export default function SupplierInvoicesPage() {
  const { profile } = useAuth()
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [showCreate, setShowCreate] = useState(false)
  const [showDetail, setShowDetail] = useState<SupplierInvoice | null>(null)

  // Create form state
  const [supplierId, setSupplierId] = useState('')
  const [supplierList, setSupplierList] = useState<Array<{ id: string; name: string }>>([])
  const [poList, setPoList] = useState<Array<{ id: string; po_number: string; total_amount: number }>>([])
  const [selectedPoId, setSelectedPoId] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [amount, setAmount] = useState(0)
  const [taxAmount, setTaxAmount] = useState(0)
  const [totalAmount, setTotalAmount] = useState(0)
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const loadInvoices = useCallback(async () => {
    setLoading(true)
    const data = await getSupplierInvoices(undefined, statusFilter || undefined)
    setInvoices(data)
    setLoading(false)
  }, [statusFilter])

  useEffect(() => { startTransition(() => { loadInvoices() }) }, [statusFilter, loadInvoices])

  useEffect(() => {
    if (showCreate) {
      getSuppliers().then(s => setSupplierList(s.map((sup: { id: string; name: string }) => ({ id: sup.id, name: sup.name }))))
      getPurchaseOrders().then(orders => setPoList(orders.map((po: { id: string; po_number: string | null; total_amount: number | null }) => ({ id: po.id, po_number: po.po_number ?? '', total_amount: po.total_amount ?? 0 }))))
    }
  }, [showCreate])

  useEffect(() => {
    // Auto-calculate total when amount or tax changes
    startTransition(() => { setTotalAmount(amount + taxAmount) })
  }, [amount, taxAmount])

  async function handleCreate() {
    if (!supplierId || !invoiceNumber || !dueDate) {
      toast({ title: 'Validation', description: 'Supplier, invoice number, and due date required', variant: 'destructive' })
      return
    }
    setSaving(true)
    const result = await createSupplierInvoice({
      invoice_number: invoiceNumber,
      supplier_id: supplierId,
      purchase_order_id: selectedPoId || undefined,
      amount, tax_amount: taxAmount, total_amount: totalAmount,
      due_date: dueDate, notes: notes || undefined,
    })
    setSaving(false)
    if (result.success) {
      toast({ title: 'Created', description: 'Supplier invoice created. Matching initiated.' })
      setShowCreate(false)
      setSupplierId(''); setSelectedPoId(''); setInvoiceNumber('')
      setAmount(0); setTaxAmount(0); setTotalAmount(0); setDueDate(''); setNotes('')
      loadInvoices()
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' })
    }
  }

  async function handleApprove(id: string) {
    const result = await approveSupplierInvoice(id)
    if (result.success) { toast({ title: 'Approved' }); loadInvoices(); if (showDetail) loadDetail(id) }
    else toast({ title: 'Error', description: result.error, variant: 'destructive' })
  }

  async function handleCancel(id: string) {
    if (!confirm('Cancel this invoice?')) return
    const result = await cancelSupplierInvoice(id)
    if (result.success) { toast({ title: 'Cancelled' }); loadInvoices(); if (showDetail) loadDetail(id) }
    else toast({ title: 'Error', description: result.error, variant: 'destructive' })
  }

  async function handleMarkPaid(id: string) {
    const result = await markInvoicePaid(id)
    if (result.success) { toast({ title: 'Marked Paid' }); loadInvoices(); if (showDetail) loadDetail(id) }
    else toast({ title: 'Error', description: result.error, variant: 'destructive' })
  }

  async function loadDetail(id: string) {
    const inv = await getSupplierInvoice(id)
    setShowDetail(inv)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Receipt className="h-8 w-8 text-blue-500" />
            Supplier Invoices
          </h1>
          <p className="text-muted-foreground mt-1">Manage invoices from suppliers</p>
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={v => setStatusFilter(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-36"><SelectValue placeholder="All Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={loadInvoices}><RefreshCw className="h-4 w-4 mr-1" /> Refresh</Button>
          <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-1" /> New Invoice</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>PO</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map(inv => (
                <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/50" onClick={() => loadDetail(inv.id)}>
                  <TableCell className="font-mono text-sm">{inv.invoice_number}</TableCell>
                  <TableCell className="font-medium">{inv.supplier?.name || '-'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{inv.purchase_order?.po_number || '-'}</TableCell>
                  <TableCell className="text-sm">{new Date(inv.due_date).toLocaleDateString()}</TableCell>
                  <TableCell><Badge className={STATUS_COLORS[inv.status] || ''}>{inv.status}</Badge></TableCell>
                  <TableCell className="text-right font-mono">{formatKSh(inv.total_amount)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      {inv.status === 'submitted' && (
                        <>
                          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleApprove(inv.id) }}>
                            <CheckCircle className="h-4 w-4 mr-1" /> Approve
                          </Button>
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleCancel(inv.id) }}>
                            <XCircle className="h-4 w-4 text-red-500" />
                          </Button>
                        </>
                      )}
                      {inv.status === 'approved' && (
                        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleMarkPaid(inv.id) }}>
                          <DollarSign className="h-4 w-4 mr-1" /> Mark Paid
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {invoices.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8"><EmptyState icon={Receipt} title="No supplier invoices" compact /></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Invoice Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>New Supplier Invoice</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Supplier *</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>
                  {supplierList.length === 0 ? (
                    <SelectItem value="__none__" disabled>No suppliers found</SelectItem>
                  ) : supplierList.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Purchase Order (optional)</Label>
              <Select value={selectedPoId} onValueChange={setSelectedPoId}>
                <SelectTrigger><SelectValue placeholder="Link to PO (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {poList.length === 0 ? (
                    <SelectItem value="__no_pos__" disabled>No purchase orders available</SelectItem>
                  ) : poList.map(po => (
                    <SelectItem key={po.id} value={po.id}>{po.po_number} - {formatKSh(po.total_amount)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Invoice Number *</Label>
              <Input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="INV-001" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Amount (excl. tax)</Label>
                <Input type="number" min={0} value={amount || ''} onChange={e => setAmount(parseInt(e.target.value) || 0)} />
              </div>
              <div><Label>Tax Amount</Label>
                <Input type="number" min={0} value={taxAmount || ''} onChange={e => setTaxAmount(parseInt(e.target.value) || 0)} />
              </div>
            </div>
            <div><Label>Total *</Label>
              <Input type="number" min={0} value={totalAmount || ''} onChange={e => setTotalAmount(parseInt(e.target.value) || 0)} className="font-bold" />
              <p className="text-xs text-muted-foreground mt-1">Auto-calculated from amount + tax. Edit manually if different.</p>
            </div>
            <div><Label>Due Date *</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
            <div><Label>Notes</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? 'Creating...' : 'Create Invoice'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!showDetail} onOpenChange={() => setShowDetail(null)}>
        <DialogContent className="sm:max-w-xl">
          {showDetail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" /> {showDetail.invoice_number}
                  <Badge className={STATUS_COLORS[showDetail.status] || ''}>{showDetail.status}</Badge>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Supplier</span><p className="font-medium">{showDetail.supplier?.name || '-'}</p></div>
                  <div><span className="text-muted-foreground">PO</span><p className="font-medium">{showDetail.purchase_order?.po_number || '-'}</p></div>
                  <div><span className="text-muted-foreground">Created</span><p className="font-medium">{new Date(showDetail.created_at).toLocaleDateString()}</p></div>
                  <div><span className="text-muted-foreground">Due Date</span><p className="font-medium">{new Date(showDetail.due_date).toLocaleDateString()}</p></div>
                </div>
                <div className="border-t pt-3 space-y-1 text-sm">
                  <div className="flex justify-between"><span>Amount (excl. tax)</span><span className="font-mono">{formatKSh(showDetail.amount)}</span></div>
                  <div className="flex justify-between"><span>Tax</span><span className="font-mono">{formatKSh(showDetail.tax_amount)}</span></div>
                  <div className="flex justify-between text-lg font-bold"><span>Total</span><span className="font-mono">{formatKSh(showDetail.total_amount)}</span></div>
                </div>
                {showDetail.notes && (
                  <div className="text-sm"><span className="text-muted-foreground">Notes:</span><p>{showDetail.notes}</p></div>
                )}
              </div>
              <DialogFooter className="gap-2">
                {showDetail.status === 'submitted' && (
                  <>
                    <Button onClick={() => handleApprove(showDetail.id)}>Approve</Button>
                    <Button variant="destructive" onClick={() => handleCancel(showDetail.id)}>Cancel</Button>
                  </>
                )}
                {showDetail.status === 'approved' && (
                  <Button onClick={() => handleMarkPaid(showDetail.id)}>Mark Paid</Button>
                )}
                <Button variant="outline" onClick={() => { setShowDetail(null); loadInvoices() }}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
