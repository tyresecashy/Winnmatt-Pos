'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from '@/hooks/use-toast'
import { getStockTransfers, approveStockTransfer, markInTransit, cancelStockTransfer, type StockTransfer } from '@/lib/transfer-actions'
import { ArrowRightLeft, RefreshCw, CheckCircle, Truck, XCircle } from 'lucide-react'

export default function TransfersPage() {
  const [transfers, setTransfers] = useState<StockTransfer[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('')

  useEffect(() => { loadTransfers() }, [statusFilter])

  async function loadTransfers() {
    setLoading(true)
    const data = await getStockTransfers(undefined, statusFilter || undefined)
    setTransfers(data)
    setLoading(false)
  }

  async function handleApprove(id: string) {
    const result = await approveStockTransfer(id)
    if (result.success) { toast({ title: 'Approved' }); loadTransfers() }
    else toast({ title: 'Error', description: result.error, variant: 'destructive' })
  }

  async function handleTransit(id: string) {
    const result = await markInTransit(id)
    if (result.success) { toast({ title: 'In Transit' }); loadTransfers() }
    else toast({ title: 'Error', description: result.error, variant: 'destructive' })
  }

  async function handleCancel(id: string) {
    if (!confirm('Cancel this transfer?')) return
    const result = await cancelStockTransfer(id)
    if (result.success) { toast({ title: 'Cancelled' }); loadTransfers() }
    else toast({ title: 'Error', description: result.error, variant: 'destructive' })
  }

  function statusColor(status: string) {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-800'
      case 'approved': return 'bg-blue-100 text-blue-800'
      case 'in_transit': return 'bg-purple-100 text-purple-800'
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
            <ArrowRightLeft className="h-8 w-8 text-blue-500" />
            Stock Transfers
          </h1>
          <p className="text-muted-foreground mt-1">Transfer stock between branches</p>
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={v => setStatusFilter(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All Statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="in_transit">In Transit</SelectItem>
              <SelectItem value="received">Received</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={loadTransfers}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Transfer #</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfers.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.transfer_number || t.id.slice(0, 8)}</TableCell>
                  <TableCell>{t.from_branch?.name || t.from_branch_id}</TableCell>
                  <TableCell>{t.to_branch?.name || t.to_branch_id}</TableCell>
                  <TableCell><Badge className={statusColor(t.status)}>{t.status}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(t.requested_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      {t.status === 'pending' && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => handleApprove(t.id)}>
                            <CheckCircle className="h-4 w-4 mr-1" /> Approve
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleCancel(t.id)}>
                            <XCircle className="h-4 w-4 text-red-500" />
                          </Button>
                        </>
                      )}
                      {t.status === 'approved' && (
                        <Button variant="outline" size="sm" onClick={() => handleTransit(t.id)}>
                          <Truck className="h-4 w-4 mr-1" /> Ship
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {transfers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No stock transfers found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
