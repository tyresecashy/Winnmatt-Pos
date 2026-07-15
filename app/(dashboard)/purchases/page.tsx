'use client'
import { logger } from '@/lib/logger';

import { useCallback, useEffect, useState, useDeferredValue } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Plus,
  Search,
  SearchX,
  Package,
  ClipboardList,
  MoreHorizontal,
  Eye,
  CheckCircle,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Truck,
  Clock,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react'
import {
  getPurchaseOrders,
  createPurchaseOrder,
  getPurchaseStats,
  type PurchaseOrderItem,
} from '@/lib/modules/purchases'
import {
  getPurchaseReceipts,
  getPurchaseReceiptById,
  receivePurchaseOrder,
  updatePurchaseOrderStatus,
} from '@/lib/modules/procurement'
import { getSuppliers } from '@/lib/modules/suppliers'
import { getProductsForPOS } from '@/lib/modules/inventory'
import { formatKSh } from '@/lib/currency'
import { formatDate } from '@/lib/date-time'
import { useToast } from '@/components/ui/use-toast'

const statusColors: Record<string, { bg: string; icon: React.ElementType }> = {
  draft: { bg: 'bg-muted text-muted-foreground', icon: AlertCircle },
  pending: { bg: 'bg-yellow-100 text-yellow-700', icon: Clock },
  approved: { bg: 'bg-green-100 text-green-700', icon: CheckCircle },
  received: { bg: 'bg-blue-100 text-blue-700', icon: Package },
  cancelled: { bg: 'bg-red-100 text-red-700', icon: AlertCircle },
}

interface PurchaseOrder {
  id: string
  supplier_id: string
  branch_id: string
  status: 'draft' | 'pending' | 'approved' | 'received' | 'cancelled'
  subtotal: number
  tax_amount: number
  total_amount: number
  expected_delivery: string
  notes: string | null
  created_at: string
  updated_at: string
  supplier?: {
    id: string
    name: string
    contact_person: string
    phone: string
  }
  items?: PurchaseOrderItemRecord[]
}

interface PurchaseOrderItemRecord {
  id: string
  product_id: string
  quantity: number
  unit_price: number
  line_total: number
  received_quantity: number
  product?: { id: string; sku: string; name: string } | null
}

interface Supplier {
  id: string
  name: string
  contact_person: string
  phone: string
  email: string | null
  payment_terms: string
  balance: number
}

interface Product {
  id: string
  name: string
  sku: string
  selling_price?: number
  purchase_price?: number
  quantity: number
  category?: { id: string; name: string; icon?: string } | null
}

