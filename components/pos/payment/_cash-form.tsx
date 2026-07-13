'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { formatKSh } from '@/lib/currency'
import { cn } from '@/lib/utils'

interface CashPaymentFormProps {
  amountReceived: string
  onAmountChange: (value: string) => void
  totalToPay: number
  disabled?: boolean
}

function changeBreakdown(change: number): { denom: number; count: number }[] {
  const denoms = [1000, 500, 200, 100, 50, 20, 10, 5, 1]
  const parts: { denom: number; count: number }[] = []
  let rem = Math.round(change)
  for (const d of denoms) {
    if (rem >= d) {
      const count = Math.floor(rem / d)
      parts.push({ denom: d, count })
      rem = rem % d
    }
  }
  return parts
}

function roundUpToNearest(amount: number, nearest: number): number {
  return Math.ceil(amount / nearest) * nearest
}

export function CashPaymentForm({ amountReceived, onAmountChange, totalToPay, disabled }: CashPaymentFormProps) {
  const received = parseFloat(amountReceived) || 0
  const change = received - totalToPay
  const hasSufficient = received >= totalToPay

  // Generate smart quick amounts
  const generateQuickAmounts = (): number[] => {
    if (totalToPay <= 0) return []
    const amounts = new Set<number>()

    // Exact amount
    amounts.add(totalToPay)

    // Round up to common denominations
    const roundUps = [50, 100, 200, 500, 1000]
    for (const denom of roundUps) {
      const rounded = roundUpToNearest(totalToPay, denom)
      if (rounded > totalToPay) amounts.add(rounded)
    }

    // Next even hundred/ thousand
    const nextHundred = Math.ceil(totalToPay / 100) * 100
    if (nextHundred > totalToPay) amounts.add(nextHundred)
    const nextFiveHundred = Math.ceil(totalToPay / 500) * 500
    if (nextFiveHundred > totalToPay) amounts.add(nextFiveHundred)
    const nextThousand = Math.ceil(totalToPay / 1000) * 1000
    if (nextThousand > totalToPay) amounts.add(nextThousand)

    return Array.from(amounts).sort((a, b) => a - b).slice(0, 6)
  }

  const quickAmounts = generateQuickAmounts()

  return (
    <div className="space-y-4">
      {/* Amount input */}
      <div className="space-y-1.5">
        <Label htmlFor="amount" className="text-sm font-medium">
          Amount Received <span className="text-muted-foreground font-normal">(KSh)</span>
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">
            KSh
          </span>
          <Input
            id="amount"
            type="number"
            placeholder="0"
            value={amountReceived}
            onChange={(e) => onAmountChange(e.target.value)}
            className="pl-10 text-lg h-12 font-mono font-semibold tabular-nums"
            disabled={disabled}
            autoFocus
          />
        </div>
      </div>

      {/* Quick amount suggestions — exact + round-up */}
      {quickAmounts.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            Quick Select
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {quickAmounts.map((amount) => {
              const isExact = amount === totalToPay
              const isSelected = parseFloat(amountReceived) === amount
              return (
                <Button
                  key={amount}
                  variant={isSelected ? 'default' : isExact ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => onAmountChange(amount.toString())}
                  className={cn(
                    'text-xs h-8 font-mono tabular-nums',
                    isSelected && 'ring-2 ring-primary/30'
                  )}
                  disabled={disabled}
                >
                  {formatKSh(amount)}
                  {isExact && <span className="ml-1 text-[9px] opacity-70">exact</span>}
                </Button>
              )
            })}
          </div>
        </div>
      )}

      {/* Denomination quick-add chip row */}
      <div className="space-y-1.5">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          Add Denomination
        </p>
        <div className="flex flex-wrap gap-1.5">
          {[50, 100, 200, 500, 1000].map((denom) => (
            <Button
              key={denom}
              variant="outline"
              size="sm"
              onClick={() => {
                const current = parseFloat(amountReceived) || 0
                onAmountChange((current + denom).toString())
              }}
              className="text-xs h-7 font-mono tabular-nums"
              disabled={disabled}
            >
              +{formatKSh(denom)}
            </Button>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAmountChange('')}
            className="text-xs h-7 text-muted-foreground"
            disabled={disabled || !amountReceived}
          >
            Clear
          </Button>
        </div>
      </div>

      {/* Change display */}
      {hasSufficient && (
        <div className="rounded-lg bg-success/10 border border-success/20 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm font-medium text-success">Change to Return</span>
            <span className="text-xl font-bold text-success tabular-nums">{formatKSh(change)}</span>
          </div>
          {change > 0 && (
            <div className="border-t border-success/10 px-4 py-2.5 bg-success/5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
                Breakdown
              </p>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {changeBreakdown(change).map((p) => (
                  <span key={p.denom} className="text-xs font-mono tabular-nums text-muted-foreground">
                    <span className="font-medium text-foreground">{p.count}</span> × {formatKSh(p.denom)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Insufficient amount hint */}
      {amountReceived && !hasSufficient && (
        <div className="rounded-lg bg-destructive/5 border border-destructive/20 px-4 py-2.5">
          <p className="text-xs text-destructive flex items-center gap-1.5">
            <span className="font-medium">Short by {formatKSh(totalToPay - received)}</span>
            <span className="text-destructive/70">— enter at least {formatKSh(totalToPay)}</span>
          </p>
        </div>
      )}
    </div>
  )
}
