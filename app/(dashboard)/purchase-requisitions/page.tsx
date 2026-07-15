'use client'

import { useState, useEffect, useCallback, startTransition } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  getRequisitions, getRequisitionById, createRequisition, 
  submitRequisition, approveRequisition, rejectRequisition, cancelRequisition, deleteRequisition,
  getRequisitionForPO,
  type PurchaseRequisition,
  type RequisitionUrgency,
} from '@/lib/modules/procurement'
import { getSuppliers } from '@/lib/modules/suppliers'
import { searchProducts } from '@/lib/modules/inventory'
import { useRouter } from 'next/navigation'
import { FileText, Plus, CheckCircle, XCircle, Send, RefreshCw, Trash2 } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

interface RequisitionDetail {
  id: string
  requisition_number: string
  status: string
  urgency: string
  notes: string | null
  expected_date: string | null
  rejection_reason: string | null
  supplier_id: string | null
  supplier?: { company_name?: string } | null
  requester?: { full_name?: string } | null
  approver?: { full_name?: string } | null
  branch?: { name?: string } | null
  items: Array<{
    id: string
    product?: { name?: string; sku?: string; unit_price?: number } | null
    quantity_requested: number
    quantity_approved?: number | null
    unit_price_estimate?: number | null
  }>
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  pending_approval: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  cancelled: 'bg-gray-100 text-muted-foreground dark:bg-gray-800 dark:text-muted-foreground',
}

