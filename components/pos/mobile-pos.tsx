'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { 
  ShoppingCart, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  X,
  CreditCard,
  Banknote,
  Smartphone,
  ArrowRight,
  User,
  Tag,
  Package,
  AlertTriangle,
} from 'lucide-react'
import { formatKSh } from '@/lib/currency'
import { useToast } from '@/hooks/use-toast'

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface Product {
  id: string
  name: string
  sku: string
  barcode: string | null
  selling_price: number
  image_url: string | null
  stock_quantity: number
  category: string
}

interface CartItem {
  id: string
  product: Product
  quantity: number
  unit_price: number
  total: number
}

interface MobilePOSProps {
  products: Product[]
  onCheckout: (items: CartItem[], paymentMethod: string) => Promise<void>
}

// â”€â”€â”€ Mobile POS Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function MobilePOS({ products, onCheckout }: MobilePOSProps) {
  const { toast } = useToast()
  const searchInputRef = useRef<HTMLInputElement>(null)
  
  const [cart, setCart] = useState<CartItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showCart, setShowCart] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  
  // Filter products based on search
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.barcode && p.barcode.includes(searchQuery))
  )

  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + item.total, 0)
  const tax = Math.round(subtotal * 0.16) // 16% VAT
  const total = subtotal + tax

  // Add product to cart
  const addToCart = useCallback((product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id)
      
      if (existing) {
        // Update quantity
        return prev.map(item => 
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.unit_price }
            : item
        )
      } else {
        // Add new item
        return [...prev, {
          id: `${product.id}-${Date.now()}`,
          product,
          quantity: 1,
          unit_price: product.selling_price,
          total: product.selling_price,
        }]
      }
    })
    
    // Clear search
    setSearchQuery('')
    searchInputRef.current?.focus()
    
    toast({
      title: 'Added to cart',
      description: `${product.name} added`,
      duration: 1000,
    })
  }, [])

  // Update quantity
  const updateQuantity = useCallback((itemId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === itemId) {
        const newQuantity = Math.max(1, item.quantity + delta)
        return {
          ...item,
          quantity: newQuantity,
          total: newQuantity * item.unit_price,
        }
      }
      return item
    }))
  }, [])

  // Remove from cart
  const removeFromCart = useCallback((itemId: string) => {
    setCart(prev => prev.filter(item => item.id !== itemId))
  }, [])

  // Clear cart
  const clearCart = useCallback(() => {
    setCart([])
    setShowPayment(false)
  }, [])

  // Handle checkout
  const handleCheckout = async (paymentMethod: string) => {
    if (cart.length === 0) return
    
    setIsProcessing(true)
    try {
      await onCheckout(cart, paymentMethod)
      setCart([])
      setShowPayment(false)
      setShowCart(false)
      toast({
        title: 'Sale Complete',
        description: 'Transaction processed successfully',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to process sale',
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Keyboard shortcut for barcode scanning
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus search on any alphanumeric key when not in input
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        const target = e.target as HTMLElement
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          searchInputRef.current?.focus()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b bg-card">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          <span className="font-semibold">POS</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCart(!showCart)}
          className="relative"
        >
          <ShoppingCart className="h-4 w-4 mr-2" />
          Cart
          {cart.length > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {cart.length}
            </Badge>
          )}
        </Button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Products Grid */}
        <div className={`flex-1 flex flex-col ${showCart ? 'hidden md:flex' : 'flex'}`}>
          {/* Search Bar */}
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Scan barcode or search products..."
                className="pl-10 h-12 text-lg"
                autoFocus
              />
            </div>
          </div>

          {/* Products Grid */}
          <ScrollArea className="flex-1 p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="aspect-square flex flex-col items-center justify-center p-3 rounded-lg border bg-card hover:bg-accent hover:text-accent-foreground transition-colors touch-manipulation"
                >
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-16 object-contain mb-2"
                    />
                  ) : (
                    <Package className="w-12 h-12 text-muted-foreground mb-2" />
                  )}
                  <span className="text-xs font-medium text-center line-clamp-2">
                    {product.name}
                  </span>
                  <span className="text-sm font-bold mt-1">
                    {formatKSh(product.selling_price)}
                  </span>
                  {product.stock_quantity <= 0 && (
                    <Badge variant="destructive" className="text-[10px] mt-1">
                      Out of Stock
                    </Badge>
                  )}
                  {product.stock_quantity > 0 && product.stock_quantity <= 5 && (
                    <Badge variant="secondary" className="text-[10px] mt-1">
                      Low Stock
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Cart Sidebar */}
        <div className={`${showCart ? 'flex' : 'hidden md:flex'} flex-col w-full md:w-96 border-l bg-card`}>
          {/* Cart Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="font-semibold">Current Order</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCart(false)}
              className="md:hidden"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Cart Items */}
          <ScrollArea className="flex-1 p-4">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <ShoppingCart className="h-12 w-12 mb-4 opacity-50" />
                <p>Cart is empty</p>
                <p className="text-sm">Tap products to add</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-background"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.product.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatKSh(item.unit_price)} Ã— {item.quantity}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateQuantity(item.id, -1)}
                        className="h-8 w-8 p-0"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-8 text-center font-medium">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateQuantity(item.id, 1)}
                        className="h-8 w-8 p-0"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFromCart(item.id)}
                        className="h-8 w-8 p-0 text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Cart Footer */}
          {cart.length > 0 && (
            <div className="border-t p-4 space-y-4">
              {/* Totals */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{formatKSh(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>VAT (16%)</span>
                  <span>{formatKSh(tax)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>{formatKSh(total)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={clearCart}
                  className="h-12"
                >
                  Clear
                </Button>
                <Button
                  onClick={() => setShowPayment(true)}
                  className="h-12"
                >
                  Pay
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {showPayment && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end md:items-center justify-center">
          <div className="bg-card w-full max-w-md rounded-t-xl md:rounded-xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Select Payment</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPayment(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Total Display */}
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Total Amount</p>
              <p className="text-3xl font-bold">{formatKSh(total)}</p>
            </div>

            {/* Payment Methods */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-20 flex flex-col items-center justify-center gap-2"
                onClick={() => handleCheckout('cash')}
                disabled={isProcessing}
              >
                <Banknote className="h-6 w-6" />
                <span>Cash</span>
              </Button>
              <Button
                variant="outline"
                className="h-20 flex flex-col items-center justify-center gap-2"
                onClick={() => handleCheckout('mpesa')}
                disabled={isProcessing}
              >
                <Smartphone className="h-6 w-6" />
                <span>M-Pesa</span>
              </Button>
              <Button
                variant="outline"
                className="h-20 flex flex-col items-center justify-center gap-2"
                onClick={() => handleCheckout('card')}
                disabled={isProcessing}
              >
                <CreditCard className="h-6 w-6" />
                <span>Card</span>
              </Button>
              <Button
                variant="outline"
                className="h-20 flex flex-col items-center justify-center gap-2"
                onClick={() => handleCheckout('credit')}
                disabled={isProcessing}
              >
                <Tag className="h-6 w-6" />
                <span>Credit</span>
              </Button>
            </div>

            {isProcessing && (
              <div className="text-center">
                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                <p className="text-sm text-muted-foreground mt-2">Processing...</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
