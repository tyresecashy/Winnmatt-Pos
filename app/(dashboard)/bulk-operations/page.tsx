'use client'
import { logger } from '@/lib/logger';

import { useState, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
import { getProducts } from '@/lib/actions'

const MOCK_CATEGORIES = [
  'Groceries', 'Beverages', 'Dairy', 'Bakery', 'Meat & Fish',
  'Fruits & Veg', 'Household', 'Personal Care', 'Electronics',
  'Stationery', 'Other',
]

const MOCK_BRANCHES = [
  { id: 'b1', name: 'Main Branch' },
  { id: 'b2', name: 'Downtown Branch' },
  { id: 'b3', name: 'Mall Branch' },
]

const MOCK_SUPPLIERS = [
  { id: 's1', name: 'Fresh Supplies Ltd' },
  { id: 's2', name: 'Global Distributors' },
  { id: 's3', name: 'Local Farmers Co-op' },
  { id: 's4', name: 'TechWholesale Inc' },
]

function generateMockProducts(): Product[] {
  const names = [
    { name: 'White Bread Loaf', cat: 'Bakery', price: 65 },
    { name: 'Whole Milk 1L', cat: 'Dairy', price: 130 },
    { name: 'Cooking Oil 2L', cat: 'Groceries', price: 420 },
    { name: 'Sugar 1kg', cat: 'Groceries', price: 195 },
    { name: 'Rice 5kg', cat: 'Groceries', price: 650 },
    { name: 'Maize Flour 2kg', cat: 'Groceries', price: 240 },
    { name: 'Wheat Flour 1kg', cat: 'Groceries', price: 145 },
    { name: 'Pasta 500g', cat: 'Groceries', price: 110 },
    { name: 'Tomato Sauce 400g', cat: 'Groceries', price: 180 },
    { name: 'Salt 1kg', cat: 'Groceries', price: 55 },
    { name: 'Tea Bags 100pk', cat: 'Beverages', price: 280 },
    { name: 'Instant Coffee 200g', cat: 'Beverages', price: 520 },
    { name: 'Mineral Water 1.5L', cat: 'Beverages', price: 75 },
    { name: 'Soda 330ml Can', cat: 'Beverages', price: 55 },
    { name: 'Orange Juice 1L', cat: 'Beverages', price: 260 },
    { name: 'Margarine 500g', cat: 'Dairy', price: 310 },
    { name: 'Yogurt 500ml', cat: 'Dairy', price: 180 },
    { name: 'Cheddar Cheese 200g', cat: 'Dairy', price: 450 },
    { name: 'Butter 250g', cat: 'Dairy', price: 350 },
    { name: 'Cream 250ml', cat: 'Dairy', price: 220 },
    { name: 'Croissant 4pk', cat: 'Bakery', price: 280 },
    { name: 'Chocolate Cake Slice', cat: 'Bakery', price: 150 },
    { name: 'Beef Mince 500g', cat: 'Meat & Fish', price: 550 },
    { name: 'Chicken Whole 1.5kg', cat: 'Meat & Fish', price: 680 },
    { name: 'Fish Tilapia 500g', cat: 'Meat & Fish', price: 450 },
    { name: 'Pork Chops 500g', cat: 'Meat & Fish', price: 520 },
    { name: 'Bananas 1kg', cat: 'Fruits & Veg', price: 120 },
    { name: 'Apples 1kg', cat: 'Fruits & Veg', price: 280 },
    { name: 'Oranges 1kg', cat: 'Fruits & Veg', price: 150 },
    { name: 'Potatoes 5kg', cat: 'Fruits & Veg', price: 350 },
    { name: 'Onions 1kg', cat: 'Fruits & Veg', price: 100 },
    { name: 'Detergent 2L', cat: 'Household', price: 380 },
    { name: 'Bleach 1L', cat: 'Household', price: 160 },
    { name: 'Dish Soap 500ml', cat: 'Household', price: 210 },
    { name: 'Toilet Paper 12pk', cat: 'Household', price: 520 },
    { name: 'Shampoo 250ml', cat: 'Personal Care', price: 390 },
    { name: 'Soap Bar 3pk', cat: 'Personal Care', price: 165 },
    { name: 'Toothpaste 100g', cat: 'Personal Care', price: 210 },
    { name: 'Deodorant 50ml', cat: 'Personal Care', price: 320 },
    { name: 'LED Bulb 10W', cat: 'Electronics', price: 250 },
    { name: 'Extension Cord 3m', cat: 'Electronics', price: 420 },
    { name: 'AA Batteries 4pk', cat: 'Electronics', price: 180 },
    { name: 'Notebook A4 200pg', cat: 'Stationery', price: 290 },
    { name: 'Ballpoint Pen 10pk', cat: 'Stationery', price: 120 },
    { name: 'Sticky Notes 3pk', cat: 'Stationery', price: 160 },
    { name: 'Tissue Paper 200pk', cat: 'Household', price: 190 },
    { name: 'Floor Cleaner 1L', cat: 'Household', price: 250 },
    { name: 'Body Lotion 200ml', cat: 'Personal Care', price: 280 },
    { name: 'Facial Tissue 100pk', cat: 'Household', price: 140 },
  ]
  return names.map((item, i) => ({
    id: `p${i + 1}`,
    sku: `SKU-${String(i + 1).padStart(4, '0')}`,
    name: item.name,
    selling_price: item.price,
    category: MOCK_CATEGORIES.indexOf(item.cat),
    category_name: item.cat,
    branch: MOCK_BRANCHES[i % MOCK_BRANCHES.length].id,
    branch_name: MOCK_BRANCHES[i % MOCK_BRANCHES.length].name,
    supplier: MOCK_SUPPLIERS[i % MOCK_SUPPLIERS.length].id,
    supplier_name: MOCK_SUPPLIERS[i % MOCK_SUPPLIERS.length].name,
    stock: Math.floor(Math.random() * 200),
    cost_price: Math.round(item.price * 0.65),
    barcode: `200${String(i + 1).padStart(7, '0')}`,
  }))
}

interface Product {
  id: string
  sku: string
  name: string
  selling_price: number
  category: number
  category_name: string
  branch: string
  branch_name: string
  supplier: string
  supplier_name: string
  stock: number
  cost_price: number
  barcode: string
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

  const allProducts = useMemo(() => generateMockProducts(), [])

  const [activeTab, setActiveTab] = useState('pricing')

  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [branchFilter, setBranchFilter] = useState('all')

  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set())
  const [selectAll, setSelectAll] = useState(false)

  const [alertInfo, setAlertInfo] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<() => void>(() => {})

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
        p.barcode.includes(q)
      )
    }
    if (categoryFilter !== 'all') {
      result = result.filter(p => p.category_name === categoryFilter)
    }
    if (supplierFilter !== 'all') {
      result = result.filter(p => p.supplier === supplierFilter)
    }
    if (branchFilter !== 'all') {
      result = result.filter(p => p.branch === branchFilter)
    }
    return result
  }, [allProducts, searchTerm, categoryFilter, supplierFilter, branchFilter])

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
      await new Promise(r => setTimeout(r, 1200))
      logger.info('Bulk price update completed', { count: pricePreview.length })
      showAlert('success', `Successfully updated ${pricePreview.length} product prices.`)
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
      await new Promise(r => setTimeout(r, 1000))
      const successCount = Math.floor(selectedProducts.length * 0.9)
      const failCount = selectedProducts.length - successCount
      setCategoryResult({ moved: successCount, failed: failCount })
      showAlert('success', `Moved ${successCount} products to "${newCategory}". ${failCount > 0 ? `${failCount} failed.` : ''}`)
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
      await new Promise(r => setTimeout(r, 1000))
      const branchName = MOCK_BRANCHES.find(b => b.id === adjustBranch)?.name || 'Unknown'
      const typeLabel = adjustType === 'add' ? 'Add Stock' : adjustType === 'remove' ? 'Remove Stock' : 'Set Stock Level'
      const qtyChange = adjustType === 'add' ? qty : adjustType === 'remove' ? -qty : qty
      const now = new Date().toISOString()
      const newAdjustments = selectedProducts.map(p => ({
        id: `adj-${Date.now()}-${p.id}`,
        date: now,
        productName: p.name,
        branchName,
        type: typeLabel,
        qtyChange,
        reason: adjustNote.trim() || typeLabel,
        status: 'completed' as const,
      }))
      setRecentAdjustments(prev => [...newAdjustments, ...prev].slice(0, 50))
      showAlert('success', `Applied ${typeLabel} to ${selectedProducts.length} products.`)
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
            supplierFilter={supplierFilter}
            onSupplierFilterChange={setSupplierFilter}
            branchFilter={branchFilter}
            onBranchFilterChange={setBranchFilter}
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
            supplierFilter={supplierFilter}
            onSupplierFilterChange={setSupplierFilter}
            branchFilter={branchFilter}
            onBranchFilterChange={setBranchFilter}
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
                    {MOCK_CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
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
            supplierFilter={supplierFilter}
            onSupplierFilterChange={setSupplierFilter}
            branchFilter={branchFilter}
            onBranchFilterChange={setBranchFilter}
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
                      {MOCK_BRANCHES.map(b => (
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
                  <p>No recent adjustments. Apply an adjustment above to see it here.</p>
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
  supplierFilter,
  onSupplierFilterChange,
  branchFilter,
  onBranchFilterChange,
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
  supplierFilter: string
  onSupplierFilterChange: (v: string) => void
  branchFilter: string
  onBranchFilterChange: (v: string) => void
  selectedProductIds: Set<string>
  onToggleProduct: (id: string) => void
  selectAll: boolean
  onSelectAll: () => void
}) {
  const uniqueCategories = useMemo(
    () => [...new Set(products.map(p => p.category_name))].sort(),
    [products]
  )
  const uniqueSuppliers = useMemo(
    () => products.filter((p, i, a) => a.findIndex(x => x.supplier === p.supplier) === i)
      .map(p => ({ id: p.supplier, name: p.supplier_name })),
    [products]
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
          <Select value={supplierFilter} onValueChange={onSupplierFilterChange}>
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Supplier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Suppliers</SelectItem>
              {uniqueSuppliers.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={branchFilter} onValueChange={onBranchFilterChange}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Branch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              {MOCK_BRANCHES.map(b => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
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
                <TableHead>Branch</TableHead>
                <TableHead className="text-right">Stock</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No products match your filters.
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
                    <TableCell className="text-sm">{p.branch_name}</TableCell>
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