export default function PurchasesPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [stats, setStats] = useState({
    total_orders: 0,
    total_spent: 0,
    draft: 0,
    pending: 0,
    approved: 0,
    received: 0,
    cancelled: 0,
  })
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const deferredSearchTerm = useDeferredValue(searchTerm)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null)
  const [showReceiveDialog, setShowReceiveDialog] = useState(false)
  const [receiveNotes, setReceiveNotes] = useState('')
  const [receiveItems, setReceiveItems] = useState<Array<{
    product_id: string
    product_name: string
    quantity_ordered: number
    quantity_received_so_far: number
    quantity_received: number
    unit_cost: number
    batch_number: string
    expiry_date: string
  }>>([])
  const [isSaving, setIsSaving] = useState(false)
  const [showReceiptHistory, setShowReceiptHistory] = useState(false)
  const [receipts, setReceipts] = useState<any[]>([])
  const [receiptsLoading, setReceiptsLoading] = useState(false)
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null)
  const [receiptDetail, setReceiptDetail] = useState<any | null>(null)
  const [receiptDetailLoading, setReceiptDetailLoading] = useState(false)

  // Form state for creating PO
  const [formData, setFormData] = useState({
    supplier_id: '',
    expected_delivery: '',
    notes: '',
  })
  const [poItems, setPoItems] = useState<
    Array<{
      product_id: string
      quantity: number
      unit_price: number
    }>
  >([])
  const [newItem, setNewItem] = useState({
    product_id: '',
    quantity: 1,
    unit_price: 0,
  })

  const loadData = useCallback(async () => {
    if (!profile?.branch_id) {
      setPurchaseOrders([])
      setSuppliers([])
      setProducts([])
      setStats({
        total_orders: 0,
        total_spent: 0,
        draft: 0,
        pending: 0,
        approved: 0,
        received: 0,
        cancelled: 0,
      })
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const [pos, sups, prods, poStats] = await Promise.all([
        getPurchaseOrders(profile.branch_id, 100),
        getSuppliers(),
        getProductsForPOS(profile.branch_id),
        getPurchaseStats(profile.branch_id),
      ])

      setPurchaseOrders(pos as unknown as PurchaseOrder[])
      setSuppliers(sups as unknown as Supplier[])
      setProducts(prods as unknown as Product[])
      setStats(poStats)
    } catch (error) {
      logger.error('Failed to load data:', error)
      toast({
        title: 'Error',
        description: 'Failed to load data',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [profile, toast])

  // Load data on mount
  useEffect(() => {
    const timer = setTimeout(() => void loadData())
    return () => clearTimeout(timer)
  }, [loadData])

  const filteredOrders = purchaseOrders.filter((order) => {
    const matchesSearch =
      (order.id.toLowerCase().includes(deferredSearchTerm.toLowerCase()) ||
        order.supplier?.name.toLowerCase().includes(deferredSearchTerm.toLowerCase()) ||
        (order.notes?.toLowerCase() || '').includes(deferredSearchTerm.toLowerCase())) &&
      (statusFilter === 'all' || order.status === statusFilter)
    return matchesSearch
  })

  const handleAddItem = () => {
    if (!newItem.product_id || newItem.quantity <= 0 || newItem.unit_price <= 0) {
      toast({
        title: 'Error',
        description: 'Please fill in all item fields',
        variant: 'destructive',
      })
      return
    }

    // Check if item already added
    if (poItems.find((item) => item.product_id === newItem.product_id)) {
      toast({
        title: 'Error',
        description: 'This product is already in the purchase order',
        variant: 'destructive',
      })
      return
    }

    setPoItems([...poItems, { ...newItem }])
    setNewItem({
      product_id: '',
      quantity: 1,
      unit_price: 0,
    })
  }

  const handleRemoveItem = (index: number) => {
    setPoItems(poItems.filter((_, i) => i !== index))
  }

  const handleCreatePO = async () => {
    if (!formData.supplier_id || !formData.expected_delivery || poItems.length === 0) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields and add at least one item',
        variant: 'destructive',
      })
      return
    }

    setIsSaving(true)
    try {
      const result = await createPurchaseOrder({
        supplier_id: formData.supplier_id,
        branch_id: profile?.branch_id || '',
        items: poItems,
        expected_delivery: formData.expected_delivery,
        notes: formData.notes,
      })

      if (result.success) {
        setShowCreateDialog(false)
        setFormData({
          supplier_id: '',
          expected_delivery: '',
          notes: '',
        })
        setPoItems([])
        toast({
          title: 'Success',
          description: result.message,
        })
        await loadData()
      } else {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create purchase order',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleMarkAsPending = async (order?: PurchaseOrder | null) => {
    const targetPO = order || selectedPO
    if (!targetPO) return

    setIsSaving(true)
    try {
      const result = await updatePurchaseOrderStatus(targetPO.id, 'pending')

      if (result.success) {
        setSelectedPO(null)
        setShowDetailsDialog(false)
        toast({
          title: 'Success',
          description: result.message,
        })
        await loadData()
      } else {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to submit order',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleOpenReceiveDialog = (order?: PurchaseOrder | null) => {
    const targetPO = order || selectedPO
    if (!targetPO) return

    const items = (targetPO.items || []).map((item) => ({
      product_id: item.product_id,
      product_name: item.product?.name || 'Unknown',
      quantity_ordered: item.quantity,
      quantity_received_so_far: item.received_quantity || 0,
      quantity_received: item.quantity - (item.received_quantity || 0),
      unit_cost: item.unit_price,
      batch_number: '',
      expiry_date: '',
    }))
    setReceiveItems(items)
    setReceiveNotes('')
    setShowReceiveDialog(true)
    setShowDetailsDialog(false)
  }

  const handleConfirmReceive = async () => {
    if (!selectedPO) return
    setIsSaving(true)
    try {
      const result = await receivePurchaseOrder(
        selectedPO.id,
        receiveItems.map((item) => ({
          product_id: item.product_id,
          quantity_received: item.quantity_received,
          unit_cost: item.unit_cost,
          batch_number: item.batch_number || null,
          expiry_date: item.expiry_date || null,
        })),
        receiveNotes || undefined
      )

      if (result.success) {
        setShowReceiveDialog(false)
        setSelectedPO(null)
        toast({ title: 'Success', description: result.message })
        await loadData()
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to receive goods', variant: 'destructive' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleOpenReceiptHistory = async (order: PurchaseOrder) => {
    setSelectedPO(order)
    setShowReceiptHistory(true)
    setReceiptsLoading(true)
    try {
      const data = await getPurchaseReceipts(order.id)
      setReceipts(data)
    } catch (error) {
      logger.error('Failed to load receipts:', error)
    } finally {
      setReceiptsLoading(false)
    }
  }

  const handleViewReceiptDetail = async (receiptId: string) => {
    setReceiptDetailLoading(true)
    try {
      const data = await getPurchaseReceiptById(receiptId)
      setReceiptDetail(data)
    } catch (error) {
      logger.error('Failed to load receipt detail:', error)
    } finally {
      setReceiptDetailLoading(false)
    }
  }

  const handleApproveOrder = async (order?: PurchaseOrder | null) => {
    const targetPO = order || selectedPO
    if (!targetPO) return
    setIsSaving(true)
    try {
      const result = await updatePurchaseOrderStatus(targetPO.id, 'approved')
      if (result.success) {
        setSelectedPO(null)
        setShowDetailsDialog(false)
        toast({ title: 'Success', description: result.message })
        await loadData()
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to approve order', variant: 'destructive' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleRejectOrder = async (order?: PurchaseOrder | null) => {
    const targetPO = order || selectedPO
    if (!targetPO) return
    setIsSaving(true)
    try {
      const result = await updatePurchaseOrderStatus(targetPO.id, 'cancelled')
      if (result.success) {
        setSelectedPO(null)
        setShowDetailsDialog(false)
        toast({ title: 'Success', description: result.message })
        await loadData()
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to reject order', variant: 'destructive' })
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
          <Skeleton className="h-10 w-44" />
        </div>
        <div className="grid gap-4 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16 mt-2" />
              </CardHeader>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <div className="flex gap-4">
              <Skeleton className="h-10 w-72" />
              <Skeleton className="h-10 w-36" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Purchases</h1>
          <p className="text-muted-foreground">Manage purchase orders and goods received</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Purchase Order
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Orders</CardDescription>
            <CardTitle className="text-3xl">{stats.total_orders}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Spent</CardDescription>
            <CardTitle className="text-2xl">{formatKSh(stats.total_spent)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Draft
            </CardDescription>
            <CardTitle className="text-3xl">{stats.draft}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-yellow-600" />
              Pending
            </CardDescription>
            <CardTitle className="text-3xl text-yellow-600">{stats.pending}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3 text-green-600" />
              Approved
            </CardDescription>
            <CardTitle className="text-3xl text-green-600">{stats.approved}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Package className="h-3 w-3 text-blue-600" />
              Received
            </CardDescription>
            <CardTitle className="text-3xl text-blue-600">{stats.received}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending">Pending Approval</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="received">Received</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground whitespace-nowrap">
              Showing {filteredOrders.length} of {purchaseOrders.length} orders
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {filteredOrders.length === 0 ? (
            <EmptyState
              icon={purchaseOrders.length === 0 ? ClipboardList : SearchX}
              title={purchaseOrders.length === 0 ? 'No purchase orders yet' : 'No orders match your filters'}
              description={purchaseOrders.length === 0 ? 'Create your first purchase order to start tracking inventory.' : 'Try different search terms or clear your filters.'}
              compact
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-center">Items</TableHead>
                  <TableHead className="text-right">Total Value</TableHead>
                  <TableHead>Expected Delivery</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => {
                  const StatusIcon = statusColors[order.status]?.icon || Package
                  return (
                    <TableRow key={order.id}>
                      <TableCell>
                        <span className="font-mono text-sm font-medium">{order.id.substring(0, 8)}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                            <Truck className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{order.supplier?.name}</p>
                            <p className="text-xs text-muted-foreground">{order.supplier?.contact_person}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{order.items?.length || 0}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatKSh(order.total_amount)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(order.expected_delivery)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusColors[order.status]?.bg}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedPO(order)
                                setShowDetailsDialog(true)
                              }}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            {order.status === 'draft' && (
                              <DropdownMenuItem
                                onClick={() => {
                                  void handleMarkAsPending(order)
                                }}
                              >
                                <Truck className="mr-2 h-4 w-4" />
                                Submit for Approval
                              </DropdownMenuItem>
                            )}
                            {order.status === 'pending' && (profile?.role === 'super_admin' || profile?.role === 'admin') && (
                              <>
                                <DropdownMenuItem onClick={() => void handleApproveOrder(order)}>
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Approve
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => void handleRejectOrder(order)}>
                                  <AlertCircle className="mr-2 h-4 w-4" />
                                  Reject
                                </DropdownMenuItem>
                              </>
                            )}
                            {order.status === 'approved' && (
                              <DropdownMenuItem onClick={() => void handleOpenReceiveDialog(order)}>
                                <Package className="mr-2 h-4 w-4" />
                                Receive Stock
                              </DropdownMenuItem>
                            )}
                            {order.status === 'received' && (
                              <DropdownMenuItem onClick={() => void handleOpenReceiptHistory(order)}>
                                <ClipboardList className="mr-2 h-4 w-4" />
                                View Receipts
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Purchase Order Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Purchase Order</DialogTitle>
            <DialogDescription>Create a new purchase order from a supplier</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Supplier Selection */}
            <div>
              <Label htmlFor="supplier">Supplier *</Label>
              <Select value={formData.supplier_id} onValueChange={(val) => setFormData({ ...formData, supplier_id: val })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier..." />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Expected Delivery */}
            <div>
              <Label htmlFor="delivery_date">Expected Delivery Date *</Label>
              <Input
                id="delivery_date"
                type="date"
                value={formData.expected_delivery}
                onChange={(e) => setFormData({ ...formData, expected_delivery: e.target.value })}
                disabled={isSaving}
              />
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                placeholder="Optional notes about this order"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                disabled={isSaving}
              />
            </div>

            {/* Items Section */}
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">Purchase Items</h3>

              {/* Add Item Form */}
              <div className="space-y-2 p-3 border rounded-lg bg-muted/30 mb-3">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Product</Label>
                    <Select value={newItem.product_id} onValueChange={(val) => setNewItem({ ...newItem, product_id: val })}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select product..." />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Quantity</Label>
                    <Input
                      type="number"
                      min="1"
                      value={newItem.quantity}
                      onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) })}
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Cost Price</Label>
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={newItem.unit_price}
                      onChange={(e) => setNewItem({ ...newItem, unit_price: parseFloat(e.target.value) })}
                      className="h-9"
                    />
                  </div>
                </div>
                <Button size="sm" onClick={handleAddItem} disabled={isSaving} className="w-full">
                  Add Item
                </Button>
              </div>

              {/* Items Table */}
              {poItems.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Line Total</TableHead>
                        <TableHead className="w-[40px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {poItems.map((item, idx) => {
                        const product = products.find((p) => p.id === item.product_id)
                        const lineTotal = item.quantity * item.unit_price
                        return (
                          <TableRow key={idx}>
                            <TableCell className="text-sm">{product?.name}</TableCell>
                            <TableCell className="text-right text-sm">{item.quantity}</TableCell>
                            <TableCell className="text-right text-sm">{formatKSh(item.unit_price)}</TableCell>
                            <TableCell className="text-right text-sm font-medium">
                              {formatKSh(lineTotal)}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveItem(idx)}
                                disabled={isSaving}
                              >
                                ✕
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>

                  {/* Totals */}
                  <div className="bg-muted p-3 space-y-1">
                    {(() => {
                      const subtotal = poItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0)
                      const tax = Math.round(subtotal * 0.16)
                      const total = subtotal + tax
                      return (
                        <>
                          <div className="flex justify-between text-sm">
                            <span>Subtotal</span>
                            <span>{formatKSh(subtotal)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Tax (16%)</span>
                            <span>{formatKSh(tax)}</span>
                          </div>
                          <div className="flex justify-between font-semibold border-t pt-1">
                            <span>Total</span>
                            <span>{formatKSh(total)}</span>
                          </div>
                        </>
                      )
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleCreatePO} disabled={isSaving || poItems.length === 0}>
              {isSaving ? 'Creating...' : 'Create Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Purchase Order Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Purchase Order Details</DialogTitle>
            <DialogDescription>Order ID: {selectedPO?.id.substring(0, 8)}</DialogDescription>
          </DialogHeader>

          {selectedPO && (
            <div className="space-y-4">
              {/* Header Info */}
              <div className="grid grid-cols-2 gap-4 pb-4 border-b">
                <div>
                  <p className="text-xs text-muted-foreground">Supplier</p>
                  <p className="font-medium">{selectedPO.supplier?.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedPO.supplier?.contact_person}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge className={statusColors[selectedPO.status]?.bg}>
                    {statusColors[selectedPO.status]?.icon &&
                      (() => {
                        const Icon = statusColors[selectedPO.status].icon
                        return <Icon className="h-3 w-3 mr-1 inline" />
                      })()}
                    {selectedPO.status}
                  </Badge>
                </div>
              </div>

              {/* Items */}
              <div>
                <h4 className="font-semibold mb-2">Order Items</h4>
                {selectedPO.items && selectedPO.items.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Ordered</TableHead>
                          <TableHead className="text-right">Received</TableHead>
                          <TableHead className="text-right">Unit Price</TableHead>
                          <TableHead className="text-right">Line Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedPO.items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="text-sm">{item.product?.name}</TableCell>
                            <TableCell className="text-right text-sm">{item.quantity}</TableCell>
                            <TableCell className="text-right text-sm">
                              {item.received_quantity || 0}
                            </TableCell>
                            <TableCell className="text-right text-sm">{formatKSh(item.unit_price)}</TableCell>
                            <TableCell className="text-right text-sm font-medium">
                              {formatKSh(item.line_total)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {/* Totals */}
                    <div className="bg-muted p-3 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Subtotal</span>
                        <span>{formatKSh(selectedPO.subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Tax</span>
                        <span>{formatKSh(selectedPO.tax_amount)}</span>
                      </div>
                      <div className="flex justify-between font-semibold border-t pt-1">
                        <span>Total</span>
                        <span>{formatKSh(selectedPO.total_amount)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No items in this order</p>
                )}
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="text-sm">{formatDate(selectedPO.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Expected Delivery</p>
                  <p className="text-sm">{formatDate(selectedPO.expected_delivery)}</p>
                </div>
              </div>

              {/* Notes */}
              {selectedPO.notes && (
                <div>
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p className="text-sm">{selectedPO.notes}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {selectedPO?.status === 'draft' && (
              <Button onClick={() => void handleMarkAsPending()} disabled={isSaving}>
                {isSaving ? 'Submitting...' : 'Submit for Approval'}
              </Button>
            )}
            {(selectedPO?.status === 'pending' && (profile?.role === 'super_admin' || profile?.role === 'admin')) && (
              <>
                <Button variant="outline" onClick={() => void handleRejectOrder()} disabled={isSaving}>
                  Reject
                </Button>
                <Button onClick={() => void handleApproveOrder()} disabled={isSaving}>
                  {isSaving ? 'Approving...' : 'Approve'}
                </Button>
              </>
            )}
            {selectedPO?.status === 'approved' && (
              <Button onClick={() => void handleOpenReceiveDialog()} disabled={isSaving}>
                <Package className="mr-2 h-4 w-4" />
                {isSaving ? 'Opening...' : 'Receive Stock'}
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowDetailsDialog(false)} disabled={isSaving}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Goods Received Note Dialog */}
      <Dialog open={showReceiveDialog} onOpenChange={setShowReceiveDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Receive Goods</DialogTitle>
            <DialogDescription>
              Record goods received for PO {selectedPO?.id.substring(0, 8)} — {selectedPO?.supplier?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {receiveItems.map((item, idx) => (
              <div key={item.product_id} className="border rounded-lg p-4 space-y-3">
                <h4 className="font-semibold text-sm">{item.product_name}</h4>

                <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground mb-2">
                  <span>Ordered: {item.quantity_ordered}</span>
                  <span>Received so far: {item.quantity_received_so_far}</span>
                  <span>Remaining: {item.quantity_ordered - item.quantity_received_so_far}</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Qty Receiving *</Label>
                    <Input
                      type="number"
                      min="0"
                      max={item.quantity_ordered - item.quantity_received_so_far}
                      value={item.quantity_received}
                      onChange={(e) => {
                        const newItems = [...receiveItems]
                        newItems[idx] = { ...newItems[idx], quantity_received: parseInt(e.target.value) || 0 }
                        setReceiveItems(newItems)
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Unit Cost</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unit_cost}
                      onChange={(e) => {
                        const newItems = [...receiveItems]
                        newItems[idx] = { ...newItems[idx], unit_cost: parseFloat(e.target.value) || 0 }
                        setReceiveItems(newItems)
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Batch Number</Label>
                    <Input
                      placeholder="Optional"
                      value={item.batch_number}
                      onChange={(e) => {
                        const newItems = [...receiveItems]
                        newItems[idx] = { ...newItems[idx], batch_number: e.target.value }
                        setReceiveItems(newItems)
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Expiry Date</Label>
                    <Input
                      type="date"
                      value={item.expiry_date}
                      onChange={(e) => {
                        const newItems = [...receiveItems]
                        newItems[idx] = { ...newItems[idx], expiry_date: e.target.value }
                        setReceiveItems(newItems)
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}

            <div>
              <Label>Receipt Notes</Label>
              <Input
                placeholder="Optional notes about this receipt"
                value={receiveNotes}
                onChange={(e) => setReceiveNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReceiveDialog(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleConfirmReceive} disabled={isSaving}>
              {isSaving ? 'Receiving...' : 'Confirm Receive'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt History Dialog */}
      <Dialog open={showReceiptHistory} onOpenChange={setShowReceiptHistory}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Receipt History</DialogTitle>
            <DialogDescription>
              {selectedPO ? `PO #${selectedPO.id.substring(0, 8)}` : ''}
            </DialogDescription>
          </DialogHeader>

          {receiptsLoading ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : receipts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No receipts recorded yet</p>
          ) : selectedReceipt && receiptDetail ? (
            /* Receipt detail view */
            <div className="space-y-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedReceipt(null)
                  setReceiptDetail(null)
                }}
                className="gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Receipts
              </Button>

              <div className="rounded-lg bg-muted p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Date Received</span>
                    <p className="font-medium">
                      {new Date(receiptDetail.created_at).toLocaleDateString('en-KE', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Supplier</span>
                    <p className="font-medium">{receiptDetail.supplier?.name || '-'}</p>
                  </div>
                  {receiptDetail.notes && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Notes</span>
                      <p className="font-medium">{receiptDetail.notes}</p>
                    </div>
                  )}
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty Received</TableHead>
                    <TableHead className="text-right">Unit Cost</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Expiry</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receiptDetail.items?.map((item: { id: string; product?: { id: string; sku: string; name: string } | null; quantity_received: number; unit_cost: number; batch_number?: string | null; expiry_date?: string | null }) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.product?.name || 'Unknown'}</TableCell>
                      <TableCell className="text-right">{item.quantity_received}</TableCell>
                      <TableCell className="text-right font-mono">{formatKSh(item.unit_cost)}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatKSh(item.quantity_received * item.unit_cost)}
                      </TableCell>
                      <TableCell className="text-xs">{item.batch_number || '-'}</TableCell>
                      <TableCell className="text-xs">
                        {item.expiry_date
                          ? new Date(item.expiry_date).toLocaleDateString('en-KE', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            /* Receipt list */
            <div className="space-y-2">
              {receipts.map((receipt) => (
                <div
                  key={receipt.id}
                  className="flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  onClick={() => {
                    setSelectedReceipt(receipt)
                    void handleViewReceiptDetail(receipt.id)
                  }}
                >
                  <div>
                    <p className="text-sm font-medium">
                      Receipt #{receipt.id.substring(0, 8)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(receipt.created_at).toLocaleDateString('en-KE', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono">{formatKSh(receipt.total_amount || 0)}</p>
                    <p className="text-xs text-muted-foreground">{receipt.items_count || 0} items</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
