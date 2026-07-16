"use client"
import { logger } from '@/lib/logger';

import { useEffect, useState, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import { formatKSh } from "@/lib/currency"
import {
  Receipt,
  Percent,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CreditCard,
  RotateCcw,
} from "lucide-react"
import type { SelectedCustomer } from "@/app/(dashboard)/pos/page"
import type { SaleDetailsData } from "@/components/receipt-preview"
import { isReceiptPayloadValid } from "@/lib/receipt-builder"
import { StripeCheckout } from "@/components/pos/stripe-checkout"

// Import extracted sub-components
import { PaymentSummary } from '@/components/pos/payment/_summary'
import { PaymentMethodSelector, type PaymentMethod } from '@/components/pos/payment/_method-selector'
import { CashPaymentForm } from '@/components/pos/payment/_cash-form'
import { MpesaPaymentForm } from '@/components/pos/payment/_mpesa-form'
import { CardPaymentForm } from '@/components/pos/payment/_card-form'
import { SplitPaymentForm, type SplitEntry } from '@/components/pos/payment/_split-form'
import { LoyaltyRedemptionSection, type LoyaltyRedemptionData } from '@/components/pos/payment/_loyalty-redemption'
import { ReceiptDialog } from '@/components/pos/payment/_receipt-dialog'
import { PaymentSuccessAnimation } from '@/components/pos/payment/_success-animation'
import { usePaymentKeys } from '@/components/pos/payment/use-payment-keys'

interface PaymentPanelProps {
  subtotal: number
  itemDiscounts: number
  cartDiscount: number
  onCartDiscountChange: (discount: number) => void
  total: number
  showPayment: boolean
  onShowPayment: (show: boolean) => void
  onCompletePayment: (receiptNumber: string, paymentMethod: string, options?: Record<string, unknown>) => void
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
  const prevDiscountCartRef = useRef(cartDiscount)
  useEffect(() => {
    if (cartDiscount !== prevDiscountCartRef.current) {
      prevDiscountCartRef.current = cartDiscount
      const id = setTimeout(() => {
        setDiscountInput(cartDiscount > 0 ? cartDiscount.toString() : "")
      }, 0)
      return () => clearTimeout(id)
    }
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
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false)
  const [animationConfirmed, setAnimationConfirmed] = useState(false)

  // Split payment state
  const [enableSplit, setEnableSplit] = useState(false)
  const [splits, setSplits] = useState<SplitEntry[]>([])
  const [splitAmountInputs, setSplitAmountInputs] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!showPayment) return
    if (showSuccessAnimation) return

    if (fullSaleData && isReceiptPayloadValid(fullSaleData)) {
      const timer = setTimeout(() => {
        setShowReceipt(true)
        onShowPayment(false)
      })
      return () => clearTimeout(timer)
    }
  }, [fullSaleData, showPayment, onShowPayment, showSuccessAnimation])

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

    // ── SSE subscription (Tuma uses polling only) ──────────────────
    // Tuma Payments uses HTTP polling via /api/payments/tuma/status
    // SSE is not needed since the polling loop below handles everything

    // ── Polling (Tuma / M-Pesa status check) ───────────────────────
    const pollStatus = async () => {
      if (cancelled || isPolling || isMpesaFinalizing) return

      isPolling = true
      try {
        const response = await fetch(
          `/api/payments/tuma/status?checkoutRequestId=${encodeURIComponent(checkoutRequestId)}&saleId=${encodeURIComponent(pendingSaleId)}`,
          { method: "GET", credentials: "include" }
        )

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}))
          throw new Error(errData.error || "Unable to check payment status")
        }

        const statusResult = await response.json()
        if (cancelled) return

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
          setPaymentError(statusResult.errorMessage || "Payment was not completed.")
          return
        }

        setPaymentStatus("Waiting for customer to enter M-Pesa PIN on phone...")
      } catch (error) {
        if (!cancelled) {
          logger.warn("[PAYMENT] Failed to poll payment status:", { error })
          setPaymentStatus("Checking payment status...")
        }
      } finally {
        isPolling = false
      }
    }

    void pollStatus()
    const intervalId = window.setInterval(() => { void pollStatus() }, 3000)

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

  const updateSplitMethod = useCallback((id: string, method: SplitEntry['method']) => {
    setSplits((prev) => prev.map((s) => (s.id === id ? { ...s, method } : s)))
  }, [])

  const updateSplitAmount = useCallback((id: string, raw: string) => {
    setSplitAmountInputs((prev) => ({ ...prev, [id]: raw }))
    const parsed = parseInt(raw, 10)
    if (!isNaN(parsed) && parsed >= 0) {
      setSplits((prev) => prev.map((s) => (s.id === id ? { ...s, amount: parsed } : s)))
    }
  }, [])

  const totalAfterRedemption = Math.max(0, total - (loyaltyRedemption?.redemptionDiscount || 0))

  // Intentionally not wrapped in useCallback — ref pattern always has latest version
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
        setShowSuccessAnimation(true)
        try {
          await onCompletePayment(newReceiptNumber, primarySplit.method, {
            splits: splits.map((s) => ({ method: s.method, amount: s.amount })),
            redemption: loyaltyRedemption && loyaltyRedemption.pointsToRedeem > 0
              ? { pointsToRedeem: loyaltyRedemption.pointsToRedeem, discountApplied: loyaltyRedemption.redemptionDiscount }
              : undefined,
          })
        } catch (e) {
          setShowSuccessAnimation(false)
          setAnimationConfirmed(false)
          throw e
        }
        setAnimationConfirmed(true)
        setPaymentStatus("")
        setIsProcessing(false)
        return
      }

      if (selectedMethod === "cash") {
        setPaymentStatus("Saving cash sale...")
        setShowSuccessAnimation(true)
        try {
          await onCompletePayment(newReceiptNumber, "cash", {
            redemption: loyaltyRedemption && loyaltyRedemption.pointsToRedeem > 0
              ? { pointsToRedeem: loyaltyRedemption.pointsToRedeem, discountApplied: loyaltyRedemption.redemptionDiscount }
              : undefined,
          })
        } catch (e) {
          setShowSuccessAnimation(false)
          setAnimationConfirmed(false)
          throw e
        }
        setAnimationConfirmed(true)
        setPaymentStatus("")
        setIsProcessing(false)
        return
      }

      if (selectedMethod === "card") {
        setPaymentStatus("Creating pending card sale...")
        await onCompletePayment(newReceiptNumber, "card", {
          redemption: loyaltyRedemption && loyaltyRedemption.pointsToRedeem > 0
            ? { pointsToRedeem: loyaltyRedemption.pointsToRedeem, discountApplied: loyaltyRedemption.redemptionDiscount }
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
          ? { pointsToRedeem: loyaltyRedemption.pointsToRedeem, discountApplied: loyaltyRedemption.redemptionDiscount }
          : undefined,
        onSaleCreated: (saleId: string, pendingReceiptNumber?: string) => {
          setPendingSaleId(saleId)
          if (pendingReceiptNumber) setReceiptNumber(pendingReceiptNumber)
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
      setShowSuccessAnimation(false)
      setAnimationConfirmed(false)
      toast({ title: "Payment Error", description: errorMessage, variant: "destructive" })
    }
  }

  const handleComplete = () => {
    setShowReceipt(false)
    setShowSuccessAnimation(false)
    setAnimationConfirmed(false)
    onShowPayment(false)
    resetPaymentState()
    onReceiptClose?.()
  }

  const change = amountReceived
    ? parseFloat(amountReceived) - totalAfterRedemption
    : 0

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
    if (!open && !showReceipt) resetPaymentState()
  }

  const handleReceiptDialogChange = (open: boolean) => {
    if (!open) handleComplete()
  }

  const handlePaymentRef = useRef(handlePayment)
  useEffect(() => { handlePaymentRef.current = handlePayment }) // ref sync — no deps needed, runs after every render

  const handlePayClick = useCallback(() => {
    if (!isProcessing && showPayment) handlePaymentRef.current()
  }, [isProcessing, showPayment])

  const handleSelectCash = useCallback(() => {
    if (!isProcessing) { setSelectedMethod("cash"); setPaymentError(null); setPaymentStatus("") }
  }, [isProcessing])

  const handleSelectMpesa = useCallback(() => {
    if (!isProcessing) { setSelectedMethod("mpesa"); setPaymentError(null); setPaymentStatus("") }
  }, [isProcessing])

  const handleSelectCard = useCallback(() => {
    if (!isProcessing) { setSelectedMethod("card"); setPaymentError(null); setPaymentStatus("") }
  }, [isProcessing])

  usePaymentKeys({
    onCash: handleSelectCash,
    onMpesa: handleSelectMpesa,
    onCard: handleSelectCard,
    onPay: handlePayClick,
    onCancel: () => handlePaymentDialogChange(false),
    enabled: showPayment && !showReceipt,
  })

  const paymentButtonDisabled =
    selectedMethod === "cash"
      ? isProcessing || parseFloat(amountReceived || "0") < totalAfterRedemption
      : selectedMethod === "card"
        ? isProcessing
        : isProcessing || !mpesaPhone.trim()

  const paymentButtonLabel = selectedMethod === "cash"
    ? isProcessing ? "Saving Cash Sale..." : "Complete Cash Payment"
    : selectedMethod === "card"
      ? isProcessing ? "Creating Card Sale..." : "Process Card Payment"
      : isMpesaFinalizing
        ? "Opening Receipt..."
        : isMpesaPending
          ? "Waiting for Customer..."
          : isProcessing
            ? "Sending STK Push..."
            : "Send M-Pesa Prompt"

  const paymentMethodText = selectedMethod === "mpesa"
    ? "Finalizing M-Pesa Payment..."
    : selectedMethod === "cash"
      ? "Finalizing Cash Sale..."
      : "Finalizing Card Sale..."

  return (
    <>
      {/* ── Sidebar Summary ────────────────────────────────── */}
      <div className="p-4 space-y-4 border-t bg-gradient-to-t from-muted/30 to-card">
        <Collapsible open={showDiscountSection} onOpenChange={setShowDiscountSection}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between h-8 px-2">
              <span className="flex items-center gap-2 text-sm">
                <Percent className="h-3.5 w-3.5" />
                Cart Discount
              </span>
              {showDiscountSection ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
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
              <Button size="sm" onClick={() => onCartDiscountChange(parseFloat(discountInput) || 0)}>
                Apply
              </Button>
              {cartDiscount > 0 && (
                <Button size="sm" variant="outline" onClick={() => { onCartDiscountChange(0); setDiscountInput("") }}>
                  Clear
                </Button>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        <PaymentSummary
          subtotal={subtotal}
          itemDiscounts={itemDiscounts}
          cartDiscount={cartDiscount}
          promotionDiscount={promotionDiscount}
          redemptionDiscount={loyaltyRedemption?.redemptionDiscount || 0}
          total={total}
          variant="compact"
        />

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

      {/* ── Payment Dialog ─────────────────────────────────── */}
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
            {customer && (
              <div className="text-sm text-muted-foreground">
                Customer: <span className="font-medium text-foreground">{customer.name}</span>
              </div>
            )}

            {/* Processing status */}
            <AnimatePresence>
              {isProcessing && paymentStatus && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: "auto", marginBottom: 12 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.2 }}
                  className="bg-primary/10 rounded-lg p-3 text-sm text-primary border border-primary/30 overflow-hidden"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
                    </span>
                    <span className="font-medium">{paymentStatus}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Payment error */}
            <AnimatePresence>
              {paymentError && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="bg-destructive/10 rounded-lg p-3 text-sm text-destructive border border-destructive/30"
                >
                  <div className="font-semibold mb-1 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Payment Failed
                  </div>
                  <div className="font-mono text-xs break-words whitespace-pre-wrap text-destructive/80">{paymentError}</div>
                  <button
                    onClick={() => { setPaymentError(null); setPaymentStatus(""); setIsProcessing(false) }}
                    className="mt-2 text-xs font-medium text-destructive hover:text-destructive/80 transition-colors inline-flex items-center gap-1"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Dismiss and Retry
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
            <div className="space-y-4 py-4">
              {/* Order summary */}
              <PaymentSummary
                subtotal={subtotal}
                itemDiscounts={itemDiscounts}
                cartDiscount={cartDiscount}
                promotionDiscount={promotionDiscount}
                redemptionDiscount={loyaltyRedemption?.redemptionDiscount || 0}
                total={total}
                variant="full"
              />

              {/* Loyalty redemption */}
              {customer && loyaltyRedemption && (
                <LoyaltyRedemptionSection
                  data={loyaltyRedemption as LoyaltyRedemptionData}
                  totalAfterRedemption={totalAfterRedemption}
                  onPointsChange={onRedemptionPointsChange!}
                  disabled={isProcessing}
                />
              )}

              {/* Split payment */}
              <SplitPaymentForm
                enabled={enableSplit}
                onToggle={(checked) => {
                  if (isProcessing) return
                  setEnableSplit(checked)
                  if (!checked) {
                    setSplits([])
                    setSplitAmountInputs({})
                  } else {
                    const id = crypto.randomUUID()
                    setSplits([{ id, method: 'cash', amount: totalAfterRedemption }])
                    setSplitAmountInputs({ [id]: String(totalAfterRedemption) })
                  }
                }}
                splits={splits}
                splitAmountInputs={splitAmountInputs}
                onAddSplit={addSplitMethod}
                onRemoveSplit={removeSplit}
                onUpdateSplitMethod={updateSplitMethod}
                onUpdateSplitAmount={updateSplitAmount}
                totalToPay={totalAfterRedemption}
                disabled={isProcessing}
              />

              {/* Payment method + forms (only when split is off) */}
              {!enableSplit && (
                <>
                  <PaymentMethodSelector
                    selected={selectedMethod}
                    onSelect={(m) => { setSelectedMethod(m); setPaymentError(null); setPaymentStatus("") }}
                    disabled={isProcessing}
                  />

                  {selectedMethod === "cash" ? (
                    <CashPaymentForm
                      amountReceived={amountReceived}
                      onAmountChange={setAmountReceived}
                      totalToPay={totalAfterRedemption}
                      disabled={isProcessing}
                    />
                  ) : selectedMethod === "card" ? (
                    <CardPaymentForm />
                  ) : (
                    <MpesaPaymentForm
                      phone={mpesaPhone}
                      onPhoneChange={setMpesaPhone}
                      disabled={isMpesaPending}
                    />
                  )}
                </>
              )}

              {/* Pay button */}
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

      {/* ── Receipt Dialog ─────────────────────────────────── */}
      <ReceiptDialog
        open={showReceipt}
        onOpenChange={handleReceiptDialogChange}
        receiptNumber={receiptNumber}
        receiptLoadError={receiptLoadError}
        fullSaleData={fullSaleData}
        onRetry={() => setReceiptLoadError(null)}
        onComplete={handleComplete}
        paymentMethodText={paymentMethodText}
      />

      {/* ── Stripe Card Checkout ────────────────────────────── */}
      <Dialog
        open={showStripeCheckout}
        onOpenChange={(open) => {
          if (!open) { setShowStripeCheckout(false); setStripeSaleId(null) }
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
              onSuccess={async (paymentIntentId: string) => {
                setShowStripeCheckout(false)
                setStripeSaleId(null)
                setPaymentStatus("Card payment confirmed. Opening receipt...")
                await onCompletePayment(receiptNumber, "card", {
                  skipSaleCreation: true,
                  saleId: stripeSaleId,
                  stripePaymentIntentId: paymentIntentId,
                })
              }}
              onError={(error: string) => {
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

      {/* ── Success Animation ──────────────────────────────── */}
      <PaymentSuccessAnimation
        show={showSuccessAnimation}
        confirmed={animationConfirmed}
        method={selectedMethod}
        receiptNumber={receiptNumber}
        totalAmount={total}
        customerEmail={customer?.email}
        onComplete={() => {
          setShowSuccessAnimation(false)
          setAnimationConfirmed(false)
          // Wait for animation, then show receipt
          setTimeout(() => setShowReceipt(true), 300)
        }}
        onViewReceipt={() => {
          setShowSuccessAnimation(false)
          setAnimationConfirmed(false)
          setTimeout(() => setShowReceipt(true), 300)
        }}
        onNewPayment={() => {
          handleComplete()
        }}
      />
    </>
  )
}
