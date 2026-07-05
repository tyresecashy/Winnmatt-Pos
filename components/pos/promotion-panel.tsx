"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  getAutoApplyPromotions,
  validateCoupon,
  type Promotion,
  type ValidatedPromotion,
} from "@/lib/promotion-actions"
import { formatKSh } from "@/lib/currency"
import { BadgePercent, ChevronDown, ChevronUp, Tag, X, Loader2, Check, Percent, Coins } from "lucide-react"

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AppliedPromotion {
  id: string
  name: string
  type: string
  discountCents: number
  couponCode?: string
}

interface PromotionPanelProps {
  cartTotalCents: number
  cartItemCategoryIds: string[]
  /** Called whenever the set of applied promotions changes */
  onAppliedPromotionsChange: (applied: AppliedPromotion[], totalDiscountCents: number) => void
  disabled?: boolean
}

// ─── Component ──────────────────────────────────────────────────────────────

export function PromotionPanel({
  cartTotalCents,
  cartItemCategoryIds,
  onAppliedPromotionsChange,
  disabled = false,
}: PromotionPanelProps) {
  const [autoPromotions, setAutoPromotions] = useState<Promotion[]>([])
  const [appliedPromos, setAppliedPromos] = useState<AppliedPromotion[]>([])
  const [expanded, setExpanded] = useState(false)

  // Coupon state
  const [couponCode, setCouponCode] = useState("")
  const [validating, setValidating] = useState(false)
  const [couponError, setCouponError] = useState<string | null>(null)
  const [couponApplied, setCouponApplied] = useState(false)
  const [couponValidated, setCouponValidated] = useState<ValidatedPromotion | null>(null)

  const prevCartRef = useRef(0)
  const appliedPromosRef = useRef(appliedPromos)
  appliedPromosRef.current = appliedPromos

  // ─── Fetch auto-apply promotions when cart changes ─────────────────────

  useEffect(() => {
    // Only re-fetch if cart total changed significantly (>KSh 1)
    if (Math.abs(cartTotalCents - prevCartRef.current) < 100) return
    prevCartRef.current = cartTotalCents

    if (cartTotalCents <= 0) {
      setAutoPromotions([])
      return
    }

    let cancelled = false

    const fetchAuto = async () => {
      const promotions = await getAutoApplyPromotions(cartTotalCents, cartItemCategoryIds)
      if (!cancelled) {
        setAutoPromotions(promotions)
      }
    }

    void fetchAuto()
    return () => { cancelled = true }
  }, [cartTotalCents, cartItemCategoryIds])

  // ─── Report applied promotions to parent ───────────────────────────────

  useEffect(() => {
    onAppliedPromotionsChange(appliedPromos, appliedPromos.reduce((sum, p) => sum + p.discountCents, 0))
  }, [appliedPromos, onAppliedPromotionsChange])

  // ─── Apply/Remove auto-promotion ────────────────────────────────────────

  const toggleAutoPromo = (promo: Promotion) => {
    setAppliedPromos((prev) => {
      const exists = prev.find((p) => p.id === promo.id)
      if (exists) {
        return prev.filter((p) => p.id !== promo.id)
      }

      let discountCents = 0
      if (promo.type === 'percentage') {
        discountCents = Math.round(cartTotalCents * (promo.value / 100))
      } else if (promo.type === 'fixed_amount') {
        discountCents = Math.round(promo.value)
      } else if (promo.type === 'bonus_points') {
        // Bonus points promotions don't have a direct KSh discount
        discountCents = 0
      }

      // Apply max cap
      if (promo.max_discount_cents > 0 && discountCents > promo.max_discount_cents) {
        discountCents = promo.max_discount_cents
      }

      return [
        ...prev,
        {
          id: promo.id,
          name: promo.name,
          type: promo.type,
          discountCents,
        },
      ]
    })
  }

  const isAutoApplied = (promoId: string) => appliedPromos.some((p) => p.id === promoId)

  // ─── Validate & apply coupon ────────────────────────────────────────────

  const handleValidateCoupon = useCallback(async () => {
    const code = couponCode.trim()
    if (!code) return

    setValidating(true)
    setCouponError(null)

    const result = await validateCoupon(code, cartTotalCents)

    if (!result.valid || !result.validated) {
      setCouponError(result.error || 'Invalid coupon')
      setValidating(false)
      return
    }

    // Check if this promotion is already applied
    const alreadyApplied = appliedPromos.some((p) => p.id === result.validated!.promotion.id)
    if (alreadyApplied) {
      setCouponError('This promotion is already applied')
      setValidating(false)
      return
    }

    // Check stackable
    if (!result.validated.promotion.stackable && appliedPromos.length > 0) {
      setCouponError('This promotion is not stackable with other promotions')
      setValidating(false)
      return
    }

    setCouponValidated(result.validated)
    setValidating(false)
  }, [couponCode, cartTotalCents, appliedPromos])

  const applyCoupon = () => {
    if (!couponValidated) return

    setAppliedPromos((prev) => [
      ...prev,
      {
        id: couponValidated.promotion.id,
        name: couponValidated.promotion.name,
        type: couponValidated.promotion.type,
        discountCents: couponValidated.discountCents,
        couponCode: couponValidated.couponCode,
      },
    ])

    setCouponCode("")
    setCouponValidated(null)
    setCouponApplied(true)
    setCouponError(null)

    setTimeout(() => setCouponApplied(false), 2000)
  }

  const removeApplied = (promoId: string) => {
    setAppliedPromos((prev) => prev.filter((p) => p.id !== promoId))
  }

  const totalPromoDiscountCents = appliedPromos.reduce((sum, p) => sum + p.discountCents, 0)

  if (cartTotalCents <= 0) return null

  return (
    <div className="border-t bg-card">
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <div className="px-4 py-2">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between h-7 px-2">
              <span className="flex items-center gap-2 text-xs font-medium">
                <BadgePercent className="h-3.5 w-3.5" />
                Promotions
                {totalPromoDiscountCents > 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-success/10 text-success">
                    -{formatKSh(totalPromoDiscountCents)}
                  </Badge>
                )}
                {autoPromotions.length > 0 && expanded === false && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {autoPromotions.length} available
                  </Badge>
                )}
              </span>
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <div className="px-4 pb-3 space-y-3">
            {/* Applied promotions */}
            {appliedPromos.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Applied</p>
                {appliedPromos.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 rounded-md bg-primary/5 px-2.5 py-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <Check className="h-3 w-3 text-success flex-shrink-0" />
                      <span className="text-xs font-medium truncate">{p.name}</span>
                      {p.couponCode && (
                        <code className="text-[10px] font-mono px-1 py-0.5 rounded bg-muted">{p.couponCode}</code>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs font-semibold text-success">
                        -{formatKSh(p.discountCents)}
                      </span>
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeApplied(p.id)} disabled={disabled}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Auto-apply promotions */}
            {autoPromotions.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Available Auto-Apply
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {autoPromotions.map((promo) => {
                    const applied = isAutoApplied(promo.id)
                    return (
                      <Badge
                        key={promo.id}
                        variant={applied ? "default" : "outline"}
                        className={`cursor-pointer text-xs gap-1 ${
                          applied ? 'bg-success text-success-foreground hover:bg-success/80' : ''
                        }`}
                        onClick={() => !disabled && toggleAutoPromo(promo)}
                      >
                        {promo.type === 'percentage' && <Percent className="h-3 w-3" />}
                        {promo.type === 'fixed_amount' && <Coins className="h-3 w-3" />}
                        {promo.name}
                        <span className="opacity-70">
                          ({promo.type === 'percentage' ? `${promo.value}%` : formatKSh(promo.value)})
                        </span>
                      </Badge>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Coupon input */}
            {!couponValidated && (
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Coupon Code
                </p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={couponCode}
                      onChange={(e) => {
                        setCouponCode(e.target.value.toUpperCase())
                        setCouponError(null)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleValidateCoupon()
                      }}
                      placeholder="Enter coupon code"
                      className="h-8 pl-8 text-xs font-mono uppercase"
                      disabled={disabled || validating}
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 text-xs"
                    onClick={handleValidateCoupon}
                    disabled={!couponCode.trim() || validating || disabled}
                  >
                    {validating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Apply'}
                  </Button>
                </div>
                {couponError && (
                  <p className="text-[11px] text-destructive">{couponError}</p>
                )}
                {couponApplied && (
                  <p className="text-[11px] text-success flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    Coupon applied!
                  </p>
                )}
              </div>
            )}

            {/* Validated coupon preview */}
            {couponValidated && (
              <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-2.5">
                <p className="text-xs font-medium text-primary">Coupon Validated</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium">{couponValidated.promotion.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Code: <code className="font-mono">{couponValidated.couponCode}</code>
                    </p>
                  </div>
                  <p className="text-xs font-semibold text-success">
                    -{formatKSh(couponValidated.discountCents)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 h-7 text-xs" onClick={applyCoupon} disabled={disabled}>
                    <Check className="h-3 w-3 mr-1" />
                    Apply Coupon
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => { setCouponValidated(null); setCouponCode("") }}
                    disabled={disabled}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {autoPromotions.length === 0 && appliedPromos.length === 0 && !couponValidated && (
              <p className="text-[11px] text-muted-foreground italic">
                No promotions available for this cart.
              </p>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
