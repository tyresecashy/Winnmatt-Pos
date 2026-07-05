'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import {
  FlaskConical, Search, Package, Truck, AlertTriangle,
  CheckCircle2, XCircle, Clock, CalendarDays, Building2,
  RefreshCw,
} from 'lucide-react'
import { toast } from '@/components/ui/use-toast'

// Simulated batch data until the migration SQL runs
const MOCK_BATCHES = [
  { id: '1', batch_number: 'B-2026-001', lot_number: 'LOT-A123', product_name: 'Coca-Cola 500ml', supplier_name: 'Coca-Cola Kenya', quantity: 240, reserved: 10, manufacture_date: '2026-01-15', expiry_date: '2026-07-15', status: 'active', location: 'Main Warehouse', days_until_expiry: 12 },
  { id: '2', batch_number: 'B-2026-002', lot_number: 'LOT-B456', product_name: 'Mama Nguil 2kg', supplier_name: 'Mama Nguil Mills', quantity: 500, reserved: 30, manufacture_date: '2026-03-01', expiry_date: '2026-09-01', status: 'active', location: 'Main Warehouse', days_until_expiry: 60 },
  { id: '3', batch_number: 'B-2026-003', lot_number: 'LOT-C789', product_name: 'Fresh Milk 1L', supplier_name: 'Brookside Dairy', quantity: 80, reserved: 0, manufacture_date: '2026-06-20', expiry_date: '2026-07-05', status: 'active', location: 'Branch A - Cooler', days_until_expiry: 2 },
  { id: '4', batch_number: 'B-2026-004', lot_number: 'LOT-D012', product_name: 'Cooking Oil 3L', supplier_name: 'Pwani Oil', quantity: 0, reserved: 0, manufacture_date: '2025-12-01', expiry_date: '2026-06-01', status: 'expired', location: 'Damaged Goods', days_until_expiry: -32 },
  { id: '5', batch_number: 'B-2026-005', lot_number: 'LOT-E345', product_name: 'Bread Sliced White', supplier_name: 'Bakeries Ltd', quantity: 50, reserved: 5, manufacture_date: '2026-07-01', expiry_date: '2026-07-04', status: 'active', location: 'Branch B', days_until_expiry: 1 },
  { id: '6', batch_number: 'B-2026-006', lot_number: null, product_name: 'Wheat Flour 1kg', supplier_name: 'Unga Limited', quantity: 1000, reserved: 200, manufacture_date: '2026-05-01', expiry_date: '2026-11-01', status: 'quarantined', location: 'Quarantine Zone', days_until_expiry: 121 },
  { id: '7', batch_number: 'B-2026-007', lot_number: 'LOT-F678', product_name: 'Sugar 2kg', supplier_name: 'Sony Sugar', quantity: 0, reserved: 0, manufacture_date: '2026-02-01', expiry_date: '2026-08-01', status: 'depleted', location: 'Main Warehouse', days_until_expiry: 29 },
]

const statusColors: Record<string, 'default' | 'destructive' | 'secondary' | 'outline' | 'warning'> = {
  active: 'default',
  quarantined: 'warning',
  recalled: 'destructive',
  expired: 'destructive',
  disposed: 'secondary',
  depleted: 'secondary',
}

export default function BatchTrackingPage() {
  const [batches, setBatches] = useState(MOCK_BATCHES)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('all')

  useEffect(() => { setLoading(true); setTimeout(() => setLoading(false), 500) }, [])

  const filteredBatches = batches.filter(b => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!b.batch_number.toLowerCase().includes(q) &&
          !b.product_name.toLowerCase().includes(q) &&
          !(b.lot_number || '').toLowerCase().includes(q)) return false
    }
    if (activeTab === 'active') return b.status === 'active'
    if (activeTab === 'expiring') return b.days_until_expiry >= 0 && b.days_until_expiry <= 30 && b.status === 'active'
    if (activeTab === 'issues') return ['quarantined', 'recalled', 'expired'].includes(b.status)
    return true
  })

  const activeCount = batches.filter(b => b.status === 'active').length
  const expiringCount = batches.filter(b => b.days_until_expiry >= 0 && b.days_until_expiry <= 30 && b.status === 'active').length
  const issueCount = batches.filter(b => ['quarantined', 'recalled', 'expired'].includes(b.status)).length

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Batch & Lot Tracking</h1>
          <p className="text-muted-foreground mt-1">
            Track expiry dates, lot numbers, recalls, and quarantine items
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Batches</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{activeCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3 text-yellow-500" /> Expiring Soon (30d)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-yellow-600">{expiringCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-red-500" /> Issues
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">{issueCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Units Tracked</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{batches.reduce((s, b) => s + b.quantity, 0).toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search & Filter */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by batch number, lot number, or product name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
            <TabsList>
              <TabsTrigger value="all">All ({batches.length})</TabsTrigger>
              <TabsTrigger value="active">Active ({activeCount})</TabsTrigger>
              <TabsTrigger value="expiring" className="text-yellow-600">Expiring Soon ({expiringCount})</TabsTrigger>
              <TabsTrigger value="issues" className="text-red-600">Issues ({issueCount})</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {/* Batch List */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : filteredBatches.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No batches found matching your search</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filteredBatches.map((batch) => (
            <Card key={batch.id} className={`overflow-hidden ${
              batch.days_until_expiry >= 0 && batch.days_until_expiry <= 3 && batch.status === 'active'
                ? 'border-red-300' : ''
            }`}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <FlaskConical className="h-8 w-8 text-muted-foreground mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{batch.product_name}</p>
                        <Badge variant={statusColors[batch.status] || 'default'} className="uppercase text-xs">
                          {batch.status}
                        </Badge>
                        {batch.days_until_expiry >= 0 && batch.days_until_expiry <= 30 && batch.status === 'active' && (
                          <Badge variant="destructive" className="text-xs animate-pulse">
                            {batch.days_until_expiry}d until expiry
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs">Batch #</p>
                          <p className="font-mono text-xs">{batch.batch_number}</p>
                        </div>
                        {batch.lot_number && (
                          <div>
                            <p className="text-muted-foreground text-xs">Lot #</p>
                            <p className="font-mono text-xs">{batch.lot_number}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-muted-foreground text-xs">Quantity</p>
                          <p className="font-bold">{batch.quantity.toLocaleString()}</p>
                          {batch.reserved > 0 && <p className="text-xs text-muted-foreground">{batch.reserved} reserved</p>}
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Manufactured</p>
                          <p>{formatDate(batch.manufacture_date)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Expiry</p>
                          <p className={batch.days_until_expiry <= 30 && batch.status === 'active' ? 'text-red-600 font-bold' : ''}>
                            {formatDate(batch.expiry_date)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Supplier</p>
                          <p>{batch.supplier_name}</p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        <Building2 className="h-3 w-3 inline mr-1" />
                        {batch.location}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
