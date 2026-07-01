"use client"

import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, X, ChevronDown } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { forwardRef, useCallback, useState } from "react"
import { formatKSh } from "@/lib/currency"

interface Product {
  id: string
  name: string
  sku: string
  quantity: number
  selling_price: number
  category?: { name: string }
}

interface ProductSearchProps {
  searchTerm: string
  onSearchChange: (value: string) => void
  selectedCategory: string | null
  onCategoryChange: (category: string | null) => void
  isWholesale: boolean
  onWholesaleToggle: (value: boolean) => void
  categories: (string | null)[]
  filteredProducts?: Product[]
  onAddToCart?: (productId: string) => void
}

export const ProductSearch = forwardRef<HTMLInputElement, ProductSearchProps>(
  (
    {
      searchTerm,
      onSearchChange,
      selectedCategory,
      onCategoryChange,
      isWholesale,
      onWholesaleToggle,
      categories,
      filteredProducts = [],
      onAddToCart,
    },
    ref
  ) => {
    const [showCategories, setShowCategories] = useState(false)

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
      // Esc: Clear search
      if (e.key === "Escape") {
        e.preventDefault()
        onSearchChange("")
        return
      }
    }, [onSearchChange])

    const displayPrice = (product: Product) => 
      isWholesale ? Math.round(product.selling_price * 0.85) : product.selling_price

    return (
      <div className="space-y-3 p-4 bg-card border-b">
        {/* Search bar and controls */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={ref}
              placeholder="Search products, SKU, or scan barcode..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-9 pr-10"
              autoFocus
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear product search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 pl-2 border-l">
            <Switch
              id="wholesale-mode"
              checked={isWholesale}
              onCheckedChange={onWholesaleToggle}
            />
            <Label
              htmlFor="wholesale-mode"
              className={`text-sm font-medium cursor-pointer ${
                isWholesale ? "text-primary" : "text-muted-foreground"
              }`}
            >
              Wholesale
            </Label>
          </div>
        </div>

        {/* Category filter bar */}
        <div className="flex items-center gap-2">
          <Badge
            variant={!selectedCategory ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => onCategoryChange(null)}
          >
            All
          </Badge>
          {categories.slice(0, 5).map((category) => (
            <Badge
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => onCategoryChange(category)}
            >
              {category}
            </Badge>
          ))}
          {categories.length > 5 && (
            <button
              type="button"
              onClick={() => setShowCategories(!showCategories)}
              className="text-xs text-muted-foreground hover:text-foreground"
              aria-label={showCategories ? "Hide more categories" : "Show more categories"}
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${showCategories ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>

        {showCategories && categories.length > 5 && (
          <div className="flex flex-wrap items-center gap-2">
            {categories.slice(5).map((category) => (
              <Badge
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => onCategoryChange(category)}
              >
                {category}
              </Badge>
            ))}
          </div>
        )}

        {/* Search results - show only when there's a search term or products to display */}
        {(searchTerm || filteredProducts.length > 0) && (
          <ScrollArea className="h-auto max-h-[300px] border rounded-lg bg-muted/30">
            <div className="divide-y">
              {filteredProducts.length === 0 && searchTerm ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No products found
                </div>
              ) : (
                filteredProducts.map((product) => {
                  const isOutOfStock = product.quantity <= 0
                  return (
                    <div
                      key={product.id}
                      onClick={() => !isOutOfStock && onAddToCart?.(product.id)}
                      className={`p-3 flex items-center justify-between cursor-pointer transition-all ${
                        isOutOfStock
                          ? 'opacity-50 cursor-not-allowed'
                          : 'hover:bg-primary/10 active:scale-98'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{product.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs text-muted-foreground">{product.sku}</p>
                          {product.category && (
                            <Badge variant="outline" className="text-xs">
                              {product.category.name}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right ml-4 flex-shrink-0">
                        <p className="font-bold text-primary">
                          {formatKSh(displayPrice(product))}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {isOutOfStock ? "Out of Stock" : `${product.quantity} in stock`}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
            <ScrollBar orientation="vertical" />
          </ScrollArea>
        )}
      </div>
    )
  }
)

ProductSearch.displayName = "ProductSearch"
