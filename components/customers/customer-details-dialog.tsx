"use client"
import { logger } from '@/lib/logger';

import { useState, useEffect } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Phone, Mail, Loader2, Calendar, ShoppingBag, Edit2 } from "lucide-react"
import { getCustomerPurchases } from "@/lib/customers-actions"

interface CustomerDetailsDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  customer: {
    id: string
    name: string
    phone?: string
    email?: string
    type: string
    loyalty_points: number
    credit_limit: number
    credit_balance: number
    created_at: string
    total_purchases?: number
    purchase_count?: number
  }
  onEdit: () => void
}

const customerTypeColors: Record<string, { bg: string; text: string }> = {
  retail: { bg: "bg-blue-100", text: "text-blue-700" },
  wholesale: { bg: "bg-green-100", text: "text-green-700" },
  business: { bg: "bg-purple-100", text: "text-purple-700" },
}

export function CustomerDetailsDialog({
  isOpen,
  onOpenChange,
  customer,
  onEdit,
}: CustomerDetailsDialogProps) {
  const [purchases, setPurchases] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const loadPurchases = async () => {
    setIsLoading(true)
    try {
      const data = await getCustomerPurchases(customer.id, 10)
      setPurchases(data)
    } catch (error) {
      logger.error("Failed to load purchases:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && customer?.id) {
      const timer = setTimeout(() => void loadPurchases())
      return () => clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, customer?.id])

  const colorScheme = customerTypeColors[customer.type] || customerTypeColors.retail

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle>Customer Profile</DialogTitle>
          <DialogDescription>View customer details and purchase history</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6">
          {/* Customer Header */}
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary/10 text-primary text-xl">
                {customer.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="text-lg font-semibold">{customer.name}</h3>
              <Badge className={`${colorScheme.bg} ${colorScheme.text} mt-1`}>
                {customer.type}
              </Badge>
            </div>
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Edit2 className="h-4 w-4 mr-1" />
              Edit
            </Button>
          </div>

          {/* Contact Information */}
          <div className="space-y-2 border-t pt-4">
            <h4 className="font-medium text-sm">Contact Information</h4>
            {customer.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{customer.phone}</span>
              </div>
            )}
            {customer.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{customer.email}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              Member since {new Date(customer.created_at).toLocaleDateString()}
            </div>
          </div>

          {/* Statistics */}
          <div className="border-t pt-4">
            <h4 className="font-medium text-sm mb-3">Account Summary</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Total Spent</p>
                <p className="text-lg font-bold">
                  KShs{" "}
                  {(customer.total_purchases || 0).toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Purchases</p>
                <p className="text-lg font-bold">{customer.purchase_count || 0}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Loyalty Points</p>
                <p className="text-lg font-bold">{customer.loyalty_points}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Credit Balance</p>
                <p className={`text-lg font-bold ${customer.credit_balance > 0 ? "text-red-600" : ""}`}>
                  KShs {Math.abs(customer.credit_balance).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Purchase History */}
          <div className="border-t pt-4">
            <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" />
              Recent Purchases
            </h4>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : purchases.length === 0 ? (
              <p className="text-sm text-muted-foreground">No purchases yet</p>
            ) : (
              <div className="space-y-2">
                {purchases.map((purchase) => (
                  <div key={purchase.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                    <div>
                      <p className="text-sm font-medium">{purchase.receipt_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {purchase.item_count} {purchase.item_count === 1 ? "item" : "items"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(purchase.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <p className="font-semibold">KShs {purchase.total_amount.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
