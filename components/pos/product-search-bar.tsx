"use client"

import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, X, ChevronDown, Package } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { forwardRef, useCallback, useState, useEffect, useRef } from "react"
import { formatKSh } from "@/lib/currency"
import { ScrollArea } from "@/components/ui/scroll-area"

interface Product {
  id: string
  name: string
  sku: string
  quantity: number
  selling_price?: number
  category?: { id: string; name: string; icon?: string } | null
  _matchScore?: number
  _isExactMatch?: boolean
}

interface ProductSearchBarProps {
  searchTerm: string
  onSearchChange: (value: string) => void
  selectedCategory: string | null
  onCategoryChange: (category: string | null) => void
  isWholesale: boolean
  onWholesaleToggle: (value: boolean) => void
  categories: (string | null)[]
  filteredProducts?: Product[]
  onAddToCart?: (productId: string) => void
  onQuickCreate?: () => void
}

export const ProductSearchBar = forwardRef<HTMLInputElement, ProductSearchBarProps>(
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
      onQuickCreate,
    },
    ref
  ) => {
    const [showCategories, setShowCategories] = useState(false)
    const [showResults, setShowResults] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    const displayPrice = (product: Product): number =>
      isWholesale ? Math.round((product.selling_price ?? 0) * 0.85) : (product.selling_price ?? 0)

    // Only show results when user has typed a search term
    useEffect(() => {
      if (searchTerm) {
        setShowResults(true)
      } else {
        setShowResults(false)
      }
    }, [searchTerm])

    // Close popup on outside click
    useEffect(() => {
      function handleClickOutside(e: MouseEvent) {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setShowResults(false)
        }
      }
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        e.preventDefault()
        setShowResults(false)
        onSearchChange("")
        return
      }
    }, [onSearchChange])

    const handleSelectProduct = useCallback((productId: string) => {
      onAddToCart?.(productId)
      setShowResults(false)
    }, [onAddToCart])

    return (
      <div ref={containerRef} className="relative w-full max-w-2xl mx-auto">
        {/* Search bar row */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={ref}
              placeholder="Search products, SKU, or scan barcode..."
              value={searchTerm}
              onChange={(e) => {
                onSearchChange(e.target.value)
                if (e.target.value) setShowResults(true)
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                if (searchTerm) {
                  setShowResults(true)
                }
              }}
              className="pl-8 pr-8 h-8 text-sm"
              autoFocus
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  onSearchChange("")
                  setShowResults(false)
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear product search"
              >
                <X className="h-3.5 w-3.5" />
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
              className={`text-sm font-medium cursor-pointer whitespace-nowrap ${
                isWholesale ? "text-primary" : "text-muted-foreground"
              }`}
            >
              Wholesale
            </Label>
          </div>
        </div>

        {/* Category filter bar */}
        <div className="flex items-center gap-1.5 mt-1.5">
          <Badge
            variant={!selectedCategory ? "default" : "outline"}
            className="cursor-pointer text-[10px] px-1.5 py-0 h-5"
            onClick={() => onCategoryChange(null)}
          >
            All
          </Badge>
          {categories.slice(0, 5).map((category) => (
            <Badge
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              className="cursor-pointer text-[10px] px-1.5 py-0 h-5"
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
          <div className="flex flex-wrap items-center gap-2 mt-2">
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

        {/* Product results dropdown */}
        {showResults && (
          <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-card border rounded-lg shadow-xl max-h-[50vh] overflow-hidden flex flex-col">
            {filteredProducts.length === 0 && searchTerm ? (
              <div className="p-6 text-center">
                <Package className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground mb-3">No products found for &ldquo;{searchTerm}&rdquo;</p>
                {onQuickCreate && (
                  <button
                    type="button"
                    onClick={onQuickCreate}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    <span className="text-lg leading-none">+</span>
                    Quick Create &ldquo;{searchTerm}&rdquo;
                  </button>
                )}
              </div>
            ) : (
              <ScrollArea className="max-h-[50vh]">
                <div className="divide-y">
                  {filteredProducts.map((product) => {
                    const isOutOfStock = product.quantity <= 0
                    const displayPriceFormatted = formatKSh(displayPrice(product))
                    return (
                      <div
                        key={product.id}
                        onClick={() => !isOutOfStock && handleSelectProduct(product.id)}
                        className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-all ${
                          isOutOfStock
                            ? 'opacity-50 cursor-not-allowed bg-muted/10'
                            : 'hover:bg-primary/5 active:scale-[0.99]'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{product.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-xs text-muted-foreground">{product.sku}</p>
                            {product.category && (
                              <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                                {product.category.name}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right ml-3 flex-shrink-0 min-w-[80px]">
                          <p className="font-bold text-primary text-sm">{displayPriceFormatted}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {isOutOfStock ? "Out of Stock" : `${product.quantity} left`}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        )}
      </div>
    )
  }
)

ProductSearchBar.displayName = "ProductSearchBar"
