'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatKSh } from '@/lib/currency'
import { getPurchaseReceipts, getPurchaseReceiptById } from '@/lib/modules/procurement'
import { ClipboardList, RefreshCw, FileText, Truck, Package } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

export default function GoodsReceivedNotesPage() {
  const [receipts, setReceipts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [showDetail, setShowDetail] = useState<any | null>(null)

  useEffect(() => { loadReceipts() }, [])

  async function loadReceipts() {
    setLoading(true)
    const data = await getPurchaseReceipts()
    setReceipts(data)
    setLoading(false)
  }

  async function loadDetail(id: string) {
    const receipt = await getPurchaseReceiptById(id)
    setShowDetail(receipt)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ClipboardList className="h-8 w-8 text-blue-500" />
            Goods Received Notes
          </h1>
          <p className="text-muted-foreground mt-1">Record of all goods received from suppliers</p>
        </div>
        <Button variant="outline" onClick={loadReceipts}><RefreshCw className="h-4 w-4 mr-1" /> Refresh</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>GRN Number</TableHead>
                <TableHead>PO</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Received Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Items</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : receipts.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8"><EmptyState icon={ClipboardList} title="No goods received notes" compact /></TableCell></TableRow>
              ) : (
                receipts.map(r => (
                  <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => loadDetail(r.id)}>
                    <TableCell className="font-mono text-sm font-medium">{r.receipt_number || r.id.slice(0, 8)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.purchase_order?.id?.slice(0, 8) || '-'}</TableCell>
                    <TableCell className="font-medium">{r.supplier?.name || '-'}</TableCell>
                    <TableCell className="text-sm">{new Date(r.received_date || r.created_at).toLocaleDateString()}</TableCell>
                    <TableCell><Badge className={STATUS_COLORS[r.status] || ''}>{r.status}</Badge></TableCell>
                    <TableCell className="text-right">{r.items_count || '-'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!showDetail} onOpenChange={() => setShowDetail(null)}>
        <DialogContent className="sm:max-w-2xl">
          {showDetail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" /> {showDetail.receipt_number || 'GRN'}
                  <Badge className={STATUS_COLORS[showDetail.status] || ''}>{showDetail.status}</Badge>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Supplier</span><p className="font-medium">{showDetail.supplier?.name || '-'}</p></div>
                  <div><span className="text-muted-foreground">PO</span><p className="font-medium">{showDetail.purchase_order?.id?.slice(0, 8) || '-'}</p></div>
                  <div><span className="text-muted-foreground">Received Date</span><p className="font-medium">{new Date(showDetail.received_date || showDetail.created_at).toLocaleDateString()}</p></div>
                  <div><span className="text-muted-foreground">Received By</span><p className="font-medium">{showDetail.received_by?.slice(0, 8) || '-'}</p></div>
                </div>
                {showDetail.notes && (
                  <div className="text-sm"><span className="text-muted-foreground">Notes:</span><p>{showDetail.notes}</p></div>
                )}

                {showDetail.items && showDetail.items.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2 flex items-center gap-1"><Package className="h-4 w-4" /> Items Received</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-center">Qty Received</TableHead>
                          <TableHead className="text-right">Unit Cost</TableHead>
                          <TableHead>Batch</TableHead>
                          <TableHead>Expiry</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {showDetail.items.map((item: { id: string; product?: { name?: string } | null; product_id?: string; quantity_received: number; unit_cost: number; batch_number?: string | null; expiry_date?: string | null }) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.product?.name || item.product_id?.slice(0, 8)}</TableCell>
                            <TableCell className="text-center">{item.quantity_received}</TableCell>
                            <TableCell className="text-right font-mono">{formatKSh(item.unit_cost)}</TableCell>
                            <TableCell className="text-sm">{item.batch_number || '-'}</TableCell>
                            <TableCell className="text-sm">{item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDetail(null)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
