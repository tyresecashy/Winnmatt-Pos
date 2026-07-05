'use client'

import { useState, useEffect } from 'react'
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
} from '@/lib/purchase-order-actions'
import { ShoppingCart, Plus, CheckCircle, Truck, XCircle, RefreshCw, Package, FileText } from 'lucide-react'

export default function PurchaseOrdersPage() {
  const { profile } = useAuth()
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [showCreate, setShowCreate] = useState(false)
  const [showDetail, setShowDetail] = useState<PurchaseOrder | null>(null)
  const [items, setItems] = useState<Array<{ product_name: string; quantity_ordered: number; unit_price: number }>>([])
  const [supplier, setSupplier] = useState('')
  const [supplierContact, setSupplierContact] = useState('')
  const [notes, setNotes] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadOrders() }, [statusFilter])

  async function loadOrders() {
    setLoading(true)
    const data = await getPurchaseOrders(undefined, statusFilter || undefined)
    setOrders(data)
    setLoading(false)
  }

  async function handleCreate() {
    if (!supplier || items.length === 0 || !profile?.branch_id) {
      toast({ title: 'Validation', description: 'Supplier and at least one item required', variant: 'destructive' })
      return
    }
    setSaving(true)
    const result = await createPurchaseOrder({
      branch_id: profile.branch_id, supplier_name: supplier,
      supplier_contact: supplierContact, expected_date: expectedDate, notes,
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

  async function handleReceive(id: string, poItems: PurchaseOrderItem[]) {
    const receivedItems = poItems.map(i => ({ item_id: i.id, quantity_received: i.quantity_ordered }))
    const result = await receivePurchaseOrder(id, receivedItems)
    if (result.success) { toast({ title: 'Received' }); loadOrders(); if (showDetail) loadDetail(id) }
    else toast({ title: 'Error', description: result.error, variant: 'destructive' })
  }

  async function loadDetail(id: string) {
    const po = await getPurchaseOrder(id)
    setShowDetail(po)
  }

  function statusColor(s: string) {
    switch (s) {
      case 'draft': return 'bg-amber-100 text-amber-800'
      case 'approved': return 'bg-blue-100 text-blue-800'
      case 'received': return 'bg-green-100 text-green-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
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
                      {po.status === 'approved' && (
                        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleReceive(po.id, po.items || []) }}>
                          <Truck className="h-4 w-4 mr-1" /> Receive
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {orders.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No purchase orders</TableCell></TableRow>
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
              </div>
              <DialogFooter className="gap-2">
                {showDetail.status === 'draft' && (
                  <>
                    <Button onClick={() => handleApprove(showDetail.id)}>Approve</Button>
                    <Button variant="destructive" onClick={() => handleCancel(showDetail.id)}>Cancel</Button>
                  </>
                )}
                {showDetail.status === 'approved' && (
                  <Button onClick={() => handleReceive(showDetail.id, showDetail.items || [])}>Receive Goods</Button>
                )}
                <Button variant="outline" onClick={() => setShowDetail(null)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
