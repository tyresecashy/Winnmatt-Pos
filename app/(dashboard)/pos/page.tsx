'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ProductSearch } from '@/components/pos/product-search'
import { ShoppingCart } from '@/components/pos/shopping-cart'
import { PaymentPanel } from '@/components/pos/payment-panel'
import { CustomerLookup } from '@/components/pos/customer-lookup'
import { RecentTransactions } from '@/components/pos/recent-transactions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Kbd } from '@/components/ui/kbd'
import { MapPin, User, Clock, Receipt } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useToast } from '@/components/ui/use-toast'
import { getProductsForPOS } from '@/lib/products-actions'
import { getRedemptionEligibility } from '@/lib/loyalty-actions'
import { createSale, getSaleById } from '@/lib/sales-actions'
import { completePaymentAction } from '@/lib/actions/complete-payment-action'
import { useReceiptSettings } from '@/hooks/use-receipt-settings'
import type { SaleItem } from '@/lib/sales-actions'
import type { SaleDetailsData } from '@/components/receipt-preview'

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

export default function POSPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const { settings: receiptSettings } = useReceiptSettings(profile?.branch_id ?? undefined)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const productRefreshPromiseRef = useRef<Promise<void> | null>(null)
  const lastProductRefreshAtRef = useRef(0)
  const postSaleRefreshTimeoutRef = useRef<number | null>(null)
  const [allProducts, setAllProducts] = useState<any[]>([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [cart, setCart] = useState<CartItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<SelectedCustomer | null>(null)
  const [isWholesale, setIsWholesale] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [cartDiscount, setCartDiscount] = useState(0)
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

  async function refreshProducts(
    showLoadingState: boolean = false,
    options?: {
      force?: boolean
      minIntervalMs?: number
    }
  ) {
    const branchId = profile?.branch_id
    if (!branchId) {
      setAllProducts([])
      setProductsLoading(false)
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
        console.error('Failed to load products:', error)
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
      void refreshProducts(false, { force: true })
    }, delayMs)
  }

  // Load and refresh products for live branch stock visibility
  useEffect(() => {
    let cancelled = false

    const loadProducts = async (showLoadingState: boolean = false) => {
      if (cancelled) return
      await refreshProducts(showLoadingState)
    }

    void loadProducts(true)

    const intervalId = window.setInterval(() => {
      void refreshProducts(false, { minIntervalMs: 10000 })
    }, 45000)

    const handleFocus = () => {
      void refreshProducts(false, { minIntervalMs: 10000 })
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
  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          allProducts
            .map((p) => p.category?.name)
            .filter(Boolean)
        )
      ).sort(),
    [allProducts]
  )

  // Score products for barcode/SKU matching: exact matches rank above fuzzy matches
  const getProductMatchScore = (product: any, searchTerm: string) => {
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
          const { score, isExactMatch } = getProductMatchScore(product, searchTerm)
          return { ...product, _matchScore: score, _isExactMatch: isExactMatch }
        })
        .filter((product) => {
          const matchesSearch = product._matchScore > 0
          const noSearch = !searchTerm
          const matchesCategory = !selectedCategory || product.category?.name === selectedCategory
          return (matchesSearch || noSearch) && matchesCategory
        })
        .sort((a, b) => (b._matchScore || 0) - (a._matchScore || 0)),
    [allProducts, searchTerm, selectedCategory]
  )

  const addToCart = (productId: string, isExactMatch: boolean = false) => {
    const product = allProducts.find((p) => p.id === productId)
    if (!product) return
    
    // Prevent adding out-of-stock items
    if (product.quantity <= 0) return

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
          price: isWholesale ? Math.round(product.selling_price * 0.85) : product.selling_price,
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
    setCart((prev) =>
      prev.map((item) =>
        item.id === productId ? { ...item, discount } : item
      )
    )
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
    // Focus search input after clearing cart
    setTimeout(() => {
      searchInputRef.current?.focus()
    }, 0)
  }

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const itemDiscounts = cart.reduce((sum, item) => sum + item.discount * item.quantity, 0)
  const totalDiscount = itemDiscounts + cartDiscount
  const total = Math.max(0, subtotal - totalDiscount)

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
          Math.round(total * 100)
        )

        if (cancelled || !eligibility) {
          return
        }

        setLoyaltyRedemption((current) => {
          const nextPoints = eligibility.eligible
            ? Math.min(current.pointsToRedeem, eligibility.maxRedeemablePoints)
            : 0
          const nextDiscount = Math.round(
            (nextPoints * eligibility.redeemValueCents) / 100
          )

          return {
            loading: false,
            eligible: eligibility.eligible,
            reason: eligibility.reason || null,
            currentBalance: eligibility.currentBalance,
            maxRedeemablePoints: eligibility.maxRedeemablePoints,
            maxRedeemableDiscount: Math.round(
              eligibility.maxRedeemableDiscount / 100
            ),
            redeemValueCents: eligibility.redeemValueCents,
            pointsToRedeem: nextPoints,
            redemptionDiscount: nextDiscount,
          }
        })
      } catch (error) {
        if (cancelled) {
          return
        }

        console.error('[POS] Failed to load redemption eligibility:', error)
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
        setSearchTerm('')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showRecent, cart.length])

  const buildReceiptData = (sale: any): SaleDetailsData => ({
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
    branchSettings: receiptSettings?.branchSettings,
  })

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* POS Header */}
      <div role="region" aria-label="Point of Sale header" className="flex items-center justify-between px-4 py-3 bg-card border-b">
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
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground">
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

      {/* Main Content - Single Column: Search + Cart */}
      <div className="flex flex-1 overflow-hidden gap-0">
        {/* Left: Search Bar + Results */}
        <div role="region" aria-label="Product search and selection" className="flex-1 flex flex-col bg-card border-r overflow-hidden max-w-md">
          {productsLoading && allProducts.length === 0 ? (
            <div className="p-4 space-y-3">
              <Skeleton className="h-10 w-full" />
              <div className="flex gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-7 w-16 rounded-full" />
                ))}
              </div>
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <ProductSearch
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
            />
          )}
        </div>

        {/* Right: Cart & Checkout (Primary Focus) */}
        <div role="region" aria-label="Cart and checkout" className="flex-1 flex flex-col bg-card overflow-hidden min-h-0">
          <CustomerLookup
            selectedCustomer={selectedCustomer}
            onSelectCustomer={setSelectedCustomer}
            loyaltyRedeemValue={loyaltyRedemption.redeemValueCents}
          />

          {/* Cart Section - Grows to fill available space */}
          <div className="flex-1 overflow-hidden min-h-0">
            <ShoppingCart
              items={cart}
              onUpdateQuantity={updateQuantity}
              onUpdateDiscount={updateItemDiscount}
              onRemoveItem={removeFromCart}
              onClearCart={clearCart}
              onHoldSale={() => {
                // Hold sale feature disabled for this phase
              }}
              allProducts={allProducts}
              searchInputRef={searchInputRef}
            />
          </div>

          {/* Payment Section - Fixed height */}
          <div className="flex-shrink-0">
            <PaymentPanel
            subtotal={subtotal}
            itemDiscounts={itemDiscounts}
            cartDiscount={cartDiscount}
            onCartDiscountChange={setCartDiscount}
            total={total}
            showPayment={showPayment}
            onShowPayment={setShowPayment}
            fullSaleData={fullSaleData}
            onReceiptClose={() => {
              // Receipt has been viewed/printed, clear everything for next transaction
              setCart([])
              setSelectedCustomer(null)
              setCartDiscount(0)
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
            onCompletePayment={async (receiptNumber, paymentMethod, options) => {
              if (paymentMethod === 'mpesa' && options?.skipSaleCreation && options?.saleId) {
                const fullSale = await getSaleById(options.saleId)

                if (!fullSale || !fullSale.id) {
                  throw new Error('Failed to load the confirmed M-Pesa sale. Please check recent sales.')
                }

                setFullSaleData(buildReceiptData(fullSale))

                toast({
                  title: 'M-Pesa Payment Confirmed',
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
                  discountPercent: item.discount > 0 ? Math.round((item.discount / item.price) * 100) : 0,
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
                  )

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

                if (paymentMethod !== 'cash') {
                  throw new Error('Unsupported payment method')
                }

                const paymentResult = await completePaymentAction({
                  branchId: profile.branch_id,
                  cashierId: profile.id,
                  items: saleItems,
                  paymentMethod: 'cash',
                  customerId: selectedCustomer?.id,
                  cartDiscount,
                  receiptSettings: (receiptSettings ?? {}) as Record<string, unknown>,
                  redemptionPoints: options?.redemption?.pointsToRedeem || undefined,
                  redemptionDiscount: options?.redemption?.discountApplied || undefined,
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
                console.error('[POS] Failed to complete sale:', error)
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
            branchId={profile?.branch_id ?? undefined}
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
                    (safePoints * current.redeemValueCents) / 100
                  ),
                }
              })
            }}
          />
          </div>
        </div>

        {/* Recent Transactions Sidebar */}
        {showRecent && (
          <div role="region" aria-label="Recent transactions">
            <RecentTransactions onClose={() => setShowRecent(false)} />
          </div>
        )}
      </div>
    </div>
  )
}
