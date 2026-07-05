"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, Plus, Minus } from "lucide-react"
import { adjustInventoryStock } from "@/lib/inventory-actions"

interface StockAdjustmentDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  product: {
    id: string
    name: string
    sku: string
    quantity: number
  }
  inventoryId: string
  branchId: string
  onAdjustmentSuccess: () => void
}

export function StockAdjustmentDialog({
  isOpen,
  onOpenChange,
  product,
  inventoryId,
  branchId,
  onAdjustmentSuccess,
}: StockAdjustmentDialogProps) {
  const [adjustmentType, setAdjustmentType] = useState<"increase" | "decrease" | "set">("increase")
  const [quantity, setQuantity] = useState("")
  const [reason, setReason] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleAdjust = async () => {
    // Validation
    const qty = parseInt(quantity)
    if (isNaN(qty) || qty === 0) {
      toast({
        title: "Invalid quantity",
        description: "Please enter a valid number",
        variant: "destructive",
      })
      return
    }

    if (!reason.trim()) {
      toast({
        title: "Reason required",
        description: "Please provide a reason for this adjustment",
        variant: "destructive",
      })
      return
    }

    // Validation: For decrease/set, check against current stock
    if (adjustmentType === "decrease" && qty > product.quantity) {
      toast({
        title: "Invalid adjustment",
        description: `Cannot decrease by ${qty}. Only ${product.quantity} units available.`,
        variant: "destructive",
      })
      return
    }

    if (adjustmentType === "set" && qty < 0) {
      toast({
        title: "Invalid quantity",
        description: "Quantity cannot be negative",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      let adjustmentQuantity = qty
      if (adjustmentType === "decrease") {
        adjustmentQuantity = -qty
      } else if (adjustmentType === "set") {
        // Calculate the difference
        adjustmentQuantity = qty - product.quantity
      }

      const result = await adjustInventoryStock(
        inventoryId,
        product.id,
        branchId,
        adjustmentQuantity,
        reason
      )

      if (!result.success) {
        throw new Error(result.error || "Failed to adjust stock")
      }

      toast({
        title: "Stock adjusted",
        description: result.message || `Stock updated successfully`,
        variant: "default",
      })

      // Reset form
      setQuantity("")
      setReason("")
      setAdjustmentType("increase")
      onOpenChange(false)

      // Refresh inventory
      onAdjustmentSuccess()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to adjust stock",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Adjust Stock</DialogTitle>
          <DialogDescription>
            {product.name} ({product.sku}) - Current stock: <span className="font-semibold">{product.quantity}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Adjustment Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Adjustment Type</label>
            <Select value={adjustmentType} onValueChange={(value: string) => setAdjustmentType(value as 'set' | 'increase' | 'decrease')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="increase">
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Increase Stock
                  </div>
                </SelectItem>
                <SelectItem value="decrease">
                  <div className="flex items-center gap-2">
                    <Minus className="h-4 w-4" />
                    Decrease Stock
                  </div>
                </SelectItem>
                <SelectItem value="set">
                  <div className="flex items-center gap-2">
                    Set to Exact Quantity
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Quantity Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {adjustmentType === "set" ? "New Quantity" : "Quantity to " + (adjustmentType === "increase" ? "Add" : "Remove")}
            </label>
            <Input
              type="number"
              min={adjustmentType === "set" ? "0" : "1"}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={adjustmentType === "set" ? "Enter exact quantity" : `Enter amount to ${adjustmentType}`}
              disabled={isLoading}
              autoFocus
            />
            {adjustmentType === "set" && quantity && !isNaN(parseInt(quantity)) && (
              <p className="text-xs text-muted-foreground">
                Change: {parseInt(quantity) - product.quantity > 0 ? "+" : ""}{parseInt(quantity) - product.quantity}
              </p>
            )}
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Reason / Notes</label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., 'Damage reported', 'Incoming shipment', 'Physical count adjustment'"
              disabled={isLoading}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">Required for audit trail</p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAdjust}
            disabled={isLoading || !quantity || !reason.trim()}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adjusting...
              </>
            ) : (
              "Confirm Adjustment"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
