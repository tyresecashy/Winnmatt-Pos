'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface MpesaPaymentFormProps {
  phone: string
  onPhoneChange: (value: string) => void
  disabled?: boolean
}

export function MpesaPaymentForm({ phone, onPhoneChange, disabled }: MpesaPaymentFormProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="mpesaPhone">Customer M-Pesa Phone Number</Label>
        <Input
          id="mpesaPhone"
          type="tel"
          placeholder="e.g. 0712345678"
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          className="text-lg h-12"
          disabled={disabled}
        />
      </div>
      <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Send the STK prompt, then wait for the customer to enter their M-Pesa PIN on their phone.
      </div>
    </div>
  )
}
