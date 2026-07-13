'use client'

import { useState, useEffect, useCallback, startTransition } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from '@/hooks/use-toast'
import { formatKSh } from '@/lib/currency'
import {
  getSupplierReturns, getSupplierReturn, createSupplierReturn,
  approveSupplierReturn, cancelSupplierReturn,
  type SupplierReturn,
  getSuppliers,
} from '@/lib/modules/suppliers'
import { RotateCcw, Plus, CheckCircle, XCircle, RefreshCw, FileText, Package, Search } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  submitted: 'bg-blue-100 text-blue-700',
  approved: 'bg-amber-100 text-amber-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

export default function SupplierReturnsPage() {
  const { profile } = useAuth()
  const [returns, setReturns] = useState<SupplierReturn[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [showCreate, setShowCreate] = useState(false)
  const [showDetail, setShowDetail] = useState<SupplierReturn | null>(null)

  // Create form
  const [supplierId, setSupplierId] = useState('')
  const [supplierList, setSupplierList] = useState<Array<{ id: string; name: string }>>([])
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [replacementRequired, setReplacementRequired] = useState(false)
  const [returnItems, setReturnItems] = useState<Array<{
    product_id: string; product_name: string; quantity_returned: number; unit_price: number; reason: string
  }>>([])
  const [productSearch, setProductSearch] = useState('')
  const [productResults, setProductResults] = useState<Array<{ id: string; name: string; purchase_price: number }>>([])
  const [saving, setSaving] = useState(false)

  const loadReturns = useCallback(async () => {
    setLoading(true)
    const data = await getSupplierReturns(statusFilter || undefined)
    setReturns(data)
    setLoading(false)
  }, [statusFilter])

  useEffect(() => { startTransition(() => { loadReturns() }) }, [statusFilter, loadReturns])

  useEffect(() => {
    if (showCreate) {
      getSuppliers().then(s => setSupplierList(s.map((sup: { id: string; name: string }) => ({ id: sup.id, name: sup.name }))))
    }
  }, [showCreate])

  async function searchProducts(query: string) {
    setProductSearch(query)
    if (query.length < 2) { setProductResults([]); return }
    const { getAllProducts } = await import('@/lib/products-actions')
    const all = await getAllProducts()
    const filtered = all.filter((p: { name: string; sku?: string | null }) =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      (p.sku || '').toLowerCase().includes(query.toLowerCase())
    )
    setProductResults(filtered.slice(0, 10))
  }

  function addItem(product: { id: string; name: string; purchase_price: number }) {
    if (returnItems.find(i => i.product_id === product.id)) {
      toast({ title: 'Already added', variant: 'destructive' })
      return
    }
    setReturnItems([...returnItems, {
      product_id: product.id,
      product_name: product.name,
      quantity_returned: 1,
      unit_price: product.purchase_price || 0,
      reason: '',
    }])
    setProductSearch('')
    setProductResults([])
  }

  async function handleCreate() {
    if (!supplierId || returnItems.length === 0) {
      toast({ title: 'Validation', description: 'Supplier and at least one item required', variant: 'destructive' })
      return
    }
    setSaving(true)
    const result = await createSupplierReturn({
      supplier_id: supplierId,
      reason: reason || undefined,
      notes: notes || undefined,
      replacement_required: replacementRequired,
      items: returnItems.map(i => ({
        product_id: i.product_id,
        quantity_returned: i.quantity_returned,
        unit_price: i.unit_price,
        reason: i.reason || undefined,
      })),
    })
    setSaving(false)
    if (result.success) {
      toast({ title: 'Created', description: `Return ${(result as any).return_number ?? ''} submitted` })
      setShowCreate(false)
      setSupplierId(''); setReason(''); setNotes(''); setReplacementRequired(false)
      setReturnItems([])
      loadReturns()
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' })
    }
  }

  async function handleApprove(id: string) {
    const result = await approveSupplierReturn(id)
    if (result.success) { toast({ title: 'Completed', description: 'Return processed, inventory adjusted' }); loadReturns(); if (showDetail) loadDetail(id) }
    else toast({ title: 'Error', description: result.error, variant: 'destructive' })
  }

  async function handleCancel(id: string) {
    if (!confirm('Cancel this return?')) return
    const result = await cancelSupplierReturn(id)
    if (result.success) { toast({ title: 'Cancelled' }); loadReturns(); if (showDetail) loadDetail(id) }
    else toast({ title: 'Error', description: result.error, variant: 'destructive' })
  }

  async function loadDetail(id: string) {
    const ret = await getSupplierReturn(id)
    setShowDetail(ret)
  }

  const totalCredit = returnItems.reduce((s, i) => s + i.quantity_returned * i.unit_price, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <RotateCcw className="h-8 w-8 text-red-500" />
            Supplier Returns
          </h1>
          <p className="text-muted-foreground mt-1">Return goods to suppliers for credit or replacement</p>
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={v => setStatusFilter(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-36"><SelectValue placeholder="All Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={loadReturns}><RefreshCw className="h-4 w-4 mr-1" /> Refresh</Button>
          <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-1" /> New Return</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Return #</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {returns.map(r => (
                <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => loadDetail(r.id)}>
                  <TableCell className="font-mono text-sm">{r.return_number}</TableCell>
                  <TableCell className="font-medium">{r.supplier?.name || '-'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{r.reason || '-'}</TableCell>
                  <TableCell className="text-sm">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                  <TableCell><Badge className={STATUS_COLORS[r.status] || ''}>{r.status}</Badge></TableCell>
                  <TableCell className="text-right font-mono">{formatKSh(r.credit_amount)}</TableCell>
                  <TableCell className="text-right">
                    {r.status === 'submitted' && (
                      <div className="flex gap-1 justify-end">
                        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleApprove(r.id) }}>
                          <CheckCircle className="h-4 w-4 mr-1" /> Process
                        </Button>
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleCancel(r.id) }}>
                          <XCircle className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {returns.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8"><EmptyState icon={RotateCcw} title="No supplier returns" compact /></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Return Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Supplier Return</DialogTitle></DialogHeader>
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
            <div><Label>Reason for Return</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="defective">Defective / Damaged</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="wrong_item">Wrong Item</SelectItem>
                  <SelectItem value="overstock">Overstock / Excess</SelectItem>
                  <SelectItem value="quality">Quality Issue</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="replacement" checked={replacementRequired} onCheckedChange={(v) => setReplacementRequired(v === true)} />
              <Label htmlFor="replacement">Replacement required</Label>
            </div>

            <div className="space-y-2">
              <Label>Items *</Label>
              {/* Product search */}
              <div className="relative">
                <Input placeholder="Search products..." value={productSearch}
                  onChange={e => searchProducts(e.target.value)} />
                {productResults.length > 0 && (
                  <div className="absolute z-10 w-full bg-popover border rounded-md mt-1 shadow-md max-h-48 overflow-y-auto">
                    {productResults.map(p => (
                      <button key={p.id} type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex justify-between"
                        onClick={() => addItem(p)}>
                        <span>{p.name}</span>
                        <span className="text-muted-foreground">{formatKSh(p.purchase_price || 0)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {returnItems.map((item, i) => (
                <div key={i} className="grid grid-cols-[1fr_80px_100px_auto] gap-2 items-end">
                  <span className="text-sm font-medium py-2">{item.product_name}</span>
                  <Input type="number" min={1} placeholder="Qty" value={item.quantity_returned || ''}
                    onChange={e => {
                      const n = [...returnItems]; n[i].quantity_returned = parseInt(e.target.value) || 0; setReturnItems(n)
                    }} className="h-8" />
                  <Input type="number" min={0} placeholder="Price" value={item.unit_price || ''}
                    onChange={e => {
                      const n = [...returnItems]; n[i].unit_price = parseInt(e.target.value) || 0; setReturnItems(n)
                    }} className="h-8" />
                  <Button variant="ghost" size="sm" onClick={() => setReturnItems(returnItems.filter((_, j) => j !== i))}>✕</Button>
                </div>
              ))}
            </div>

            {returnItems.length > 0 && (
              <div className="text-right font-bold border-t pt-2">
                Total Credit: {formatKSh(totalCredit)}
              </div>
            )}

            <div><Label>Notes</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? 'Creating...' : 'Submit Return'}</Button>
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
                  <FileText className="h-5 w-5" /> {showDetail.return_number}
                  <Badge className={STATUS_COLORS[showDetail.status] || ''}>{showDetail.status}</Badge>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Supplier</span><p className="font-medium">{showDetail.supplier?.name || '-'}</p></div>
                  <div><span className="text-muted-foreground">Created</span><p className="font-medium">{new Date(showDetail.created_at).toLocaleDateString()}</p></div>
                  <div><span className="text-muted-foreground">Reason</span><p className="font-medium">{showDetail.reason || '-'}</p></div>
                  <div><span className="text-muted-foreground">Replacement</span><p className="font-medium">{showDetail.replacement_required ? 'Yes' : 'No'}</p></div>
                </div>
                {showDetail.notes && (
                  <div className="text-sm"><span className="text-muted-foreground">Notes:</span><p>{showDetail.notes}</p></div>
                )}
                {showDetail.items && showDetail.items.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2 flex items-center gap-1"><Package className="h-4 w-4" /> Items</h3>
                    <Table>
                      <TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-center">Qty</TableHead><TableHead className="text-right">Price</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {showDetail.items.map((item: { id: string; product?: { name?: string } | null; product_id?: string; quantity_returned: number; unit_price: number }) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.product?.name || item.product_id?.slice(0, 8)}</TableCell>
                            <TableCell className="text-center">{item.quantity_returned}</TableCell>
                            <TableCell className="text-right">{formatKSh(item.unit_price)}</TableCell>
                            <TableCell className="text-right font-mono">{formatKSh(item.quantity_returned * item.unit_price)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                <div className="text-right border-t pt-2 text-lg font-bold">
                  Total Credit: {formatKSh(showDetail.credit_amount)}
                </div>
              </div>
              <DialogFooter className="gap-2">
                {showDetail.status === 'submitted' && (
                  <>
                    <Button onClick={() => handleApprove(showDetail.id)}>Process Return</Button>
                    <Button variant="destructive" onClick={() => handleCancel(showDetail.id)}>Cancel</Button>
                  </>
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
