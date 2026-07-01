"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Minus, Plus, Trash2, ShoppingCart as CartIcon, Percent } from "lucide-react"
import { formatKSh } from "@/lib/currency"
import type { CartItem, SelectedCustomer } from "@/app/(dashboard)/pos/page"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { useState } from "react"
import { RefObject } from "react"

interface ShoppingCartProps {
  items: CartItem[]
  onUpdateQuantity: (productId: string, quantity: number) => void
  onUpdateDiscount: (productId: string, discount: number) => void
  onRemoveItem: (productId: string) => void
  onClearCart: () => void
  onHoldSale: () => void
  allProducts?: any[]
  searchInputRef?: RefObject<HTMLInputElement | null>
}

export function ShoppingCart({
  items,
  onUpdateQuantity,
  onUpdateDiscount,
  onRemoveItem,
  onClearCart,
  onHoldSale,
  allProducts,
  searchInputRef,
}: ShoppingCartProps) {
  const [editingDiscount, setEditingDiscount] = useState<string | null>(null)
  const [discountValue, setDiscountValue] = useState("")
  const [editingQuantity, setEditingQuantity] = useState<string | null>(null)
  const [quantityValue, setQuantityValue] = useState("")
  const [quantityError, setQuantityError] = useState<{ [key: string]: string | null }>({})
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)

  const getMaxStock = (productId: string) => {
    return allProducts?.find((p) => p.id === productId)?.quantity || 0
  }

  const applyDiscount = (itemId: string) => {
    const value = parseFloat(discountValue) || 0
    onUpdateDiscount(itemId, value)
    setEditingDiscount(null)
    setDiscountValue("")
  }

  const applyQuantity = (itemId: string) => {
    const value = parseInt(quantityValue)
    const maxStock = getMaxStock(itemId)

    // Validation: Check for zero or negative
    if (value <= 0) {
      setQuantityError((prev) => ({ ...prev, [itemId]: "Quantity must be at least 1" }))
      return
    }

    // Validation: Check against available stock
    if (value > maxStock) {
      setQuantityError((prev) => ({ ...prev, [itemId]: `Only ${maxStock} in stock` }))
      return
    }

    // Valid: Apply quantity update
    onUpdateQuantity(itemId, value)
    setEditingQuantity(null)
    setQuantityValue("")
    setQuantityError((prev) => ({ ...prev, [itemId]: null }))

    // Focus search input after successful update
    setTimeout(() => {
      searchInputRef?.current?.focus()
    }, 0)
  }

  return (
    <div className="h-full flex flex-col overflow-hidden border-b">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30 flex-shrink-0">
        <div className="flex items-center gap-2">
          <CartIcon className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Cart</span>
          {itemCount > 0 && (
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              {items.length} {items.length === 1 ? 'line' : 'lines'}, {itemCount} units
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearCart}
            disabled={items.length === 0}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[200px] text-center p-4">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <CartIcon className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              Cart is empty
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Click on products to add them
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatKSh(item.price)} each
                    </p>
                    {item.discount > 0 && (
                      <Badge variant="secondary" className="mt-1 text-xs bg-success/10 text-success">
                        -{formatKSh(item.discount)} discount
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    {editingQuantity === item.id ? (
                      <div className="flex flex-col gap-1">
                        <Input
                          type="number"
                          min="1"
                          value={quantityValue}
                          onChange={(e) => {
                            setQuantityValue(e.target.value)
                            // Clear error when user types
                            setQuantityError((prev) => ({ ...prev, [item.id]: null }))
                          }}
                          onBlur={() => applyQuantity(item.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") applyQuantity(item.id)
                            if (e.key === "Escape") {
                              setEditingQuantity(null)
                              setQuantityError((prev) => ({ ...prev, [item.id]: null }))
                            }
                          }}
                          className="w-10 text-center text-sm font-medium h-7 p-1"
                          autoFocus
                        />
                        {quantityError[item.id] && (
                          <p className="text-xs text-destructive font-medium px-1">
                            {quantityError[item.id]}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span
                        onClick={() => {
                          setEditingQuantity(item.id)
                          setQuantityValue(item.quantity.toString())
                          // Clear any previous error for this item
                          setQuantityError((prev) => ({ ...prev, [item.id]: null }))
                        }}
                        className="w-8 text-center text-sm font-medium cursor-pointer hover:bg-muted rounded py-1 px-1 hover:shadow-sm transition-all"
                      >
                        {item.quantity}
                      </span>
                    )}
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                  <div className="flex items-center gap-1">
                    <Popover
                      open={editingDiscount === item.id}
                      onOpenChange={(open) => {
                        if (open) {
                          setEditingDiscount(item.id)
                          setDiscountValue(item.discount > 0 ? item.discount.toString() : "")
                        } else {
                          setEditingDiscount(null)
                        }
                      }}
                    >
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 text-xs">
                          <Percent className="h-3 w-3 mr-1" />
                          {item.discount > 0 ? "Edit" : "Add"} Discount
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56 p-3" align="start">
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Item Discount (KSh)</p>
                          <Input
                            type="number"
                            placeholder="Enter amount"
                            value={discountValue}
                            onChange={(e) => setDiscountValue(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && applyDiscount(item.id)}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="flex-1"
                              onClick={() => applyDiscount(item.id)}
                            >
                              Apply
                            </Button>
                            {item.discount > 0 && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  onUpdateDiscount(item.id, 0)
                                  setEditingDiscount(null)
                                }}
                              >
                                Remove
                              </Button>
                            )}
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => onRemoveItem(item.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-sm font-semibold text-primary">
                    {formatKSh((item.price - item.discount) * item.quantity)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
