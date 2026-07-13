'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { formatKSh } from '@/lib/currency'

export interface LoyaltyRedemptionData {
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

interface LoyaltyRedemptionSectionProps {
  data: LoyaltyRedemptionData
  totalAfterRedemption: number
  onPointsChange: (points: number) => void
  disabled?: boolean
}

export function LoyaltyRedemptionSection({
  data,
  totalAfterRedemption,
  onPointsChange,
  disabled,
}: LoyaltyRedemptionSectionProps) {
  return (
    <div className="space-y-3 rounded-lg border bg-primary/5 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Loyalty Redemption</div>
          <div className="text-xs text-muted-foreground">
            Customer balance: {data.currentBalance.toLocaleString()} pts
          </div>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div>Value per point</div>
          <div className="font-medium text-foreground">
            {formatKSh(data.redeemValueCents)}
          </div>
        </div>
      </div>

      {data.loading ? (
        <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Checking loyalty redemption eligibility...
        </div>
      ) : data.eligible ? (
        <>
          <div className="grid grid-cols-[1fr_auto_auto] gap-2">
            <div className="space-y-2">
              <Label htmlFor="redeemPoints">Points to Redeem</Label>
              <Input
                id="redeemPoints"
                type="number"
                min={0}
                max={data.maxRedeemablePoints}
                value={data.pointsToRedeem > 0 ? data.pointsToRedeem : ''}
                onChange={(e) => onPointsChange(parseInt(e.target.value || '0', 10))}
                disabled={disabled}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="self-end"
              disabled={disabled}
              onClick={() => onPointsChange(data.maxRedeemablePoints)}
            >
              Max
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="self-end"
              disabled={disabled || data.pointsToRedeem === 0}
              onClick={() => onPointsChange(0)}
            >
              Clear
            </Button>
          </div>

          <div className="rounded-md bg-background px-3 py-2 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Redeemable now</span>
              <span>
                up to {data.maxRedeemablePoints.toLocaleString()} pts
                {' '}({formatKSh(data.maxRedeemableDiscount)})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Redemption value</span>
              <span>-{formatKSh(data.redemptionDiscount)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>New cash total</span>
              <span>{formatKSh(totalAfterRedemption)}</span>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {data.reason || 'This customer is not eligible to redeem points on this sale.'}
        </div>
      )}
    </div>
  )
}
