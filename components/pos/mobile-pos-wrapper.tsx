'use client'

import { useCallback, useMemo, useState } from 'react'
import { MobilePOS } from '@/components/pos/mobile-pos'
import { type SaleItem, createSaleTransaction } from '@/lib/modules/sales'
import { completePaymentAction } from '@/lib/actions/complete-payment-action'
import { QuickShiftDialog } from '@/components/pos/quick-shift-dialog'
import { useShiftGuard } from '@/hooks/use-shift-guard'
import { useToast } from '@/hooks/use-toast'
import { useReceiptSettings } from '@/hooks/use-receipt-settings'

// ── Product shape (subset of POSProduct for MobilePOS) ───────────────────
interface POSProduct {
  id: string
  name: string
  sku: string
  selling_price?: number
  quantity: number
  category?: { id: string; name: string; icon?: string } | null
}

// ── Mobile POS Product shape (as MobilePOS expects) ──────────────────────
interface MobileProduct {
  id: string
  name: string
  sku: string
  barcode: string | null
  selling_price: number
  image_url: string | null
  stock_quantity: number
  category: string
}

interface MobileCartItem {
  id: string
  product: MobileProduct
  quantity: number
  unit_price: number
  total: number
}

// ── Props ─────────────────────────────────────────────────────────────────
interface MobilePOSWrapperProps {
  allProducts: POSProduct[]
  profile: {
    id: string
    branch_id?: string | null
    full_name?: string | null
    role?: string | null
  }
  branchName?: string
  onSaleCompleted?: () => void
}

// ── Wrapper ───────────────────────────────────────────────────────────────
export function MobilePOSWrapper({
  allProducts,
  profile,
  branchName,
  onSaleCompleted,
}: MobilePOSWrapperProps) {
  const { toast } = useToast()
  const { settings: receiptSettings } = useReceiptSettings(
    profile?.branch_id ?? undefined
  )

  // Shift guard
  const {
    activeShift,
    isLoading: shiftLoading,
    hasActiveShift,
    openNewShift,
    closeActiveShift,
  } = useShiftGuard({
    branchId: profile?.branch_id ?? null,
    cashierId: profile?.id ?? '',
  })
  const [showShiftDialog, setShowShiftDialog] = useState(false)
  const [shiftDialogMode, setShiftDialogMode] = useState<'open' | 'close'>('open')

  // Map POSProduct[] → MobileProduct[]
  const mobileProducts: MobileProduct[] = useMemo(
    () =>
      allProducts.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        barcode: null,
        selling_price: p.selling_price ?? 0,
        image_url: null,
        stock_quantity: p.quantity,
        category: p.category?.name ?? 'General',
      })),
    [allProducts]
  )

  // Checkout: bridge MobilePOS cart → completePaymentAction
  const handleCheckout = useCallback(
    async (items: MobileCartItem[], paymentMethod: string) => {
      if (!profile?.branch_id || !profile?.id) {
        toast({ title: 'Error', description: 'Profile not loaded', variant: 'destructive' })
        return
      }

      // Map to SaleItem[]
      const saleItems = items.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        discountPercent: 0,
      })) as any[]

      const subtotal = items.reduce((sum, item) => sum + item.total, 0)

      // For M-Pesa, create a pending sale first then trigger STK push
      if (paymentMethod === 'mpesa') {
        const createResult = await createSaleTransaction({
          branch_id: profile.branch_id,
          cashier_id: profile.id,
          items: items.map((i) => ({
            product_id: i.product.id,
            quantity: i.quantity,
            unit_price: i.unit_price,
          })),
          payment_method: 'mpesa',
          notes: 'Mobile POS Sale',
          payment_status: 'pending',
        })
        if (!createResult.success || !createResult.sale_id) {
          throw new Error(createResult.error || 'Failed to create pending M-Pesa sale')
        }
        const saleId = createResult.sale_id

        const stkResponse = await fetch('/api/mpesa/stk-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            saleId,
            amount: subtotal,
            phone: '',
          }),
        })
        const stkResult = await stkResponse.json()
        if (!stkResult.success) {
          throw new Error(stkResult.error || 'M-Pesa STK push failed')
        }
        return
      }

      // For cash/card/credit — call completePaymentAction directly
      const paymentResult = await completePaymentAction({
        branchId: profile.branch_id,
        cashierId: profile.id,
        shiftId: activeShift?.id,
        items: saleItems as any,
        paymentMethod: paymentMethod as 'cash' | 'card' | 'bank_transfer' | 'cheque' | 'credit',
        customerId: undefined,
        cartDiscount: 0,
        receiptSettings: (receiptSettings ?? {}) as Record<string, unknown>,
      })

      if (!paymentResult.success) {
        throw new Error(paymentResult.error || 'Payment failed')
      }

      onSaleCompleted?.()

      toast({
        title: 'Sale Completed',
        description: `Receipt #${paymentResult.receiptData?.receipt_number ?? ''}`,
      })
    },
    [profile, activeShift?.id, receiptSettings, toast, onSaleCompleted]
  )

  // Shift status indicator area
  const shiftIndicator = (
    <div className="flex items-center gap-2">
      {!shiftLoading && (
        <button
          onClick={() => {
            if (hasActiveShift) {
              setShiftDialogMode('close')
            } else {
              setShiftDialogMode('open')
            }
            setShowShiftDialog(true)
          }}
          className="text-xs flex items-center gap-1 px-2 py-1 rounded-full border"
        >
          <span
            className={`h-2 w-2 rounded-full ${
              hasActiveShift ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            }`}
          />
          {hasActiveShift ? 'Shift Open' : 'No Shift'}
        </button>
      )}
    </div>
  )

  return (
    <>
      <MobilePOS products={mobileProducts} onCheckout={handleCheckout} />

      {/* Shift Dialog */}
      <QuickShiftDialog
        open={showShiftDialog}
        onOpenChange={setShowShiftDialog}
        mode={shiftDialogMode}
        activeShift={activeShift ?? null}
        cashierName={profile?.full_name || 'Cashier'}
        onOpenShift={openNewShift as any}
        onCloseShift={closeActiveShift}
      />
    </>
  )
}
