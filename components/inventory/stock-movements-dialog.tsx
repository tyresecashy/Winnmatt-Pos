"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Loader2, History } from "lucide-react"
import { getStockMovements } from "@/lib/inventory-actions"

interface StockMovementsDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  product: {
    id: string
    name: string
    sku: string
  }
  branchId: string
}

interface Movement {
  id: string
  type: "sale" | "receipt" | "transfer" | "adjustment" | "damage"
  quantity: number
  reference_id: string | null
  notes: string | null
  created_at: string
}

const movementTypeLabels: Record<string, { label: string; color: string }> = {
  sale: { label: "Sale", color: "destructive" },
  receipt: { label: "Purchase Receipt", color: "default" },
  transfer: { label: "Transfer", color: "secondary" },
  adjustment: { label: "Adjustment", color: "outline" },
  damage: { label: "Damage", color: "warning" },
}

export function StockMovementsDialog({
  isOpen,
  onOpenChange,
  product,
  branchId,
}: StockMovementsDialogProps) {
  const [movements, setMovements] = useState<Movement[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const loadMovements = async () => {
    setIsLoading(true)
    try {
      const data = await getStockMovements(product.id, branchId)
      setMovements(data)
    } catch (error) {
      console.error("Failed to load stock movements:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => void loadMovements())
      return () => clearTimeout(timer)
    }
  }, [isOpen, product.id, branchId])

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Stock Movement History
          </DialogTitle>
          <DialogDescription>
            {product.name} ({product.sku})
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : movements.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground">No stock movements recorded</p>
            </div>
          ) : (
            <div className="space-y-3">
              {movements.map((movement) => {
                const typeInfo = movementTypeLabels[movement.type]
                const isIncrease = movement.quantity > 0
                const absQty = Math.abs(movement.quantity)

                return (
                  <div key={movement.id} className="border rounded-lg p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <Badge variant={typeInfo.color as any}>{typeInfo.label}</Badge>
                      <span className={`font-semibold ${isIncrease ? "text-green-600" : "text-red-600"}`}>
                        {isIncrease ? "+" : "-"}{absQty}
                      </span>
                    </div>
                    {movement.notes && (
                      <p className="text-sm text-muted-foreground">{movement.notes}</p>
                    )}
                    {movement.reference_id && (
                      <p className="text-xs text-muted-foreground">Ref: {movement.reference_id.substring(0, 8)}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(movement.created_at).toLocaleString()}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
