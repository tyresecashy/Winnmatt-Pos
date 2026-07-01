'use client'

import { useState } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronUp, AlertTriangle, Loader2, AlertCircle } from 'lucide-react'
import { formatKSh } from '@/lib/currency'

interface Product {
  id: string
  name: string
  sku: string
  selling_price: number
  category?: { name: string }
  quantity: number
  reorder_level: number
}

interface ProductListProps {
  products: Product[]
  onAddToCart: (productId: string) => void
  isWholesale: boolean
  isLoading?: boolean
}

export function ProductList({ products, onAddToCart, isWholesale, isLoading }: ProductListProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (isLoading) {
    return (
      <div className="border-b p-3">
        <div className="flex items-center justify-center gap-2 py-8">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">Loading products...</span>
        </div>
      </div>
    )
  }

  const getStockStatus = (quantity: number, reorderLevel: number) => {
    if (quantity <= 0) return { status: 'out-of-stock', label: 'Out of Stock', color: 'bg-destructive/10 text-destructive' }
    if (quantity < reorderLevel) return { status: 'low-stock', label: `Low Stock (${quantity})`, color: 'bg-warning/10 text-warning' }
    return { status: 'in-stock', label: `In Stock (${quantity})`, color: 'bg-success/10 text-success' }
  }

  return (
    <div className="border-b bg-muted/30">
      {/* Toggle Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full h-10 px-3 flex items-center justify-between text-sm font-medium hover:bg-muted transition-colors"
      >
        <span>
          Products ({products.length})
        </span>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      {/* Expanded Products List */}
      {isExpanded && (
        <ScrollArea className="h-[300px]">
          <div className="divide-y">
            {products.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                <AlertTriangle className="h-5 w-5 mx-auto mb-2 opacity-50" />
                No products available
              </div>
            ) : (
              products.map((product) => {
                const displayPrice = isWholesale
                  ? Math.round(product.selling_price * 0.85)
                  : product.selling_price
                const stockStatus = getStockStatus(product.quantity, product.reorder_level)
                const isOutOfStock = product.quantity <= 0

                return (
                  <div
                    key={product.id}
                    onClick={() => !isOutOfStock && onAddToCart(product.id)}
                    className={`p-3 flex items-center justify-between transition-all duration-150 border-l-4 border-transparent ${
                      isOutOfStock
                        ? 'opacity-50 cursor-not-allowed bg-muted/20'
                        : 'cursor-pointer active:scale-95 hover:bg-primary/10 dark:hover:bg-primary/20 hover:border-primary hover:shadow-sm'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.sku}</p>
                      <div className="flex items-center gap-2 mt-2">
                        {product.category && (
                          <Badge variant="outline" className="text-[10px]">
                            {product.category.name}
                          </Badge>
                        )}
                        <Badge variant="outline" className={`text-[10px] ${stockStatus.color}`}>
                          {stockStatus.label}
                        </Badge>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0 ml-2">
                      <p className={`text-xs font-bold ${isOutOfStock ? 'text-muted-foreground' : ''}`}>{formatKSh(displayPrice)}</p>
                      {isWholesale && (
                        <p className="text-[10px] text-muted-foreground line-through">
                          {formatKSh(product.selling_price)}
                        </p>
                      )}
                    </div>
                    
                    {isOutOfStock && (
                      <div className="ml-2">
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
