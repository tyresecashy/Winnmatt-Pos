'use client'
import { logger } from '@/lib/logger';

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Tags,
  Percent,
  DollarSign,
  Package,
  Filter,
  Upload,
  Download,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Search,
  ArrowUpDown,
  RefreshCw,
  FileSpreadsheet,
  Trash2,
  Edit3,
  Save,
} from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import {
  getBulkOperationData,
  bulkUpdateProductPrice,
  bulkUpdateProductCategory,
  bulkAdjustInventory,
  type BulkProduct,
  type BulkCategory,
  type BulkBranch,
  type BulkSupplier,
} from '@/lib/modules/system'

interface Product extends BulkProduct {
  branch_name: string
  supplier_name: string
  stock: number
}

interface PricePreview {
  productId: string
  productName: string
  currentPrice: number
  newPrice: number
  difference: number
}

interface RecentAdjustment {
  id: string
  date: string
  productName: string
  branchName: string
  type: string
  qtyChange: number
  reason: string
  status: 'completed' | 'pending' | 'failed'
}

type PriceMode = 'fixed' | 'percentage' | 'round'
type AdjustType = 'add' | 'remove' | 'set'

const ROUND_OPTIONS = [
  { value: 0.05, label: 'Nearest 0.05' },
  { value: 0.1, label: 'Nearest 0.10' },
  { value: 0.5, label: 'Nearest 0.50' },
  { value: 1, label: 'Nearest 1.00' },
]

function formatKSh(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
  }).format(amount)
}

