'use client'

import { useState, useEffect, useCallback, startTransition } from 'react'
import { useSearchParams } from 'next/navigation'
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
  getPurchaseOrders, getPurchaseOrder, createPurchaseOrder, approvePurchaseOrder,
  receivePurchaseOrder, cancelPurchaseOrder,
  type PurchaseOrder, type PurchaseOrderItem,
} from '@/lib/modules/procurement'
import { ShoppingCart, Plus, CheckCircle, Truck, XCircle, RefreshCw, Package, FileText, Upload, Trash2, Download } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

export default function PurchaseOrdersPage() {
  const { profile } = useAuth()
  const searchParams = useSearchParams()
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [showCreate, setShowCreate] = useState(false)
  const [items, setItems] = useState<Array<{ product_name: string; quantity_ordered: number; unit_price: number }>>([])
  const [supplier, setSupplier] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [supplierContact, setSupplierContact] = useState('')
  const [notes, setNotes] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [showDetail, setShowDetail] = useState<PurchaseOrder | null>(null)

  // Receive dialog state
  const [showReceive, setShowReceive] = useState(false)
  const [receivePoId, setReceivePoId] = useState('')
  const [receiveItems, setReceiveItems] = useState<Array<{
    item_id: string; product_name: string; quantity_ordered: number;
    prev_received: number; quantity_received: number; batch_number: string; expiry_date: string;
    quantity_damaged: number; quantity_rejected: number; rejection_reason: string;
  }>>([])
  const [receiveNotes, setReceiveNotes] = useState('')
  const [receiveSaving, setReceiveSaving] = useState(false)

  // Attachment state
  const [poAttachments, setPOAttachments] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)

  // Read URL query params for supplier linking (e.g. /purchase-orders?supplier=xxx&requisition=xxx&action=new)
  useEffect(() => {
    const supplierParam = searchParams?.get('supplier')
    const requisitionParam = searchParams?.get('requisition')
    const action = searchParams?.get('action')

    async function initFromParams() {
      if (supplierParam) {
        setSupplierId(supplierParam)
        try {
          const { getSupplierById } = await import('@/lib/modules/suppliers')
          const sup = await getSupplierById(supplierParam)
          if (sup) setSupplier(sup.name)
        } catch { /* ignore */ }
      }

      if (requisitionParam) {
        try {
          const { getRequisitionForPO } = await import('@/lib/modules/procurement')
          const reqData = await getRequisitionForPO(requisitionParam)
          if (reqData?.items?.length) {
            setItems(reqData.items.map((i: { product_name: string; quantity: number; unit_price: number }) => ({
              product_name: i.product_name,
              quantity_ordered: Math.round(i.quantity),
              unit_price: Math.round(i.unit_price * 100) / 100,
            })))
            if (reqData.notes) setNotes(reqData.notes)
            if (reqData.expected_date) setExpectedDate(reqData.expected_date)
            if (reqData.supplier_id && !supplierParam) {
              setSupplierId(reqData.supplier_id)
              const { getSupplierById } = await import('@/lib/modules/suppliers')
              const sup = await getSupplierById(reqData.supplier_id)
              if (sup) setSupplier(sup.name)
            }
          }
        } catch { /* ignore */ }
      }

      if (action === 'new') {
        setTimeout(() => setShowCreate(true), 300)
      }
    }

    initFromParams()
  }, [searchParams])

  const loadOrders = useCallback(async () => {
    setLoading(true)
    const data = await getPurchaseOrders(statusFilter ? { status: statusFilter } : undefined)
    setOrders(data as unknown as PurchaseOrder[])
    setLoading(false)
  }, [statusFilter])

  useEffect(() => { startTransition(() => { loadOrders() }) }, [statusFilter, loadOrders])

  async function handleCreate() {
    if (!supplier || items.length === 0 || !profile?.branch_id) {
      toast({ title: 'Validation', description: 'Supplier and at least one item required', variant: 'destructive' })
      return
    }
    setSaving(true)
    const result = await createPurchaseOrder({
      branch_id: profile.branch_id, supplier_name: supplier,
      supplier_contact: supplierContact, supplier_id: supplierId || undefined,
      expected_date: expectedDate, notes,
      items,
    })
    setSaving(false)
    if (result.success) {
      toast({ title: 'Created', description: 'Purchase order created' })
      setShowCreate(false); setItems([]); setSupplier(''); setSupplierContact(''); setNotes(''); setExpectedDate('')
      loadOrders()
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' })
    }
  }

  async function handleApprove(id: string) {
    const result = await approvePurchaseOrder(id)
    if (result.success) { toast({ title: 'Approved' }); loadOrders(); if (showDetail) loadDetail(id) }
    else toast({ title: 'Error', description: result.error, variant: 'destructive' })
  }

  async function handleCancel(id: string) {
    if (!confirm('Cancel this PO?')) return
    const result = await cancelPurchaseOrder(id)
    if (result.success) { toast({ title: 'Cancelled' }); loadOrders(); if (showDetail) loadDetail(id) }
    else toast({ title: 'Error', description: result.error, variant: 'destructive' })
  }

  function openReceiveDialog(poId: string, poItems: PurchaseOrderItem[]) {
    setReceivePoId(poId)
    setReceiveItems(poItems.map(i => ({
      item_id: i.id,
      product_name: i.product_name,
      quantity_ordered: i.quantity_ordered,
      prev_received: i.quantity_received || 0,
      quantity_received: Math.max(0, i.quantity_ordered - (i.quantity_received || 0)),
      batch_number: '',
      expiry_date: '',
      quantity_damaged: 0,
      quantity_rejected: 0,
      rejection_reason: '',
    })))
    setReceiveNotes('')
    setShowReceive(true)
  }

  async function handleConfirmReceive() {
    // Filter out items with zero to receive
    const toReceive = receiveItems.filter(i => i.quantity_received > 0 || i.quantity_damaged > 0 || i.quantity_rejected > 0)
    if (toReceive.length === 0) {
      toast({ title: 'Validation', description: 'At least one item must have a received quantity', variant: 'destructive' })
      return
    }
    setReceiveSaving(true)
    const result = await receivePurchaseOrder(receivePoId, toReceive.map(i => ({
      item_id: i.item_id,
      quantity_received: i.quantity_received,
      batch_number: i.batch_number || null,
      expiry_date: i.expiry_date || null,
      quantity_damaged: i.quantity_damaged || 0,
      quantity_rejected: i.quantity_rejected || 0,
      rejection_reason: i.rejection_reason || null,
    })), receiveNotes || '')
    setReceiveSaving(false)
    if (result.success) {
      toast({ title: 'Received', description: 'Goods received successfully' })
      setShowReceive(false)
      loadOrders()
      if (showDetail) loadDetail(showDetail.id)
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' })
    }
  }

  async function loadDetail(id: string) {
    const po = await getPurchaseOrder(id)
    setShowDetail(po)
    // Load attachments
    const { getPOAttachments } = await import('@/lib/modules/procurement')
    const atts = await getPOAttachments(id)
    setPOAttachments(atts)
  }

  async function handleUpload(file: File) {
    if (!showDetail) return
    setUploading(true)
    try {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const base64 = e.target?.result as string
        const { uploadPOAttachment } = await import('@/lib/modules/procurement')
        const result = await uploadPOAttachment(showDetail.id, file.name, file.type, base64)
        if (result.success) {
          toast({ title: 'Uploaded', description: `${file.name} attached` })
          const { getPOAttachments } = await import('@/lib/modules/procurement')
          setPOAttachments(await getPOAttachments(showDetail.id))
        } else {
          toast({ title: 'Error', description: result.error, variant: 'destructive' })
        }
        setUploading(false)
      }
      reader.readAsDataURL(file)
    } catch {
      toast({ title: 'Error', description: 'Failed to read file', variant: 'destructive' })
      setUploading(false)
    }
  }

  async function handleDeleteAttachment(id: string) {
    if (!confirm('Delete this attachment?')) return
    const { deletePOAttachment } = await import('@/lib/modules/procurement')
    const result = await deletePOAttachment(id)
    if (result.success) {
      setPOAttachments(atts => atts.filter(a => a.id !== id))
      toast({ title: 'Deleted' })
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' })
    }
  }

  async function handleDownload(id: string) {
    const { getAttachmentDownloadUrl } = await import('@/lib/modules/procurement')
    const url = await getAttachmentDownloadUrl(id)
    if (url) window.open(url, '_blank')
    else toast({ title: 'Error', description: 'Could not generate download URL', variant: 'destructive' })
  }

  function statusColor(s: string) {
    switch (s) {
      case 'draft': return 'bg-amber-100 text-amber-800'
      case 'approved': return 'bg-blue-100 text-blue-800'
      case 'partially_received': return 'bg-purple-100 text-purple-800'
      case 'received': return 'bg-green-100 text-green-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShoppingCart className="h-8 w-8 text-blue-500" />
            Purchase Orders
          </h1>
          <p className="text-muted-foreground mt-1">Manage supplier purchase orders</p>
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={v => setStatusFilter(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-36"><SelectValue placeholder="All Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="partially_received">Partial Receive</SelectItem>
              <SelectItem value="received">Received</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={loadOrders}><RefreshCw className="h-4 w-4 mr-1" /> Refresh</Button>
          <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-1" /> New PO</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO Number</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Order Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map(po => (
                <TableRow key={po.id} className="cursor-pointer hover:bg-muted/50" onClick={() => loadDetail(po.id)}>
                  <TableCell className="font-mono text-sm">{po.po_number}</TableCell>
                  <TableCell className="font-medium">{po.supplier_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(po.order_date).toLocaleDateString()}</TableCell>
                  <TableCell><Badge className={statusColor(po.status)}>{po.status}</Badge></TableCell>
                  <TableCell className="text-right font-mono">{formatKSh(po.total_amount)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      {po.status === 'draft' && (
                        <>
                          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleApprove(po.id) }}>
                            <CheckCircle className="h-4 w-4 mr-1" /> Approve
                          </Button>
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleCancel(po.id) }}>
                            <XCircle className="h-4 w-4 text-red-500" />
                          </Button>
                        </>
                      )}
                      {(po.status === 'approved' || po.status === 'partially_received') && (
                        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); openReceiveDialog(po.id, po.items || []) }}>
                          <Truck className="h-4 w-4 mr-1" /> Receive
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {orders.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8"><EmptyState icon={ShoppingCart} title="No purchase orders" compact /></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create PO Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Purchase Order</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Supplier Name *</Label><Input value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Supplier" /></div>
              <div><Label>Contact</Label><Input value={supplierContact} onChange={e => setSupplierContact(e.target.value)} placeholder="Phone/email" /></div>
              <div><Label>Expected Date</Label><Input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} /></div>
              <div><Label>Notes</Label><Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes" /></div>
            </div>
            <div className="space-y-2">
              <Label>Items *</Label>
              {items.map((item, i) => (
                <div key={i} className="grid grid-cols-[1fr_100px_100px_auto] gap-2 items-end">
                  <Input placeholder="Product name" value={item.product_name} onChange={e => {
                    const newItems = [...items]; newItems[i].product_name = e.target.value; setItems(newItems)
                  }} />
                  <Input type="number" min={1} placeholder="Qty" value={item.quantity_ordered || ''} onChange={e => {
                    const newItems = [...items]; newItems[i].quantity_ordered = parseInt(e.target.value) || 0; setItems(newItems)
                  }} />
                  <Input type="number" min={0} placeholder="Unit cost" value={item.unit_price || ''} onChange={e => {
                    const newItems = [...items]; newItems[i].unit_price = parseInt(e.target.value) || 0; setItems(newItems)
                  }} />
                  <Button variant="ghost" size="sm" onClick={() => setItems(items.filter((_, j) => j !== i))}>✕</Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setItems([...items, { product_name: '', quantity_ordered: 1, unit_price: 0 }])}>
                <Plus className="h-4 w-4 mr-1" /> Add Item
              </Button>
            </div>
            {items.length > 0 && (
              <div className="text-right font-bold border-t pt-2">
                Subtotal: {formatKSh(items.reduce((s, i) => s + i.quantity_ordered * i.unit_price, 0))}
                <br />+ VAT (16%): {formatKSh(Math.round(items.reduce((s, i) => s + i.quantity_ordered * i.unit_price, 0) * 0.16))}
                <br />Total: {formatKSh(Math.round(items.reduce((s, i) => s + i.quantity_ordered * i.unit_price, 0) * 1.16))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? 'Saving...' : 'Create PO'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!showDetail} onOpenChange={() => setShowDetail(null)}>
        <DialogContent className="sm:max-w-2xl">
          {showDetail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" /> {showDetail.po_number}
                  <Badge className={statusColor(showDetail.status)}>{showDetail.status}</Badge>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Supplier</span><p className="font-medium">{showDetail.supplier_name}</p></div>
                  <div><span className="text-muted-foreground">Date</span><p className="font-medium">{new Date(showDetail.order_date).toLocaleDateString()}</p></div>
                  {showDetail.expected_date && <div><span className="text-muted-foreground">Expected</span><p className="font-medium">{new Date(showDetail.expected_date).toLocaleDateString()}</p></div>}
                  {showDetail.received_date && <div><span className="text-muted-foreground">Received</span><p className="font-medium">{new Date(showDetail.received_date).toLocaleDateString()}</p></div>}
                </div>
                {showDetail.items && showDetail.items.length > 0 && (
                  <Table>
                    <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Qty</TableHead><TableHead>Unit Cost</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {showDetail.items.map((item: PurchaseOrderItem) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.product_name}</TableCell>
                          <TableCell>{item.quantity_ordered} {item.quantity_received > 0 ? <span className="text-green-600">({item.quantity_received} rcvd)</span> : ''}</TableCell>
                          <TableCell>{formatKSh(item.unit_price)}</TableCell>
                          <TableCell className="text-right">{formatKSh(item.line_total)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                <div className="text-right border-t pt-2 space-y-1 text-sm">
                  <div>Subtotal: {formatKSh(showDetail.subtotal)}</div>
                  <div>VAT: {formatKSh(showDetail.tax_amount)}</div>
                  <div className="text-lg font-bold">Total: {formatKSh(showDetail.total_amount)}</div>
                </div>

                {/* Attachments */}
                <div className="border-t pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold flex items-center gap-1"><Upload className="h-4 w-4" /> Attachments</h3>
                    <div className="relative">
                      <Button variant="outline" size="sm" disabled={uploading} onClick={() => document.getElementById('file-upload-input')?.click()}>
                        <Upload className="h-4 w-4 mr-1" /> {uploading ? 'Uploading...' : 'Upload'}
                      </Button>
                      <input id="file-upload-input" type="file" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) { handleUpload(f); e.target.value = '' } }} />
                    </div>
                  </div>
                  {poAttachments.length === 0 ? (
                    <EmptyState title="No attachments" compact />
                  ) : (
                    <div className="space-y-1">
                      {poAttachments.map((att: { id: string; file_name: string; file_size: number }) => (
                        <div key={att.id} className="flex items-center justify-between py-1 px-2 rounded bg-muted/30">
                          <div className="flex items-center gap-2 text-sm truncate">
                            <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                            <span className="truncate">{att.file_name}</span>
                            <span className="text-xs text-muted-foreground shrink-0">
                              ({Math.round(att.file_size / 1024)} KB)
                            </span>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleDownload(att.id)}>
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => handleDeleteAttachment(att.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter className="gap-2">
                {showDetail.status === 'draft' && (
                  <>
                    <Button onClick={() => handleApprove(showDetail.id)}>Approve</Button>
                    <Button variant="destructive" onClick={() => handleCancel(showDetail.id)}>Cancel</Button>
                  </>
                )}
                {(showDetail.status === 'approved' || showDetail.status === 'partially_received') && (
                  <Button onClick={() => openReceiveDialog(showDetail.id, showDetail.items || [])}>Receive Goods</Button>
                )}
                <Button variant="outline" onClick={() => setShowDetail(null)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Receive Dialog */}
      <Dialog open={showReceive} onOpenChange={setShowReceive}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-500" /> Receive Goods
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Enter quantities received for each item. Items with zero received qty will be skipped.</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="w-20 text-center">Ordered</TableHead>
                  <TableHead className="w-20 text-center">Prev Rcvd</TableHead>
                  <TableHead className="w-20">Receive</TableHead>
                  <TableHead className="w-20">Damaged</TableHead>
                  <TableHead className="w-20">Rejected</TableHead>
                  <TableHead className="w-28">Batch</TableHead>
                  <TableHead className="w-28">Expiry</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receiveItems.map((item, i) => (
                  <TableRow key={item.item_id}>
                    <TableCell className="font-medium text-sm">{item.product_name}</TableCell>
                    <TableCell className="text-center">{item.quantity_ordered}</TableCell>
                    <TableCell className="text-center text-green-600">{item.prev_received}</TableCell>
                    <TableCell>
                      <Input type="number" min={0} max={item.quantity_ordered}
                        value={item.quantity_received}
                        onChange={e => {
                          const n = [...receiveItems]; n[i].quantity_received = parseInt(e.target.value) || 0; setReceiveItems(n)
                        }}
                        className="h-8 w-20" />
                    </TableCell>
                    <TableCell>
                      <Input type="number" min={0}
                        value={item.quantity_damaged}
                        onChange={e => {
                          const n = [...receiveItems]; n[i].quantity_damaged = parseInt(e.target.value) || 0; setReceiveItems(n)
                        }}
                        className="h-8 w-20" />
                    </TableCell>
                    <TableCell>
                      <Input type="number" min={0}
                        value={item.quantity_rejected}
                        onChange={e => {
                          const n = [...receiveItems]; n[i].quantity_rejected = parseInt(e.target.value) || 0; setReceiveItems(n)
                        }}
                        className="h-8 w-20" />
                    </TableCell>
                    <TableCell>
                      <Input placeholder="Batch #"
                        value={item.batch_number}
                        onChange={e => {
                          const n = [...receiveItems]; n[i].batch_number = e.target.value; setReceiveItems(n)
                        }}
                        className="h-8 w-28" />
                    </TableCell>
                    <TableCell>
                      <Input type="date"
                        value={item.expiry_date}
                        onChange={e => {
                          const n = [...receiveItems]; n[i].expiry_date = e.target.value; setReceiveItems(n)
                        }}
                        className="h-8 w-28" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div>
              <Label>Receive Notes</Label>
              <Textarea value={receiveNotes} onChange={e => setReceiveNotes(e.target.value)}
                placeholder="Optional notes about this receipt" className="h-20" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReceive(false)}>Cancel</Button>
            <Button onClick={handleConfirmReceive} disabled={receiveSaving}>
              {receiveSaving ? 'Receiving...' : 'Confirm Receipt'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
