'use client'
import { logger } from '@/lib/logger';

import React, { useEffect, useMemo, useRef, useState, useDeferredValue, startTransition } from 'react'
import dynamic from 'next/dynamic'
import { ProductSearchBar } from '@/components/pos/product-search-bar'
import { EmptyState } from '@/components/ui/empty-state'
import { ShoppingCart } from '@/components/pos/shopping-cart'
import { CustomerLookup } from '@/components/pos/customer-lookup'
import { RecentTransactions } from '@/components/pos/recent-transactions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Kbd } from '@/components/ui/kbd'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { formatKSh } from "@/lib/currency"
import { MapPin, User, Clock, Receipt, Pause, Play, Trash2, Archive, Loader2, Keyboard, RotateCcw, Plus, Package, Shield } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useToast } from '@/components/ui/use-toast'
import { getProductsForPOS, createProduct } from '@/lib/modules/inventory'
import { getRedemptionEligibility } from '@/lib/modules/customers'
import { verifySupervisorRole } from '@/lib/auth-helpers'
import { holdSale } from '@/lib/sales-actions'
import { createSale, getSaleById, getHeldSales, resumeHeldSale, cancelHeldSale } from '@/lib/modules/sales'
import { completePaymentAction, type CompletePaymentPromotion } from '@/lib/actions/complete-payment-action'
import { type AppliedPromotion } from '@/components/pos/promotion-panel'
import { QuickActionBar } from '@/components/pos/quick-action-bar'
import { convertCartToQuote, emailSaleReceipt, smsSaleReceipt } from '@/lib/pos-actions'
import { applyPromotionToSale } from '@/lib/promotion-actions'
import { useReceiptSettings } from '@/hooks/use-receipt-settings'
import { useDeviceHeartbeat } from '@/hooks/use-device-heartbeat'
import { registerDevice } from '@/lib/modules/devices'
import { useShiftGuard } from '@/hooks/use-shift-guard'
import { QuickShiftDialog } from '@/components/pos/quick-shift-dialog'
import { useIsMobile } from '@/hooks/use-is-mobile'
import { getRegisters } from '@/lib/modules/cash'
import { ensureRegisterForBranch } from '@/lib/shift-cash-sync'
import type { SaleItem, HeldSale } from '@/lib/sales-actions'
import type { SaleDetailsData } from '@/components/receipt-preview'

// ── Dynamic imports (lazy load heavy components with framer-motion / Stripe) ──
const PaymentPanel = dynamic(() => import('@/components/pos/payment-panel').then(mod => mod.PaymentPanel), {
  ssr: false,
  loading: () => (
    <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
      Loading payment panel…
    </div>
  ),
})

const PromotionPanel = dynamic(() => import('@/components/pos/promotion-panel').then(mod => mod.PromotionPanel), {
  ssr: false,
})

const MobilePOSWrapper = dynamic(() => import('@/components/pos/mobile-pos-wrapper').then(mod => mod.MobilePOSWrapper), {
  ssr: false,
})

/** Minimal product shape used in POS product lists. */
export interface POSProduct {
  id: string
  name: string
  sku: string
  selling_price?: number
  purchase_price?: number
  quantity: number
  category?: { id: string; name: string; icon?: string } | null
}

export interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  discount: number
}

export interface SelectedCustomer {
  id: string
  name: string
  phone: string
  email?: string
  type: string
  loyalty_points: number
  tier?: string
}

