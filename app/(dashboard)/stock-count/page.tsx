'use client'
import { logger } from '@/lib/logger'

import { useCallback, useEffect, useRef, useState, startTransition } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/components/ui/use-toast'
import { formatKSh } from '@/lib/currency'
import {
  createStockCount,
  getStockCounts,
  getStockCountWithItems,
  populateStockCount,
  updateStockCountItem,
  completeStockCount,
  approveStockCount,
  cancelStockCount,
  type StockCount,
  type StockCountItem,
} from '@/lib/modules/inventory'
import { Plus, ClipboardList, CheckCircle2, XCircle, AlertTriangle, Save, Play, Eye, Search } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

const STATUS_BADGE: Record<string, 'secondary' | 'default' | 'destructive' | 'outline'> = {
  draft: 'secondary',
  in_progress: 'default',
  completed: 'outline',
  approved: 'outline',
  cancelled: 'destructive',
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  in_progress: 'In Progress',
  completed: 'Completed',
  approved: 'Approved',
  cancelled: 'Cancelled',
}

export default function StockCountPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [stockCounts, setStockCounts] = useState<StockCount[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [selectedCount, setSelectedCount] = useState<StockCount | null>(null)
  const [countItems, setCountItems] = useState<(StockCountItem & { product?: { id: string; sku: string; name: string; selling_price: number; purchase_price: number } | null })[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [savingEdit, setSavingEdit] = useState<string | null>(null)
  const [populating, setPopulating] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [approving, setApproving] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string | undefined>()
  const [searchQuery, setSearchQuery] = useState('')

  const loadCounts = useCallback(async () => {
    const branchId = profile?.branch_id
    if (!branchId) {
      setStockCounts([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const counts = await getStockCounts(branchId, filterStatus)
      setStockCounts(counts)
    } catch (error) {
      logger.error('Failed to load stock counts:', error)
    } finally {
      setLoading(false)
    }
  }, [profile?.branch_id, filterStatus])

  useEffect(() => {
    startTransition(() => { void loadCounts() })
  }, [loadCounts])

  const handleCreate = async () => {
    if (!profile?.branch_id || !profile?.id) return
    setCreating(true)
    try {
      const result = await createStockCount(profile.branch_id, profile.id)
      if (result.success && result.data) {
        toast({ title: 'Stock Count Created', description: 'New draft stock count created' })
        void loadCounts()
        // Open the new stock count
        handleViewCount(result.data)
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to create', variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create stock count', variant: 'destructive' })
    } finally {
      setCreating(false)
    }
  }

  const handleViewCount = async (count: StockCount) => {
    setSelectedCount(count)
    setDetailLoading(true)
    try {
      const result = await getStockCountWithItems(count.id)
      if (result.count && result.items) {
        setCountItems(result.items as (StockCountItem & { product?: { id: string; sku: string; name: string; selling_price: number; purchase_price: number } | null })[])
        // Initialize edit values
        const values: Record<string, string> = {}
        result.items.forEach((item) => {
          values[item.id] = String(item.physical_quantity)
        })
        setEditValues(values)
      }
    } catch (error) {
      logger.error('Failed to load count details:', error)
    } finally {
      setDetailLoading(false)
    }
  }

  const handlePopulate = async () => {
    if (!selectedCount || !profile?.branch_id) return
    setPopulating(true)
    try {
      const result = await populateStockCount(selectedCount.id, profile.branch_id)
      if (result.success) {
        toast({ title: 'Stock Count Populated', description: 'Products loaded from inventory' })
        void handleViewCount(selectedCount)
        void loadCounts()
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to populate', variant: 'destructive' })
      }
    } finally {
      setPopulating(false)
    }
  }

  const handleUpdateItem = async (itemId: string) => {
    const val = parseInt(editValues[itemId] || '0', 10)
    if (isNaN(val) || val < 0) return

    setSavingEdit(itemId)
    try {
      const result = await updateStockCountItem(itemId, val)
      if (result.success) {
        // Update local state
        setCountItems((prev) =>
          prev.map((item) =>
            item.id === itemId
              ? { ...item, physical_quantity: val, variance: val - item.expected_quantity }
              : item
          )
        )
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to update', variant: 'destructive' })
      }
    } finally {
      setSavingEdit(null)
    }
  }

  const handleComplete = async () => {
    if (!selectedCount) return
    setCompleting(true)
    try {
      const result = await completeStockCount(selectedCount.id)
      if (result.success) {
        toast({ title: 'Stock Count Completed', description: 'Ready for review and approval' })
        void handleViewCount(selectedCount)
        void loadCounts()
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to complete', variant: 'destructive' })
      }
    } finally {
      setCompleting(false)
    }
  }

  const handleApprove = async () => {
    if (!selectedCount || !profile?.id || !profile?.branch_id) return
    setApproving(true)
    try {
      const result = await approveStockCount(selectedCount.id, profile.id, profile.branch_id)
      if (result.success) {
        toast({ title: 'Stock Count Approved', description: 'Inventory has been adjusted' })
        void handleViewCount(selectedCount)
        void loadCounts()
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to approve', variant: 'destructive' })
      }
    } finally {
      setApproving(false)
    }
  }

  const handleCancel = async (countId: string) => {
    try {
      const result = await cancelStockCount(countId)
      if (result.success) {
        toast({ title: 'Stock Count Cancelled' })
        setSelectedCount(null)
        setCountItems([])
        void loadCounts()
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to cancel', variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to cancel', variant: 'destructive' })
    }
  }

  const filteredItems = searchQuery
    ? countItems.filter(
        (item) =>
          item.product?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.product?.sku?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : countItems

  const discrepancies = countItems.filter((item) => item.variance !== 0)

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stock Count / Audit</h1>
          <p className="text-sm text-muted-foreground">Physical inventory counting and discrepancy management</p>
        </div>
        <Button onClick={handleCreate} disabled={creating} className="gap-1.5">
          <Plus className="h-4 w-4" />
          New Stock Count
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Stock Counts List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Stock Counts</CardTitle>
              <select
                className="rounded-md border px-2 py-1 text-sm"
                value={filterStatus || ''}
                onChange={(e) => setFilterStatus(e.target.value || undefined)}
              >
                <option value="">All Status</option>
                <option value="draft">Draft</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="approved">Approved</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : stockCounts.length === 0 ? (
                <EmptyState icon={ClipboardList} title="No stock counts yet" actions={[{ label: 'Create your first count', onClick: handleCreate, variant: 'outline' }]} compact />
              ) : (
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead className="text-right">Discrepancies</TableHead>
                        <TableHead className="text-right">Variance</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stockCounts.map((count) => (
                        <TableRow
                          key={count.id}
                          className={`cursor-pointer ${
                            selectedCount?.id === count.id ? 'bg-muted/50' : ''
                          }`}
                          onClick={() => handleViewCount(count)}
                        >
                          <TableCell className="text-sm">
                            {new Date(count.count_date || count.created_at).toLocaleDateString('en-KE', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </TableCell>
                          <TableCell>
                            <Badge variant={STATUS_BADGE[count.status] || 'secondary'}>
                              {STATUS_LABEL[count.status] || count.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{count.total_items}</TableCell>
                          <TableCell className="text-right text-sm">
                            {count.total_discrepancies > 0 ? (
                              <span className="font-medium text-destructive">
                                {count.total_discrepancies}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-sm font-mono">
                            {count.net_variance !== 0 ? (
                              <span className={count.net_variance > 0 ? 'text-green-600' : 'text-destructive'}>
                                {count.net_variance > 0 ? '+' : ''}{count.net_variance}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {(count.status === 'draft' || count.status === 'in_progress') && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleCancel(count.id)
                                }}
                              >
                                <XCircle className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Count Detail */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {selectedCount ? `Count #${selectedCount.id.slice(0, 8)}` : 'Details'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedCount ? (
                <EmptyState icon={ClipboardList} title="Select a stock count" compact />
              ) : detailLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Status badge */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Status</span>
                    <Badge variant={STATUS_BADGE[selectedCount.status] || 'secondary'}>
                      {STATUS_LABEL[selectedCount.status] || selectedCount.status}
                    </Badge>
                  </div>

                  {/* Summary stats */}
                  <div className="rounded-lg bg-muted p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span>Total Items</span>
                      <span className="font-medium">{selectedCount.total_items}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Discrepancies</span>
                      <span className={`font-medium ${selectedCount.total_discrepancies > 0 ? 'text-destructive' : ''}`}>
                        {selectedCount.total_discrepancies}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Net Variance</span>
                      <span className={`font-mono font-medium ${
                        selectedCount.net_variance > 0
                          ? 'text-green-600'
                          : selectedCount.net_variance < 0
                          ? 'text-destructive'
                          : ''
                      }`}>
                        {selectedCount.net_variance !== 0
                          ? `${selectedCount.net_variance > 0 ? '+' : ''}${selectedCount.net_variance}`
                          : '0'}
                      </span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-col gap-2">
                    {selectedCount.status === 'draft' && (
                      <Button
                        onClick={handlePopulate}
                        disabled={populating}
                        className="gap-1.5"
                      >
                        <Play className="h-4 w-4" />
                        {populating ? 'Loading...' : 'Start Count (Load Products)'}
                      </Button>
                    )}
                    {selectedCount.status === 'in_progress' && (
                      <Button
                        onClick={handleComplete}
                        disabled={completing}
                        className="gap-1.5"
                      >
                        <Save className="h-4 w-4" />
                        {completing ? 'Completing...' : 'Complete Count'}
                      </Button>
                    )}
                    {selectedCount.status === 'completed' && (
                      <Button
                        onClick={handleApprove}
                        disabled={approving}
                        className="gap-1.5 bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {approving ? 'Approving...' : 'Approve & Adjust Inventory'}
                      </Button>
                    )}
                  </div>

                  {/* Item search */}
                  {(selectedCount.status === 'in_progress' || selectedCount.status === 'completed') && (
                    <>
                      <div className="relative mt-2">
                        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Search products..."
                          className="pl-8 h-8 text-sm"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>

                      {/* Discrepancy summary */}
                      {discrepancies.length > 0 && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-sm dark:border-amber-800 dark:bg-amber-950">
                          <div className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {discrepancies.length} item{discrepancies.length !== 1 ? 's' : ''} with variance
                          </div>
                        </div>
                      )}

                      {/* Items list */}
                      <ScrollArea className="h-[350px]">
                        <div className="space-y-1.5">
                          {filteredItems.length === 0 ? (
                            <EmptyState title="No items loaded. Click &quot;Start Count&quot; to load products." compact />
                          ) : (
                            filteredItems.map((item) => (
                              <div
                                key={item.id}
                                className={`rounded-md border p-2.5 ${
                                  item.variance !== 0
                                    ? 'border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30'
                                    : ''
                                }`}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium truncate">
                                      {item.product?.name || 'Unknown Product'}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      SKU: {item.product?.sku || '-'}
                                    </p>
                                  </div>
                                  <div className="ml-2 text-right">
                                    <p className="text-xs text-muted-foreground">Expected: {item.expected_quantity}</p>
                                  </div>
                                </div>
                                <div className="mt-1.5 flex items-center gap-2">
                                  {selectedCount.status === 'in_progress' ? (
                                    <>
                                      <div className="flex-1">
                                        <Input
                                          type="number"
                                          min="0"
                                          className="h-8 text-sm"
                                          value={editValues[item.id] ?? String(item.physical_quantity)}
                                          onChange={(e) =>
                                            setEditValues((prev) => ({
                                              ...prev,
                                              [item.id]: e.target.value,
                                            }))
                                          }
                                        />
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8"
                                        disabled={savingEdit === item.id}
                                        onClick={() => handleUpdateItem(item.id)}
                                      >
                                        {savingEdit === item.id ? '...' : 'Set'}
                                      </Button>
                                    </>
                                  ) : (
                                    <div className="flex items-center gap-3 text-sm">
                                      <span className="text-muted-foreground">
                                        Counted: <strong>{item.physical_quantity}</strong>
                                      </span>
                                      <span
                                        className={
                                          item.variance > 0
                                            ? 'text-green-600 font-medium'
                                            : item.variance < 0
                                            ? 'text-destructive font-medium'
                                            : 'text-muted-foreground'
                                        }
                                      >
                                        {item.variance > 0 ? '+' : ''}{item.variance}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </ScrollArea>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
