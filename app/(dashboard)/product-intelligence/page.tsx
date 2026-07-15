'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/components/ui/use-toast'
import {
  Search,
  Package,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Boxes,
  Clock,
  History,
  Building2,
  Truck,
  BarChart3,
  Tag,
  Barcode,
  Layers,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowLeft,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import {
  getProductIntelligence,
  getProductActivity,
  getProductPriceHistory,
  getProductStockLocations,
  updateProductPricing,
  type ProductSummary,
  type ProductActivity,
  type ProductPriceHistory,
  type ProductStockAtLocation,
} from '@/lib/modules/inventory'
import { searchProducts } from '@/lib/product-intelligence-actions'
import { formatKSh } from '@/lib/currency'

const activityIcons: Record<string, React.ReactNode> = {
  created: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  price_changed: <DollarSign className="h-4 w-4 text-yellow-500" />,
  purchased: <Truck className="h-4 w-4 text-blue-500" />,
  received: <Package className="h-4 w-4 text-green-500" />,
  transferred: <Building2 className="h-4 w-4 text-purple-500" />,
  sold: <TrendingUp className="h-4 w-4 text-blue-500" />,
  returned: <History className="h-4 w-4 text-orange-500" />,
  adjusted: <BarChart3 className="h-4 w-4 text-red-500" />,
  cycle_counted: <Layers className="h-4 w-4 text-indigo-500" />,
  expired: <XCircle className="h-4 w-4 text-muted-foreground" />,
  archived: <Archive className="h-4 w-4 text-muted-foreground" />,
  status_changed: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
}

function Archive(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 8v13H3V8" /><path d="M1 3h22v5H1z" /><path d="M10 12h4" />
    </svg>
  )
}

