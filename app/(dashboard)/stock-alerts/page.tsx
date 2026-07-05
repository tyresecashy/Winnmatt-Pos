"use client"
import { logger } from '@/lib/logger';

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { AlertTriangle, Package, SearchX, Loader2, Bell, BellOff, RefreshCw } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { getInventoryForBranch } from "@/lib/products-actions"

interface StockAlertItem {
  id: string
  product_id: string
  product_name: string
  sku: string
  quantity: number
  reorder_level: number
  status: 'ok' | 'low' | 'critical'
  alerts_enabled: boolean
}

export default function StockAlertsPage() {
  const { profile, authState } = useAuth()
  const [inventory, setInventory] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [alertFilter, setAlertFilter] = useState<string>("all")
  const [enabledAlerts, setEnabledAlerts] = useState<Set<string>>(new Set())
  const [preferencesLoaded, setPreferencesLoaded] = useState(false)
  const hasLoadedRef = useRef(false)

  // Load saved alert preferences from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('stock_alert_preferences')
      if (saved) {
        const parsed = JSON.parse(saved) as string[]
        setEnabledAlerts(new Set(parsed))
      }
    } catch { /* ignore parse errors */ }
    setPreferencesLoaded(true)
  }, [])

  const loadInventory = useCallback(async () => {
    if (!profile?.branch_id) {
      setInventory([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const data = await getInventoryForBranch(profile.branch_id)
      setInventory(data || [])
      hasLoadedRef.current = true
    } catch (error) {
      logger.error("Failed to load inventory:", error)
      if (!hasLoadedRef.current) {
        setInventory([])
      }
    } finally {
      setIsLoading(false)
    }
  }, [profile])

  useEffect(() => {
    void loadInventory()
  }, [loadInventory])

  const stockAlerts: StockAlertItem[] = useMemo(() => {
    return inventory.map((item) => {
      const reorderLevel = item.product?.reorder_level || 10
      const quantity = item.quantity
      let status: 'ok' | 'low' | 'critical'
      if (quantity === 0) {
        status = 'critical'
      } else if (quantity < reorderLevel) {
        status = 'low'
      } else {
        status = 'ok'
      }

      return {
        id: item.id,
        product_id: item.product_id,
        product_name: item.product?.name || 'Unknown',
        sku: item.product?.sku || '',
        quantity,
        reorder_level: reorderLevel,
        status,
        alerts_enabled: preferencesLoaded && enabledAlerts.has(item.product_id),
      }
    })
  }, [inventory, enabledAlerts])

  const toggleAlert = (productId: string) => {
    setEnabledAlerts((prev) => {
      const next = new Set(prev)
      if (next.has(productId)) {
        next.delete(productId)
      } else {
        next.add(productId)
      }
      // Persist to localStorage
      try { localStorage.setItem('stock_alert_preferences', JSON.stringify([...next])) }
      catch { /* ignore storage errors */ }
      return next
    })
  }

  const filteredAlerts = useMemo(() => {
    if (alertFilter === "all") return stockAlerts
    if (alertFilter === "enabled") return stockAlerts.filter(a => a.alerts_enabled)
    if (alertFilter === "disabled") return stockAlerts.filter(a => !a.alerts_enabled)
    return stockAlerts.filter((a) => a.status === alertFilter)
  }, [alertFilter, stockAlerts])

  const criticalCount = useMemo(() => stockAlerts.filter((a) => a.status === 'critical').length, [stockAlerts])
  const lowCount = useMemo(() => stockAlerts.filter((a) => a.status === 'low').length, [stockAlerts])

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
            Please sign in to view stock alerts.
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!profile.branch_id) {
    return (
      <div className="p-6 space-y-6 fade-in">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stock Alerts</h1>
          <p className="text-muted-foreground">Monitor low stock levels and reorder points</p>
        </div>
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-base text-yellow-900">Branch context required</CardTitle>
            <CardDescription className="text-yellow-800">
              Stock alerts are branch-specific. Choose or assign a branch to view alerts.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stock Alerts</h1>
          <p className="text-muted-foreground">
            Monitor low stock levels for {profile.branch?.name || "your branch"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadInventory()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="card-hover border-green-200">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-green-600">
              <Package className="h-3 w-3" />
              In Stock
            </CardDescription>
            <CardTitle className="text-2xl text-green-600">
              {stockAlerts.filter((a) => a.status === 'ok').length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Items above reorder level</p>
          </CardContent>
        </Card>
        <Card className="card-hover border-amber-200">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-amber-600">
              <AlertTriangle className="h-3 w-3" />
              Low Stock
            </CardDescription>
            <CardTitle className="text-2xl text-amber-600">
              {lowCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Items below reorder level</p>
          </CardContent>
        </Card>
        <Card className="card-hover border-destructive/30">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-destructive">
              <SearchX className="h-3 w-3" />
              Critical
            </CardDescription>
            <CardTitle className="text-2xl text-destructive">
              {criticalCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Out of stock items</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Select value={alertFilter} onValueChange={setAlertFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Items</SelectItem>
                <SelectItem value="ok">In Stock</SelectItem>
                <SelectItem value="low">Low Stock</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="enabled">Alerts On</SelectItem>
                <SelectItem value="disabled">Alerts Off</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground whitespace-nowrap">
              Showing {filteredAlerts.length} of {stockAlerts.length} items
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
          ) : filteredAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <Bell className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-lg font-medium">No stock alerts</p>
              <p className="text-sm text-muted-foreground mt-1">
                {alertFilter !== 'all'
                  ? 'No items match the selected filter.'
                  : 'All items have adequate stock levels.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-center">Current Stock</TableHead>
                  <TableHead className="text-center">Reorder Level</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Alerts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAlerts.map((item) => {
                  const rowColor =
                    item.status === 'critical'
                      ? 'bg-destructive/5'
                      : item.status === 'low'
                        ? 'bg-amber-50 dark:bg-amber-950/20'
                        : ''

                  return (
                    <TableRow key={item.id} className={rowColor}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                            <Package className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <p className="font-medium">{item.product_name}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="rounded bg-muted px-2 py-1 text-xs font-mono">{item.sku}</code>
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">
                        {item.reorder_level}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.status === 'critical'
                              ? 'destructive'
                              : item.status === 'low'
                                ? 'secondary'
                                : 'outline'
                          }
                          className={
                            item.status === 'low'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                              : ''
                          }
                        >
                          {item.status === 'critical'
                            ? 'Critical'
                            : item.status === 'low'
                              ? 'Low'
                              : 'OK'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleAlert(item.product_id)}
                          title={item.alerts_enabled ? 'Disable alert' : 'Enable alert'}
                        >
                          {item.alerts_enabled ? (
                            <Bell className="h-4 w-4 text-primary" />
                          ) : (
                            <BellOff className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
