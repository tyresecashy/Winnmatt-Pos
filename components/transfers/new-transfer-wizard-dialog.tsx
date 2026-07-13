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
import {
  AlertCircle, Trash2, Plus, Loader2, Check, ChevronsUpDown, Lock,
  Truck, User, Phone, Calendar,
} from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import { getAllBranches, getProductsAtBranch, createTransferWizard } from '@/lib/modules/transfers'

interface Branch {
  id: string
  name: string
  code: string
}

interface Product {
  productId: string
  product: {
    id: string
    sku: string
    name: string
    category: {
      id: string
      name: string
    } | null
  } | null
  availableQuantity: number
}

interface WizardFormItem {
  productId: string
  productName: string
  productSku: string
  quantityRequested: number
  maxQuantity: number
}

interface NewTransferWizardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void | Promise<void>
}

type WizardStep = 'branches' | 'items' | 'logistics' | 'review'

const STEP_TITLES: Record<WizardStep, string> = {
  branches: 'Select Branches',
  items: 'Add Products',
  logistics: 'Driver & Vehicle',
  review: 'Review & Confirm',
}

export function NewTransferWizardDialog({ open, onOpenChange, onSuccess }: NewTransferWizardDialogProps) {
  const { profile } = useAuth()

  // Wizard step
  const [step, setStep] = useState<WizardStep>('branches')

  // Step 1: Branches
  const [sourceBranch, setSourceBranch] = useState<string>('')
  const [destinationBranch, setDestinationBranch] = useState<string>('')
  const [branches, setBranches] = useState<Branch[]>([])
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [branchesError, setBranchesError] = useState<string>('')

  // Step 2: Products
  const [sourceProducts, setSourceProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [productsError, setProductsError] = useState<string>('')
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [selectedQuantity, setSelectedQuantity] = useState<string>('')
  const [productSearch, setProductSearch] = useState<string>('')
  const [productOpen, setProductOpen] = useState(false)
  const [transferItems, setTransferItems] = useState<WizardFormItem[]>([])

  // Step 3: Logistics
  const [driverName, setDriverName] = useState('')
  const [driverPhone, setDriverPhone] = useState('')
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [expectedArrivalDate, setExpectedArrivalDate] = useState('')
  const [expectedArrivalTime, setExpectedArrivalTime] = useState('')
  const [notes, setNotes] = useState('')

  // General
  const [error, setError] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  const branchesCacheRef = useRef<Branch[] | null>(null)
  const productsCacheRef = useRef<Record<string, Product[]>>({})
  const deferredProductSearch = useDeferredValue(productSearch)

  const canManage = ['super_admin', 'admin', 'manager'].includes(profile?.role || '')
  const sourceBranchLocked = profile?.role !== 'super_admin'
  const lockedSourceBranchId = sourceBranchLocked ? profile?.branch_id || '' : ''

  const resetDialogState = () => {
    setStep('branches')
    setBranches([])
    setBranchesError('')
    setSourceBranch('')
    setDestinationBranch('')
    setTransferItems([])
    setSelectedProductId('')
    setSelectedQuantity('')
    setProductSearch('')
    setProductOpen(false)
    setSourceProducts([])
    setProductsError('')
    setDriverName('')
    setDriverPhone('')
    setVehicleNumber('')
    setExpectedArrivalDate('')
    setExpectedArrivalTime('')
    setNotes('')
    setError('')
    setLoadingBranches(false)
    setLoadingProducts(false)
    setSubmitting(false)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetDialogState()
    onOpenChange(nextOpen)
  }

  // Load branches
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!open) return
      if (!canManage) {
        setBranchesError('Transfers are limited to owners, admins, and managers.')
        return
      }
      if (sourceBranchLocked && !lockedSourceBranchId) {
        setBranchesError('Your account must be assigned to a branch.')
        return
      }
      if (sourceBranchLocked && lockedSourceBranchId) {
        setSourceBranch(lockedSourceBranchId)
      }
      if (branchesCacheRef.current && branchesCacheRef.current.length > 0) {
        setBranches(branchesCacheRef.current)
        return
      }

      async function load() {
        setLoadingBranches(true)
        try {
          const fetched = await getAllBranches()
          if (!fetched || fetched.length === 0) {
            setBranchesError('No branches found.')
            return
          }
          setBranches(fetched)
          branchesCacheRef.current = fetched
        } catch (err) {
          setBranchesError(err instanceof Error ? err.message : 'Failed to load branches')
        } finally {
          setLoadingBranches(false)
        }
      }
      void load()
    })
    return () => clearTimeout(timer)
  }, [canManage, lockedSourceBranchId, open, sourceBranchLocked])

  // Load source branch products when source branch changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!sourceBranch) {
        setSourceProducts([])
        setProductsError('')
        return
      }

      async function load() {
        const cached = productsCacheRef.current[sourceBranch]
        if (cached) {
          setSourceProducts(cached)
          setProductsError('')
          setLoadingProducts(false)
          return
        }
        setLoadingProducts(true)
        setProductsError('')
        try {
          const products = await getProductsAtBranch(sourceBranch)
          if (!products || products.length === 0) {
            setSourceProducts([])
            setProductsError('No products with stock found at this branch.')
            return
          }
          const valid = products as unknown as Product[]
          setSourceProducts(valid)
          productsCacheRef.current[sourceBranch] = valid
        } catch (err) {
          setSourceProducts([])
          setProductsError(err instanceof Error ? err.message : 'Failed to load products')
        } finally {
          setLoadingProducts(false)
        }
      }
      void load()
    })
    return () => clearTimeout(timer)
  }, [sourceBranch])

  const destinationBranches = useMemo(
    () => branches.filter(b => b.id !== sourceBranch),
    [branches, sourceBranch]
  )

  const filteredProducts = useMemo(() => {
    const q = deferredProductSearch.trim().toLowerCase()
    return sourceProducts.filter(p =>
      !q ||
      (p.product?.name.toLowerCase().includes(q) || false) ||
      (p.product?.sku.toLowerCase().includes(q) || false)
    )
  }, [deferredProductSearch, sourceProducts])

  const handleAddItem = () => {
    if (!selectedProductId) { setError('Select a product'); return }
    const qty = parseInt(selectedQuantity, 10)
    if (!qty || qty <= 0) { setError('Enter a valid quantity'); return }
    const product = sourceProducts.find(p => p.productId === selectedProductId)
    if (!product) { setError('Product not found'); return }
    if (qty > product.availableQuantity) {
      setError(`Only ${product.availableQuantity} available`)
      return
    }
    if (transferItems.some(i => i.productId === selectedProductId)) {
      setError('Product already added')
      return
    }
    setTransferItems([...transferItems, {
      productId: selectedProductId,
      productName: product.product!.name,
      productSku: product.product!.sku,
      quantityRequested: qty,
      maxQuantity: product.availableQuantity,
    }])
    setSelectedProductId('')
    setSelectedQuantity('')
    setError('')
  }

  const removeItem = (productId: string) => {
    setTransferItems(transferItems.filter(i => i.productId !== productId))
  }

  const canGoNext = (): boolean => {
    switch (step) {
      case 'branches': return !!sourceBranch && !!destinationBranch
      case 'items': return transferItems.length > 0
      case 'logistics': return true // driver/vehicle/date are optional
      case 'review': return true
    }
  }

  const handleNext = () => {
    setError('')
    if (step === 'branches' && !canGoNext()) { setError('Select both source and destination branches'); return }
    if (step === 'items' && !canGoNext()) { setError('Add at least one product'); return }
    const order: WizardStep[] = ['branches', 'items', 'logistics', 'review']
    const idx = order.indexOf(step)
    if (idx < order.length - 1) setStep(order[idx + 1])
  }

  const handleBack = () => {
    setError('')
    const order: WizardStep[] = ['branches', 'items', 'logistics', 'review']
    const idx = order.indexOf(step)
    if (idx > 0) setStep(order[idx - 1])
  }

  const handleSubmit = async () => {
    setError('')
    if (!canManage) { setError('Access denied'); return }
    setSubmitting(true)
    try {
      const expectedArrival = expectedArrivalDate && expectedArrivalTime
        ? `${expectedArrivalDate}T${expectedArrivalTime}:00`
        : expectedArrivalDate
          ? `${expectedArrivalDate}T00:00:00`
          : undefined

      const result = await createTransferWizard({
        fromWarehouseId: sourceBranch,
        toWarehouseId: destinationBranch,
        notes: notes || undefined,
        driverName: driverName || undefined,
        driverPhone: driverPhone || undefined,
        vehicleNumber: vehicleNumber || undefined,
        expectedArrival,
        items: transferItems.map(i => ({
          productId: i.productId,
          quantityRequested: i.quantityRequested,
        })),
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
      setError(err instanceof Error ? err.message : 'Unexpected error')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Stock Transfer</DialogTitle>
          <DialogDescription>
            Step {['branches', 'items', 'logistics', 'review'].indexOf(step) + 1} of 4: {STEP_TITLES[step]}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1">
          {(['branches', 'items', 'logistics', 'review'] as WizardStep[]).map((s, idx) => {
            const current = ['branches', 'items', 'logistics', 'review'].indexOf(step)
            const isComplete = idx < current
            const isCurrent = idx === current
            return (
              <div key={s} className="flex items-center flex-1">
                <div className={`h-1.5 rounded-full flex-1 ${
                  isComplete ? 'bg-primary' : isCurrent ? 'bg-primary/60' : 'bg-muted'
                }`} />
                {idx < 3 && <div className="w-0.5" />}
              </div>
            )
          })}
        </div>

        <div className="space-y-6">
          {/* ── STEP 1: Branches ── */}
          {step === 'branches' && (
            <>
              {branchesError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{branchesError}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Source Branch *</Label>
                  <Select
                    value={sourceBranch}
                    onValueChange={(v) => { setSourceBranch(v); setDestinationBranch(''); setTransferItems([]) }}
                    disabled={loadingBranches || branches.length === 0 || sourceBranchLocked}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={loadingBranches ? 'Loading...' : 'Select source'} />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {sourceBranchLocked && profile?.branch?.name && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Lock className="h-3 w-3" /> Locked to {profile.branch.name}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Destination Branch *</Label>
                  <Select
                    value={destinationBranch}
                    onValueChange={setDestinationBranch}
                    disabled={!sourceBranch || loadingBranches}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={!sourceBranch ? 'Select source first' : 'Select destination'} />
                    </SelectTrigger>
                    <SelectContent>
                      {destinationBranches.map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          {/* ── STEP 2: Items ── */}
          {step === 'items' && (
            <>
              {productsError && !loadingProducts && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{productsError}</AlertDescription>
                </Alert>
              )}
              {loadingProducts && (
                <Alert>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <AlertDescription>Loading products from source branch...</AlertDescription>
                </Alert>
              )}

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Add Products</CardTitle>
                  <CardDescription>From: {branches.find(b => b.id === sourceBranch)?.name || 'selected branch'}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!loadingProducts && sourceProducts.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-2">
                        <Label>Product *</Label>
                        <Popover open={productOpen} onOpenChange={setProductOpen}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" aria-expanded={productOpen}
                              className="w-full justify-between" disabled={sourceProducts.length === 0}>
                              {selectedProductId
                                ? sourceProducts.find(p => p.productId === selectedProductId)?.product?.name || 'Select...'
                                : 'Select product...'}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Search by name or SKU..." value={productSearch}
                                onValueChange={setProductSearch} />
                              <CommandEmpty>No matching products.</CommandEmpty>
                              <CommandGroup className="max-h-48 overflow-y-auto">
                                {filteredProducts.map(p => (
                                  <CommandItem key={p.productId} value={p.productId}
                                    onSelect={(cv) => { setSelectedProductId(cv === selectedProductId ? '' : cv); setProductOpen(false); setProductSearch('') }}>
                                    <Check className={cn('mr-2 h-4 w-4', selectedProductId === p.productId ? 'opacity-100' : 'opacity-0')} />
                                    <span className="text-sm">{p.product?.sku ?? ''} - {p.product?.name ?? 'Unknown'} ({p.availableQuantity} avail)</span>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-2">
                        <Label>Quantity *</Label>
                        <Input type="number" min="1" value={selectedQuantity}
                          onChange={e => setSelectedQuantity(e.target.value)} placeholder="0" />
                      </div>
                      <div className="flex items-end">
                        <Button type="button" onClick={handleAddItem}
                          disabled={!selectedProductId || !selectedQuantity} variant="secondary" className="w-full">
                          <Plus className="mr-1 h-4 w-4" /> Add
                        </Button>
                      </div>
                    </div>
                  )}

                  {transferItems.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">SKU</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transferItems.map(item => (
                          <TableRow key={item.productId}>
                            <TableCell className="font-medium">{item.productName}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{item.productSku}</TableCell>
                            <TableCell className="text-right"><Badge variant="secondary">{item.quantityRequested}</Badge></TableCell>
                            <TableCell>
                              <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(item.productId)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}

                  {!loadingProducts && sourceProducts.length === 0 && !productsError && (
                    <p className="text-sm text-muted-foreground text-center py-4">No products with stock at the source branch.</p>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {/* ── STEP 3: Logistics ── */}
          {step === 'logistics' && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Truck className="h-4 w-4" /> Driver & Vehicle
                  </CardTitle>
                  <CardDescription>Optional details for tracking the shipment</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Driver Name</Label>
                    <div className="relative">
                      <User className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input className="pl-8" placeholder="e.g. John Kamau" value={driverName}
                        onChange={e => setDriverName(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Driver Phone</Label>
                    <div className="relative">
                      <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input className="pl-8" placeholder="e.g. 0712 345 678" value={driverPhone}
                        onChange={e => setDriverPhone(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Vehicle Number</Label>
                    <Input placeholder="e.g. KCA 123T" value={vehicleNumber}
                      onChange={e => setVehicleNumber(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Expected Arrival</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="relative">
                        <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input className="pl-8" type="date" value={expectedArrivalDate}
                          onChange={e => setExpectedArrivalDate(e.target.value)} />
                      </div>
                      <Input type="time" value={expectedArrivalTime}
                        onChange={e => setExpectedArrivalTime(e.target.value)} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <Label>Transfer Notes (Optional)</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Urgent stock rebalance for weekend demand" className="min-h-16" />
              </div>
            </div>
          )}

          {/* ── STEP 4: Review ── */}
          {step === 'review' && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Source</span>
                    <span className="font-medium">{branches.find(b => b.id === sourceBranch)?.name || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Destination</span>
                    <span className="font-medium">{branches.find(b => b.id === destinationBranch)?.name || '—'}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Products</span>
                    <span className="font-medium">{transferItems.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Units</span>
                    <span className="font-medium">{transferItems.reduce((s, i) => s + i.quantityRequested, 0)}</span>
                  </div>
                  <Separator />
                  {driverName && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Driver</span>
                      <span>{driverName}</span>
                    </div>
                  )}
                  {vehicleNumber && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Vehicle</span>
                      <span>{vehicleNumber}</span>
                    </div>
                  )}
                  {expectedArrivalDate && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Expected</span>
                      <span>{expectedArrivalDate}{expectedArrivalTime ? ` ${expectedArrivalTime}` : ''}</span>
                    </div>
                  )}
                  {notes && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Notes</span>
                      <span className="text-right max-w-[200px] truncate">{notes}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Items</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">SKU</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transferItems.map(item => (
                        <TableRow key={item.productId}>
                          <TableCell>{item.productName}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{item.productSku}</TableCell>
                          <TableCell className="text-right"><Badge>{item.quantityRequested}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2">
          {step !== 'branches' && (
            <Button variant="outline" onClick={handleBack} disabled={submitting}>
              Back
            </Button>
          )}
          {step !== 'review' ? (
            <Button onClick={handleNext} disabled={!canGoNext()}>
              Next
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</>
              ) : (
                'Create Transfer'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Separator() {
  return <div className="border-t" />
}