interface LoyaltyRedemptionState {
  loading: boolean
  eligible: boolean
  reason: string | null
  currentBalance: number
  maxRedeemablePoints: number
  maxRedeemableDiscount: number
  redeemValueCents: number
  pointsToRedeem: number
  redemptionDiscount: number
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          <div className="text-center">
            <p className="text-lg font-medium">Something went wrong</p>
            <p className="text-sm mt-1">Please refresh the page or contact support.</p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default function POSPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const { settings: receiptSettings } = useReceiptSettings(profile?.branch_id ?? undefined)
  const isMobile = useIsMobile()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const customerLookupRef = useRef<HTMLButtonElement>(null)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const productRefreshPromiseRef = useRef<Promise<void> | null>(null)
  const lastProductRefreshAtRef = useRef(0)
  const postSaleRefreshTimeoutRef = useRef<number | null>(null)
  const refreshProductsRef = useRef(refreshProducts)
  const [allProducts, setAllProducts] = useState<POSProduct[]>([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [cart, setCart] = useState<CartItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const deferredSearch = useDeferredValue(searchTerm)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<SelectedCustomer | null>(null)
  const [isWholesale, setIsWholesale] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [cartDiscount, setCartDiscount] = useState(0)
  const [appliedPromotions, setAppliedPromotions] = useState<AppliedPromotion[]>([])
  const [promotionDiscountCents, setPromotionDiscountCents] = useState(0)
  const [showRecent, setShowRecent] = useState(false)
  const [isProcessingSale, setIsProcessingSale] = useState(false)
  const [fullSaleData, setFullSaleData] = useState<SaleDetailsData | null>(null)
  const [loyaltyRedemption, setLoyaltyRedemption] = useState<LoyaltyRedemptionState>({
    loading: false,
    eligible: false,
    reason: null,
    currentBalance: 0,
    maxRedeemablePoints: 0,
    maxRedeemableDiscount: 0,
    redeemValueCents: 50,
    pointsToRedeem: 0,
    redemptionDiscount: 0,
  })

  // Device ID (must be declared before useDeviceHeartbeat)
  const [deviceId, setDeviceId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('pos_device_id')
  })

  useDeviceHeartbeat(deviceId)

  // Shift guard — block payments without an open shift
  const {
    activeShift,
    isLoading: shiftLoading,
    hasActiveShift,
    openNewShift,
    closeActiveShift,
  } = useShiftGuard({
    branchId: profile?.branch_id ?? null,
    cashierId: profile?.id ?? '',
  })
  const [showShiftDialog, setShowShiftDialog] = useState(false)
  const [shiftDialogMode, setShiftDialogMode] = useState<'open' | 'close'>('open')
  const [shiftGateOpen, setShiftGateOpen] = useState(false) // true when we should show payment after opening shift
  const [registers, setRegisters] = useState<Array<{ id: string; register_name: string }>>([])
  const [loadingRegisters, setLoadingRegisters] = useState(false)

  // Load registers for register selection in shift dialog
  useEffect(() => {
    if (!profile?.branch_id) return
    const loadRegs = async () => {
      setLoadingRegisters(true)
      try {
        const data = await getRegisters(profile.branch_id!)
        const list = (data || []).map((r: { id: string; register_name?: string }) => ({
          id: r.id,
          register_name: r.register_name || 'Unnamed',
        }))
        setRegisters(list)
      } catch {
        logger.warn('[POS] Failed to load registers')
      } finally {
        setLoadingRegisters(false)
      }
    }
    loadRegs()
  }, [profile?.branch_id])

  const handleCreateRegister = async () => {
    if (!profile?.branch_id) return null
    try {
      const reg = await ensureRegisterForBranch(profile.branch_id)
      if (reg) {
        setRegisters(prev => {
          if (prev.some(r => r.id === reg.id)) return prev
          return [...prev, { id: reg.id, register_name: reg.register_name }]
        })
      }
      return reg
    } catch {
      return null
    }
  }

  // Auto-register device on mount
  useEffect(() => {
    if (!profile?.branch_id) return
    if (deviceId) return

    const doRegister = async () => {
      const result = await registerDevice({
        name: `POS-${profile?.full_name || 'Unknown'}`,
        device_type: 'pos_terminal',
        branch_id: profile.branch_id!,
        app_version: '1.0.0',
      })
      if (result.success && result.id) {
        localStorage.setItem('pos_device_id', result.id)
        setDeviceId(result.id)
      }
    }
    void doRegister()
  }, [profile?.branch_id, profile?.full_name, deviceId])

  // Hold sale state
  const [showHoldDialog, setShowHoldDialog] = useState(false)
  const [holdNotes, setHoldNotes] = useState("")
  const [isHoldingSale, setIsHoldingSale] = useState(false)
  const [showHeldSales, setShowHeldSales] = useState(false)
  const [heldSales, setHeldSales] = useState<HeldSale[]>([])
  const [heldSalesLoading, setHeldSalesLoading] = useState(false)
  const [heldSalesError, setHeldSalesError] = useState<string | null>(null)

  // Quick product create
  const [showQuickCreate, setShowQuickCreate] = useState(false)
  const [quickCreateForm, setQuickCreateForm] = useState({ name: '', sku: '', price: '' })
  const [quickCreateSaving, setQuickCreateSaving] = useState(false)

  // Price override approval
  const [pendingPriceOverride, setPendingPriceOverride] = useState<{ productId: string; newPrice: number } | null>(null)
  const [showApprovalDialog, setShowApprovalDialog] = useState(false)
  const [approvalPassword, setApprovalPassword] = useState('')
  const [approvalError, setApprovalError] = useState<string | null>(null)
  const isSupervisor = profile?.role === 'super_admin' || profile?.role === 'admin'

  async function refreshProducts(
    showLoadingState: boolean = false,
    options?: {
      force?: boolean
      minIntervalMs?: number
    }
  ) {
    const branchId = profile?.branch_id
    if (!branchId) {
      logger.warn('[POS] No branch ID available, skipping product refresh')
      return
    }

    const minIntervalMs = options?.minIntervalMs ?? 0
    const now = Date.now()
    if (!options?.force && productRefreshPromiseRef.current) {
      return productRefreshPromiseRef.current
    }

    if (!options?.force && minIntervalMs > 0 && now - lastProductRefreshAtRef.current < minIntervalMs) {
      return
    }

    if (showLoadingState) {
      setProductsLoading(true)
    }

    const refreshPromise = (async () => {
      try {
        const products = await getProductsForPOS(branchId)
        setAllProducts(products)
        lastProductRefreshAtRef.current = Date.now()
      } catch (error) {
        logger.error('Failed to load products:', error)
        setAllProducts([])
      } finally {
        if (showLoadingState) {
          setProductsLoading(false)
        }
      }
    })()

    productRefreshPromiseRef.current = refreshPromise

    try {
      await refreshPromise
    } finally {
      if (productRefreshPromiseRef.current === refreshPromise) {
        productRefreshPromiseRef.current = null
      }
    }
  }

  useEffect(() => {
    refreshProductsRef.current = refreshProducts
  })

  const applySoldQuantitiesToProducts = (items: SaleItem[]) => {
    setAllProducts((currentProducts) =>
      currentProducts.map((product) => {
        const matchingItem = items.find((item) => item.productId === product.id)
        if (!matchingItem) {
          return product
        }

        return {
          ...product,
          quantity: Math.max(0, product.quantity - matchingItem.quantity),
        }
      })
    )
  }

  const queueBackgroundProductRefresh = (delayMs: number = 1500) => {
    if (postSaleRefreshTimeoutRef.current) {
      window.clearTimeout(postSaleRefreshTimeoutRef.current)
    }

    postSaleRefreshTimeoutRef.current = window.setTimeout(() => {
      postSaleRefreshTimeoutRef.current = null
      void refreshProductsRef.current(false, { force: true })
    }, delayMs)
  }

  // Load and refresh products for live branch stock visibility
  useEffect(() => {
    let cancelled = false

    const loadProducts = async (showLoadingState: boolean = false) => {
      if (cancelled) return
      await refreshProductsRef.current(showLoadingState)
    }

    void loadProducts(true)

    const intervalId = window.setInterval(() => {
      void refreshProductsRef.current(false, { minIntervalMs: 10000 })
    }, 45000)

    const handleFocus = () => {
      void refreshProductsRef.current(false, { minIntervalMs: 10000 })
    }

    window.addEventListener('focus', handleFocus)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      window.removeEventListener('focus', handleFocus)
      if (postSaleRefreshTimeoutRef.current) {
        window.clearTimeout(postSaleRefreshTimeoutRef.current)
        postSaleRefreshTimeoutRef.current = null
      }
    }
  }, [profile?.branch_id])

  // Extract unique categories from database products
  const categories: (string | null)[] = useMemo(
    () =>
      Array.from(
        new Set(
          allProducts
            .map((p) => p.category?.name)
            .filter((n): n is string => n != null)
        )
      ).sort(),
    [allProducts]
  )

  // Score products for barcode/SKU matching: exact matches rank above fuzzy matches
  const getProductMatchScore = (product: POSProduct, searchTerm: string) => {
    if (!searchTerm) {
      return { score: 0, isExactMatch: false }
    }

    const lowerSearch = searchTerm.toLowerCase().trim()
    const lowerSku = product.sku?.toLowerCase() || ""
    const lowerName = product.name?.toLowerCase() || ""

    // Exact SKU/barcode match = highest priority (scanner mode)
    if (lowerSku === lowerSearch) {
      return { score: 1000, isExactMatch: true }
    }

    // Fuzzy matches = lower priority
    if (lowerSku.includes(lowerSearch) || lowerName.includes(lowerSearch)) {
      return { score: 100, isExactMatch: false }
    }

    return { score: 0, isExactMatch: false }
  }

  const filteredProducts = useMemo(
    () =>
      allProducts
        .map((product) => {
          const { score, isExactMatch } = getProductMatchScore(product, deferredSearch)
          return { ...product, _matchScore: score, _isExactMatch: isExactMatch }
        })
        .filter((product) => {
          const matchesSearch = product._matchScore > 0
          const noSearch = !deferredSearch
          const matchesCategory = !selectedCategory || product.category?.name === selectedCategory
          return (matchesSearch || noSearch) && matchesCategory
        })
        .sort((a, b) => (b._matchScore || 0) - (a._matchScore || 0)),
    [allProducts, deferredSearch, selectedCategory]
  )

