"use client"

import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, X, ChevronDown, Package } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { forwardRef, useCallback, useState, useEffect, useRef } from "react"
import { formatKSh } from "@/lib/currency"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { EmptyState } from "@/components/ui/empty-state"

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
    const [selectedIndex, setSelectedIndex] = useState(-1)
    const containerRef = useRef<HTMLDivElement>(null)
    const resultItemRefs = useRef<Map<string, HTMLDivElement>>(new Map())

    // Cap results for keyboard nav
    const visibleProducts = filteredProducts.slice(0, 100)
    const hasResults = visibleProducts.length > 0

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

    // Reset selection when results change
    useEffect(() => {
      setSelectedIndex(-1)
    }, [searchTerm, filteredProducts.length])

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

    const handleSelectProduct = useCallback((productId: string) => {
      onAddToCart?.(productId)
      setShowResults(false)
      setSelectedIndex(-1)
    }, [onAddToCart])

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        e.preventDefault()
        setShowResults(false)
        onSearchChange("")
        setSelectedIndex(-1)
        return
      }

      if (!hasResults) return

      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex((prev) => {
          const next = prev < visibleProducts.length - 1 ? prev + 1 : 0
          // Scroll the item into view
          const product = visibleProducts[next]
          if (product) {
            const el = resultItemRefs.current.get(product.id)
            el?.scrollIntoView({ block: "nearest" })
          }
          return next
        })
        return
      }

      if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex((prev) => {
          const next = prev > 0 ? prev - 1 : visibleProducts.length - 1
          // Scroll the item into view
          const product = visibleProducts[next]
          if (product) {
            const el = resultItemRefs.current.get(product.id)
            el?.scrollIntoView({ block: "nearest" })
          }
          return next
        })
        return
      }

      if (e.key === "Enter" && selectedIndex >= 0 && selectedIndex < visibleProducts.length) {
        e.preventDefault()
        const product = visibleProducts[selectedIndex]
        const isOutOfStock = product.quantity <= 0
        if (!isOutOfStock) {
          handleSelectProduct(product.id)
        }
        return
      }
    }, [onSearchChange, hasResults, visibleProducts, selectedIndex, handleSelectProduct])

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
            {!hasResults && searchTerm ? (
              <div className="p-6 text-center">
                <Package className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                <EmptyState title={`No products found for "${searchTerm}"`} compact />
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
            ) : hasResults ? (
              <ScrollArea className="max-h-[50vh]">
                <div className="divide-y">
                  {visibleProducts.map((product, index) => {
                    const isOutOfStock = product.quantity <= 0
                    const isSelected = index === selectedIndex
                    const displayPriceFormatted = formatKSh(displayPrice(product))
                    return (
                      <div
                        key={product.id}
                        ref={(el) => {
                          if (el) {
                            resultItemRefs.current.set(product.id, el)
                          } else {
                            resultItemRefs.current.delete(product.id)
                          }
                        }}
                        onClick={() => !isOutOfStock && handleSelectProduct(product.id)}
                        className={cn(
                          "flex items-center justify-between px-4 py-3 cursor-pointer transition-all",
                          isOutOfStock && "opacity-50 cursor-not-allowed bg-muted/10",
                          !isOutOfStock && "active:scale-[0.99]",
                          isSelected && !isOutOfStock
                            ? "bg-primary/10 border-l-2 border-primary"
                            : !isOutOfStock && "hover:bg-primary/5"
                        )}
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
            ) : null}
          </div>
        )}
      </div>
    )
  }
)

ProductSearchBar.displayName = "ProductSearchBar"