export default function ProductIntelligencePage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{
    id: string; sku: string; name: string; brand: string | null;
    barcode: string | null; selling_price: number; purchase_price: number;
    status: string; category: string | null
  }>>([])
  const [searching, setSearching] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null)
  const [productData, setProductData] = useState<ProductSummary | null>(null)
  const [activity, setActivity] = useState<ProductActivity[]>([])
  const [priceHistory, setPriceHistory] = useState<ProductPriceHistory[]>([])
  const [stockLocations, setStockLocations] = useState<ProductStockAtLocation[]>([])
  const [loading, setLoading] = useState(false)

  // Edit pricing mode
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const results = await searchProducts(searchQuery.trim())
      setSearchResults(results as unknown as typeof searchResults)
    } catch {
      toast({ title: 'Error', description: 'Search failed', variant: 'destructive' })
    } finally {
      setSearching(false)
    }
  }, [searchQuery])

  const loadProductIntel = useCallback(async (productId: string) => {
    setLoading(true)
    setSelectedProduct(productId)
    try {
      const [intel, acts, prices, locations] = await Promise.all([
        getProductIntelligence(productId),
        getProductActivity(productId),
        getProductPriceHistory(productId),
        getProductStockLocations(productId),
      ])
      if (intel) setProductData(intel)
      setActivity(acts)
      setPriceHistory(prices)
      setStockLocations(locations)
    } catch {
      toast({ title: 'Error', description: 'Failed to load product data', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSavePricing = async (field: string) => {
    const val = parseInt(editValue)
    if (isNaN(val) || val < 0) {
      toast({ title: 'Invalid value', description: 'Enter a valid number', variant: 'destructive' })
      return
    }
    const result = await updateProductPricing(productData!.id, { [field]: val })
    if (result.success) {
      toast({ title: 'Updated', description: `${field.replace('_', ' ')} changed to ${val}` })
      setEditingField(null)
      loadProductIntel(productData!.id)
    } else {
      toast({ title: 'Error', description: result.error || 'Update failed', variant: 'destructive' })
    }
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  const formatShortDate = (d: string) => new Date(d).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' })

  // Stock status badge
  const stockStatus = productData
    ? productData.available_stock <= productData.safety_stock
      ? { label: 'Critical', color: 'destructive' as const }
      : productData.available_stock <= productData.reorder_level
        ? { label: 'Low', color: 'warning' as const }
        : { label: 'In Stock', color: 'default' as const }
    : null

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Product Intelligence</h1>
          <p className="text-muted-foreground mt-1">
            Search any product to view its complete lifecycle dashboard
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by product name, SKU, barcode, or brand..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch} disabled={searching}>
              {searching ? 'Searching...' : 'Search'}
            </Button>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm text-muted-foreground">{searchResults.length} product(s) found</p>
              <div className="grid gap-2 max-h-60 overflow-y-auto">
                {searchResults.map((p) => (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedProduct === p.id
                        ? 'bg-primary/10 border-primary'
                        : 'hover:bg-accent'
                    }`}
                    onClick={() => loadProductIntel(p.id)}
                  >
                    <div className="flex items-center gap-3">
                      <Package className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          SKU: {p.sku} {p.brand && `| Brand: ${p.brand}`} {p.barcode && `| ${p.barcode}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{formatKSh(p.selling_price)}</p>
                      <Badge variant={p.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                        {p.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Product Dashboard */}
      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-64" />
        </div>
      )}

      {productData && !loading && (
        <div className="space-y-6">
          {/* Product Header */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="h-16 w-16 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Package className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-2xl font-bold">{productData.name}</h2>
                      <Badge>{stockStatus?.label || 'Unknown'}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-4 mt-1 text-sm text-muted-foreground">
                      <span>SKU: <strong>{productData.sku}</strong></span>
                      {productData.brand && <span>Brand: <strong>{productData.brand}</strong></span>}
                      {productData.barcode && <span>Barcode: <strong>{productData.barcode}</strong></span>}
                      {productData.category_name && <span>Category: <strong>{productData.category_name}</strong></span>}
                      {productData.unit && <span>Unit: <strong>{productData.unit}</strong></span>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => router.push(`/products/${productData.id}`)}>
                    Edit Product
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-4 w-4" /> Selling Price
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatKSh(productData.selling_price)}</p>
                <p className="text-xs text-muted-foreground">
                  Cost: {formatKSh(productData.purchase_price)} | Margin: {productData.margin_pct}%
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Boxes className="h-4 w-4" /> Available Stock
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{productData.available_stock}</p>
                <p className="text-xs text-muted-foreground">
                  Total: {productData.current_stock} | Reserved: {productData.reserved_stock}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Avg Monthly Sales
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{productData.avg_monthly_sales}</p>
                <p className="text-xs text-muted-foreground">
                  Weekly avg: {productData.avg_weekly_sales}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Truck className="h-4 w-4" /> Preferred Supplier
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold truncate">
                  {productData.preferred_supplier_name || 'None'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Lead time: {productData.lead_time_days} days
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Tabs */}
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="pricing">Pricing</TabsTrigger>
              <TabsTrigger value="stock">Stock Locations</TabsTrigger>
              <TabsTrigger value="timeline">Activity Timeline</TabsTrigger>
              <TabsTrigger value="price-history">Price History</TabsTrigger>
            </TabsList>

            {/* OVERVIEW TAB */}
            <TabsContent value="overview">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader><CardTitle className="text-lg">Product Details</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-muted-foreground">SKU</div>
                      <div className="font-medium">{productData.sku}</div>
                      <div className="text-muted-foreground">Barcode</div>
                      <div className="font-medium">{productData.barcode || '—'}</div>
                      <div className="text-muted-foreground">Internal Code</div>
                      <div className="font-medium">{productData.internal_code || '—'}</div>
                      <div className="text-muted-foreground">Brand</div>
                      <div className="font-medium">{productData.brand || '—'}</div>
                      <div className="text-muted-foreground">Category</div>
                      <div className="font-medium">{productData.category_name || '—'}</div>
                      <div className="text-muted-foreground">Unit</div>
                      <div className="font-medium">{productData.unit || 'pcs'}</div>
                      <div className="text-muted-foreground">Status</div>
                      <div><Badge variant={productData.status === 'active' ? 'default' : 'secondary'}>{productData.status}</Badge></div>
                    </div>
                    {productData.description && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Description</p>
                        <p className="text-sm">{productData.description}</p>
                      </div>
                    )}
                    {productData.tags && productData.tags.length > 0 && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Tags</p>
                        <div className="flex flex-wrap gap-1">
                          {productData.tags.map((t, i) => <Badge key={i} variant="outline">{t}</Badge>)}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-lg">Stock & Reorder</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">Current Stock</p>
                        <p className="text-xl font-bold">{productData.current_stock}</p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">Available</p>
                        <p className="text-xl font-bold">{productData.available_stock}</p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">Reorder Level</p>
                        <p className="text-xl font-bold">{productData.reorder_level}</p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">Safety Stock</p>
                        <p className="text-xl font-bold">{productData.safety_stock}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium">Stock Status</p>
                      <div className="w-full bg-muted rounded-full h-2.5">
                        <div
                          className={`h-2.5 rounded-full ${
                            productData.available_stock <= productData.safety_stock
                              ? 'bg-red-500'
                              : productData.available_stock <= productData.reorder_level
                                ? 'bg-yellow-500'
                                : 'bg-green-500'
                          }`}
                          style={{
                            width: `${Math.min(
                              100,
                              (productData.available_stock / Math.max(productData.reorder_level * 3, 1)) * 100
                            )}%`,
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>0</span>
                        <span>Safety: {productData.safety_stock}</span>
                        <span>Reorder: {productData.reorder_level}</span>
                      </div>
                    </div>

                    <div className="text-sm text-muted-foreground">
                      <p>Lead time: <strong>{productData.lead_time_days} days</strong></p>
                      <p>Created: <strong>{formatShortDate(productData.created_at)}</strong></p>
                      <p>Last updated: <strong>{formatShortDate(productData.updated_at)}</strong></p>
                      {productData.last_purchase_date && (
                        <p>Last purchase: <strong>{formatShortDate(productData.last_purchase_date)}</strong></p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* PRICING TAB */}
            <TabsContent value="pricing">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Pricing Tiers</CardTitle>
                  <CardDescription>Click any price to edit. Changes are logged immediately.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { label: 'Cost Price', field: 'purchase_price', value: productData.purchase_price, color: 'text-orange-600' },
                      { label: 'Selling Price', field: 'selling_price', value: productData.selling_price, color: 'text-blue-600' },
                      { label: 'Wholesale Price', field: 'wholesale_price', value: productData.wholesale_price, color: 'text-green-600' },
                      { label: 'Promotion Price', field: 'promotion_price', value: productData.promotion_price, color: 'text-red-600' },
                      { label: 'Staff Price', field: 'staff_price', value: productData.staff_price, color: 'text-purple-600' },
                      { label: 'VIP Price', field: 'vip_price', value: productData.vip_price, color: 'text-yellow-600' },
                    ].map(({ label, field, value, color }) => (
                      <div key={field} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div>
                          <p className="text-sm font-medium">{label}</p>
                          <p className={`text-lg font-bold ${value ? color : 'text-muted-foreground'}`}>
                            {value ? formatKSh(value) : 'Not set'}
                          </p>
                        </div>
                        {editingField === field ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-32"
                              autoFocus
                              onKeyDown={(e) => e.key === 'Enter' && handleSavePricing(field)}
                            />
                            <Button size="sm" onClick={() => handleSavePricing(field)}>Save</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingField(null)}>Cancel</Button>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingField(field)
                              setEditValue(String(value || 0))
                            }}
                          >
                            Edit
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <p className="text-sm font-medium">Margin Summary</p>
                    <div className="grid grid-cols-3 gap-4 mt-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Margin (cents)</p>
                        <p className="text-lg font-bold">{formatKSh(productData.margin_cents)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Margin %</p>
                        <p className="text-lg font-bold">{productData.margin_pct}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Min Margin Warning</p>
                        <p className="text-lg font-bold">{productData.min_margin_percent ?? 'Not set'}%</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* STOCK LOCATIONS TAB */}
            <TabsContent value="stock">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Stock Across Locations</CardTitle>
                  <CardDescription>Inventory levels across all branches and warehouses</CardDescription>
                </CardHeader>
                <CardContent>
                  {stockLocations.length === 0 ? (
                    <p className="text-muted-foreground">No stock data available</p>
                  ) : (
                    <div className="space-y-3">
                      {stockLocations.map((loc) => (
                        <div key={loc.location_id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div className="flex items-center gap-3">
                            <Building2 className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{loc.location_name}</p>
                              <p className="text-xs text-muted-foreground capitalize">{loc.location_type}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold">{loc.quantity}</p>
                            {loc.reserved > 0 && (
                              <p className="text-xs text-muted-foreground">{loc.reserved} reserved</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ACTIVITY TIMELINE TAB */}
            <TabsContent value="timeline">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Activity Timeline</CardTitle>
                  <CardDescription>Every event in this product&apos;s lifecycle</CardDescription>
                </CardHeader>
                <CardContent>
                  {activity.length === 0 ? (
                    <EmptyState icon={History} title="No activity recorded yet" description="Activity will appear as products are purchased, sold, transferred, etc." compact />
                  ) : (
                    <div className="relative">
                      <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
                      <div className="space-y-0">
                        {activity.map((act) => (
                          <div key={act.id} className="relative flex gap-4 pb-6">
                            <div className="absolute left-2.5 top-1 h-3 w-3 rounded-full bg-background border-2 border-primary z-10" />
                            <div className="ml-10 flex-1">
                              <div className="flex items-center gap-2">
                                {activityIcons[act.activity_type] || <Clock className="h-4 w-4 text-muted-foreground" />}
                                <p className="text-sm font-medium">{act.description}</p>
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-xs text-muted-foreground">{formatDate(act.created_at)}</span>
                                {act.performer_name && (
                                  <span className="text-xs text-muted-foreground">by {act.performer_name}</span>
                                )}
                                {act.reference_type && (
                                  <Badge variant="outline" className="text-xs">
                                    {act.reference_type}: {act.reference_id?.slice(0, 8)}...
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* PRICE HISTORY TAB */}
            <TabsContent value="price-history">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Price History</CardTitle>
                  <CardDescription>Record of every price change</CardDescription>
                </CardHeader>
                <CardContent>
                  {priceHistory.length === 0 ? (
                    <p className="text-muted-foreground">No price history available</p>
                  ) : (
                    <div className="space-y-2">
                      {priceHistory.map((ph) => (
                        <div key={ph.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline">{ph.price_type.replace('_', ' ')}</Badge>
                            <div>
                              <p className="font-medium">{formatKSh(ph.price)}</p>
                              {ph.change_reason && (
                                <p className="text-xs text-muted-foreground">{ph.change_reason}</p>
                              )}
                            </div>
                          </div>
                          <div className="text-right text-xs text-muted-foreground">
                            <p>{formatDate(ph.effective_date)}</p>
                            {!ph.is_active && <Badge variant="secondary" className="text-xs mt-1">Inactive</Badge>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {!selectedProduct && !loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-30" />
            <h3 className="text-lg font-medium mb-2">Search for a Product</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Enter a product name, SKU, barcode, or brand above to open its complete
              intelligence dashboard with pricing, stock, activity timeline, and more.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
