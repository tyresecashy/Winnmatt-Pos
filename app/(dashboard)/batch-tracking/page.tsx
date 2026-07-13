'use client'

import { logger } from '@/lib/logger'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import {
  FlaskConical, Search, AlertTriangle,
  Clock, Building2,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { toast } from '@/components/ui/use-toast'
import { supabase } from '@/lib/supabase'

interface Batch {
  id: string
  batch_number: string
  lot_number: string | null
  product_id: string | null
  product?: { name: string } | null
  supplier_id: string | null
  supplier?: { name: string } | null
  warehouse_id: string | null
  warehouse?: { name: string } | null
  quantity: number
  reserved_quantity: number
  manufacture_date: string | null
  expiry_date: string | null
  status: string
  notes: string | null
}

const statusColors: Record<string, 'default' | 'destructive' | 'secondary' | 'outline' | 'ghost'> = {
  active: 'default',
  quarantined: 'ghost',
  recalled: 'destructive',
  expired: 'destructive',
  disposed: 'secondary',
  depleted: 'secondary',
}

export default function BatchTrackingPage() {
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('all')

  useEffect(() => {
    const fetchBatches = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('batch_tracking')
          .select(`
            *,
            product:products(name),
            supplier:suppliers(name),
            warehouse:warehouses(name)
          `)
          .order('expiry_date', { ascending: true, nullsFirst: false })

        if (error) throw error
        setBatches((data as Batch[]) || [])
      } catch (err) {
        logger.error('Failed to load batch data:', err)
        toast({
          title: 'Error',
          description: 'Failed to load batch tracking data',
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    }
    fetchBatches()
  }, [])

  const daysUntilExpiry = (expiryDate: string | null): number => {
    if (!expiryDate) return Infinity
    const now = new Date()
    const expiry = new Date(expiryDate)
    return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  }

  const filteredBatches = batches.filter(b => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const productName = b.product?.name?.toLowerCase() || ''
      if (!b.batch_number.toLowerCase().includes(q) &&
          !productName.includes(q) &&
          !(b.lot_number || '').toLowerCase().includes(q)) return false
    }
    if (activeTab === 'active') return b.status === 'active'
    if (activeTab === 'expiring') {
      const d = daysUntilExpiry(b.expiry_date)
      return d >= 0 && d <= 30 && b.status === 'active'
    }
    if (activeTab === 'issues') return ['quarantined', 'recalled', 'expired'].includes(b.status)
    return true
  })

  const activeCount = batches.filter(b => b.status === 'active').length
  const expiringCount = batches.filter(b => {
    const d = daysUntilExpiry(b.expiry_date)
    return d >= 0 && d <= 30 && b.status === 'active'
  }).length
  const issueCount = batches.filter(b => ['quarantined', 'recalled', 'expired'].includes(b.status)).length
  const totalUnits = batches.reduce((s, b) => s + b.quantity, 0)

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
              <p className="text-2xl font-bold">{totalUnits.toLocaleString()}</p>
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
          <EmptyState icon={Search} title="No batches found matching your search" compact />
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filteredBatches.map((batch) => {
            const d = daysUntilExpiry(batch.expiry_date)
            const isUrgent = d >= 0 && d <= 3 && batch.status === 'active'
            const productName = batch.product?.name || `Product ${batch.product_id?.slice(0, 8) || 'Unknown'}`
            const supplierName = batch.supplier?.name || 'Unknown'
            const warehouseName = batch.warehouse?.name || 'Unassigned'
            return (
            <Card key={batch.id} className={`overflow-hidden ${
              isUrgent ? 'border-destructive/30' : ''
            }`}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <FlaskConical className="h-8 w-8 text-muted-foreground mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{productName}</p>
                        <Badge variant={statusColors[batch.status] || 'default'} className="uppercase text-xs">
                          {batch.status}
                        </Badge>
                        {d >= 0 && d <= 30 && batch.status === 'active' && (
                          <Badge variant="destructive" className="text-xs animate-pulse">
                            {d}d until expiry
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
                          {batch.reserved_quantity > 0 && <p className="text-xs text-muted-foreground">{batch.reserved_quantity} reserved</p>}
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Manufactured</p>
                          <p>{batch.manufacture_date ? formatDate(batch.manufacture_date) : '-'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Expiry</p>
                          <p className={d <= 30 && batch.status === 'active' ? 'text-red-600 font-bold' : ''}>
                            {batch.expiry_date ? formatDate(batch.expiry_date) : '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Supplier</p>
                          <p>{supplierName}</p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        <Building2 className="h-3 w-3 inline mr-1" />
                        {warehouseName}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
