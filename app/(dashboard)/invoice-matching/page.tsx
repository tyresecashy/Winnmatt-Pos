'use client'

import { useState, useEffect, useCallback, startTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Search, FileText, AlertTriangle, CheckCircle, Clock, RefreshCw, DollarSign } from 'lucide-react'
import { formatKSh } from '@/lib/currency'
import { getInvoiceMatchingStats, getMatchesByStatus } from '@/lib/modules/reports'

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' }> = {
  matched: { label: 'Matched', variant: 'default' },
  pending: { label: 'Pending', variant: 'secondary' },
  quantity_discrepancy: { label: 'Qty Discrepancy', variant: 'ghost' },
  price_discrepancy: { label: 'Price Discrepancy', variant: 'ghost' },
  unmatched: { label: 'Unmatched', variant: 'destructive' },
}

export default function InvoiceMatchingPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<{ total: number; matched: number; pending: number; discrepancies: number } | null>(null)
  const [matches, setMatches] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [s, m] = await Promise.all([
        getInvoiceMatchingStats(),
        getMatchesByStatus(activeTab === 'all' ? '' : activeTab),
      ])
      setStats(s)
      setMatches(m)
    } catch {
      // noop
    } finally { setLoading(false) }
  }, [activeTab])

  useEffect(() => { startTransition(() => { loadData() }) }, [activeTab, loadData])

  const filteredMatches = matches.filter(m => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      m.invoice?.invoice_number?.toLowerCase().includes(q) ||
      m.invoice?.supplier?.name?.toLowerCase().includes(q)
    )
  })

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Invoice Matching</h1>
          <p className="text-muted-foreground">3-way matching: Purchase Order → Receipt → Invoice</p>
        </div>
        <Button variant="outline" onClick={loadData}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total Lines</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats?.total || 0}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Matched</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-600">{stats?.matched || 0}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Pending</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-amber-600">{stats?.pending || 0}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground text-red-600">Discrepancies</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-red-600">{stats?.discrepancies || 0}</p></CardContent></Card>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by invoice or supplier..." className="pl-9" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <Select value={activeTab} onValueChange={async (v) => { setActiveTab(v); setLoading(true); const m = await getMatchesByStatus(v === 'all' ? '' : v); setMatches(m); setLoading(false) }}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="matched">Matched</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="quantity_discrepancy">Qty Discrepancy</SelectItem>
            <SelectItem value="price_discrepancy">Price Discrepancy</SelectItem>
            <SelectItem value="unmatched">Unmatched</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredMatches.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <EmptyState title="No invoice matching data found" compact />
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Qty Ordered</TableHead>
                  <TableHead className="text-right">Qty Received</TableHead>
                  <TableHead className="text-right">Qty Invoiced</TableHead>
                  <TableHead className="text-right">Price Ordered</TableHead>
                  <TableHead className="text-right">Price Invoiced</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMatches.map((item) => {
                  const cfg = statusConfig[item.match_status] || { label: item.match_status, variant: 'outline' }
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.invoice?.invoice_number || '—'}</TableCell>
                      <TableCell>{item.invoice?.supplier?.name || '—'}</TableCell>
                      <TableCell className="text-right">{item.quantity_ordered}</TableCell>
                      <TableCell className="text-right">{item.quantity_received}</TableCell>
                      <TableCell className="text-right">{item.quantity_invoiced}</TableCell>
                      <TableCell className="text-right font-mono">{formatKSh(item.price_ordered)}</TableCell>
                      <TableCell className="text-right font-mono">{formatKSh(item.price_invoiced)}</TableCell>
                      <TableCell><Badge variant={cfg.variant as 'default' | 'secondary' | 'destructive' | 'outline'}>{cfg.label}</Badge></TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
