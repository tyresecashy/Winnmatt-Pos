"use client"
import { logger } from '@/lib/logger';

import { useEffect, useState, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { formatKSh } from "@/lib/currency"
import {
  Banknote,
  Receipt,
  Percent,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  RotateCcw,
  X,
  Check,
  Smartphone,
  Plus,
  Wand2,
  Split,
  CreditCard,
} from "lucide-react"
import type { SelectedCustomer } from "@/app/(dashboard)/pos/page"
import { ReceiptPreview, type SaleDetailsData } from "@/components/receipt-preview"
import { isReceiptPayloadValid } from "@/lib/receipt-builder"
import { StripeCheckout } from "@/components/pos/stripe-checkout"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

interface PaymentPanelProps {
  subtotal: number
  itemDiscounts: number
  cartDiscount: number
  onCartDiscountChange: (discount: number) => void
  total: number
  showPayment: boolean
  onShowPayment: (show: boolean) => void
  onCompletePayment: (receiptNumber: string, paymentMethod: string, options?: Record<string, any>) => void
  customer: SelectedCustomer | null
  fullSaleData?: SaleDetailsData | null
  onReceiptClose?: () => void
  promotionDiscount?: number
  loyaltyRedemption?: {
    loading: boolean
    eligible: boolean
    reason: string | null
    currentBalance: number
    maxRedeemablePoints: number
    maxRedeemableDiscount: number
    redeemValueCents: number
    pointsToRedeem: number
    redemptionDiscount: number
  }
  onRedemptionPointsChange?: (points: number) => void
}

type PaymentMethod = "cash" | "mpesa" | "card"

export function PaymentPanel({
  subtotal,
  itemDiscounts,
  cartDiscount,
  onCartDiscountChange,
  total,
  showPayment,
  onShowPayment,
  onCompletePayment,
  customer,
  fullSaleData,
  onReceiptClose,
  promotionDiscount = 0,
  loyaltyRedemption,
  onRedemptionPointsChange,
}: PaymentPanelProps) {
  const { toast } = useToast()
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("cash")
  const [amountReceived, setAmountReceived] = useState("")
  const [mpesaPhone, setMpesaPhone] = useState("")
  const [discountInput, setDiscountInput] = useState(cartDiscount > 0 ? cartDiscount.toString() : "")
  useEffect(() => {
    setDiscountInput(cartDiscount > 0 ? cartDiscount.toString() : "")
  }, [cartDiscount])
  const [showDiscountSection, setShowDiscountSection] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isMpesaFinalizing, setIsMpesaFinalizing] = useState(false)
  const [receiptNumber, setReceiptNumber] = useState("")
  const [paymentStatus, setPaymentStatus] = useState<string>("")
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [showReceipt, setShowReceipt] = useState(false)
  const [receiptLoadError, setReceiptLoadError] = useState<string | null>(null)
  const [pendingSaleId, setPendingSaleId] = useState<string | null>(null)
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null)
  const [showStripeCheckout, setShowStripeCheckout] = useState(false)
  const [stripeSaleId, setStripeSaleId] = useState<string | null>(null)

  // Split payment state
  const [enableSplit, setEnableSplit] = useState(false)
  const [splits, setSplits] = useState<Array<{ id: string; method: 'cash' | 'card' | 'bank_transfer' | 'cheque' | 'credit'; amount: number }>>([])
  const [splitAmountInputs, setSplitAmountInputs] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!showPayment) return

    if (fullSaleData && isReceiptPayloadValid(fullSaleData)) {
      const timer = setTimeout(() => {
        setShowReceipt(true)
        onShowPayment(false)
      })
      return () => clearTimeout(timer)
    }
  }, [fullSaleData, showPayment, onShowPayment])

  useEffect(() => {
    if (!customer?.phone) return

    const timer = setTimeout(() => setMpesaPhone((currentPhone) => currentPhone || customer.phone))
    return () => clearTimeout(timer)
  }, [customer?.phone])

  const onCompletePaymentRef = useRef(onCompletePayment)
  useEffect(() => {
    onCompletePaymentRef.current = onCompletePayment
  }, [onCompletePayment])

  useEffect(() => {
    if (!showPayment || !checkoutRequestId || !pendingSaleId || !isProcessing || selectedMethod !== "mpesa") {
      return
    }

    let cancelled = false
    let isPolling = false

    const pollStatus = async () => {
      if (cancelled || isPolling || isMpesaFinalizing) {
        return
      }

      isPolling = true

      try {
        const response = await fetch(
          `/api/mpesa/status?checkoutRequestId=${encodeURIComponent(checkoutRequestId)}&saleId=${encodeURIComponent(pendingSaleId)}`,
          {
            method: "GET",
            credentials: "include",
          }
        )

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || "Unable to check M-Pesa status")
        }

        const statusResult = await response.json()

        if (cancelled) {
          return
        }

        if (statusResult.isConfirmed) {
          setIsMpesaFinalizing(true)
          setPaymentStatus("Payment confirmed. Opening receipt...")

          await onCompletePaymentRef.current(receiptNumber, "mpesa", {
            skipSaleCreation: true,
            saleId: pendingSaleId,
          })

          return
        }

        if (statusResult.isFailed) {
          setIsProcessing(false)
          setIsMpesaFinalizing(false)
          setCheckoutRequestId(null)
          setPendingSaleId(null)
          setPaymentStatus("")
          setPaymentError(statusResult.errorMessage || "M-Pesa payment was not completed.")
          return
        }

        setPaymentStatus("Waiting for customer to enter M-Pesa PIN on phone...")
      } catch (error) {
        if (!cancelled) {
          logger.warn("[PAYMENT] Failed to poll M-Pesa status:", { error })
          setPaymentStatus("Checking M-Pesa payment status...")
        }
      } finally {
        isPolling = false
      }
    }

    void pollStatus()
    const intervalId = window.setInterval(() => {
      void pollStatus()
    }, 3000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [
    checkoutRequestId,
    isMpesaFinalizing,
    isProcessing,
    pendingSaleId,
    receiptNumber,
    selectedMethod,
    showPayment,
  ])

  const resetPaymentState = () => {
    setAmountReceived("")
    setMpesaPhone(customer?.phone || "")
    setDiscountInput("")
    setReceiptNumber("")
    setPaymentError(null)
    setPaymentStatus("")
    setReceiptLoadError(null)
    setPendingSaleId(null)
    setCheckoutRequestId(null)
    setIsProcessing(false)
    setIsMpesaFinalizing(false)
    setSelectedMethod("cash")
    setEnableSplit(false)
    setSplits([])
    setSplitAmountInputs({})
    setShowStripeCheckout(false)
    setStripeSaleId(null)
  }

  // Split payment helpers
  const addSplitMethod = useCallback(() => {
    const newSplit = { id: crypto.randomUUID(), method: 'cash' as const, amount: 0 }
    setSplits((prev) => [...prev, newSplit])
    setSplitAmountInputs((prev) => ({ ...prev, [newSplit.id]: '' }))
  }, [])

  const removeSplit = useCallback((id: string) => {
    setSplits((prev) => prev.filter((s) => s.id !== id))
    setSplitAmountInputs((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  const updateSplitMethod = useCallback((id: string, method: 'cash' | 'card' | 'bank_transfer' | 'cheque' | 'credit') => {
    setSplits((prev) => prev.map((s) => (s.id === id ? { ...s, method } : s)))
  }, [])

  const updateSplitAmount = useCallback((id: string, raw: string) => {
    setSplitAmountInputs((prev) => ({ ...prev, [id]: raw }))
    const parsed = parseInt(raw, 10)
    if (!isNaN(parsed) && parsed >= 0) {
      setSplits((prev) => prev.map((s) => (s.id === id ? { ...s, amount: parsed } : s)))
    }
  }, [])

  const handlePayment = async () => {
    if (isProcessing) return

    setIsProcessing(true)
    setIsMpesaFinalizing(false)
    setPaymentStatus("")
    setPaymentError(null)
    setReceiptLoadError(null)
    setPendingSaleId(null)
    setCheckoutRequestId(null)

    const newReceiptNumber = `RCP-${Date.now().toString().slice(-8)}`
    setReceiptNumber(newReceiptNumber)

    try {
      if (enableSplit) {
        if (splits.length === 0) {
          throw new Error('Add at least one payment method to split.')
        }
        const allocated = splits.reduce((sum, s) => sum + s.amount, 0)
        if (Math.abs(allocated - totalAfterRedemption) > 1) {
          throw new Error(`Split amounts total ${formatKSh(allocated)} but the total to pay is ${formatKSh(totalAfterRedemption)}.`)
        }
        const primarySplit = splits.reduce((max, s) => s.amount > max.amount ? s : max)
        setPaymentStatus(`Processing split payment (primary: ${primarySplit.method})...`)
        await onCompletePayment(newReceiptNumber, primarySplit.method, {
          splits: splits.map((s) => ({ method: s.method, amount: s.amount })),
          redemption: loyaltyRedemption && loyaltyRedemption.pointsToRedeem > 0
            ? {
                pointsToRedeem: loyaltyRedemption.pointsToRedeem,
                discountApplied: loyaltyRedemption.redemptionDiscount,
              }
            : undefined,
        })
        setPaymentStatus("")
        return
      }

      if (selectedMethod === "cash") {
        setPaymentStatus("Saving cash sale...")
        await onCompletePayment(newReceiptNumber, "cash", {
          redemption: loyaltyRedemption && loyaltyRedemption.pointsToRedeem > 0
            ? {
                pointsToRedeem: loyaltyRedemption.pointsToRedeem,
                discountApplied: loyaltyRedemption.redemptionDiscount,
              }
            : undefined,
        })
        setPaymentStatus("")
        return
      }

      if (selectedMethod === "card") {
        setPaymentStatus("Creating pending card sale...")
        // Create a pending sale first, then open Stripe checkout
        await onCompletePayment(newReceiptNumber, "card", {
          redemption: loyaltyRedemption && loyaltyRedemption.pointsToRedeem > 0
            ? {
                pointsToRedeem: loyaltyRedemption.pointsToRedeem,
                discountApplied: loyaltyRedemption.redemptionDiscount,
              }
            : undefined,
          onSaleCreated: (saleId: string) => {
            setStripeSaleId(saleId)
            setShowStripeCheckout(true)
          },
        })
        setPaymentStatus("")
        return
      }

      const cleanedPhone = mpesaPhone.trim()
      if (!cleanedPhone) {
        throw new Error("Enter the customer's M-Pesa phone number before sending the prompt.")
      }

      setPaymentStatus("Creating pending M-Pesa sale...")

      await onCompletePayment(newReceiptNumber, "mpesa", {
        mpesaPhone: cleanedPhone,
        redemption: loyaltyRedemption && loyaltyRedemption.pointsToRedeem > 0
          ? {
              pointsToRedeem: loyaltyRedemption.pointsToRedeem,
              discountApplied: loyaltyRedemption.redemptionDiscount,
            }
          : undefined,
        onSaleCreated: (saleId: string, pendingReceiptNumber?: string) => {
          setPendingSaleId(saleId)
          if (pendingReceiptNumber) {
            setReceiptNumber(pendingReceiptNumber)
          }
        },
        onCheckoutId: (requestId: string) => {
          setCheckoutRequestId(requestId)
        },
      })

      setPaymentStatus("STK Push sent. Waiting for customer confirmation on phone...")
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
      logger.error("[PAYMENT] Error during payment:", errorMessage)
      setPaymentError(errorMessage)
      setPaymentStatus("")
      setIsProcessing(false)
      setIsMpesaFinalizing(false)
      setPendingSaleId(null)
      setCheckoutRequestId(null)

      toast({
        title: "Payment Error",
        description: errorMessage,
        variant: "destructive",
      })
    }
  }

  const handleComplete = () => {
    setShowReceipt(false)
    onShowPayment(false)
    resetPaymentState()
    onReceiptClose?.()
  }

  const change = amountReceived
    ? parseFloat(amountReceived) - Math.max(0, total - (loyaltyRedemption?.redemptionDiscount || 0))
    : 0

  const totalAfterRedemption = Math.max(0, total - (loyaltyRedemption?.redemptionDiscount || 0))

  const isMpesaPending = selectedMethod === "mpesa" && !!checkoutRequestId && isProcessing

  const handlePaymentDialogChange = (open: boolean) => {
    if (!open && isMpesaPending) {
      toast({
        title: "M-Pesa Prompt In Progress",
        description: "Wait for the customer to complete or cancel the prompt on their phone before closing this window.",
        variant: "destructive",
      })
      return
    }

    onShowPayment(open)

    if (!open && !showReceipt) {
      resetPaymentState()
    }
  }

  const paymentButtonDisabled =
    selectedMethod === "cash"
      ? isProcessing || parseFloat(amountReceived || "0") < totalAfterRedemption
      : selectedMethod === "card"
        ? isProcessing
        : isProcessing || !mpesaPhone.trim()

  const paymentButtonLabel = selectedMethod === "cash"
    ? isProcessing
      ? "Saving Cash Sale..."
      : "Complete Cash Payment"
    : selectedMethod === "card"
      ? isProcessing
        ? "Creating Card Sale..."
        : "Process Card Payment"
      : isMpesaFinalizing
        ? "Opening Receipt..."
        : isMpesaPending
          ? "Waiting for Customer..."
          : isProcessing
            ? "Sending STK Push..."
            : "Send M-Pesa Prompt"

  return (
    <>
      <div className="p-4 space-y-4 border-t bg-gradient-to-t from-muted/30 to-card">
        <Collapsible open={showDiscountSection} onOpenChange={setShowDiscountSection}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between h-8 px-2">
              <span className="flex items-center gap-2 text-sm">
                <Percent className="h-3.5 w-3.5" />
                Cart Discount
              </span>
              {showDiscountSection ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="flex gap-2 mt-2">
              <Input
                type="number"
                placeholder="Discount amount (KSh)"
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={() => {
                  const value = parseFloat(discountInput) || 0
                  onCartDiscountChange(value)
                }}
              >
                Apply
              </Button>
              {cartDiscount > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onCartDiscountChange(0)
                    setDiscountInput("")
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        <div className="space-y-2 p-3 rounded-lg bg-background border">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatKSh(subtotal)}</span>
          </div>
          {(itemDiscounts + cartDiscount + promotionDiscount) > 0 && (
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
                <div className="flex justify-between text-sm text-blue-600">
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

        <Button
          className="w-full h-12 text-lg font-semibold"
          size="lg"
          disabled={total === 0}
          onClick={() => onShowPayment(true)}
        >
          <Receipt className="mr-2 h-5 w-5" />
          Checkout
        </Button>
      </div>

      <Dialog open={showPayment && !showReceipt} onOpenChange={handlePaymentDialogChange}>
        <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden p-0 sm:max-w-md">
          <DialogHeader className="shrink-0 space-y-3 border-b px-6 pt-6 pb-4">
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Receipt className="h-4 w-4 text-primary" />
              </div>
              Complete Payment
            </DialogTitle>
            <DialogDescription>
              Choose how the customer will pay. M-Pesa uses an STK Push prompt. Loyalty
               redemption is available for named customers.
            </DialogDescription>
            {customer ? (
              <div className="text-sm text-muted-foreground">
                Customer: <span className="font-medium text-foreground">{customer.name}</span>
              </div>
            ) : null}

            {isProcessing && paymentStatus && (
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 text-sm text-blue-900 dark:text-blue-100 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                  {paymentStatus}
                </div>
              </div>
            )}

            {paymentError && (
              <div className="bg-destructive/15 rounded-lg p-3 text-sm text-destructive border-2 border-destructive/50">
                <div className="font-bold mb-1 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Payment Failed
                </div>
                <div className="font-mono text-xs break-words whitespace-pre-wrap">{paymentError}</div>
                <button
                  onClick={() => {
                    setPaymentError(null)
                    setPaymentStatus("")
                  }}
                  className="mt-2 text-xs underline hover:no-underline"
                >
                  Dismiss and Retry
                </button>
              </div>
            )}
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
            <div className="space-y-4 py-4">
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
                  <div className="flex justify-between text-blue-600">
                    <span className="text-muted-foreground">Promotion Discount</span>
                    <span>-{formatKSh(promotionDiscount)}</span>
                  </div>
                )}
                {(loyaltyRedemption?.redemptionDiscount || 0) > 0 && (
                  <div className="flex justify-between text-destructive">
                    <span className="text-muted-foreground">Loyalty Redemption</span>
                    <span>-{formatKSh(loyaltyRedemption?.redemptionDiscount || 0)}</span>
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

              {customer && loyaltyRedemption && (
                <div className="space-y-3 rounded-lg border bg-primary/5 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">Loyalty Redemption</div>
                      <div className="text-xs text-muted-foreground">
                        Customer balance: {loyaltyRedemption.currentBalance.toLocaleString()} pts
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <div>Value per point</div>
                      <div className="font-medium text-foreground">
                        {formatKSh(loyaltyRedemption.redeemValueCents)}
                      </div>
                    </div>
                  </div>

                  {loyaltyRedemption.loading ? (
                    <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                      Checking loyalty redemption eligibility...
                    </div>
                  ) : loyaltyRedemption.eligible ? (
                    <>
                      <div className="grid grid-cols-[1fr_auto_auto] gap-2">
                        <div className="space-y-2">
                          <Label htmlFor="redeemPoints">Points to Redeem</Label>
                          <Input
                            id="redeemPoints"
                            type="number"
                            min={0}
                            max={loyaltyRedemption.maxRedeemablePoints}
                            value={loyaltyRedemption.pointsToRedeem > 0 ? loyaltyRedemption.pointsToRedeem : ""}
                            onChange={(e) => onRedemptionPointsChange?.(parseInt(e.target.value || "0", 10))}
                            disabled={isProcessing}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="self-end"
                          disabled={isProcessing}
                          onClick={() => onRedemptionPointsChange?.(loyaltyRedemption.maxRedeemablePoints)}
                        >
                          Max
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="self-end"
                          disabled={isProcessing || loyaltyRedemption.pointsToRedeem === 0}
                          onClick={() => onRedemptionPointsChange?.(0)}
                        >
                          Clear
                        </Button>
                      </div>

                      <div className="rounded-md bg-background px-3 py-2 text-sm space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Redeemable now</span>
                          <span>
                            up to {loyaltyRedemption.maxRedeemablePoints.toLocaleString()} pts
                            {" "}
                            ({formatKSh(loyaltyRedemption.maxRedeemableDiscount)})
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Redemption value</span>
                          <span>-{formatKSh(loyaltyRedemption.redemptionDiscount)}</span>
                        </div>
                        <div className="flex justify-between font-semibold">
                          <span>New cash total</span>
                          <span>{formatKSh(totalAfterRedemption)}</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                      {loyaltyRedemption.reason || 'This customer is not eligible to redeem points on this sale.'}
                    </div>
                  )}
                </div>
              )}

              {/* ── Split Payment Toggle ───────────────────── */}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="splitPayment"
                    checked={enableSplit}
                    onCheckedChange={(checked) => {
                      if (isProcessing) return
                      setEnableSplit(!!checked)
                      if (!checked) {
                        setSplits([])
                        setSplitAmountInputs({})
                      } else {
                        const id = crypto.randomUUID()
                        setSplits([{ id, method: 'cash', amount: totalAfterRedemption }])
                        setSplitAmountInputs({ [id]: String(totalAfterRedemption) })
                      }
                    }}
                  />
                  <Label htmlFor="splitPayment" className="text-sm font-medium cursor-pointer">Split Payment</Label>
                </div>
                <span className="text-xs text-muted-foreground">Multiple methods</span>
              </div>

              {enableSplit ? (
                <div className="space-y-3 rounded-lg border bg-muted/10 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Payment Allocation
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs gap-1"
                      onClick={() => {
                        // Auto-balance: distribute remaining evenly across splits
                        const remaining = totalAfterRedemption - splits.reduce((s, sp) => s + sp.amount, 0)
                        if (remaining <= 0 || splits.length === 0) return
                        const perSplit = Math.floor(remaining / splits.length)
                        const extra = remaining - perSplit * splits.length
                        setSplits(prev => prev.map((sp, i) => {
                          const newAmt = sp.amount + perSplit + (i === 0 ? extra : 0)
                          return { ...sp, amount: newAmt }
                        }))
                        setSplitAmountInputs(prev => {
                          const next = { ...prev }
                          splits.forEach((sp, i) => {
                            const newAmt = sp.amount + perSplit + (i === 0 ? extra : 0)
                            next[sp.id] = String(newAmt)
                          })
                          return next
                        })
                      }}
                      disabled={isProcessing || splits.length === 0}
                    >
                      <Wand2 className="h-3 w-3 mr-1" />
                      Auto-Balance
                    </Button>
                  </div>

                  {/* Progress bar showing allocation */}
                  {(() => {
                    const allocated = splits.reduce((s, sp) => s + sp.amount, 0)
                    const pct = totalAfterRedemption > 0 ? Math.min((allocated / totalAfterRedemption) * 100, 100) : 0
                    const remaining = totalAfterRedemption - allocated
                    return (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            {formatKSh(allocated)} / {formatKSh(totalAfterRedemption)}
                          </span>
                          <span className={remaining > 0 ? 'text-destructive font-medium' : 'text-green-600 font-medium'}>
                            {remaining > 0 ? `${formatKSh(remaining)} remaining` : 'Fully allocated'}
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden flex">
                          {splits.map((sp, i) => {
                            const width = totalAfterRedemption > 0 ? (sp.amount / totalAfterRedemption) * 100 : 0
                            const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-amber-500', 'bg-rose-500']
                            return width > 0 ? (
                              <div
                                key={sp.id}
                                className={`${colors[i % colors.length]} h-2 transition-all`}
                                style={{ width: `${Math.min(width, 100)}%` }}
                                title={`${sp.method}: ${formatKSh(sp.amount)}`}
                              />
                            ) : null
                          })}
                          {remaining > 0 && (
                            <div className="bg-muted-foreground/20 h-2 flex-1" title={`Unallocated: ${formatKSh(remaining)}`} />
                          )}
                        </div>
                        {/* Color legend */}
                        <div className="flex flex-wrap gap-2 pt-1">
                          {splits.map((sp, i) => {
                            const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-amber-500', 'bg-rose-500']
                            return (
                              <span key={sp.id} className="flex items-center gap-1 text-[9px] text-muted-foreground">
                                <span className={`inline-block w-2 h-2 rounded-full ${colors[i % colors.length]}`} />
                                {sp.method}
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}

                  {/* Quick split presets */}
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[10px] h-7 px-2"
                      onClick={() => {
                        // 50/50
                        const half = Math.floor(totalAfterRedemption / 2)
                        if (splits.length >= 2) {
                          setSplits(prev => prev.map((sp, i) => ({
                            ...sp,
                            amount: i === 0 ? half + (totalAfterRedemption - half * 2) : half,
                          })))
                          setSplitAmountInputs(prev => {
                            const next = { ...prev }
                            splits.forEach((sp, i) => {
                              next[sp.id] = String(i === 0 ? half + (totalAfterRedemption - half * 2) : half)
                            })
                            return next
                          })
                        }
                      }}
                      disabled={isProcessing || splits.length < 2}
                    >
                      <Split className="h-3 w-3 mr-1" />
                      50/50
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[10px] h-7 px-2"
                      onClick={() => {
                        // Equal split
                        const perSplit = Math.floor(totalAfterRedemption / splits.length)
                        const extra = totalAfterRedemption - perSplit * splits.length
                        setSplits(prev => prev.map((sp, i) => ({
                          ...sp,
                          amount: perSplit + (i === 0 ? extra : 0),
                        })))
                        setSplitAmountInputs(prev => {
                          const next = { ...prev }
                          splits.forEach((sp, i) => {
                            next[sp.id] = String(perSplit + (i === 0 ? extra : 0))
                          })
                          return next
                        })
                      }}
                      disabled={isProcessing || splits.length < 2}
                    >
                      Equal
                    </Button>
                  </div>

                  {splits.map((split) => (
                    <div key={split.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                      <div className="space-y-1">
                        <Label className="text-xs">Method</Label>
                        <Select
                          value={split.method}
                          onValueChange={(v: 'cash' | 'card' | 'bank_transfer' | 'cheque' | 'credit') =>
                            updateSplitMethod(split.id, v)
                          }
                          disabled={isProcessing}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">Cash</SelectItem>
                            <SelectItem value="card">Card</SelectItem>
                            <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                            <SelectItem value="cheque">Cheque</SelectItem>
                            <SelectItem value="credit">Credit</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Amount (KSh)</Label>
                        <Input
                          type="number"
                          min={0}
                          placeholder="0"
                          value={splitAmountInputs[split.id] ?? ''}
                          onChange={(e) => updateSplitAmount(split.id, e.target.value)}
                          className="h-9"
                          disabled={isProcessing}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => removeSplit(split.id)}
                        disabled={isProcessing || splits.length <= 1}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex items-center justify-between text-sm">
                    <Button variant="outline" size="sm" onClick={addSplitMethod} disabled={isProcessing}>
                      <Plus className="h-3 w-3 mr-1" />
                      Add Method
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <Card
                      className={`p-4 cursor-pointer text-center transition-all border-2 ${
                        selectedMethod === "cash"
                          ? "bg-primary/10 text-primary border-primary"
                          : "border-border hover:border-primary/40"
                      }`}
                      onClick={() => {
                        if (isProcessing) return
                        setSelectedMethod("cash")
                        setPaymentError(null)
                        setPaymentStatus("")
                      }}
                    >
                      <Banknote className="h-6 w-6 mx-auto mb-2" />
                      <span className="text-sm font-medium">Cash</span>
                    </Card>
                    <Card
                      className={`p-4 cursor-pointer text-center transition-all border-2 ${
                        selectedMethod === "mpesa"
                          ? "bg-primary/10 text-primary border-primary"
                          : "border-border hover:border-primary/40"
                      }`}
                      onClick={() => {
                        if (isProcessing) return
                        setSelectedMethod("mpesa")
                        setPaymentError(null)
                        setPaymentStatus("")
                      }}
                    >
                      <Smartphone className="h-6 w-6 mx-auto mb-2" />
                      <span className="text-sm font-medium">M-Pesa</span>
                    </Card>
                    <Card
                      className={`p-4 cursor-pointer text-center transition-all border-2 ${
                        selectedMethod === "card"
                          ? "bg-primary/10 text-primary border-primary"
                          : "border-border hover:border-primary/40"
                      }`}
                      onClick={() => {
                        if (isProcessing) return
                        setSelectedMethod("card")
                        setPaymentError(null)
                        setPaymentStatus("")
                      }}
                    >
                      <CreditCard className="h-6 w-6 mx-auto mb-2" />
                      <span className="text-sm font-medium">Card</span>
                    </Card>
                  </div>

                  {selectedMethod === "cash" ? (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="amount">Amount Received</Label>
                        <Input
                          id="amount"
                          type="number"
                          placeholder="Enter amount"
                          value={amountReceived}
                          onChange={(e) => setAmountReceived(e.target.value)}
                          className="text-lg h-12"
                        />
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[totalAfterRedemption, Math.ceil(totalAfterRedemption / 100) * 100, Math.ceil(totalAfterRedemption / 500) * 500, Math.ceil(totalAfterRedemption / 1000) * 1000].map((amount, i) => (
                          <Button key={`dyn-${i}`} variant="outline" size="sm" onClick={() => setAmountReceived(amount.toString())} className="text-xs">
                            {formatKSh(amount)}
                          </Button>
                        ))}
                      </div>

                      <div className="grid grid-cols-5 gap-2">
                        {[50, 100, 200, 500, 1000].map((denom) => (
                          <Button key={denom} variant="outline" size="sm" onClick={() => {
                            const current = parseFloat(amountReceived) || 0
                            setAmountReceived((current + denom).toString())
                          }} className="text-xs">
                            +{formatKSh(denom)}
                          </Button>
                        ))}
                      </div>

                      {parseFloat(amountReceived) >= totalAfterRedemption && (
                        <div className="space-y-2">
                          <div className="flex justify-between p-4 rounded-lg bg-success/10 text-success border border-success/20">
                            <span className="font-medium">Change to Return</span>
                            <span className="font-bold text-lg">{formatKSh(change)}</span>
                          </div>
                          {change > 0 && (
                            <div className="rounded-lg bg-muted/30 border p-3 text-sm space-y-1">
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Break Down</p>
                              {(() => {
                                const denoms = [1000, 500, 200, 100, 50, 20, 10, 5, 1]
                                const remaining = Math.round(change)
                                const parts: { denom: number; count: number }[] = []
                                let rem = remaining
                                for (const d of denoms) {
                                  if (rem >= d) {
                                    const count = Math.floor(rem / d)
                                    parts.push({ denom: d, count })
                                    rem = rem % d
                                  }
                                }
                                return (
                                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                                    {parts.map((p) => (
                                      <span key={p.denom} className="text-xs">
                                         {p.count} &times; {formatKSh(p.denom)}
                                      </span>
                                    ))}
                                  </div>
                                )
                              })()}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : selectedMethod === "card" ? (
                    <div className="space-y-3">
                      <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                        Card payment is processed securely via Stripe. Click "Process Card Payment" below to open the secure card form.
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="mpesaPhone">Customer M-Pesa Phone Number</Label>
                        <Input
                          id="mpesaPhone"
                          type="tel"
                          placeholder="e.g. 0712345678"
                          value={mpesaPhone}
                          onChange={(e) => setMpesaPhone(e.target.value)}
                          className="text-lg h-12"
                          disabled={isMpesaPending}
                        />
                      </div>
                      <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                        Send the STK prompt, then wait for the customer to enter their M-Pesa PIN on their phone.
                      </div>
                    </div>
                  )}
                </>
              )}

              <Button
                className="w-full h-12 text-lg font-semibold"
                onClick={handlePayment}
                disabled={paymentButtonDisabled}
              >
                {paymentButtonLabel}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showReceipt}
        onOpenChange={(open) => {
          if (!open) {
            handleComplete()
          }
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto print:max-h-none print:overflow-visible">
          <DialogHeader className="sr-only">
            <DialogTitle>Receipt Preview</DialogTitle>
            <DialogDescription>
              Review the saved receipt, print it, or close the dialog to continue checkout.
            </DialogDescription>
          </DialogHeader>
          {receiptLoadError ? (
            <div className="text-center space-y-4 py-6">
              <div className="h-16 w-16 rounded-full bg-destructive/10 mx-auto flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-destructive">Receipt Not Ready</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  {receiptLoadError}
                </p>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 text-left space-y-2 text-sm">
                <div className="space-y-1">
                  <p className="font-medium">What you can do:</p>
                  <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                    <li>The sale may already be saved.</li>
                    <li>Receipt #: {receiptNumber}</li>
                    <li>Close this window and check recent sales.</li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setReceiptLoadError(null)
                  }}
                  className="flex-1"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
                <Button
                  onClick={() => handleComplete()}
                  className="flex-1"
                >
                  <X className="h-4 w-4 mr-2" />
                  Close and Continue
                </Button>
              </div>
            </div>
          ) : fullSaleData ? (
            <div className="py-4">
              <ReceiptPreview
                saleData={fullSaleData}
                showPrintButton={true}
                showCloseButton={true}
                onPrint={() => {
                  // ReceiptPreview handles print itself.
                }}
                onClose={() => {
                  handleComplete()
                }}
              />
            </div>
          ) : (
            <div className="text-center space-y-4 py-6 max-h-[70vh] overflow-y-auto">
              <div className="h-16 w-16 rounded-full bg-success/10 mx-auto flex items-center justify-center">
                <Check className="h-8 w-8 text-success" />
              </div>
              <div>
                <h3 className="text-xl font-bold">
                  {selectedMethod === "mpesa" ? "Finalizing M-Pesa Payment..." : "Finalizing Cash Sale..."}
                </h3>
                <p className="text-success font-mono text-lg font-bold mt-2">
                  Receipt #{receiptNumber}
                </p>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 text-left space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                  <p className="text-sm text-muted-foreground">Preparing your receipt...</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Stripe Card Checkout Dialog */}
      <Dialog
        open={showStripeCheckout}
        onOpenChange={(open) => {
          if (!open) {
            setShowStripeCheckout(false)
            setStripeSaleId(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Card Payment
            </DialogTitle>
            <DialogDescription>
              Enter card details to complete the payment securely via Stripe.
            </DialogDescription>
          </DialogHeader>
          {stripeSaleId && (
            <StripeCheckout
              saleId={stripeSaleId}
              amount={totalAfterRedemption}
              onSuccess={async (paymentIntentId) => {
                setShowStripeCheckout(false)
                setStripeSaleId(null)
                setPaymentStatus("Card payment confirmed. Opening receipt...")
                await onCompletePayment(receiptNumber, "card", {
                  skipSaleCreation: true,
                  saleId: stripeSaleId,
                  stripePaymentIntentId: paymentIntentId,
                })
              }}
              onError={(error) => {
                setPaymentError(error)
                setShowStripeCheckout(false)
                setStripeSaleId(null)
              }}
              onCancel={() => {
                setShowStripeCheckout(false)
                setStripeSaleId(null)
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
