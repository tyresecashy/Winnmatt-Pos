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
import { formatKSh } from "@/lib/currency"
import { Phone, Mail, Loader2, Calendar, ShoppingBag, Edit2, Cake, StickyNote, Tag, Users } from "lucide-react"
import { getCustomerPurchases } from "@/lib/customers-actions"
import { getCustomerSegments } from "@/lib/segment-actions"
import type { Segment } from "@/lib/segment-actions"

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
    tier?: string
    birthday?: string | null
    notes?: string | null
    tags?: string[]
    total_lifetime_spend_cents?: number
    total_visits?: number
    last_purchase_date?: string | null
  }
  onEdit: () => void
}

const customerTypeColors: Record<string, { bg: string; text: string }> = {
  retail: { bg: "bg-blue-100", text: "text-blue-700" },
  wholesale: { bg: "bg-green-100", text: "text-green-700" },
  business: { bg: "bg-purple-100", text: "text-purple-700" },
}

const tierColors: Record<string, string> = {
  bronze: "bg-amber-100 text-amber-800",
  silver: "bg-slate-100 text-slate-700",
  gold: "bg-yellow-100 text-yellow-800",
  platinum: "bg-teal-100 text-teal-800",
  vip: "bg-purple-100 text-purple-800",
}

export function CustomerDetailsDialog({
  isOpen,
  onOpenChange,
  customer,
  onEdit,
}: CustomerDetailsDialogProps) {
  const [purchases, setPurchases] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [customerSegments, setCustomerSegmentsList] = useState<Segment[]>([])

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
      const timer = setTimeout(() => {
        void loadPurchases()
        void getCustomerSegments(customer.id).then(setCustomerSegmentsList)
      })
      return () => clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, customer?.id])

  const colorScheme = customerTypeColors[customer.type] || customerTypeColors.retail
  const tier = customer.tier || "bronze"

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[650px] flex flex-col">
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
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge className={`${colorScheme.bg} ${colorScheme.text}`}>
                  {customer.type}
                </Badge>
                <Badge variant="outline" className={tierColors[tier] || tierColors.bronze}>
                  {tier.charAt(0).toUpperCase() + tier.slice(1)}
                </Badge>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Edit2 className="h-4 w-4 mr-1" />
              Edit
            </Button>
          </div>

          {/* Tags */}
          {customer.tags && customer.tags.length > 0 && (
            <div className="border-t pt-4">
              <h4 className="font-medium text-sm mb-2 flex items-center gap-1">
                <Tag className="h-4 w-4" />
                Tags
              </h4>
              <div className="flex flex-wrap gap-1">
                {customer.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Segments */}
          {customerSegments.length > 0 && (
            <div className="border-t pt-4">
              <h4 className="font-medium text-sm mb-2 flex items-center gap-1">
                <Users className="h-4 w-4" />
                Segments
              </h4>
              <div className="flex flex-wrap gap-1">
                {customerSegments.map((seg) => (
                  <span
                    key={seg.id}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ backgroundColor: seg.color + '20', color: seg.color }}
                  >
                    {seg.name}
                  </span>
                ))}
              </div>
            </div>
          )}

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
            {customer.birthday && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Cake className="h-4 w-4" />
                Birthday: {new Date(customer.birthday).toLocaleDateString("en-KE", { month: "long", day: "numeric" })}
              </div>
            )}
          </div>

          {/* Notes */}
          {customer.notes && (
            <div className="border-t pt-4">
              <h4 className="font-medium text-sm mb-2 flex items-center gap-1">
                <StickyNote className="h-4 w-4" />
                Notes
              </h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{customer.notes}</p>
            </div>
          )}

          {/* Statistics */}
          <div className="border-t pt-4">
            <h4 className="font-medium text-sm mb-3">Account Summary</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Total Spent</p>
                <p className="text-lg font-bold">
                  {formatKSh(customer.total_purchases || 0)}
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
                  {formatKSh(Math.abs(customer.credit_balance))}
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Lifetime Value</p>
                <p className="text-lg font-bold text-emerald-600">
                  {formatKSh(customer.total_lifetime_spend_cents || 0)}
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Total Visits</p>
                <p className="text-lg font-bold">{customer.total_visits || 0}</p>
              </div>
            </div>
            {customer.last_purchase_date && (
              <p className="text-xs text-muted-foreground mt-2">
                Last purchase: {new Date(customer.last_purchase_date).toLocaleDateString("en-KE", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            )}
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
                    <p className="font-semibold">{formatKSh(purchase.total_amount)}</p>
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
