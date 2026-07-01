"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatKSh } from "@/lib/currency"
import { Plus, AlertTriangle } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"

interface Product {
  id: string
  name: string
  sku: string
  category: string
  price: number
  stock: { [key: string]: number }
}

interface ProductGridProps {
  products: Product[]
  onAddToCart: (productId: string) => void
  isWholesale: boolean
}

export function ProductGrid({ products, onAddToCart, isWholesale }: ProductGridProps) {
  const getStockStatus = (product: Product) => {
    const totalStock = Object.values(product.stock).reduce((a, b) => a + b, 0)
    if (totalStock === 0) return { status: "out", label: "Out of Stock", color: "destructive" }
    if (totalStock < 20) return { status: "low", label: `${totalStock} left`, color: "warning" }
    return { status: "ok", label: `${totalStock} in stock`, color: "secondary" }
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {products.map((product) => {
            const stockInfo = getStockStatus(product)
            const displayPrice = isWholesale ? Math.round(product.price * 0.85) : product.price

            return (
              <Card
                key={product.id}
                className={`group relative overflow-hidden cursor-pointer transition-all hover:shadow-md hover:border-primary/50 ${
                  stockInfo.status === "out" ? "opacity-60" : ""
                }`}
                onClick={() => stockInfo.status !== "out" && onAddToCart(product.id)}
              >
                <div className="p-3">
                  <div className="aspect-square rounded-lg bg-muted/50 mb-3 flex items-center justify-center relative overflow-hidden">
                    <span className="text-2xl font-bold text-muted-foreground/30">
                      {product.name.charAt(0)}
                    </span>
                    {stockInfo.status !== "out" && (
                      <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
                          <Plus className="h-5 w-5 text-primary-foreground" />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium line-clamp-2 leading-tight min-h-[2.5rem]">
                      {product.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{product.sku}</p>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-primary">
                        {formatKSh(displayPrice)}
                      </p>
                      {isWholesale && (
                        <span className="text-xs text-muted-foreground line-through">
                          {formatKSh(product.price)}
                        </span>
                      )}
                    </div>
                    <Badge
                      variant={stockInfo.color as "destructive" | "secondary"}
                      className={`text-xs ${
                        stockInfo.status === "low" ? "bg-warning/20 text-warning-foreground" : ""
                      }`}
                    >
                      {stockInfo.status === "low" && (
                        <AlertTriangle className="h-3 w-3 mr-1" />
                      )}
                      {stockInfo.label}
                    </Badge>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>

        {products.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <AlertTriangle className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium">No products found</p>
            <p className="text-sm text-muted-foreground">
              Try adjusting your search or filters
            </p>
          </div>
        )}
      </div>
    </ScrollArea>
  )
}
