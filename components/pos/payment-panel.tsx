"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
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
} from "lucide-react"
import type { SelectedCustomer } from "@/app/(dashboard)/pos/page"
import { ReceiptPreview, type SaleDetailsData } from "@/components/receipt-preview"
import { isReceiptPayloadValid } from "@/lib/receipt-builder"
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
  branchId?: string
  fullSaleData?: SaleDetailsData | null
  onReceiptClose?: () => void
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

type PaymentMethod = "cash" | "mpesa"

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
  loyaltyRedemption,
  onRedemptionPointsChange,
}: PaymentPanelProps) {
  const { toast } = useToast()
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("cash")
  const [amountReceived, setAmountReceived] = useState("")
  const [mpesaPhone, setMpesaPhone] = useState("")
  const [discountInput, setDiscountInput] = useState(cartDiscount > 0 ? cartDiscount.toString() : "")
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

  useEffect(() => {
    if (!showPayment) return

    if (fullSaleData && isReceiptPayloadValid(fullSaleData)) {
      setShowReceipt(true)
      onShowPayment(false)
    }
  }, [fullSaleData, showPayment, onShowPayment])

  useEffect(() => {
    if (!customer?.phone) return

    setMpesaPhone((currentPhone) => currentPhone || customer.phone)
  }, [customer?.phone])

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

          await onCompletePayment(receiptNumber, "mpesa", {
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
          console.warn("[PAYMENT] Failed to poll M-Pesa status:", error)
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
    onCompletePayment,
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
  }

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

      const cleanedPhone = mpesaPhone.trim()
      if (!cleanedPhone) {
        throw new Error("Enter the customer's M-Pesa phone number before sending the prompt.")
      }

      setPaymentStatus("Creating pending M-Pesa sale...")

      await onCompletePayment(newReceiptNumber, "mpesa", {
        mpesaPhone: cleanedPhone,
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
      console.error("[PAYMENT] Error during payment:", errorMessage)
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

  const cashTotalDue = Math.max(0, total - (loyaltyRedemption?.redemptionDiscount || 0))

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
      ? isProcessing || parseFloat(amountReceived || "0") < cashTotalDue
      : isProcessing || !mpesaPhone.trim()

  const paymentButtonLabel = selectedMethod === "cash"
    ? isProcessing
      ? "Saving Cash Sale..."
      : "Complete Cash Payment"
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
          {(itemDiscounts + cartDiscount) > 0 && (
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
              redemption is available only for named customers on cash sales.
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
                {selectedMethod === "cash" && (loyaltyRedemption?.redemptionDiscount || 0) > 0 && (
                  <div className="flex justify-between text-destructive">
                    <span className="text-muted-foreground">Loyalty Redemption</span>
                    <span>-{formatKSh(loyaltyRedemption?.redemptionDiscount || 0)}</span>
                  </div>
                )}

                <Separator className="my-2" />

                <div className="flex justify-between items-center">
                  <span className="font-bold text-base">Total to Pay</span>
                  <span className="font-bold text-2xl text-primary">
                    {formatKSh(selectedMethod === "cash" ? cashTotalDue : total)}
                  </span>
                </div>
              </div>

              {selectedMethod === "cash" && customer && loyaltyRedemption && (
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
                        {formatKSh(loyaltyRedemption.redeemValueCents / 100)}
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
                          <span>{formatKSh(cashTotalDue)}</span>
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

              <div className="grid grid-cols-2 gap-2">
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
                  <div className="grid grid-cols-4 gap-2">
                    {[cashTotalDue, Math.ceil(cashTotalDue / 100) * 100, Math.ceil(cashTotalDue / 500) * 500, Math.ceil(cashTotalDue / 1000) * 1000].map((amount, i) => (
                      <Button
                        key={i}
                        variant="outline"
                        size="sm"
                        onClick={() => setAmountReceived(amount.toString())}
                        className="text-xs"
                      >
                        {formatKSh(amount)}
                      </Button>
                    ))}
                  </div>
                  {parseFloat(amountReceived) >= cashTotalDue && (
                    <div className="flex justify-between p-4 rounded-lg bg-success/10 text-success border border-success/20">
                      <span className="font-medium">Change to Return</span>
                      <span className="font-bold text-lg">{formatKSh(change)}</span>
                    </div>
                  )}
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
    </>
  )
}
