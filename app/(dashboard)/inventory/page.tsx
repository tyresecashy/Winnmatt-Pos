"use client"

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search, AlertTriangle, Package, Loader2, Edit2, History, Lock } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { getInventoryForBranch } from "@/lib/products-actions"
import { StockAdjustmentDialog } from "@/components/inventory/stock-adjustment-dialog"
import { StockMovementsDialog } from "@/components/inventory/stock-movements-dialog"

function formatKSh(amount: number): string {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 0,
  }).format(amount)
}

export default function InventoryPage() {
  const { profile, authState } = useAuth()
  const [inventory, setInventory] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [alertFilter, setAlertFilter] = useState<string>("all")
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false)
  const [movementsDialogOpen, setMovementsDialogOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const deferredSearchTerm = useDeferredValue(searchTerm)
  const hasInventoryRef = useRef(false)

  const canManageInventory = ["owner", "admin", "manager"].includes(profile?.role || "")

  useEffect(() => {
    hasInventoryRef.current = inventory.length > 0
  }, [inventory.length])

  const loadInventory = useCallback(async (options?: { background?: boolean }) => {
    if (!profile?.branch_id) {
      setInventory([])
      setIsLoading(false)
      return
    }

    const shouldShowLoading = !options?.background || !hasInventoryRef.current
    if (shouldShowLoading) {
      setIsLoading(true)
    }

    try {
      const data = await getInventoryForBranch(profile.branch_id)
      setInventory(data || [])
    } catch (error) {
      console.error("Failed to load inventory:", error)
      if (!options?.background) {
        setInventory([])
      }
    } finally {
      if (shouldShowLoading) {
        setIsLoading(false)
      }
    }
  }, [profile?.branch_id])

  useEffect(() => {
    void loadInventory()
  }, [loadInventory])

  const lowStockItems = useMemo(
    () => inventory.filter((item) => item.quantity > 0 && item.quantity < (item.product?.reorder_level || 10)),
    [inventory]
  )
  const outOfStockItems = useMemo(
    () => inventory.filter((item) => item.quantity === 0),
    [inventory]
  )

  const filteredInventory = useMemo(() => {
    const normalizedSearch = deferredSearchTerm.trim().toLowerCase()

    return inventory.filter((item) => {
      const matchesSearch =
        !normalizedSearch ||
        item.product?.name?.toLowerCase().includes(normalizedSearch) ||
        item.product?.sku?.toLowerCase().includes(normalizedSearch)

      if (alertFilter === "low") return item.quantity > 0 && item.quantity < (item.product?.reorder_level || 10) && matchesSearch
      if (alertFilter === "out") return item.quantity === 0 && matchesSearch
      return matchesSearch
    })
  }, [alertFilter, deferredSearchTerm, inventory])

  const totalStockValue = useMemo(() => {
    return inventory.reduce((total, item) => {
      return total + item.quantity * (item.product?.purchase_price || 0)
    }, 0)
  }, [inventory])

  const totalUnits = useMemo(
    () => inventory.reduce((sum, item) => sum + item.quantity, 0),
    [inventory]
  )

  if (authState === "loading") {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex min-h-[220px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex min-h-[220px] items-center justify-center text-muted-foreground">
            Please sign in to view inventory.
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!profile.branch_id) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground">Track stock levels by branch</p>
        </div>

        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-base text-yellow-900">Branch context required</CardTitle>
            <CardDescription className="text-yellow-800">
              {profile.role === "owner"
                ? "Inventory is branch-specific. Choose or assign a branch before loading stock levels."
                : "Your account must be assigned to a branch before inventory can be loaded."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const activeBranchId = profile.branch_id

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground">
            Track stock levels for {profile.branch?.name || "your branch"}
          </p>
        </div>
      </div>

      {!canManageInventory && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="flex items-start gap-3 pt-6 text-sm text-blue-900">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Stock adjustments are limited to owners, admins, and managers. You can still review live stock levels and movement history.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Stock Value</CardDescription>
            <CardTitle className="text-2xl">{formatKSh(totalStockValue)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Based on cost prices</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Items</CardDescription>
            <CardTitle className="text-2xl">
              {totalUnits.toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Units in stock</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-200">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-yellow-600" />
              Low Stock
            </CardDescription>
            <CardTitle className="text-2xl text-yellow-600">
              {lowStockItems.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Items below reorder level</p>
          </CardContent>
        </Card>
        <Card className="border-destructive/30">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-destructive">
              <Package className="h-3 w-3" />
              Out of Stock
            </CardDescription>
            <CardTitle className="text-2xl text-destructive">
              {outOfStockItems.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Items needing restock</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="stock" className="space-y-4">
        <TabsList>
          <TabsTrigger value="stock">Stock Levels</TabsTrigger>
        </TabsList>

        <TabsContent value="stock">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="relative max-w-sm flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={alertFilter} onValueChange={setAlertFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Items</SelectItem>
                    <SelectItem value="low">Low Stock</SelectItem>
                    <SelectItem value="out">Out of Stock</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground whitespace-nowrap">
                  Showing {filteredInventory.length} of {inventory.length} items
                </p>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3 py-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-center">Stock</TableHead>
                      <TableHead className="text-center">Reorder Level</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInventory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center">
                          <p className="text-muted-foreground">No products found</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredInventory.map((item) => {
                        const reorderLevel = item.product?.reorder_level || 10
                        const status = item.quantity === 0
                          ? { label: "Out of Stock", color: "destructive" as const, className: "" }
                          : item.quantity < reorderLevel
                            ? { label: "Low Stock", color: "secondary" as const, className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800" }
                            : { label: "In Stock", color: "secondary" as const, className: "" }

                        return (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                                  <Package className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div>
                                  <p className="font-medium">{item.product?.name}</p>
                                  <p className="text-xs text-muted-foreground">{item.product?.sku}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{item.product?.category?.name || "N/A"}</Badge>
                            </TableCell>
                            <TableCell className="text-center font-medium">
                              {item.quantity}
                            </TableCell>
                            <TableCell className="text-center text-muted-foreground">
                              {reorderLevel}
                            </TableCell>
                            <TableCell>
                              <Badge variant={status.color} className={status.className}>
                                {status.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={!canManageInventory}
                                  onClick={() => {
                                    setSelectedItem(item)
                                    setAdjustmentDialogOpen(true)
                                  }}
                                  title={canManageInventory ? "Adjust stock" : "Inventory adjustments require manager access"}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedItem(item)
                                    setMovementsDialogOpen(true)
                                  }}
                                  title="View history"
                                >
                                  <History className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedItem && (
        <StockAdjustmentDialog
          isOpen={adjustmentDialogOpen}
          onOpenChange={setAdjustmentDialogOpen}
          product={{
            id: selectedItem.product_id,
            name: selectedItem.product?.name,
            sku: selectedItem.product?.sku,
            quantity: selectedItem.quantity,
          }}
          inventoryId={selectedItem.id}
          branchId={activeBranchId}
          onAdjustmentSuccess={() => {
            void loadInventory({ background: true })
          }}
        />
      )}

      {selectedItem && (
        <StockMovementsDialog
          isOpen={movementsDialogOpen}
          onOpenChange={setMovementsDialogOpen}
          product={{
            id: selectedItem.product_id,
            name: selectedItem.product?.name,
            sku: selectedItem.product?.sku,
          }}
          branchId={activeBranchId}
        />
      )}
    </div>
  )
}
