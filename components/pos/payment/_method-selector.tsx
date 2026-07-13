'use client'

import { Card } from '@/components/ui/card'
import { Banknote, Smartphone, CreditCard } from 'lucide-react'

export type PaymentMethod = 'cash' | 'mpesa' | 'card'

interface PaymentMethodSelectorProps {
  selected: PaymentMethod
  onSelect: (method: PaymentMethod) => void
  disabled?: boolean
}

const methods: { key: PaymentMethod; icon: typeof Banknote; label: string }[] = [
  { key: 'cash', icon: Banknote, label: 'Cash' },
  { key: 'mpesa', icon: Smartphone, label: 'M-Pesa' },
  { key: 'card', icon: CreditCard, label: 'Card' },
]

export function PaymentMethodSelector({ selected, onSelect, disabled }: PaymentMethodSelectorProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {methods.map(({ key, icon: Icon, label }) => (
        <Card
          key={key}
          className={`p-4 cursor-pointer text-center transition-all border-2 ${
            selected === key
              ? 'bg-primary/10 text-primary border-primary'
              : 'border-border hover:border-primary/40'
          }`}
          onClick={() => {
            if (disabled) return
            onSelect(key)
          }}
        >
          <Icon className="h-6 w-6 mx-auto mb-2" />
          <span className="text-sm font-medium">{label}</span>
        </Card>
      ))}
    </div>
  )
}
