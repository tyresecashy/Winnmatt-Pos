'use client'

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Trash2, Plus, Loader2, Check, ChevronsUpDown, Lock } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import {
  getAllBranches,
  getProductsAtBranch,
  createStockTransfer,
  type TransferItem,
} from '@/lib/modules/transfers'

interface Branch {
  id: string
  name: string
  code: string
}

interface Product {
  id: string
  name: string
  sku: string
  category_id: string | null
  availableQuantity: number
  stock: Array<{ quantity: number; branch_id: string }>
}

interface TransferFormItem extends TransferItem {
  productName: string
  maxQuantity: number
}

interface NewTransferDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void | Promise<void>
}

export function NewTransferDialog({ open, onOpenChange, onSuccess }: NewTransferDialogProps) {
  const { profile } = useAuth()
  const [sourceBranch, setSourceBranch] = useState<string>('')
  const [destinationBranch, setDestinationBranch] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [transferItems, setTransferItems] = useState<TransferFormItem[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [sourceProducts, setSourceProducts] = useState<Product[]>([])
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [selectedQuantity, setSelectedQuantity] = useState<string>('')
  const [productSearch, setProductSearch] = useState<string>('')
  const [productOpen, setProductOpen] = useState(false)
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [error, setError] = useState<string>('')
  const [branchesError, setBranchesError] = useState<string>('')
  const [productsError, setProductsError] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const branchesCacheRef = useRef<Branch[] | null>(null)
  const productsCacheRef = useRef<Record<string, Product[]>>({})
  const deferredProductSearch = useDeferredValue(productSearch)

  const canManageTransfers = ['super_admin', 'admin', 'manager'].includes(profile?.role || '')
  const sourceBranchLocked = profile?.role !== 'super_admin'
  const lockedSourceBranchId = sourceBranchLocked ? profile?.branch_id || '' : ''

  const resetDialogState = () => {
    setBranches([])
    setBranchesError('')
    setSourceBranch('')
    setDestinationBranch('')
    setTransferItems([])
    setSelectedProductId('')
    setSelectedQuantity('')
    setProductSearch('')
    setProductOpen(false)
    setNotes('')
    setError('')
    setLoadingBranches(false)
    setLoadingProducts(false)
    setSourceProducts([])
    setProductsError('')
    setSubmitting(false)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetDialogState()
    }
    onOpenChange(nextOpen)
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!open) {
        return
      }

      if (!canManageTransfers) {
        setBranches([])
        setBranchesError('Transfers are limited to owners, admins, and managers.')
        return
      }

      if (sourceBranchLocked && !lockedSourceBranchId) {
        setBranches([])
        setBranchesError('Your account must be assigned to a branch before transfers can be created.')
        return
      }

      if (sourceBranchLocked && lockedSourceBranchId) {
        setSourceBranch(lockedSourceBranchId)
        setDestinationBranch('')
      }

      if (branchesCacheRef.current && branchesCacheRef.current.length > 0) {
        setBranches(branchesCacheRef.current)
        setLoadingBranches(false)
        return
      }

      async function loadBranches() {
        setLoadingBranches(true)
        setBranchesError('')
        try {
          const fetchedBranches = await getAllBranches()

          if (!fetchedBranches || fetchedBranches.length === 0) {
            setBranches([])
            setBranchesError('No branches found in the database.')
            return
          }

          setBranches(fetchedBranches)
          branchesCacheRef.current = fetchedBranches
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to load branches'
          setBranches([])
          setBranchesError(errorMessage)
        } finally {
          setLoadingBranches(false)
        }
      }

      void loadBranches()
    })
    return () => clearTimeout(timer)
  }, [canManageTransfers, lockedSourceBranchId, open, sourceBranchLocked])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!sourceBranch) {
        setSourceProducts([])
        setProductsError('')
        setProductSearch('')
        setProductOpen(false)
        return
      }

      async function loadProducts() {
        const cachedProducts = productsCacheRef.current[sourceBranch]
        if (cachedProducts) {
          setSourceProducts(cachedProducts)
          setProductsError('')
          setLoadingProducts(false)
          return
        }

        setLoadingProducts(true)
        setProductsError('')
        setProductSearch('')
        setProductOpen(false)

        try {
          const products = await getProductsAtBranch(sourceBranch)

          if (!products || products.length === 0) {
            setSourceProducts([])
            setProductsError('No products with available stock were found for this branch.')
            return
          }

          const validProducts = products
            .map((p) => ({
              ...p,
              availableQuantity: (p.stock || []).reduce((sum: number, s: { quantity: number | null }) => sum + (s.quantity || 0), 0),
            }))
            .filter((p) => p.id != null) as Product[]
          setSourceProducts(validProducts)
          productsCacheRef.current[sourceBranch] = validProducts
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to load products'
          setSourceProducts([])
          setProductsError(errorMessage)
        } finally {
          setLoadingProducts(false)
        }
      }

      void loadProducts()
    })
    return () => clearTimeout(timer)
  }, [sourceBranch])

  const handleSourceBranchChange = (branchId: string) => {
    if (sourceBranchLocked) {
      return
    }

    setSourceBranch(branchId)
    setDestinationBranch('')
    setTransferItems([])
    setSelectedProductId('')
    setSelectedQuantity('')
    setProductSearch('')
    setProductOpen(false)
    setError('')
  }

  const handleDestinationChange = (branchId: string) => {
    if (branchId === sourceBranch) {
      setError('Destination branch must be different from source branch')
      setDestinationBranch('')
      return
    }

    setDestinationBranch(branchId)
    setError('')
  }

  const handleAddItem = () => {
    if (!selectedProductId) {
      setError('Please select a product')
      return
    }

    if (!selectedQuantity || parseInt(selectedQuantity, 10) <= 0) {
      setError('Please enter a valid quantity')
      return
    }

    const quantity = parseInt(selectedQuantity, 10)
    const product = sourceProducts.find((item) => item.id === selectedProductId)
    if (!product) {
      setError('Product not found')
      return
    }

    if (quantity > product.availableQuantity) {
      setError(`Quantity exceeds available stock (${product.availableQuantity} available)`)
      return
    }

    if (transferItems.some((item) => item.productId === selectedProductId)) {
      setError('Product already added to transfer list')
      return
    }

    setTransferItems([
      ...transferItems,
      {
        productId: selectedProductId,
        quantity,
          productName: product.name,
        maxQuantity: product.availableQuantity,
      },
    ])
    setSelectedProductId('')
    setSelectedQuantity('')
    setError('')
  }

  const removeItem = (productId: string) => {
    setTransferItems(transferItems.filter((item) => item.productId !== productId))
  }

  const handleSubmit = async () => {
    setError('')

    if (!canManageTransfers) {
      setError('Transfers are limited to owners, admins, and managers.')
      return
    }

    if (!sourceBranch) {
      setError('Please select a source branch')
      return
    }
    if (!destinationBranch) {
      setError('Please select a destination branch')
      return
    }
    if (transferItems.length === 0) {
      setError('Please add at least one product to transfer')
      return
    }

    setSubmitting(true)
    try {
      const result = await createStockTransfer({
        from_branch_id: sourceBranch,
        to_branch_id: destinationBranch,
        items: transferItems.map((item) => ({
          product_id: item.productId,
          quantity_requested: item.quantity,
          product_name: item.productName,
        })),
        notes: notes || undefined,
      })

      if (!result.success) {
        setError(result.error || 'Failed to create transfer')
        return
      }

      handleOpenChange(false)
      delete productsCacheRef.current[sourceBranch]
      delete productsCacheRef.current[destinationBranch]
      await onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  const destinationBranches = useMemo(
    () => branches.filter((branch) => branch.id !== sourceBranch),
    [branches, sourceBranch]
  )
  const filteredProducts = useMemo(() => {
    const normalizedSearch = deferredProductSearch.trim().toLowerCase()

    return sourceProducts.filter((product) =>
      !normalizedSearch ||
      product.name.toLowerCase().includes(normalizedSearch) ||
      product.sku.toLowerCase().includes(normalizedSearch)
    )
  }, [deferredProductSearch, sourceProducts])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Stock Transfer</DialogTitle>
          <DialogDescription>Move stock between branches with full audit trail</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {branchesError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{branchesError}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="source-branch">
                Source Branch
                {loadingBranches && <span className="ml-2 text-xs text-muted-foreground">(loading...)</span>}
                *
              </Label>
              <Select
                value={sourceBranch}
                onValueChange={handleSourceBranchChange}
                disabled={loadingBranches || branches.length === 0 || sourceBranchLocked}
              >
                <SelectTrigger id="source-branch">
                  <SelectValue placeholder={loadingBranches ? 'Loading branches...' : 'Select source...'} />
                </SelectTrigger>
                <SelectContent>
                  {branches.length === 0 ? (
                    <div className="p-2 text-center text-sm text-muted-foreground">
                      {loadingBranches ? 'Loading...' : 'No branches available'}
                    </div>
                  ) : (
                    branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {sourceBranchLocked && profile?.branch?.name && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="h-3 w-3" />
                  Source branch is locked to {profile.branch.name}.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="dest-branch">
                Destination Branch
                {!sourceBranch && !loadingBranches && <span className="ml-2 text-xs text-muted-foreground">(select source first)</span>}
                *
              </Label>
              <Select
                value={destinationBranch}
                onValueChange={handleDestinationChange}
                disabled={!sourceBranch || loadingBranches}
              >
                <SelectTrigger id="dest-branch">
                  <SelectValue placeholder={!sourceBranch ? 'Select source first...' : 'Select destination...'} />
                </SelectTrigger>
                <SelectContent>
                  {destinationBranches.length === 0 ? (
                    <div className="p-2 text-center text-sm text-muted-foreground">
                      {sourceBranch ? 'No other branches available' : 'Select source first'}
                    </div>
                  ) : (
                    destinationBranches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {sourceBranch && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Add Products to Transfer</CardTitle>
                <CardDescription>Select products from source branch inventory</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {productsError && !loadingProducts && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{productsError}</AlertDescription>
                  </Alert>
                )}

                {loadingProducts && (
                  <Alert>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <AlertDescription>Loading products from the selected branch...</AlertDescription>
                  </Alert>
                )}

                {!loadingProducts && sourceProducts.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-2">
                      <Label htmlFor="product-select">Product *</Label>
                      <Popover open={productOpen} onOpenChange={setProductOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={productOpen}
                            className="w-full justify-between"
                            disabled={sourceProducts.length === 0}
                          >
                            {selectedProductId
                              ? sourceProducts.find((product) => product.id === selectedProductId)?.name ||
                                sourceProducts.find((product) => product.id === selectedProductId)?.sku
                              : 'Select product...'}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0" align="start">
                          <Command>
                            <CommandInput
                              placeholder="Search by name or SKU..."
                              value={productSearch}
                              onValueChange={setProductSearch}
                            />
                            <CommandEmpty>No matching products.</CommandEmpty>
                            <CommandGroup className="max-h-48 overflow-y-auto">
                              {filteredProducts.map((product) => (
                                <CommandItem
                                  key={product.id}
                                  value={product.id}
                                  onSelect={(currentValue) => {
                                    setSelectedProductId(currentValue === selectedProductId ? '' : currentValue)
                                    setProductOpen(false)
                                    setProductSearch('')
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      'mr-2 h-4 w-4',
                                      selectedProductId === product.id ? 'opacity-100' : 'opacity-0'
                                    )}
                                  />
                                  <span className="text-sm">
                                    {product.sku} - {product.name} ({product.availableQuantity} avail)
                                  </span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="quantity">Quantity *</Label>
                      <Input
                        id="quantity"
                        type="number"
                        min="1"
                        value={selectedQuantity}
                        onChange={(event) => setSelectedQuantity(event.target.value)}
                        placeholder="0"
                      />
                    </div>

                    <div className="flex items-end">
                      <Button
                        type="button"
                        onClick={handleAddItem}
                        disabled={!selectedProductId || !selectedQuantity}
                        variant="secondary"
                        className="w-full"
                      >
                        <Plus className="mr-1 h-4 w-4" />
                        Add
                      </Button>
                    </div>
                  </div>
                )}

                {transferItems.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">Available</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transferItems.map((item) => (
                        <TableRow key={item.productId}>
                          <TableCell className="font-medium">{item.productName}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary">{item.quantity} units</Badge>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">{item.maxQuantity}</TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeItem(item.productId)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="E.g., Stock rebalancing after inventory count..."
              className="min-h-16"
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {transferItems.length > 0 && !error && (
            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Products:</span>
                    <span className="font-medium">{transferItems.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Units:</span>
                    <span className="font-medium">{transferItems.reduce((sum, item) => sum + item.quantity, 0)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || transferItems.length === 0 || !canManageTransfers}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Transferring...
              </>
            ) : (
              'Create Transfer'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
