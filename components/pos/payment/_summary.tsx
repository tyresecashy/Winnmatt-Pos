'use client'

import { Separator } from '@/components/ui/separator'
import { formatKSh } from '@/lib/currency'

interface PaymentSummaryProps {
  subtotal: number
  itemDiscounts: number
  cartDiscount: number
  promotionDiscount: number
  redemptionDiscount: number
  total: number
  variant?: 'compact' | 'full'
}

export function PaymentSummary({
  subtotal,
  itemDiscounts,
  cartDiscount,
  promotionDiscount,
  redemptionDiscount,
  total,
  variant = 'compact',
}: PaymentSummaryProps) {
  const hasDiscounts = (itemDiscounts + cartDiscount + promotionDiscount) > 0
  const totalAfterRedemption = Math.max(0, total - redemptionDiscount)

  if (variant === 'full') {
    return (
      <div className="bg-muted/30 rounded-lg p-3 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-medium">{formatKSh(subtotal)}</span>
        </div>
        {itemDiscounts > 0 && (
          <div className="flex justify-between text-destructive">
            <span className="text-muted-foreground">Item Discounts</span>
            <span>-{formatKSh(itemDiscounts)}</span>
          </div>
        )}
        {cartDiscount > 0 && (
          <div className="flex justify-between text-destructive">
            <span className="text-muted-foreground">Cart Discount</span>
            <span>-{formatKSh(cartDiscount)}</span>
          </div>
        )}
        {promotionDiscount > 0 && (
          <div className="flex justify-between text-primary">
            <span className="text-muted-foreground">Promotion Discount</span>
            <span>-{formatKSh(promotionDiscount)}</span>
          </div>
        )}
        {redemptionDiscount > 0 && (
          <div className="flex justify-between text-destructive">
            <span className="text-muted-foreground">Loyalty Redemption</span>
            <span>-{formatKSh(redemptionDiscount)}</span>
          </div>
        )}
        <Separator className="my-2" />
        <div className="flex justify-between items-center">
          <span className="font-bold text-base">Total to Pay</span>
          <span className="font-bold text-2xl text-primary">
            {formatKSh(totalAfterRedemption)}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2 p-3 rounded-lg bg-background border">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Subtotal</span>
        <span>{formatKSh(subtotal)}</span>
      </div>
      {hasDiscounts && (
        <>
          {itemDiscounts > 0 && (
            <div className="flex justify-between text-sm text-success">
              <span>Item Discounts</span>
              <span>-{formatKSh(itemDiscounts)}</span>
            </div>
          )}
          {cartDiscount > 0 && (
            <div className="flex justify-between text-sm text-success">
              <span>Cart Discount</span>
              <span>-{formatKSh(cartDiscount)}</span>
            </div>
          )}
          {promotionDiscount > 0 && (
            <div className="flex justify-between text-sm text-primary">
              <span>Promotion Discount</span>
              <span>-{formatKSh(promotionDiscount)}</span>
            </div>
          )}
        </>
      )}
      <Separator />
      <div className="flex justify-between text-xl font-bold pt-1">
        <span>Total</span>
        <span className="text-primary">{formatKSh(total)}</span>
      </div>
    </div>
  )
}