export default function RequisitionsPage() {
  const { profile } = useAuth()
  const router = useRouter()
  const [requisitions, setRequisitions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)

  // Create dialog fields
  const [reqSupplierId, setReqSupplierId] = useState('')
  const [reqSupplierName, setReqSupplierName] = useState('')
  const [reqNotes, setReqNotes] = useState('')
  const [reqExpectedDate, setReqExpectedDate] = useState('')
  const [reqUrgency, setReqUrgency] = useState<string>('normal')
  const [reqItems, setReqItems] = useState<Array<{ product_id: string; product_name: string; sku: string; quantity_requested: string; unit_price_estimate: string; notes: string }>>([{ product_id: '', product_name: '', sku: '', quantity_requested: '1', unit_price_estimate: '', notes: '' }])

  const [suppliers, setSuppliers] = useState<any[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [productResults, setProductResults] = useState<any[]>([])
  const [showProductPicker, setShowProductPicker] = useState<number | null>(null)

  // Detail dialog
  const [selectedReq, setSelectedReq] = useState<RequisitionDetail | null>(null)
  const [showDetail, setShowDetail] = useState(false)

  // Approve dialog
  const [showApproveDialog, setShowApproveDialog] = useState(false)
  const [approveItems, setApproveItems] = useState<Array<{ item_id: string; product_name: string; quantity_requested: number; quantity_approved: string }>>([])

  // Reject dialog
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const loadRequisitions = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getRequisitions({
        status: (statusFilter as string || undefined) as 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'cancelled' | undefined,
        branchId: profile?.branch_id ?? undefined,
      })
      setRequisitions(data)
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [statusFilter, profile])

  useEffect(() => { startTransition(() => { loadRequisitions() }) }, [loadRequisitions])

  async function loadSuppliers() {
    try {
      const data = await getSuppliers()
      setSuppliers(data)
    } catch { /* ignore */ }
  }

  async function searchProduct(query: string) {
    setProductSearch(query)
    if (query.length < 2) { setProductResults([]); return }
    try {
      const results = await searchProducts(query)
      setProductResults(results)
    } catch { setProductResults([]) }
  }

  async function handleCreate() {
    const validItems = reqItems.filter(i => i.product_id && parseFloat(i.quantity_requested) > 0)
    if (validItems.length === 0) {
      toast({ title: 'Error', description: 'Add at least one item with quantity', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      const result = await createRequisition({
        branch_id: profile?.branch_id || '',
        supplier_id: reqSupplierId || undefined,
        notes: reqNotes || undefined,
        expected_date: reqExpectedDate || undefined,
        urgency: reqUrgency as RequisitionUrgency,
        items: validItems.map(i => ({
          product_id: i.product_id,
          quantity_requested: parseFloat(i.quantity_requested),
          unit_price_estimate: i.unit_price_estimate ? parseFloat(i.unit_price_estimate) : undefined,
          notes: i.notes || undefined,
        })),
      })
      toast({ title: 'Created', description: `Requisition ${result.requisition_number} created` })
      setShowCreate(false)
      resetCreateForm()
      loadRequisitions()
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  function resetCreateForm() {
    setReqSupplierId('')
    setReqSupplierName('')
    setReqNotes('')
    setReqExpectedDate('')
    setReqUrgency('normal')
    setReqItems([{ product_id: '', product_name: '', sku: '', quantity_requested: '1', unit_price_estimate: '', notes: '' }])
  }

  function addItemRow() {
    setReqItems([...reqItems, { product_id: '', product_name: '', sku: '', quantity_requested: '1', unit_price_estimate: '', notes: '' }])
  }

  function removeItemRow(idx: number) {
    if (reqItems.length <= 1) return
    setReqItems(reqItems.filter((_, i) => i !== idx))
  }

  function updateItem(idx: number, field: string, value: string) {
    const items = [...reqItems] as Array<Record<string, string>>
    items[idx][field] = value
    setReqItems(items as typeof reqItems)
  }

  function selectProduct(idx: number, product: { id: string; name: string; sku?: string; unit_price?: number }) {
    const items = [...reqItems]
    items[idx].product_id = product.id
    items[idx].product_name = product.name
    items[idx].sku = product.sku || ''
    if (!items[idx].unit_price_estimate) items[idx].unit_price_estimate = String(product.unit_price || '')
    setReqItems(items)
    setShowProductPicker(null)
    setProductSearch('')
    setProductResults([])
  }

  async function handleSubmit(id: string) {
    try {
      await submitRequisition(id)
      toast({ title: 'Submitted', description: 'Requisition submitted for approval' })
      loadRequisitions()
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' })
    }
  }

  async function openApproveDialog(req: RequisitionDetail) {
    try {
      const full = await getRequisitionById(req.id) as unknown as RequisitionDetail
      setSelectedReq(full)
      setApproveItems((full.items || []).map((item) => ({
        item_id: item.id,
        product_name: item.product?.name || '',
        quantity_requested: item.quantity_requested,
        quantity_approved: String(item.quantity_requested),
      })))
      setShowApproveDialog(true)
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' })
    }
  }

  async function handleApprove() {
    if (!selectedReq) return
    try {
      await approveRequisition(
        selectedReq.id,
        approveItems.map(i => ({ item_id: i.item_id, quantity_approved: parseFloat(i.quantity_approved) }))
      )
      toast({ title: 'Approved', description: 'Requisition approved' })
      setShowApproveDialog(false)
      setSelectedReq(null)
      loadRequisitions()
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' })
    }
  }

  async function handleReject() {
    if (!selectedReq || !rejectReason.trim()) {
      toast({ title: 'Error', description: 'Enter a rejection reason', variant: 'destructive' })
      return
    }
    try {
      await rejectRequisition(selectedReq.id, rejectReason)
      toast({ title: 'Rejected', description: 'Requisition rejected' })
      setShowRejectDialog(false)
      setRejectReason('')
      setSelectedReq(null)
      loadRequisitions()
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' })
    }
  }

  async function handleCancel(id: string) {
    try {
      await cancelRequisition(id)
      toast({ title: 'Cancelled', description: 'Requisition cancelled' })
      loadRequisitions()
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' })
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteRequisition(id)
      toast({ title: 'Deleted', description: 'Requisition deleted' })
      loadRequisitions()
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' })
    }
  }

  async function createPOFromReq(reqId: string) {
    try {
      const data = await getRequisitionForPO(reqId)
      // Navigate to purchase orders page with requisition data
      router.push(`/purchase-orders?requisition=${reqId}&supplier=${data.supplier_id || ''}&action=new`)
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' })
    }
  }

  async function viewDetail(req: RequisitionDetail) {
    try {
      const full = await getRequisitionById(req.id) as unknown as RequisitionDetail
      setSelectedReq(full)
      setShowDetail(true)
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' })
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Purchase Requisitions</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={loadRequisitions}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Button size="sm" className="gap-2" onClick={() => { loadSuppliers(); setShowCreate(true) }}>
            <Plus className="h-4 w-4" /> New Requisition
          </Button>
        </div>
      </div>

      {/* Status Filter */}
      <div className="flex flex-wrap gap-1">
        {['', 'draft', 'pending_approval', 'approved', 'rejected', 'cancelled'].map(s => (
          <Button
            key={s}
            variant={statusFilter === s ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(s)}
          >
            {s ? s.replace('_', ' ') : 'All'}
          </Button>
        ))}
      </div>

      {/* List */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Urgency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Loading...</TableCell></TableRow>
              ) : requisitions.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground"><EmptyState icon={FileText} title="No requisitions found" compact /></TableCell></TableRow>
              ) : (
                requisitions.map((req) => (
                  <TableRow key={req.id} className="cursor-pointer" onClick={() => viewDetail(req)}>
                    <TableCell className="font-mono text-xs font-medium">{req.requisition_number}</TableCell>
                    <TableCell>{req.supplier?.company_name || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">—</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        req.urgency === 'urgent' ? 'border-red-300 text-red-600' :
                        req.urgency === 'high' ? 'border-amber-300 text-amber-600' :
                        'border'
                      }>{req.urgency}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[req.status] || ''}>
                        {req.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {req.requester?.full_name || '—'}
                    </TableCell>
                    <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        {req.status === 'draft' && (
                          <>
                            <Button variant="ghost" size="sm" className="text-amber-600 gap-1" onClick={() => handleSubmit(req.id)}>
                              <Send className="h-3 w-3" /> Submit
                            </Button>
                            <Button variant="ghost" size="sm" className="text-destructive gap-1" onClick={() => handleDelete(req.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                        {req.status === 'pending_approval' && (
                          <>
                            <Button variant="ghost" size="sm" className="text-green-600 gap-1" onClick={() => openApproveDialog(req)}>
                              <CheckCircle className="h-3 w-3" /> Approve
                            </Button>
                            <Button variant="ghost" size="sm" className="text-destructive gap-1" onClick={() => { setSelectedReq(req); setShowRejectDialog(true) }}>
                              <XCircle className="h-3 w-3" /> Reject
                            </Button>
                            <Button variant="ghost" size="sm" className="text-muted-foreground gap-1" onClick={() => handleCancel(req.id)}>
                              Cancel
                            </Button>
                          </>
                        )}
                        {req.status === 'approved' && (
                          <Button variant="ghost" size="sm" className="text-blue-600 gap-1" onClick={() => createPOFromReq(req.id)}>
                            <Plus className="h-3 w-3" /> Create PO
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Purchase Requisition</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Supplier (optional)</Label>
                <Select value={reqSupplierId} onValueChange={(v) => { setReqSupplierId(v); setReqSupplierName(suppliers.find(s => s.id === v)?.name || '') }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select supplier..." />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s: { id: string; name?: string; company_name?: string }) => (
                      <SelectItem key={s.id} value={s.id}>{s.name || s.company_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Urgency</Label>
                <Select value={reqUrgency} onValueChange={setReqUrgency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Expected Date</Label>
                <Input type="date" value={reqExpectedDate} onChange={e => setReqExpectedDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={reqNotes} onChange={e => setReqNotes(e.target.value)} rows={2} />
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Items</Label>
                <Button variant="outline" size="sm" onClick={addItemRow}>+ Add Item</Button>
              </div>
              <div className="space-y-2">
                {reqItems.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-start border p-2 rounded-md">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Product</Label>
                      <div className="relative">
                        <Input
                          value={item.product_name}
                          onChange={e => {
                            updateItem(idx, 'product_name', e.target.value)
                            searchProduct(e.target.value)
                            setShowProductPicker(idx)
                          }}
                          placeholder="Search product..."
                          className="h-8"
                        />
                        {showProductPicker === idx && productResults.length > 0 && (
                          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg max-h-40 overflow-y-auto">
                            {productResults.map((p: { id: string; name: string; sku?: string }) => (
                              <div
                                key={p.id}
                                className="px-3 py-1.5 text-sm cursor-pointer hover:bg-accent"
                                onClick={() => selectProduct(idx, p)}
                              >
                                {p.name} <span className="text-xs text-muted-foreground">({p.sku || '—'})</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="w-24 space-y-1">
                      <Label className="text-xs">Qty</Label>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={item.quantity_requested}
                        onChange={e => updateItem(idx, 'quantity_requested', e.target.value)}
                        className="h-8"
                      />
                    </div>
                    <div className="w-28 space-y-1">
                      <Label className="text-xs">Est. Price</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unit_price_estimate}
                        onChange={e => updateItem(idx, 'unit_price_estimate', e.target.value)}
                        className="h-8"
                        placeholder="0.00"
                      />
                    </div>
                    <div className="w-6 pt-5">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => removeItemRow(idx)}>
                        ✕
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? 'Saving...' : 'Create Requisition'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedReq?.requisition_number || 'Requisition'}</DialogTitle>
          </DialogHeader>
          {selectedReq && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Status:</span> <Badge className={STATUS_COLORS[selectedReq.status]}>{selectedReq.status.replace('_', ' ')}</Badge></div>
                <div><span className="text-muted-foreground">Urgency:</span> {selectedReq.urgency}</div>
                <div><span className="text-muted-foreground">Supplier:</span> {selectedReq.supplier?.company_name || '—'}</div>
                <div><span className="text-muted-foreground">Requester:</span> {selectedReq.requester?.full_name || '—'}</div>
                <div><span className="text-muted-foreground">Expected:</span> {selectedReq.expected_date || '—'}</div>
                <div><span className="text-muted-foreground">Approver:</span> {selectedReq.approver?.full_name || '—'}</div>
              </div>
              {selectedReq.notes && (
                <div className="text-sm"><span className="text-muted-foreground">Notes:</span> {selectedReq.notes}</div>
              )}
              {selectedReq.rejection_reason && (
                <div className="text-sm text-destructive"><span className="font-medium">Rejection reason:</span> {selectedReq.rejection_reason}</div>
              )}
              <div>
                <h4 className="font-medium mb-2">Items</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Requested</TableHead>
                      <TableHead className="text-right">Approved</TableHead>
                      <TableHead className="text-right">Est. Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(selectedReq.items || []).map((item: { id: string; product?: { name?: string } | null; quantity_requested: number; quantity_approved?: number | null; unit_price_estimate?: number | null }) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.product?.name || '—'}</TableCell>
                        <TableCell className="text-right">{item.quantity_requested}</TableCell>
                        <TableCell className="text-right">{item.quantity_approved || '—'}</TableCell>
                        <TableCell className="text-right">{item.unit_price_estimate ? formatKSh(item.unit_price_estimate) : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Approve Requisition</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Adjust approved quantities if needed:</p>
            {approveItems.map((item, idx) => (
              <div key={item.item_id} className="flex items-center gap-3">
                <span className="flex-1 text-sm">{item.product_name}</span>
                <span className="text-sm text-muted-foreground">Requested: {item.quantity_requested}</span>
                <div className="w-24">
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={item.quantity_approved}
                    onChange={e => {
                      const items = [...approveItems]
                      items[idx].quantity_approved = e.target.value
                      setApproveItems(items)
                    }}
                    className="h-8"
                  />
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>Cancel</Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={handleApprove}>
              <CheckCircle className="h-4 w-4 mr-1" /> Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Requisition</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Reason for rejection</Label>
            <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} placeholder="Enter the reason..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
