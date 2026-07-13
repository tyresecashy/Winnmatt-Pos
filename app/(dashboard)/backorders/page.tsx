'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatKSh } from '@/lib/currency'
import { getBackorders } from '@/lib/modules/procurement'
import { Package, RefreshCw, ShoppingCart } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

export default function BackordersPage() {
  const router = useRouter()
  const [backorders, setBackorders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadBackorders() }, [])

  async function loadBackorders() {
    setLoading(true)
    const data = await getBackorders()
    setBackorders(data)
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Package className="h-8 w-8 text-amber-500" />
            Backorders
          </h1>
          <p className="text-muted-foreground mt-1">Items ordered but not yet fully received</p>
        </div>
        <Button variant="outline" onClick={loadBackorders}><RefreshCw className="h-4 w-4 mr-1" /> Refresh</Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Backorders</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{backorders.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Outstanding Qty</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {backorders.reduce((s: number, b) => s + (b.backorder_quantity || 0), 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Estimated Value</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {formatKSh(backorders.reduce((s: number, b) => s + (b.backorder_quantity || 0) * (b.unit_price || 0), 0))}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>PO</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-center">Ordered</TableHead>
                <TableHead className="text-center">Received</TableHead>
                <TableHead className="text-center">Backorder</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {backorders.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.product?.name || '-'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{item.product?.sku || '-'}</TableCell>
                  <TableCell className="font-mono text-sm">{item.purchase_order?.po_number || '-'}</TableCell>
                  <TableCell>{item.purchase_order?.supplier_name || '-'}</TableCell>
                  <TableCell className="text-center">{item.quantity}</TableCell>
                  <TableCell className="text-center text-green-600">{item.received_quantity || 0}</TableCell>
                  <TableCell className="text-center font-bold text-amber-600">{item.backorder_quantity}</TableCell>
                  <TableCell className="text-right font-mono">{formatKSh(item.unit_price)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm"
                      onClick={() => router.push(`/purchase-orders?id=${item.purchase_order?.id || ''}&action=new`)}>
                      <ShoppingCart className="h-4 w-4 mr-1" /> Open PO
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {backorders.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8"><EmptyState icon={Package} title="No backorders" description="All POs fully received" compact /></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
