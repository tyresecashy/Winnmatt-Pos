'use client'

export function CardPaymentForm() {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Card payment is processed securely via Stripe. Click &ldquo;Process Card Payment&rdquo; below to open the secure card form.
      </div>
    </div>
  )
}