  const addToCart = (productId: string, isExactMatch: boolean = false) => {
    const product = allProducts.find((p) => p.id === productId)
    if (!product) return
    
    // Prevent adding out-of-stock or unpriced items
    if (product.quantity <= 0) return
    if (product.selling_price == null) return

    const productPrice = product.selling_price
    const effectivePrice = isWholesale ? Math.round(productPrice * 0.85) : productPrice

    setCart((prev) => {
      const existing = prev.find((item) => item.id === productId)
      if (existing) {
        // Check if user is trying to add more than available stock
        const totalRequested = existing.quantity + 1
        if (totalRequested > product.quantity) return prev
        
        return prev.map((item) =>
          item.id === productId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      }
      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          price: effectivePrice,
          quantity: 1,
          discount: 0,
        },
      ]
    })
    
    // Always clear search term after adding item (whether exact match or clicked result)
    // Allows cashier to immediately search for next item without manual clearing
    setSearchTerm("")
    
    // Focus search input immediately for next transaction
    setTimeout(() => {
      searchInputRef.current?.focus()
    }, 0)
  }

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((item) => item.id !== productId))
    } else {
      setCart((prev) =>
        prev.map((item) =>
          item.id === productId ? { ...item, quantity } : item
        )
      )
    }
    // Focus search input after updating quantity
    setTimeout(() => {
      searchInputRef.current?.focus()
    }, 0)
  }

  const updateItemDiscount = (productId: string, discount: number) => {
    // For non-supervisor users, price override requires approval
    if (!isSupervisor && discount > 0) {
      const item = cart.find((i) => i.id === productId)
      if (item) {
        const newEffectivePrice = item.price - discount
        if (newEffectivePrice < item.price) {
          setPendingPriceOverride({ productId, newPrice: newEffectivePrice })
          setApprovalPassword('')
          setApprovalError(null)
          setShowApprovalDialog(true)
          return
        }
      }
    }
    setCart((prev) =>
      prev.map((item) =>
        item.id === productId ? { ...item, discount } : item
      )
    )
  }

  const handleApprovePriceOverride = async () => {
    try {
      const result = await verifySupervisorRole()
      if (result.isSupervisor) {
        if (pendingPriceOverride) {
          setCart((prev) =>
            prev.map((item) =>
              item.id === pendingPriceOverride.productId
                ? { ...item, discount: item.price - pendingPriceOverride.newPrice }
                : item
            )
          )
        }
        setShowApprovalDialog(false)
        setPendingPriceOverride(null)
        setApprovalPassword('')
        setApprovalError(null)
        toast({ title: 'Price Override Approved', description: 'The price change has been approved.' })
      } else {
        setApprovalError(result.error || 'Only supervisors can approve price overrides. Please call a supervisor.')
      }
    } catch {
      setApprovalError('Verification failed. Please try again.')
    }
  }

  const handleQuickCreate = () => {
    // Pre-fill SKU and name from current search term
    setQuickCreateForm({
      name: searchTerm || '',
      sku: searchTerm || '',
      price: '',
    })
    setShowQuickCreate(true)
  }

  const handleQuickCreateSave = async () => {
    if (!profile?.branch_id || !quickCreateForm.name.trim() || !quickCreateForm.price) return
    setQuickCreateSaving(true)
    try {
      // Create product with minimal fields
      const result = await createProduct(
        quickCreateForm.sku.trim() || `Q-${Date.now()}`,
        quickCreateForm.name.trim(),
        '',
        null, // no category - use null not '' to avoid FK violation
        0, // purchase price
        parseFloat(quickCreateForm.price),
        0, // reorder level
        profile.branch_id,
        1 // initial stock
      )
      if (!result.success) throw new Error(result.error || 'Failed to create product')
      setShowQuickCreate(false)
      // Refresh products and add to cart
      await refreshProducts(true, { force: true })
      if (result.data?.id) {
        addToCart(result.data.id, true)
      }
      toast({ title: 'Product Created', description: `${quickCreateForm.name.trim()} added to inventory and cart.` })
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create product',
        variant: 'destructive',
      })
    } finally {
      setQuickCreateSaving(false)
    }
  }

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== productId))
    // Focus search input after removing item
    setTimeout(() => {
      searchInputRef.current?.focus()
    }, 0)
  }

  const clearCart = () => {
    setCart([])
    setSelectedCustomer(null)
    setCartDiscount(0)
    setAppliedPromotions([])
    setPromotionDiscountCents(0)
    // Focus search input after clearing cart
    setTimeout(() => {
      searchInputRef.current?.focus()
    }, 0)
  }

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const itemDiscounts = cart.reduce((sum, item) => sum + item.discount * item.quantity, 0)
  const promotionDiscount = promotionDiscountCents
  const totalDiscount = itemDiscounts + cartDiscount + promotionDiscount
  const total = Math.max(0, subtotal - totalDiscount)

  const handleAppliedPromotionsChange = (applied: AppliedPromotion[], totalDiscountCents: number) => {
    setAppliedPromotions(applied)
    setPromotionDiscountCents(totalDiscountCents)
  }

  useEffect(() => {
    let cancelled = false

    async function loadRedemptionEligibility() {
      if (!selectedCustomer?.id || total <= 0) {
        setLoyaltyRedemption((current) => ({
          ...current,
          loading: false,
          eligible: false,
          reason: selectedCustomer?.id ? 'Add items to enable redemption' : null,
          currentBalance: selectedCustomer?.loyalty_points || 0,
          maxRedeemablePoints: 0,
          maxRedeemableDiscount: 0,
          pointsToRedeem: 0,
          redemptionDiscount: 0,
        }))
        return
      }

      setLoyaltyRedemption((current) => ({
        ...current,
        loading: true,
        currentBalance: selectedCustomer.loyalty_points || 0,
      }))

      try {
        const eligibility = await getRedemptionEligibility(
          selectedCustomer.id,
          total
        )

        if (cancelled || !eligibility) {
          return
        }

        setLoyaltyRedemption((current) => {
          const nextPoints = eligibility.eligible
            ? Math.min(current.pointsToRedeem, eligibility.maxRedeemablePoints)
            : 0
          const nextDiscount = Math.round(
            nextPoints * eligibility.redeemValueCents
          )

          return {
            loading: false,
            eligible: eligibility.eligible,
            reason: eligibility.reason || null,
            currentBalance: eligibility.currentBalance,
            maxRedeemablePoints: eligibility.maxRedeemablePoints,
            maxRedeemableDiscount: eligibility.maxRedeemableDiscount,
            redeemValueCents: eligibility.redeemValueCents,
            pointsToRedeem: nextPoints,
            redemptionDiscount: nextDiscount,
          }
        })
      } catch (error) {
        if (cancelled) {
          return
        }

        logger.error('[POS] Failed to load redemption eligibility:', error)
        setLoyaltyRedemption({
          loading: false,
          eligible: false,
          reason: 'Unable to check loyalty redemption right now',
          currentBalance: selectedCustomer.loyalty_points || 0,
          maxRedeemablePoints: 0,
          maxRedeemableDiscount: 0,
          redeemValueCents: 50,
          pointsToRedeem: 0,
          redemptionDiscount: 0,
        })
      }
    }

    void loadRedemptionEligibility()

    return () => {
      cancelled = true
    }
  }, [selectedCustomer?.id, selectedCustomer?.loyalty_points, total])

  // Global keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ctrl+K / Cmd+K → focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
      // Escape → close recent transactions
      if (e.key === 'Escape' && showRecent) {
        setShowRecent(false)
      }
      // Ctrl+N / Cmd+N → new transaction (clear cart)
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        if (cart.length > 0 && !window.confirm('Clear cart and start new sale?')) return
        setCart([])
        setSelectedCustomer(null)
        setCartDiscount(0)
        setAppliedPromotions([])
        setPromotionDiscountCents(0)
        setSearchTerm('')
      }
      // Ctrl+Enter / Cmd+Enter → open checkout
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        if (cart.length > 0) {
          if (hasActiveShift) {
            setShowPayment(true)
          } else {
            setShiftDialogMode('open')
            setShiftGateOpen(true)
            setShowShiftDialog(true)
          }
        }
      }
      // F2 → hold sale (when cart has items)
      if (e.key === 'F2') {
        e.preventDefault()
        if (cart.length > 0) {
          setShowHoldDialog(true)
        }
      }
      // Ctrl+L / Cmd+L → open customer lookup
      if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault()
        customerLookupRef.current?.click()
      }
      // F1 → keyboard shortcuts help
      if (e.key === 'F1') {
        e.preventDefault()
        setShowShortcuts((prev) => !prev)
      }

      // F3 → returns page
      if (e.key === 'F3') {
        e.preventDefault()
        window.location.href = '/returns'
      }
      // Ctrl+Shift+P → quick product create
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
        e.preventDefault()
        setQuickCreateForm({ name: searchTerm || '', sku: searchTerm || '', price: '' })
        setShowQuickCreate(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showRecent, cart.length, searchTerm, hasActiveShift])

  // ─── Hold Sale Handlers ──────────────────────────────────────────────

  const handleHoldSale = async () => {
    if (!profile?.id || !profile?.branch_id || cart.length === 0) return

    setIsHoldingSale(true)
    try {
      const items = cart.map((item) => ({
        productId: item.id,
        name: item.name,
        sku: '',
        quantity: item.quantity,
        unitPrice: item.price,
        discountPercent: item.discount > 0 ? (item.discount / item.price) * 100 : 0,
        sellingPrice: item.price,
      }))

      const result = await holdSale(
        profile.branch_id,
        profile.id,
        items,
        selectedCustomer?.id || null,
        subtotal,
        cartDiscount,
        total,
        holdNotes || undefined,
      )

      if (!result.success) {
        throw new Error(result.error || 'Failed to hold sale')
      }

      // Clear cart for next customer
      setCart([])
      setSelectedCustomer(null)
      setCartDiscount(0)
      setAppliedPromotions([])
      setPromotionDiscountCents(0)
      setShowHoldDialog(false)
      setHoldNotes("")

      toast({
        title: 'Sale Placed on Hold',
        description: `Receipt #${result.receiptNumber}. You can resume it from the Held Sales button.`,
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to hold sale',
        variant: 'destructive',
      })
    } finally {
      setIsHoldingSale(false)
    }
  }

  const loadHeldSales = async () => {
    if (!profile?.branch_id) return

    setHeldSalesLoading(true)
    setHeldSalesError(null)
    try {
      const sales = await getHeldSales(profile.branch_id)
      setHeldSales(sales)
    } catch (error) {
      setHeldSalesError('Failed to load held sales')
    } finally {
      setHeldSalesLoading(false)
    }
  }

  const handleResumeHeldSale = async (sale: HeldSale) => {
    if (!profile?.branch_id) return

    try {
      // Skip calling resumeHeldSale if cart is not empty
      if (cart.length > 0) {
        toast({
          title: 'Cart Not Empty',
          description: 'Clear the current cart first before resuming a held sale.',
          variant: 'destructive',
        })
        return
      }

      const result = await resumeHeldSale(sale.id)

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to resume held sale')
      }

      const heldSale = result.data as unknown as HeldSale

      // Restore cart items
      const restoredItems: CartItem[] = heldSale.items.map((item) => ({
        id: item.product_id,
        name: item.product.name,
        price: item.unit_price,
        quantity: item.quantity,
        discount: item.unit_price * (item.discount_percent / 100),
      }))
      setCart(restoredItems)

      // Restore customer if applicable
      if (heldSale.customer_id) {
        setSelectedCustomer({
          id: heldSale.customer_id,
          name: heldSale.customer_name || 'Unknown',
          phone: '',
          type: 'retail',
          loyalty_points: 0,
        })
      }

      // Restore discount
      if (heldSale.discount_amount > 0) {
        setCartDiscount(heldSale.discount_amount)
      }

      // Close held sales dialog
      setShowHeldSales(false)
      setHeldSales([])

      toast({
        title: 'Sale Resumed',
        description: `${restoredItems.length} item(s) restored to cart.`,
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to resume held sale',
        variant: 'destructive',
      })
    }
  }

  const handleCancelHeldSale = async (saleId: string) => {
    if (!profile?.branch_id) return
    if (!window.confirm('Discard this held sale permanently?')) return

    try {
      const result = await cancelHeldSale(saleId)

      if (!result.success) {
        throw new Error(result.error || 'Failed to cancel held sale')
      }

      setHeldSales((prev) => prev.filter((s) => s.id !== saleId))
      toast({
        title: 'Held Sale Discarded',
        description: 'The held sale has been cancelled.',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to cancel held sale',
        variant: 'destructive',
      })
    }
  }

  const buildReceiptData = (sale: SaleDetailsData): SaleDetailsData => ({
    ...sale,
    businessSettings: {
      business_name: receiptSettings?.business_name || 'Winnmatt',
      phone: receiptSettings?.effectivePhoneNumber || receiptSettings?.phone_number || '',
      email: receiptSettings?.effectiveEmail || receiptSettings?.email || '',
      address: receiptSettings?.effectiveAddress || receiptSettings?.address || '',
      tax_pin: receiptSettings?.tax_pin || '',
      receipt_footer_text: receiptSettings?.receipt_footer_text || '',
      thank_you_message: receiptSettings?.thank_you_message || 'Thank you for your purchase!',
    },
    branchSettings: receiptSettings?.branchSettings
      ? {
          receipt_header_text: receiptSettings.branchSettings.receipt_header_text || '',
          phone_number: receiptSettings.branchSettings.phone_number || '',
          email: receiptSettings.branchSettings.email || '',
          address: receiptSettings.branchSettings.address || '',
        }
      : undefined,
  })

  // Mobile: render simplified MobilePOSWrapper instead of full desktop layout
  if (isMobile && typeof window !== 'undefined') {
    return (
      <MobilePOSWrapper
        allProducts={allProducts}
        profile={{
          id: profile?.id ?? '',
          branch_id: profile?.branch_id,
          full_name: profile?.full_name,
          role: profile?.role,
        }}
        branchName={profile?.branch?.name}
      />
    )
  }

  return (
    <ErrorBoundary>
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* POS Header */}
      <div role="region" aria-label="Point of Sale header" className="flex items-center justify-between px-2 sm:px-4 py-2 sm:py-3 bg-card border-b">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
            <Receipt className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-lg">Point of Sale</h1>
            <p className="text-xs text-muted-foreground">Cashier Terminal</p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              {profile?.branch?.name || 'Branch'}
            </span>
            {profile?.branch?.code && (
              <Badge variant="secondary" className="text-[10px] py-0 px-1">
                {profile.branch.code}
              </Badge>
            )}
            {/* Shift Status Dot */}
            {!shiftLoading && (
              <button
                onClick={() => {
                  if (hasActiveShift) {
                    setShiftDialogMode('close')
                    setShowShiftDialog(true)
                  } else {
                    setShiftDialogMode('open')
                    setShowShiftDialog(true)
                  }
                }}
                className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border border-border hover:bg-accent transition-colors"
                title={hasActiveShift ? 'Shift active — click to close' : 'No open shift — click to open'}
              >
                <span className={`h-2 w-2 rounded-full ${hasActiveShift ? 'bg-success animate-pulse' : 'bg-destructive'}`} />
                <span className="text-muted-foreground">
                  {hasActiveShift ? `Shift #${activeShift?.shift_number?.split('-').pop() || ''}` : 'No Shift'}
                </span>
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground pos-header-shortcuts">
            <span className="mr-1">Search:</span>
            <Kbd className="text-[10px]">Ctrl+K</Kbd>
            <span className="mx-1.5">New:</span>
            <Kbd className="text-[10px]">Ctrl+N</Kbd>
          </div>
          <Button
            variant={showRecent ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setShowRecent(!showRecent)}
          >
            <Clock className="h-4 w-4 mr-2" />
            Recent
          </Button>
          {cart.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHoldDialog(true)}
            >
              <Pause className="h-4 w-4 mr-2" />
              Hold Sale
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setShowHeldSales(true)
              void loadHeldSales()
            }}
          >
            <Archive className="h-4 w-4 mr-2" />
            Held
          </Button>
          <Button
            variant="outline"
            size="sm"
            asChild
          >
            <a href="/returns">
              <RotateCcw className="h-4 w-4 mr-2" />
              Returns
            </a>
          </Button>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{profile?.full_name || 'Cashier'}</span>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium">
              {new Date().toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' })}
            </p>
            <p className="text-xs text-muted-foreground">
              {new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content - Fullscreen Cart */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Search Bar + Customer - compact single row */}
        <div className="px-2 sm:px-4 py-1.5 bg-card border-b flex-shrink-0">
          {productsLoading && allProducts.length === 0 ? (
            <div className="max-w-2xl mx-auto space-y-2">
              <Skeleton className="h-9 w-full" />
              <div className="flex gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-16 rounded-full" />
                ))}
              </div>
            </div>
          ) : (
            <ProductSearchBar
              ref={searchInputRef}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
              isWholesale={isWholesale}
              onWholesaleToggle={setIsWholesale}
              categories={categories}
              filteredProducts={filteredProducts}
              onAddToCart={addToCart}
              onQuickCreate={handleQuickCreate}
            />
          )}
        </div>

        {/* Cart - fills remaining space */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Customer bar - compact */}
          <div className="flex items-center gap-2 sm:gap-3 px-2 sm:px-4 py-1.5 border-b flex-shrink-0">
            <CustomerLookup
              selectedCustomer={selectedCustomer}
              onSelectCustomer={setSelectedCustomer}
              loyaltyRedeemValue={loyaltyRedemption.redeemValueCents}
              searchTriggerRef={customerLookupRef}
            />
          </div>

          {/* Scrollable content: Cart Items + Quick Actions + Payment */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {/* Cart Items - main content */}
            <div className="min-h-[200px]">
              <ShoppingCart
                items={cart}
                onUpdateQuantity={updateQuantity}
                onUpdateDiscount={updateItemDiscount}
                onRemoveItem={removeFromCart}
                onClearCart={clearCart}
                onHoldSale={() => setShowHoldDialog(true)}
                allProducts={allProducts}
                searchInputRef={searchInputRef}
              />
            </div>

            {/* Quick Actions Toolbar */}
            <div className="px-3 py-1.5 border-t">
              <QuickActionBar
                cartEmpty={cart.length === 0}
                hasCustomer={selectedCustomer !== null}
                isSupervisor={isSupervisor}
                onHold={() => setShowHoldDialog(true)}
                onDuplicate={() => {
                  if (cart.length === 0) return
                  // Duplicate all cart items (add them again)
                  setCart(prev => {
                    const newCart = [...prev]
                    for (const item of prev) {
                      newCart.push({ ...item })
                    }
                    return newCart
                  })
                  toast({ title: 'Cart Duplicated', description: `Added ${cart.length} items to cart` })
                }}
                onConvertToQuote={async () => {
                  if (!selectedCustomer?.id || !profile?.branch_id || cart.length === 0) return
                  const result = await convertCartToQuote(
                    selectedCustomer.id,
                    profile.branch_id,
                    cart.map(item => ({
                      productId: item.id,
                      productName: item.name,
                      quantity: item.quantity,
                      price: item.price,
                    })),
                  )
                  if (result.success) {
                    toast({ title: 'Quote Created', description: `Invoice #${result.invoiceNumber} created as draft` })
                  } else {
                    toast({ title: 'Error', description: result.error || 'Failed to create quote', variant: 'destructive' })
                  }
                }}
                onVoid={() => {
                  if (cart.length === 0) return
                  setCart([])
                  setCartDiscount(0)
                  setAppliedPromotions([])
                  setPromotionDiscountCents(0)
                  setSelectedCustomer(null)
                  setLoyaltyRedemption({
                    loading: false, eligible: false, reason: null, currentBalance: 0,
                    maxRedeemablePoints: 0, maxRedeemableDiscount: 0, redeemValueCents: 50,
                    pointsToRedeem: 0, redemptionDiscount: 0,
                  })
                  toast({ title: 'Cart Cleared', description: 'Cart has been voided' })
                }}
                onEmailReceipt={async () => {
                  if (!fullSaleData?.id || !selectedCustomer?.email) {
                    toast({ title: 'Cannot Send', description: 'No completed sale or customer email available', variant: 'destructive' })
                    return
                  }
                  const result = await emailSaleReceipt(
                    fullSaleData.id,
                    selectedCustomer.email,
                    selectedCustomer.name,
                    fullSaleData.receipt_number,
                  )
                  if (result.success) {
                    toast({ title: 'Receipt Sent', description: `Receipt emailed to ${selectedCustomer.email}` })
                  } else {
                    toast({ title: 'Error', description: result.error || 'Failed to send receipt', variant: 'destructive' })
                  }
                }}
                onSMSReceipt={async () => {
                  if (!fullSaleData?.id || !selectedCustomer?.phone) {
                    toast({ title: 'Cannot Send', description: 'No completed sale or customer phone available', variant: 'destructive' })
                    return
                  }
                  const result = await smsSaleReceipt(
                    fullSaleData.id,
                    selectedCustomer.phone,
                    selectedCustomer.name,
                    fullSaleData.receipt_number,
                    fullSaleData.total_amount,
                  )
                  if (result.success) {
                    toast({ title: 'SMS Sent', description: `Receipt sent to ${selectedCustomer.phone}` })
                  } else {
                    toast({ title: 'Error', description: result.error || 'Failed to send SMS', variant: 'destructive' })
                  }
                }}
                onReprint={() => {
                  // Trigger the browser print dialog for the current page
                  window.print()
                  toast({ title: 'Print Dialog', description: 'Opening print dialog for receipt...' })
                }}
                onManagerApproval={() => toast({ title: 'Approval', description: 'Request sent to manager' })}
              />
            </div>

            {/* Promotions Section */}
            <PromotionPanel
              cartTotalCents={subtotal}
              cartItemCategoryIds={cart.map(item => allProducts.find(p => p.id === item.id)?.category?.id).filter(Boolean) as string[]}
              onAppliedPromotionsChange={handleAppliedPromotionsChange}
              disabled={isProcessingSale}
            />

            {/* Payment Section */}
            <PaymentPanel
            subtotal={subtotal}
            itemDiscounts={itemDiscounts}
            cartDiscount={cartDiscount}
            onCartDiscountChange={setCartDiscount}
            total={total}
            showPayment={showPayment}
            onShowPayment={(show) => {
              if (show) {
                // Guard: require active shift to open payment
                if (hasActiveShift) {
                  setShowPayment(true)
                } else {
                  setShiftDialogMode('open')
                  setShiftGateOpen(true)
                  setShowShiftDialog(true)
                }
              } else {
                setShowPayment(false)
              }
            }}
            fullSaleData={fullSaleData}
            onReceiptClose={() => {
              // Receipt has been viewed/printed, clear everything for next transaction
              setCart([])
              setSelectedCustomer(null)
              setCartDiscount(0)
              setAppliedPromotions([])
              setPromotionDiscountCents(0)
              setLoyaltyRedemption({
                loading: false,
                eligible: false,
                reason: null,
                currentBalance: 0,
                maxRedeemablePoints: 0,
                maxRedeemableDiscount: 0,
                redeemValueCents: 50,
                pointsToRedeem: 0,
                redemptionDiscount: 0,
              })
              setSearchTerm("")
              setFullSaleData(null)
              
              // Focus search input for next transaction
              setTimeout(() => {
                searchInputRef.current?.focus()
              }, 0)
            }}
            promotionDiscount={promotionDiscountCents}
            onCompletePayment={async (receiptNumber, paymentMethod, opts) => {
              const options = opts as any
              if (paymentMethod === 'mpesa' && options?.skipSaleCreation && options?.saleId) {
                const fullSale = await getSaleById(options.saleId as string) as unknown as SaleDetailsData

                if (!fullSale || !fullSale.id) {
                  throw new Error('Failed to load the confirmed M-Pesa sale. Please check recent sales.')
                }

                // Apply promotions after M-Pesa payment confirmed
                if (appliedPromotions.length > 0) {
                  for (const promo of appliedPromotions) {
                    try {
                      await applyPromotionToSale(
                        promo.id,
                        options.saleId,
                        promo.discountCents,
                        promo.couponCode,
                      )
                    } catch (error) {
                      logger.warn('[POS] Failed to apply promotion to M-Pesa sale:', {
                        saleId: options.saleId,
                        promotionId: promo.id,
                        error: String(error),
                      })
                    }
                  }
                }

                setFullSaleData(buildReceiptData(fullSale))

                toast({
                  title: 'M-Pesa Payment Confirmed',
                  description: `Receipt #${fullSale.receipt_number} is ready`,
                  variant: 'default',
                })

                return
              }

              // ── Card skip-sale-creation (post-Stripe-confirmation) ──
              if (paymentMethod === 'card' && options?.skipSaleCreation && options?.saleId) {
                const fullSale = await getSaleById(options.saleId) as unknown as SaleDetailsData

                if (!fullSale || !fullSale.id) {
                  throw new Error('Failed to load the confirmed card sale. Please check recent sales.')
                }

                // Apply promotions after card payment confirmed
                if (appliedPromotions.length > 0) {
                  for (const promo of appliedPromotions) {
                    try {
                      await applyPromotionToSale(
                        promo.id,
                        options.saleId,
                        promo.discountCents,
                        promo.couponCode,
                      )
                    } catch (error) {
                      logger.warn('[POS] Failed to apply promotion to card sale:', {
                        saleId: options.saleId,
                        promotionId: promo.id,
                        error: String(error),
                      })
                    }
                  }
                }

                setFullSaleData(buildReceiptData(fullSale))

                toast({
                  title: 'Card Payment Confirmed',
                  description: `Receipt #${fullSale.receipt_number} is ready`,
                  variant: 'default',
                })

                return
              }

              // Validate for sale creation
              if (!profile?.id || !profile?.branch_id || cart.length === 0) {
                toast({
                  title: 'Error',
                  description: 'Missing required information to complete sale',
                  variant: 'destructive',
                })
                return
              }

              setIsProcessingSale(true)
              try {
                // Transform cart items to SaleItem format
                const saleItems: SaleItem[] = cart.map((item) => ({
                  productId: item.id,
                  quantity: item.quantity,
                  unitPrice: item.price,
                  discountPercent: item.discount > 0 ? (item.discount / item.price) * 100 : 0,
                }))

                if (paymentMethod === 'mpesa') {
                  const createResult = await createSale(
                    profile.branch_id,
                    profile.id,
                    saleItems,
                    'mpesa',
                    selectedCustomer?.id || undefined,
                    cartDiscount,
                    'POS Sale',
                    'pending'
                  ) as any

                  if (!createResult.success || !createResult.sale?.id) {
                    throw new Error(createResult.error || 'Failed to create pending M-Pesa sale')
                  }

                  options?.onSaleCreated?.(
                    createResult.sale.id,
                    createResult.receiptNumber || createResult.sale.receipt_number
                  )

                  const stkResponse = await fetch('/api/mpesa/stk-push', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      saleId: createResult.sale.id,
                      phoneNumber: options?.mpesaPhone,
                      amount: total,
                      accountReference: createResult.receiptNumber || createResult.sale.receipt_number || receiptNumber,
                    }),
                  })

                  const stkData = await stkResponse.json().catch(() => ({}))

                  if (!stkResponse.ok) {
                    throw new Error(stkData.error || stkData.message || 'Failed to send M-Pesa prompt')
                  }

                  options?.onCheckoutId?.(stkData.checkoutRequestId)

                  toast({
                    title: 'M-Pesa Prompt Sent',
                    description: 'Ask the customer to enter their M-Pesa PIN on their phone.',
                    variant: 'default',
                  })

                  return
                }

                if (paymentMethod === 'card') {
                  const createResult = await createSale(
                    profile.branch_id,
                    profile.id,
                    saleItems,
                    'card',
                    selectedCustomer?.id || undefined,
                    cartDiscount,
                    'POS Sale',
                    'pending'
                  ) as any

                  if (!createResult.success || !createResult.sale?.id) {
                    throw new Error(createResult.error || 'Failed to create pending card sale')
                  }

                  options?.onSaleCreated?.(
                    createResult.sale.id,
                    createResult.receiptNumber || createResult.sale.receipt_number
                  )

                  return
                }

                if (paymentMethod !== 'cash' && !options?.splits) {
                  throw new Error('Unsupported payment method')
                }

                const promoPayload: CompletePaymentPromotion[] | undefined = appliedPromotions.length > 0
                  ? appliedPromotions.map((p) => ({
                      promotionId: p.id,
                      discountCents: p.discountCents,
                      couponCode: p.couponCode,
                    }))
                  : undefined

                // Handle split payments
                const paymentSplits = options?.splits as Array<{ method: string; amount: number }> | undefined
                const effectivePaymentMethod = paymentSplits && paymentSplits.length > 0
                  ? paymentSplits.reduce((max, s) => s.amount > max.amount ? s : max).method
                  : 'cash'

                const paymentResult = await completePaymentAction({
                  branchId: profile.branch_id,
                  cashierId: profile.id,
                  shiftId: activeShift?.id,
                  items: saleItems,
                  paymentMethod: effectivePaymentMethod as 'cash' | 'card' | 'bank_transfer' | 'cheque' | 'credit',
                  customerId: selectedCustomer?.id,
                  cartDiscount,
                  receiptSettings: (receiptSettings ?? {}) as Record<string, unknown>,
                  redemptionPoints: options?.redemption?.pointsToRedeem || undefined,
                  redemptionDiscount: options?.redemption?.discountApplied || undefined,
                  promotions: promoPayload,
                  paymentSplits: paymentSplits as Array<{ method: 'cash' | 'card' | 'bank_transfer' | 'cheque' | 'credit' | 'mpesa'; amount: number; reference?: string }> | undefined,
                })

                if (!paymentResult.success) {
                  throw new Error(paymentResult.error || 'Payment failed')
                }

                if (!paymentResult.receiptData) {
                  throw new Error('No receipt data returned from payment')
                }

                applySoldQuantitiesToProducts(saleItems)
                queueBackgroundProductRefresh()
                setFullSaleData(paymentResult.receiptData)
                window.dispatchEvent(
                  new CustomEvent('pos:sale-completed', {
                    detail: {
                      saleId: paymentResult.saleId,
                      receiptNumber: paymentResult.receiptData.receipt_number,
                    },
                  })
                )

                toast({
                  title: 'Sale Completed',
                  description: `Receipt #${paymentResult.receiptData.receipt_number} saved successfully`,
                  variant: 'default',
                })

                setLoyaltyRedemption((current) => ({
                  ...current,
                  pointsToRedeem: 0,
                  redemptionDiscount: 0,
                }))

                // Don't close payment dialog yet - let user view receipt first
                // Cart will be cleared from receipt dialog's close handler
              } catch (error) {
                logger.error('[POS] Failed to complete sale:', error)
                void refreshProducts(false, { force: true })
                toast({
                  title: 'Error',
                  description: error instanceof Error ? error.message : 'Failed to save sale',
                  variant: 'destructive',
                })
              } finally {
                setIsProcessingSale(false)
              }
            }}
            customer={selectedCustomer}
            loyaltyRedemption={loyaltyRedemption}
            onRedemptionPointsChange={(points) => {
              setLoyaltyRedemption((current) => {
                if (!current.eligible) {
                  return {
                    ...current,
                    pointsToRedeem: 0,
                    redemptionDiscount: 0,
                  }
                }

                const safePoints = Math.max(
                  0,
                  Math.min(Math.floor(points || 0), current.maxRedeemablePoints)
                )

                return {
                  ...current,
                  pointsToRedeem: safePoints,
                  redemptionDiscount: Math.round(
                    safePoints * current.redeemValueCents
                  ),
                }
              })
            }}
          />
          </div>
        </div>
        {showRecent && (
          <div className="absolute right-0 top-0 bottom-0 z-40">
            <RecentTransactions onClose={() => setShowRecent(false)} />
          </div>
        )}
      </div>

      {/* Hold Sale Dialog */}
      <Dialog open={showHoldDialog} onOpenChange={(open) => { if (!open && !isHoldingSale) { setShowHoldDialog(false); setHoldNotes("") } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Pause className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              Hold Sale
            </DialogTitle>
            <DialogDescription>
              Save the current cart so you can resume it later. The cart will be cleared
              for the next customer.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="rounded-lg bg-muted/30 p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Items</span>
                <span>{cart.length} lines, {cart.reduce((s, i) => s + i.quantity, 0)} units</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-semibold">{formatKSh(total)}</span>
              </div>
              {selectedCustomer && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer</span>
                  <span>{selectedCustomer.name}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="holdNotes">Notes (optional)</Label>
              <Input
                id="holdNotes"
                placeholder="e.g. Customer went to get more money"
                value={holdNotes}
                onChange={(e) => setHoldNotes(e.target.value)}
                disabled={isHoldingSale}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setShowHoldDialog(false); setHoldNotes("") }}
              disabled={isHoldingSale}
            >
              Cancel
            </Button>
            <Button
              onClick={handleHoldSale}
              disabled={isHoldingSale}
            >
              {isHoldingSale ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Holding Sale...
                </>
              ) : (
                <>
                  <Pause className="h-4 w-4 mr-2" />
                  Hold Sale
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Shift Dialog */}
      <QuickShiftDialog
        mode={shiftDialogMode}
        activeShift={activeShift}
        cashierName={profile?.full_name || 'Cashier'}
        open={showShiftDialog}
        onOpenChange={(open) => {
          setShowShiftDialog(open)
          if (!open) {
            setShiftGateOpen(false)
          }
        }}
        onOpenShift={openNewShift as any}
        onCloseShift={closeActiveShift}
        registers={registers}
        onCreateRegister={handleCreateRegister}
      />

      {/* Held Sales Dialog — Enhanced */}
      <Dialog open={showHeldSales} onOpenChange={setShowHeldSales}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col overflow-hidden p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                <Archive className="h-4 w-4" />
              </div>
              Held Sales
            </DialogTitle>
            <DialogDescription>
              {heldSales.length} sale{heldSales.length !== 1 ? 's' : ''} on hold. Click Resume to restore to the cart.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 pb-6 min-h-0">
            {heldSalesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : heldSalesError ? (
              <div className="text-center py-8 text-sm text-destructive">
                {heldSalesError}
              </div>
            ) : heldSales.length === 0 ? (
              <div className="text-center py-8">
                <Archive className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                <EmptyState title="No sales on hold" compact />
              </div>
            ) : (
              <div className="space-y-2">
                {[...heldSales]
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .map((sale) => {
                    const heldDuration = getHeldDuration(sale.created_at)
                    return (
                      <div
                        key={sale.id}
                        className="p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            {/* Customer Avatar */}
                            <div className={`rounded-full p-2 shrink-0 ${
                              heldDuration === 'critical' ? 'bg-red-100' :
                              heldDuration === 'long' ? 'bg-amber-100' : 'bg-blue-100'
                            }`}>
                              <User className={`h-4 w-4 ${
                                heldDuration === 'critical' ? 'text-red-600' :
                                heldDuration === 'long' ? 'text-amber-600' : 'text-blue-600'
                              }`} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs text-muted-foreground">
                                  {sale.receipt_number}
                                </span>
                                <HeldTimeBadge createdAt={sale.created_at} />
                                {sale.customer_name && (
                                  <Badge variant="secondary" className="text-[10px]">
                                    {sale.customer_name}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm font-medium mt-1">
                                {sale.items.length} item{sale.items.length !== 1 ? 's' : ''}
                                {' '}&middot; <span className="font-semibold">{formatKSh(sale.total_amount)}</span>
                              </p>
                              {sale.hold_notes && (
                                <p className="text-xs text-muted-foreground mt-1 italic line-clamp-1">
                                  &ldquo;{sale.hold_notes}&rdquo;
                                </p>
                              )}
                              <p className="text-[10px] text-muted-foreground mt-1">
                                {new Date(sale.created_at).toLocaleString('en-KE')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button
                              size="sm"
                              onClick={() => handleResumeHeldSale(sale)}
                              title="Resume this sale"
                            >
                              <Play className="h-3.5 w-3.5 mr-1" />
                              Resume
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleCancelHeldSale(sale.id)}
                              className="text-muted-foreground hover:text-destructive"
                              title="Discard this held sale"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Keyboard Shortcuts Help ────────────────────────────────────── */}
      <Dialog open={showShortcuts} onOpenChange={setShowShortcuts}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                <Keyboard className="h-4 w-4" />
              </div>
              Keyboard Shortcuts
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {[
              { keys: 'Ctrl + K', label: 'Focus product search' },
              { keys: 'Ctrl + L', label: 'Open customer lookup' },
              { keys: 'Ctrl + N', label: 'New transaction (clear cart)' },
              { keys: 'Ctrl + Enter', label: 'Open checkout / payment' },
              { keys: 'Ctrl + Shift + P', label: 'Quick product create' },
              { keys: 'F2', label: 'Hold current sale' },
              { keys: 'F3', label: 'Open Returns page' },
              { keys: 'F1', label: 'Toggle this help' },
              { keys: 'Esc', label: 'Close sidebar / dialogs' },
            ].map((shortcut) => (
              <div key={shortcut.keys} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{shortcut.label}</span>
                <kbd className="px-2 py-1 text-xs font-mono font-semibold rounded border bg-muted">
                  {shortcut.keys}
                </kbd>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShortcuts(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Quick Product Create Dialog ────────────────────────────────── */}
      <Dialog open={showQuickCreate} onOpenChange={(open) => { if (!open && !quickCreateSaving) setShowQuickCreate(false) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Package className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              Quick Create Product
            </DialogTitle>
            <DialogDescription>
              Create a new product and add it to the current cart immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="qc-name">Product Name</Label>
              <Input
                id="qc-name"
                placeholder="e.g. Fresh Milk 1L"
                value={quickCreateForm.name}
                onChange={(e) => setQuickCreateForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="qc-sku">SKU / Barcode</Label>
                <Input
                  id="qc-sku"
                  placeholder="Auto-generated if empty"
                  value={quickCreateForm.sku}
                  onChange={(e) => setQuickCreateForm((prev) => ({ ...prev, sku: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="qc-price">Selling Price (KES)</Label>
                <Input
                  id="qc-price"
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="e.g. 150"
                  value={quickCreateForm.price}
                  onChange={(e) => setQuickCreateForm((prev) => ({ ...prev, price: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuickCreate(false)} disabled={quickCreateSaving}>
              Cancel
            </Button>
            <Button onClick={handleQuickCreateSave} disabled={quickCreateSaving || !quickCreateForm.name.trim() || !quickCreateForm.price}>
              {quickCreateSaving ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</>
              ) : (
                <><Plus className="h-4 w-4 mr-2" /> Create & Add to Cart</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Price Override Approval Dialog ──────────────────────────────── */}
      <Dialog open={showApprovalDialog} onOpenChange={(open) => { if (!open) { setShowApprovalDialog(false); setPendingPriceOverride(null); setApprovalError(null) } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              Price Override Requires Approval
            </DialogTitle>
            <DialogDescription>
              {pendingPriceOverride && (
                <>A supervisor must approve the price change to {formatKSh(pendingPriceOverride.newPrice)}.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-lg bg-muted/30 p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Original Price</span>
                <span>{pendingPriceOverride ? formatKSh(cart.find(i => i.id === pendingPriceOverride.productId)?.price || 0) : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">New Price</span>
                <span className="font-semibold text-amber-600">{pendingPriceOverride ? formatKSh(pendingPriceOverride.newPrice) : '—'}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="approval-pin">Supervisor PIN</Label>
              <Input
                id="approval-pin"
                type="password"
                placeholder="Enter supervisor PIN"
                value={approvalPassword}
                onChange={(e) => { setApprovalPassword(e.target.value); setApprovalError(null) }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleApprovePriceOverride() }}
                autoFocus
              />
              {approvalError && <p className="text-xs text-destructive">{approvalError}</p>}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowApprovalDialog(false); setPendingPriceOverride(null); setApprovalError(null) }}>
              Cancel
            </Button>
            <Button onClick={handleApprovePriceOverride} disabled={!approvalPassword}>
              <Shield className="h-4 w-4 mr-2" />
              Approve Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </ErrorBoundary>
  )
}

// ─── Held Sale Helpers ─────────────────────────────────────────────────────────

function getHeldDuration(createdAt: string): 'recent' | 'long' | 'critical' {
  const diff = Date.now() - new Date(createdAt).getTime()
  const hours = diff / (1000 * 60 * 60)
  if (hours > 4) return 'critical'
  if (hours > 1) return 'long'
  return 'recent'
}

function HeldTimeBadge({ createdAt }: { createdAt: string }) {
  const [now, setNow] = useState(0)
  useEffect(() => { startTransition(() => { setNow(Date.now()) }) }, [])
  const diff = now - new Date(createdAt).getTime()
  const mins = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))

  let label: string
  let variant: 'default' | 'secondary' | 'outline' | 'destructive'

  if (mins < 1) { label = 'Just now'; variant = 'default' }
  else if (mins < 60) { label = `${mins}m ago`; variant = 'default' }
  else if (hours < 24) { label = `${hours}h ${mins % 60}m ago`; variant = 'secondary' }
  else { const days = Math.floor(hours / 24); label = `${days}d ago`; variant = 'destructive' }

  return <Badge variant={variant} className="text-[9px] px-1.5 py-0 h-4">{label}</Badge>
}
