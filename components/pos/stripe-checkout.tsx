"use client"

/**
 * Stripe Checkout Component
 * Card payment form using Stripe Elements
 */

import { useState, useEffect } from "react"
import { loadStripe } from "@stripe/stripe-js"
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, CreditCard, AlertCircle, CheckCircle2 } from "lucide-react"
import { formatKSh } from "@/lib/currency"
import { logger } from "@/lib/logger"

// Load Stripe publishable key
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
)

interface StripeCheckoutFormProps {
  saleId: string
  amount: number
  clientSecret: string
  onSuccess: (paymentIntentId: string) => void
  onError: (error: string) => void
  onCancel: () => void
}

function StripeCheckoutForm({
  saleId,
  amount,
  clientSecret,
  onSuccess,
  onError,
  onCancel,
}: StripeCheckoutFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [isProcessing, setIsProcessing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setIsProcessing(true)
    setMessage(null)

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/pos`,
        },
        redirect: "if_required",
      })

      if (error) {
        setMessage(error.message || "Payment failed")
        onError(error.message || "Payment failed")
      } else {
        // Payment succeeded - get the paymentIntent from elements/stripe
        setMessage("Payment successful!")
        // We need to get the real paymentIntent ID; stripe.confirmPayment returns it
        // Since redirect: "if_required", the paymentIntent is available from the stripe object
        try {
          const piElement = elements.getElement(PaymentElement)
          if (piElement) {
            // The payment intent ID is available from the URL fragment or from Stripe
            const { paymentIntent: confirmedPi } = await stripe.retrievePaymentIntent(clientSecret)
            if (confirmedPi) {
              onSuccess(confirmedPi.id)
              return
            }
          }
        } catch {
          // fallback: use clientSecret to extract payment intent ID
        }
        // Fallback: extract from clientSecret (format: pi_xxx_secret_yyy)
        const piId = clientSecret ? clientSecret.split('_secret_')[0] : ''
        onSuccess(piId || 'payment_confirmed')
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Payment failed"
      setMessage(errorMsg)
      onError(errorMsg)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-muted/30 rounded-lg p-3 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Amount to Pay</span>
          <span className="font-bold text-lg text-primary">{formatKSh(amount)}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CreditCard className="h-3.5 w-3.5" />
          <span>Secure card payment via Stripe</span>
        </div>
      </div>

      <div className="rounded-lg border p-3">
        <PaymentElement
          onReady={() => setIsReady(true)}
          onChange={(event) => {
            if (event.complete) {
              setIsReady(true)
            }
          }}
        />
      </div>

      {message && (
        <Alert
          className={
            message.includes("successful")
              ? "bg-green-50 border-green-200"
              : "bg-destructive/15 border-destructive/50"
          }
        >
          {message.includes("successful") ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : (
            <AlertCircle className="h-4 w-4 text-destructive" />
          )}
          <AlertDescription
            className={
              message.includes("successful")
                ? "text-green-800"
                : "text-destructive"
            }
          >
            {message}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={onCancel}
          disabled={isProcessing}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="flex-1"
          disabled={!stripe || !elements || isProcessing || !isReady}
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            `Pay ${formatKSh(amount)}`
          )}
        </Button>
      </div>

      <p className="text-[10px] text-center text-muted-foreground">
        Test card: 4242 4242 4242 4242, any future date, any CVC
      </p>
    </form>
  )
}

export function StripeCheckout({
  saleId,
  amount,
  onSuccess,
  onError,
  onCancel,
}: StripeCheckoutProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Create PaymentIntent on mount
    const createIntent = async () => {
      try {
        const response = await fetch("/api/stripe/create-payment-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ saleId, amount }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Failed to create payment")
        }

        setClientSecret(data.clientSecret)
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Failed to initialize payment"
        setError(errorMsg)
        onError(errorMsg)
      } finally {
        setLoading(false)
      }
    }

    createIntent()
  }, [saleId, amount, onError])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-8 space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Initializing card payment...</p>
      </div>
    )
  }

  if (error) {
    return (
      <Alert className="bg-destructive/15 border-destructive/50">
        <AlertCircle className="h-4 w-4 text-destructive" />
        <AlertDescription className="text-destructive">{error}</AlertDescription>
      </Alert>
    )
  }

  if (!clientSecret) {
    return (
      <Alert className="bg-destructive/15 border-destructive/50">
        <AlertCircle className="h-4 w-4 text-destructive" />
        <AlertDescription className="text-destructive">
          Failed to initialize Stripe payment
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: "stripe",
          variables: {
            colorPrimary: "#0f172a",
          },
        },
      }}
    >
      <StripeCheckoutForm
        saleId={saleId}
        amount={amount}
        clientSecret={clientSecret}
        onSuccess={onSuccess}
        onError={onError}
        onCancel={onCancel}
      />
    </Elements>
  )
}