export default function BulkOperationsPage() {
  const { profile } = useAuth()

  const [loading, setLoading] = useState(true)
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<BulkCategory[]>([])
  const [branches, setBranches] = useState<BulkBranch[]>([])
  const [suppliers, setSuppliers] = useState<BulkSupplier[]>([])

  const [activeTab, setActiveTab] = useState('pricing')

  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')


  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set())
  const [selectAll, setSelectAll] = useState(false)

  const [alertInfo, setAlertInfo] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<() => void>(() => {})

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const data = await getBulkOperationData()
        const invMap = new Map<string, number>()
        for (const inv of data.inventory) invMap.set(inv.product_id, (invMap.get(inv.product_id) || 0) + inv.quantity)

        setAllProducts(data.products.map(p => ({
          ...p,
          branch_name: data.branches[0]?.name || '',
          supplier_name: '',
          stock: invMap.get(p.id) || 0,
        })))
        setCategories(data.categories)
        setBranches(data.branches)
        setSuppliers(data.suppliers)
      } catch { /* noop */ }
      setLoading(false)
    }
    load()
  }, [])

  const [priceMode, setPriceMode] = useState<PriceMode>('fixed')
  const [fixedPrice, setFixedPrice] = useState('')
  const [percentageValue, setPercentageValue] = useState('')
  const [roundValue, setRoundValue] = useState('0.1')
  const [pricePreview, setPricePreview] = useState<PricePreview[] | null>(null)
  const [priceUpdating, setPriceUpdating] = useState(false)

  const [newCategory, setNewCategory] = useState('')
  const [categoryUpdating, setCategoryUpdating] = useState(false)
  const [categoryResult, setCategoryResult] = useState<{ moved: number; failed: number } | null>(null)

  const [adjustType, setAdjustType] = useState<AdjustType>('add')
  const [adjustQty, setAdjustQty] = useState('')
  const [adjustNote, setAdjustNote] = useState('')
  const [adjustBranch, setAdjustBranch] = useState('b1')
  const [adjustUpdating, setAdjustUpdating] = useState(false)
  const [recentAdjustments, setRecentAdjustments] = useState<RecentAdjustment[]>([])

  const filteredProducts = useMemo(() => {
    let result = allProducts
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase()
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.includes(q))
      )
    }
    if (categoryFilter !== 'all') {
      result = result.filter(p => p.category_id === categoryFilter || p.category_name === categoryFilter)
    }
    return result
  }, [allProducts, searchTerm, categoryFilter])

  const handleSelectAll = useCallback(() => {
    if (selectAll) {
      setSelectedProductIds(new Set())
      setSelectAll(false)
    } else {
      setSelectedProductIds(new Set(filteredProducts.map(p => p.id)))
      setSelectAll(true)
    }
  }, [selectAll, filteredProducts])

  const handleToggleProduct = useCallback((id: string) => {
    setSelectedProductIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      setSelectAll(false)
      return next
    })
  }, [])

  const selectedProducts = useMemo(
    () => allProducts.filter(p => selectedProductIds.has(p.id)),
    [allProducts, selectedProductIds]
  )

  const showAlert = (type: 'success' | 'error' | 'info', message: string) => {
    setAlertInfo({ type, message })
    setTimeout(() => setAlertInfo(null), 5000)
  }

  const confirmThen = (action: () => void) => {
    setConfirmAction(() => action)
    setConfirmDialogOpen(true)
  }

  const handleApplyPricePreview = () => {
    if (selectedProducts.length === 0) {
      showAlert('error', 'Please select at least one product.')
      return
    }
    const preview: PricePreview[] = selectedProducts.map(p => {
      let newPrice = p.selling_price
      if (priceMode === 'fixed') {
        const val = parseFloat(fixedPrice)
        if (!isNaN(val) && val >= 0) newPrice = val
      } else if (priceMode === 'percentage') {
        const pct = parseFloat(percentageValue)
        if (!isNaN(pct)) newPrice = Math.round(p.selling_price * (1 + pct / 100) * 100) / 100
      } else if (priceMode === 'round') {
        const nearest = parseFloat(roundValue)
        if (!isNaN(nearest) && nearest > 0) {
          newPrice = Math.round(p.selling_price / nearest) * nearest
        }
      }
      return {
        productId: p.id,
        productName: p.name,
        currentPrice: p.selling_price,
        newPrice: Math.round(newPrice * 100) / 100,
        difference: Math.round((newPrice - p.selling_price) * 100) / 100,
      }
    })
    setPricePreview(preview)
  }

  const handleConfirmPriceUpdate = async () => {
    if (!pricePreview) return
    setPriceUpdating(true)
    try {
      const newPrice = pricePreview[0]?.newPrice
      if (!newPrice) { showAlert('error', 'Invalid price.'); return }
      const result = await bulkUpdateProductPrice(
        pricePreview.map(p => p.productId),
        newPrice
      )
      logger.info('Bulk price update completed', result)
      showAlert('success', `Successfully updated ${result.updated} product prices.${result.failed > 0 ? ` ${result.failed} failed.` : ''}`)
      setPricePreview(null)
      setSelectedProductIds(new Set())
      setSelectAll(false)
      setFixedPrice('')
      setPercentageValue('')
    } catch (err) {
      logger.error('Bulk price update failed', err)
      showAlert('error', 'Failed to update prices. Please try again.')
    } finally {
      setPriceUpdating(false)
    }
  }

  const handleConfirmCategoryUpdate = async () => {
    if (!newCategory || selectedProducts.length === 0) return
    setCategoryUpdating(true)
    try {
      const result = await bulkUpdateProductCategory(
        selectedProducts.map(p => p.id),
        newCategory
      )
      setCategoryResult({ moved: result.updated, failed: result.failed })
      showAlert('success', `Moved ${result.updated} products to new category.${result.failed > 0 ? ` ${result.failed} failed.` : ''}`)
      setSelectedProductIds(new Set())
      setSelectAll(false)
      setNewCategory('')
    } catch (err) {
      logger.error('Bulk category update failed', err)
      showAlert('error', 'Failed to update categories.')
    } finally {
      setCategoryUpdating(false)
    }
  }

  const currentCategory = useMemo(() => {
    const cats = [...new Set(selectedProducts.map(p => p.category_name))]
    return cats.length === 1 ? cats[0] : null
  }, [selectedProducts])

  const handleApplyAdjustment = async () => {
    if (selectedProducts.length === 0) {
      showAlert('error', 'Please select at least one product.')
      return
    }
    const qty = parseInt(adjustQty)
    if (isNaN(qty) || qty <= 0) {
      showAlert('error', 'Enter a valid quantity.')
      return
    }
    setAdjustUpdating(true)
    try {
      const qtyDelta = adjustType === 'add' ? qty : adjustType === 'remove' ? -qty : qty
      const adjustments = selectedProducts.map(p => ({
        productId: p.id,
        branchId: adjustBranch,
        quantity: qtyDelta,
        reason: adjustNote.trim() || `Bulk ${adjustType} adjustment`,
      }))
      const result = await bulkAdjustInventory(adjustments)
      const typeLabel = adjustType === 'add' ? 'Add Stock' : adjustType === 'remove' ? 'Remove Stock' : 'Set Stock Level'
      const branchName = branches.find(b => b.id === adjustBranch)?.name || adjustBranch
      const now = new Date().toISOString()
      const newAdjustments = result.updated > 0 ? selectedProducts.slice(0, result.updated).map(p => ({
        id: `adj-${Date.now()}-${p.id}`,
        date: now,
        productName: p.name,
        branchName,
        type: typeLabel,
        qtyChange: qtyDelta,
        reason: adjustNote.trim() || typeLabel,
        status: 'completed' as const,
      })) : []
      setRecentAdjustments(prev => [...newAdjustments, ...prev].slice(0, 50))
      showAlert('success', `Applied ${typeLabel} to ${result.updated} products.${result.failed > 0 ? ` ${result.failed} failed.` : ''}`)
      setSelectedProductIds(new Set())
      setSelectAll(false)
      setAdjustQty('')
    } catch (err) {
      logger.error('Bulk inventory adjustment failed', err)
      showAlert('error', 'Failed to apply adjustments.')
    } finally {
      setAdjustUpdating(false)
    }
  }

  const isAdmin = ['super_admin', 'admin'].includes(profile?.role || '')

  return (
    <div className="p-6 space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bulk Operations</h1>
          <p className="text-muted-foreground mt-1">
            Perform bulk price updates, category changes, and inventory adjustments.
          </p>
        </div>
        <Badge variant={isAdmin ? 'default' : 'secondary'} className="text-sm px-3 py-1">
          {isAdmin ? 'Admin Access' : 'Restricted'}
        </Badge>
      </div>

      {alertInfo && (
        <Alert variant={alertInfo.type === 'error' ? 'destructive' : 'default'}>
          <div className="flex items-center gap-2">
            {alertInfo.type === 'success' ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : alertInfo.type === 'error' ? (
              <XCircle className="h-4 w-4 text-red-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            )}
            <AlertDescription>{alertInfo.message}</AlertDescription>
          </div>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pricing" className="gap-2">
            <DollarSign className="h-4 w-4" />
            Price Updates
          </TabsTrigger>
          <TabsTrigger value="categories" className="gap-2">
            <Tags className="h-4 w-4" />
            Category Changes
          </TabsTrigger>
          <TabsTrigger value="inventory" className="gap-2">
            <Package className="h-4 w-4" />
            Inventory Adjustments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pricing" className="space-y-6 mt-6">
          <ProductSelector
            products={allProducts}
            filteredProducts={filteredProducts}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            categoryFilter={categoryFilter}
            onCategoryFilterChange={setCategoryFilter}
            categories={categories}
            branches={branches}
            selectedProductIds={selectedProductIds}
            onToggleProduct={handleToggleProduct}
            selectAll={selectAll}
            onSelectAll={handleSelectAll}
          />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Percent className="h-5 w-5" />
                Price Adjustment
              </CardTitle>
              <CardDescription>
                {selectedProducts.length > 0
                  ? `${selectedProducts.length} product(s) selected`
                  : 'Select products above to adjust prices'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <Label htmlFor="mode-fixed">Fixed Price</Label>
                  <input
                    type="radio"
                    id="mode-fixed"
                    name="priceMode"
                    checked={priceMode === 'fixed'}
                    onChange={() => setPriceMode('fixed')}
                    className="accent-primary"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Label htmlFor="mode-pct">Percentage</Label>
                  <input
                    type="radio"
                    id="mode-pct"
                    name="priceMode"
                    checked={priceMode === 'percentage'}
                    onChange={() => setPriceMode('percentage')}
                    className="accent-primary"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Label htmlFor="mode-round">Round Up/Down</Label>
                  <input
                    type="radio"
                    id="mode-round"
                    name="priceMode"
                    checked={priceMode === 'round'}
                    onChange={() => setPriceMode('round')}
                    className="accent-primary"
                  />
                </div>
              </div>

              {priceMode === 'fixed' && (
                <div className="flex items-center gap-3 max-w-xs">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="New price (KES)"
                    value={fixedPrice}
                    onChange={e => setFixedPrice(e.target.value)}
                  />
                </div>
              )}

              {priceMode === 'percentage' && (
                <div className="flex items-center gap-3 max-w-xs">
                  <Percent className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="% (positive = increase, negative = decrease)"
                    value={percentageValue}
                    onChange={e => setPercentageValue(e.target.value)}
                  />
                </div>
              )}

              {priceMode === 'round' && (
                <div className="flex items-center gap-3 max-w-xs">
                  <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                  <Select value={roundValue} onValueChange={setRoundValue}>
                    <SelectTrigger>
                      <SelectValue placeholder="Round to nearest..." />
                    </SelectTrigger>
                    <SelectContent>
                      {ROUND_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={String(opt.value)}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Separator />

              <div className="flex gap-3">
                <Button
                  onClick={handleApplyPricePreview}
                  disabled={selectedProducts.length === 0}
                  variant="default"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Apply to Selected ({selectedProducts.length})
                </Button>
                {pricePreview && (
                  <Button
                    variant="outline"
                    onClick={() => setPricePreview(null)}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Clear Preview
                  </Button>
                )}
              </div>

              {pricePreview && pricePreview.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-muted-foreground">
                    Price Preview — {pricePreview.length} product(s)
                  </h4>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Current Price</TableHead>
                          <TableHead className="text-right">New Price</TableHead>
                          <TableHead className="text-right">Difference</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pricePreview.map(pp => (
                          <TableRow key={pp.productId}>
                            <TableCell className="font-medium">{pp.productName}</TableCell>
                            <TableCell className="text-right">{formatKSh(pp.currentPrice)}</TableCell>
                            <TableCell className="text-right font-semibold">
                              {formatKSh(pp.newPrice)}
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={pp.difference >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {pp.difference >= 0 ? '+' : ''}{formatKSh(pp.difference)}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <Button
                    onClick={() => confirmThen(handleConfirmPriceUpdate)}
                    disabled={priceUpdating}
                    size="lg"
                    className="w-full sm:w-auto"
                  >
                    {priceUpdating ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Confirm Update
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-6 mt-6">
          <ProductSelector
            products={allProducts}
            filteredProducts={filteredProducts}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            categoryFilter={categoryFilter}
            onCategoryFilterChange={setCategoryFilter}
            categories={categories}
            branches={branches}
            selectedProductIds={selectedProductIds}
            onToggleProduct={handleToggleProduct}
            selectAll={selectAll}
            onSelectAll={handleSelectAll}
          />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Tags className="h-5 w-5" />
                Category Change
              </CardTitle>
              <CardDescription>
                {selectedProducts.length > 0
                  ? `${selectedProducts.length} product(s) selected`
                  : 'Select products above to change categories'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedProducts.length > 0 && (
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Current Category</div>
                  <div className="text-lg font-semibold">
                    {currentCategory ?? (
                      <span className="text-amber-600 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Mixed categories ({new Set(selectedProducts.map(p => p.category_name)).size} different)
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="new-category">New Category</Label>
                <Select value={newCategory} onValueChange={setNewCategory}>
                  <SelectTrigger id="new-category" className="max-w-sm">
                    <SelectValue placeholder="Select a category..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={() => confirmThen(handleConfirmCategoryUpdate)}
                disabled={!newCategory || selectedProducts.length === 0 || categoryUpdating}
                size="lg"
              >
                {categoryUpdating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Tags className="h-4 w-4 mr-2" />
                )}
                Move to New Category
              </Button>

              {categoryResult && (
                <Alert>
                  <div className="flex items-center gap-2">
                    {categoryResult.failed > 0 ? (
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    )}
                    <AlertDescription>
                      <span className="font-medium">{categoryResult.moved}</span> products moved successfully
                      {categoryResult.failed > 0 && (
                        <span>, <span className="font-medium text-red-600">{categoryResult.failed}</span> failed</span>
                      )}
                    </AlertDescription>
                  </div>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-6 mt-6">
          <ProductSelector
            products={allProducts}
            filteredProducts={filteredProducts}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            categoryFilter={categoryFilter}
            onCategoryFilterChange={setCategoryFilter}
            categories={categories}
            branches={branches}
            selectedProductIds={selectedProductIds}
            onToggleProduct={handleToggleProduct}
            selectAll={selectAll}
            onSelectAll={handleSelectAll}
          />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="h-5 w-5" />
                Adjustment Type
              </CardTitle>
              <CardDescription>
                {selectedProducts.length > 0
                  ? `${selectedProducts.length} product(s) selected — Current stock visible in table`
                  : 'Select products above to adjust stock'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="adjust-type">Stock Action</Label>
                  <Select value={adjustType} onValueChange={(v) => setAdjustType(v as AdjustType)}>
                    <SelectTrigger id="adjust-type">
                      <SelectValue placeholder="Select action..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="add">Add Stock</SelectItem>
                      <SelectItem value="remove">Remove Stock</SelectItem>
                      <SelectItem value="set">Set Stock Level</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adjust-branch">Branch</Label>
                  <Select value={adjustBranch} onValueChange={setAdjustBranch}>
                    <SelectTrigger id="adjust-branch">
                      <SelectValue placeholder="Select branch..." />
                    </SelectTrigger>
                  <SelectContent>
                    {branches.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="adjust-qty">Quantity</Label>
                <Input
                  id="adjust-qty"
                  type="number"
                  min="1"
                  placeholder={adjustType === 'set' ? 'Enter new stock level...' : 'Enter quantity...'}
                  value={adjustQty}
                  onChange={e => setAdjustQty(e.target.value)}
                  className="max-w-xs"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="adjust-note">Reason / Note</Label>
                <Textarea
                  id="adjust-note"
                  placeholder="e.g., Monthly restock, Damaged goods, Inventory correction..."
                  value={adjustNote}
                  onChange={e => setAdjustNote(e.target.value)}
                  className="max-w-lg"
                  rows={3}
                />
              </div>

              <Button
                onClick={() => confirmThen(handleApplyAdjustment)}
                disabled={
                  !adjustQty || parseInt(adjustQty) <= 0 ||
                  selectedProducts.length === 0 || adjustUpdating
                }
                size="lg"
              >
                {adjustUpdating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Apply Adjustment
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <RefreshCw className="h-5 w-5" />
                Recent Adjustments
              </CardTitle>
              <CardDescription>Last 50 stock adjustments</CardDescription>
            </CardHeader>
            <CardContent>
              {recentAdjustments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <EmptyState title="No recent adjustments" compact />
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Branch</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Qty Change</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentAdjustments.map(adj => (
                        <TableRow key={adj.id}>
                          <TableCell className="text-xs whitespace-nowrap">
                            {new Date(adj.date).toLocaleString('en-KE', {
                              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                            })}
                          </TableCell>
                          <TableCell className="font-medium">{adj.productName}</TableCell>
                          <TableCell>{adj.branchName}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{adj.type}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            <span className={adj.qtyChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {adj.qtyChange >= 0 ? '+' : ''}{adj.qtyChange}
                            </span>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">{adj.reason}</TableCell>
                          <TableCell>
                            <Badge variant={adj.status === 'completed' ? 'default' : 'secondary'}>
                              {adj.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Bulk Operation</AlertDialogTitle>
            <AlertDialogDescription>
              This action will affect <strong>{selectedProducts.length}</strong> product(s).
              Are you sure you want to proceed? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { confirmAction(); setConfirmDialogOpen(false); }}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function ProductSelector({
  products,
  filteredProducts,
  searchTerm,
  onSearchChange,
  categoryFilter,
  onCategoryFilterChange,
  categories,
  branches,
  selectedProductIds,
  onToggleProduct,
  selectAll,
  onSelectAll,
}: {
  products: Product[]
  filteredProducts: Product[]
  searchTerm: string
  onSearchChange: (v: string) => void
  categoryFilter: string
  onCategoryFilterChange: (v: string) => void
  categories: BulkCategory[]
  branches: BulkBranch[]
  selectedProductIds: Set<string>
  onToggleProduct: (id: string) => void
  selectAll: boolean
  onSelectAll: () => void
}) {
  const uniqueCategories = useMemo(
    () => categories.length > 0 ? categories.map(c => c.name).sort() : [...new Set(products.map(p => p.category_name).filter(Boolean) as string[])].sort(),
    [products, categories]
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Filter className="h-5 w-5" />
          Select Products
        </CardTitle>
        <CardDescription>
          {products.length} total products · {filteredProducts.length} shown ·{' '}
          <span className="font-medium">{selectedProductIds.size} selected</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, SKU, or barcode..."
              className="pl-9"
              value={searchTerm}
              onChange={e => onSearchChange(e.target.value)}
            />
          </div>
          <Select value={categoryFilter} onValueChange={onCategoryFilterChange}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {uniqueCategories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <Button variant="outline" size="sm" onClick={onSelectAll}>
            {selectAll ? 'Deselect All' : 'Select All'}
          </Button>
          <Badge variant="secondary">{selectedProductIds.size} selected</Badge>
        </div>

        <div className="border rounded-lg max-h-[400px] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={filteredProducts.length > 0 && filteredProducts.every(p => selectedProductIds.has(p.id))}
                    onCheckedChange={onSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead className="w-[100px]">SKU</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Current Price</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Stock</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    <EmptyState title="No products match your filters" compact />
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedProductIds.has(p.id)}
                        onCheckedChange={() => onToggleProduct(p.id)}
                        aria-label={`Select ${p.name}`}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-right font-mono">{formatKSh(p.selling_price)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{p.category_name}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{p.stock}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
