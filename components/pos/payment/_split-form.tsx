'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatKSh } from '@/lib/currency'
import { Plus, X, Wand2, Split } from 'lucide-react'

export interface SplitEntry {
  id: string
  method: 'cash' | 'card' | 'bank_transfer' | 'cheque' | 'credit'
  amount: number
}

interface SplitPaymentFormProps {
  enabled: boolean
  onToggle: (enabled: boolean) => void
  splits: SplitEntry[]
  splitAmountInputs: Record<string, string>
  onAddSplit: () => void
  onRemoveSplit: (id: string) => void
  onUpdateSplitMethod: (id: string, method: SplitEntry['method']) => void
  onUpdateSplitAmount: (id: string, value: string) => void
  totalToPay: number
  disabled?: boolean
}

const splitColors = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
]

export function SplitPaymentForm({
  enabled,
  onToggle,
  splits,
  splitAmountInputs,
  onAddSplit,
  onRemoveSplit,
  onUpdateSplitMethod,
  onUpdateSplitAmount,
  totalToPay,
  disabled,
}: SplitPaymentFormProps) {
  const allocated = splits.reduce((s, sp) => s + sp.amount, 0)
  const remaining = totalToPay - allocated

  return (
    <div className="space-y-3">
      {/* Toggle */}
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="splitPayment"
            checked={enabled}
            onCheckedChange={(checked) => {
              if (disabled) return
              onToggle(!!checked)
            }}
          />
          <Label htmlFor="splitPayment" className="text-sm font-medium cursor-pointer">Split Payment</Label>
        </div>
        <span className="text-xs text-muted-foreground">Multiple methods</span>
      </div>

      {enabled && (
        <div className="space-y-3 rounded-lg border bg-muted/10 p-3">
          {/* Header + Auto-Balance */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Payment Allocation
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs gap-1"
              onClick={() => {
                const rem = totalToPay - splits.reduce((s, sp) => s + sp.amount, 0)
                if (rem <= 0 || splits.length === 0) return
                const perSplit = Math.floor(rem / splits.length)
                const extra = rem - perSplit * splits.length
                splits.forEach((sp, i) => {
                  const newAmt = sp.amount + perSplit + (i === 0 ? extra : 0)
                  onUpdateSplitAmount(sp.id, String(newAmt))
                })
              }}
              disabled={disabled || splits.length === 0}
            >
              <Wand2 className="h-3 w-3 mr-1" />
              Auto-Balance
            </Button>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {formatKSh(allocated)} / {formatKSh(totalToPay)}
              </span>
              <span className={remaining > 0 ? 'text-destructive font-medium' : 'text-success font-medium'}>
                {remaining > 0 ? `${formatKSh(remaining)} remaining` : 'Fully allocated'}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden flex">
              {splits.map((sp, i) => {
                const width = totalToPay > 0 ? (sp.amount / totalToPay) * 100 : 0
                return width > 0 ? (
                  <div
                    key={sp.id}
                    className="h-2 transition-all"
                    style={{ width: `${Math.min(width, 100)}%`, backgroundColor: splitColors[i % splitColors.length] }}
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
              {splits.map((sp, i) => (
                <span key={sp.id} className="flex items-center gap-1 text-[9px] text-muted-foreground">
                  <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: splitColors[i % splitColors.length] }} />
                  {sp.method}
                </span>
              ))}
            </div>
          </div>

          {/* Quick split presets */}
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              className="text-[10px] h-7 px-2"
              onClick={() => {
                if (splits.length < 2) return
                splits.forEach((sp, i) => {
                  const half = Math.floor(totalToPay / 2)
                  onUpdateSplitAmount(sp.id, String(i === 0 ? half + (totalToPay - half * 2) : half))
                })
              }}
              disabled={disabled || splits.length < 2}
            >
              <Split className="h-3 w-3 mr-1" />
              50/50
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-[10px] h-7 px-2"
              onClick={() => {
                const perSplit = Math.floor(totalToPay / splits.length)
                const extra = totalToPay - perSplit * splits.length
                splits.forEach((sp, i) => {
                  onUpdateSplitAmount(sp.id, String(perSplit + (i === 0 ? extra : 0)))
                })
              }}
              disabled={disabled || splits.length < 2}
            >
              Equal
            </Button>
          </div>

          {/* Split rows */}
          {splits.map((split, i) => (
            <div key={split.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
              <div className="space-y-1">
                <Label className="text-xs">Method</Label>
                <Select
                  value={split.method}
                  onValueChange={(v: SplitEntry['method']) => onUpdateSplitMethod(split.id, v)}
                  disabled={disabled}
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
                  onChange={(e) => onUpdateSplitAmount(split.id, e.target.value)}
                  className="h-9"
                  disabled={disabled}
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => onRemoveSplit(split.id)}
                disabled={disabled || splits.length <= 1}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <div className="flex items-center justify-between text-sm">
            <Button variant="outline" size="sm" onClick={onAddSplit} disabled={disabled}>
              <Plus className="h-3 w-3 mr-1" />
              Add Method
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
