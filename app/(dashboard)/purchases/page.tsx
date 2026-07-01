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
  Package,
  MoreHorizontal,
  Eye,
  CheckCircle,
  Truck,
  Clock,
  AlertCircle,
} from 'lucide-react'
import {
  getPurchaseOrders,
  createPurchaseOrder,
  receivePurchaseOrder,
  updatePurchaseOrderStatus,
  getPurchaseStats,
  type PurchaseOrderItem,
} from '@/lib/purchase-actions'
import { getSuppliers } from '@/lib/suppliers-actions'
import { getProductsForPOS } from '@/lib/products-actions'
import { formatKSh } from '@/lib/currency'
import { formatDate } from '@/lib/date-time'
import { useToast } from '@/components/ui/use-toast'

const statusColors: Record<string, { bg: string; icon: React.ElementType }> = {
  draft: { bg: 'bg-gray-100 text-gray-700', icon: AlertCircle },
  pending: { bg: 'bg-yellow-100 text-yellow-700', icon: Clock },
  received: { bg: 'bg-green-100 text-green-700', icon: CheckCircle },
  cancelled: { bg: 'bg-red-100 text-red-700', icon: AlertCircle },
}

interface PurchaseOrder {
  id: string
  supplier_id: string
  branch_id: string
  status: 'draft' | 'pending' | 'received' | 'cancelled'
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
  items?: any[]
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
  cost_price: number
  selling_price: number
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
  const [isSaving, setIsSaving] = useState(false)

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

      setPurchaseOrders(pos)
      setSuppliers(sups)
      setProducts(prods)
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

  const handleReceiveGoods = async (order?: PurchaseOrder | null) => {
    const targetPO = order || selectedPO
    if (!targetPO) return

    setIsSaving(true)
    try {
      const result = await receivePurchaseOrder(targetPO.id)

      if (result.success) {
        setShowDetailsDialog(false)
        setSelectedPO(null)
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
        description: 'Failed to receive goods',
        variant: 'destructive',
      })
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
    <div className="p-6 space-y-6">
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

      <div className="grid gap-4 md:grid-cols-5">
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
              Received
            </CardDescription>
            <CardTitle className="text-3xl text-green-600">{stats.received}</CardTitle>
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
                <SelectItem value="pending">Pending</SelectItem>
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
            <div className="text-center py-8 text-muted-foreground">
              {purchaseOrders.length === 0
                ? 'No purchase orders yet. Create one to get started.'
                : 'No orders match your filters.'}
            </div>
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
                                Submit Order
                              </DropdownMenuItem>
                            )}
                            {order.status === 'pending' && (
                              <DropdownMenuItem onClick={() => void handleReceiveGoods(order)}>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Receive Goods
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
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Unit Price</TableHead>
                          <TableHead className="text-right">Line Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedPO.items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="text-sm">{item.product?.name}</TableCell>
                            <TableCell className="text-right text-sm">{item.quantity}</TableCell>
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
                {isSaving ? 'Submitting...' : 'Submit Order'}
              </Button>
            )}
            {selectedPO?.status === 'pending' && (
              <Button onClick={() => void handleReceiveGoods()} disabled={isSaving}>
                {isSaving ? 'Receiving...' : 'Receive Goods'}
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowDetailsDialog(false)} disabled={isSaving}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
