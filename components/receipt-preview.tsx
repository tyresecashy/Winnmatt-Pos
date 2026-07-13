'use client'
import { logger } from '@/lib/logger';

import { Button } from '@/components/ui/button'
import { formatKSh } from '@/lib/currency'
import { CheckCircle2, Printer, Star, UserRound, X } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

export interface SaleItem {
  id: string
  product_id: string
  quantity: number
  unit_price: number
  discount_percent: number
  line_total: number
  product: {
    id: string
    sku: string
    name: string
  }
}

export interface SaleDetailsData {
  id: string
  receipt_number: string
  created_at: string
  subtotal: number
  discount_amount: number
  tax_amount: number
  total_amount: number
  payment_method: string
  payment_status: string
  notes: string | null
  cashier: {
    id: string
    full_name: string
  }
  customer: {
    id: string
    name: string
    phone: string
    loyalty_points?: number
  } | null
  branch: {
    id: string
    name: string
    code: string
  }
  items: SaleItem[]
  businessSettings: {
    business_name: string
    phone: string
    email: string
    address: string
    tax_pin: string
    receipt_footer_text: string
    thank_you_message: string
  }
  branchSettings?: {
    receipt_header_text: string
    phone_number: string
    email: string
    address: string
  }
  loyalty?: {
    points_earned: number
    points_redeemed?: number
    new_balance: number
  }
}

interface ReceiptPreviewProps {
  saleData: SaleDetailsData
  showPrintButton?: boolean
  showCloseButton?: boolean
  onPrint?: () => void
  onClose?: () => void
}

function formatPaymentLabel(method: string | undefined) {
  const paymentMethodMap: Record<string, string> = {
    cash: 'Cash',
    mpesa: 'M-Pesa',
    paybill: 'Paybill',
    card: 'Card',
    bank_transfer: 'Bank Transfer',
    cheque: 'Cheque',
    credit: 'Credit',
  }

  if (!method) {
    return 'Unknown'
  }

  return (
    paymentMethodMap[method] ||
    String(method)
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase())
  )
}

function formatStatusLabel(status: string | undefined) {
  return (status || 'completed')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function ReceiptPreview({
  saleData,
  showPrintButton = true,
  showCloseButton = true,
  onPrint,
  onClose,
}: ReceiptPreviewProps) {
  const safeBusiness = {
    name: saleData?.businessSettings?.business_name || 'Winnmatt',
    phone: saleData?.businessSettings?.phone || '',
    email: saleData?.businessSettings?.email || '',
    address: saleData?.businessSettings?.address || '',
    taxPin: saleData?.businessSettings?.tax_pin || '',
    thankYouMessage:
      saleData?.businessSettings?.thank_you_message || 'Thank you for your purchase!',
    footerText: saleData?.businessSettings?.receipt_footer_text || '',
  }

  const safeBranch = {
    name: saleData?.branch?.name || 'Main Branch',
    code: saleData?.branch?.code || '',
    headerText: saleData?.branchSettings?.receipt_header_text || '',
  }

  const safeCashier = {
    name: saleData?.cashier?.full_name || 'Unknown Cashier',
  }

  const safeCustomer = {
    name: saleData?.customer?.name || null,
    phone: saleData?.customer?.phone || null,
    loyaltyPoints: saleData?.customer?.loyalty_points || 0,
  }

  const safeItems: SaleItem[] = Array.isArray(saleData?.items) ? saleData.items : []
  const safeReceiptNumber = saleData?.receipt_number || 'UNKNOWN'

  let dateStr = 'N/A'
  let timeStr = 'N/A'

  try {
    if (saleData?.created_at) {
      const receiptDate = new Date(saleData.created_at)
      if (!Number.isNaN(receiptDate.getTime())) {
        dateStr = receiptDate.toLocaleDateString('en-KE', {
          year: 'numeric',
          month: 'short',
          day: '2-digit',
          timeZone: 'Africa/Nairobi',
        })
        timeStr = receiptDate.toLocaleTimeString('en-KE', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone: 'Africa/Nairobi',
        })
      }
    }
  } catch (error) {
    logger.error('Failed to parse receipt date:', error)
  }

  const safeTotals = {
    subtotal: typeof saleData?.subtotal === 'number' ? saleData.subtotal : 0,
    discountAmount: typeof saleData?.discount_amount === 'number' ? saleData.discount_amount : 0,
    taxAmount: typeof saleData?.tax_amount === 'number' ? saleData.tax_amount : 0,
    totalAmount: typeof saleData?.total_amount === 'number' ? saleData.total_amount : 0,
  }

  const safePaymentMethod = formatPaymentLabel(saleData?.payment_method)
  const safePaymentStatusLabel = formatStatusLabel(saleData?.payment_status)

  const safeLoyalty = saleData?.loyalty
    ? {
        pointsEarned: saleData.loyalty.points_earned || 0,
        pointsRedeemed: saleData.loyalty.points_redeemed || 0,
        newBalance: saleData.loyalty.new_balance || 0,
      }
    : null

  const safeNotes = typeof saleData?.notes === 'string' ? saleData.notes : null

  const itemDiscountsTotal = safeItems.reduce(
    (sum, item) =>
      sum +
      ((item?.unit_price || 0) *
        (item?.quantity || 0) *
        ((item?.discount_percent || 0) / 100)),
    0
  )

  const showLoyaltySection =
    !!safeLoyalty &&
    ((safeLoyalty.pointsEarned || 0) > 0 || (safeLoyalty.pointsRedeemed || 0) > 0)

  const handlePrint = () => {
    onPrint?.()

    const handleAfterPrint = () => {
      window.removeEventListener('afterprint', handleAfterPrint)
      onClose?.()
    }

    window.addEventListener('afterprint', handleAfterPrint)
    window.print()
  }

  return (
    <div className="receipt-shell text-slate-950">
      <style>{`
        @media print {
          @page {
            size: 80mm auto;
            margin: 0;
          }

          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            width: 80mm !important;
            min-width: 80mm !important;
            max-width: 80mm !important;
            min-height: auto !important;
            height: auto !important;
            background: #fff !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          body * {
            visibility: hidden !important;
          }

          .receipt-shell,
          .receipt-shell * {
            visibility: visible !important;
          }

          .receipt-shell {
            display: block !important;
            width: 80mm !important;
            min-width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .receipt-actions,
          .receipt-screen {
            display: none !important;
          }

          .receipt-print {
            display: block !important;
            width: 80mm !important;
            margin: 0 !important;
            padding: 4mm 4mm 3mm 4mm !important;
            background: #fff !important;
          }

          .receipt-print * {
            box-shadow: none !important;
            text-shadow: none !important;
          }

          .receipt-print table {
            width: 100% !important;
            border-collapse: collapse !important;
          }

          .receipt-print td,
          .receipt-print th {
            padding: 4px 0 !important;
            vertical-align: top !important;
          }

          .receipt-print-row,
          .receipt-print-divider,
          .receipt-print-footer {
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      <div className="receipt-actions mx-auto mb-4 flex max-w-md gap-2 print:hidden">
        {showPrintButton && (
          <Button size="sm" onClick={handlePrint} className="flex-1" variant="default">
            <Printer className="mr-2 h-4 w-4" />
            Print Receipt
          </Button>
        )}
        {showCloseButton && (
          <Button size="sm" onClick={onClose} variant="outline" className="flex-1">
            <X className="mr-2 h-4 w-4" />
            Close
          </Button>
        )}
      </div>

      <article className="receipt-screen mx-auto max-w-md rounded-[28px] bg-[linear-gradient(180deg,#f7f4ef_0%,#fbfaf8_100%)] p-5 shadow-[0_24px_60px_rgba(15,23,42,0.12)] print:hidden">
        <header className="rounded-[22px] bg-white/82 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-2xl font-semibold italic tracking-tight text-[#c2141c]">
              WINNMATT
            </div>
            <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-slate-500">
              Receipt
            </div>
          </div>
          <div className="mt-5 flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[#c2141c]">
                Receipt Number
              </div>
              <div className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
                {safeReceiptNumber}
              </div>
              <div className="mt-2 text-sm text-slate-600">
                {safeBranch.name}
                {safeBranch.code ? ` · ${safeBranch.code}` : ''}
              </div>
              {safeBranch.headerText && (
                <div className="mt-1 text-xs text-slate-500">{safeBranch.headerText}</div>
              )}
            </div>
            <div className="text-right">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {safePaymentStatusLabel}
              </div>
              <div className="mt-3 text-xs text-slate-500">{dateStr}</div>
              <div className="text-xs text-slate-500">{timeStr}</div>
            </div>
          </div>
        </header>

        <section className="mt-5 rounded-[24px] bg-white/88 px-5 py-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Total Paid
          </div>
          <div className="mt-2 text-[2.9rem] font-semibold leading-none tracking-tight text-slate-950">
            {formatKSh(safeTotals.totalAmount)}
          </div>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Payment</div>
              <div className="mt-1 font-medium text-slate-900">{safePaymentMethod}</div>
            </div>
            <div className="sm:text-right">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Customer</div>
              <div className="mt-1 font-medium text-slate-900">
                {safeCustomer.name || 'Walk-in Customer'}
              </div>
              {safeCustomer.phone && (
                <div className="mt-1 text-xs text-slate-500">{safeCustomer.phone}</div>
              )}
            </div>
          </div>
        </section>

        {showLoyaltySection && safeLoyalty && (
          <section className="mt-5 rounded-[24px] bg-[linear-gradient(180deg,#c20f18_0%,#9c0912_100%)] px-5 py-5 text-white">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/75">
              <Star className="h-4 w-4" />
              Loyalty Summary
            </div>
            <div className="mt-3 text-3xl font-semibold tracking-tight">
              {safeCustomer.loyaltyPoints.toLocaleString()} pts
            </div>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-2xl bg-white/10 px-3 py-3">
                <div className="text-xs uppercase tracking-[0.18em] text-white/70">Earned</div>
                <div className="mt-1 font-semibold">
                  +{safeLoyalty.pointsEarned.toLocaleString()}
                </div>
              </div>
              <div className="rounded-2xl bg-white/10 px-3 py-3">
                <div className="text-xs uppercase tracking-[0.18em] text-white/70">Redeemed</div>
                <div className="mt-1 font-semibold">
                  -{safeLoyalty.pointsRedeemed.toLocaleString()}
                </div>
              </div>
              <div className="rounded-2xl bg-white/10 px-3 py-3">
                <div className="text-xs uppercase tracking-[0.18em] text-white/70">New Balance</div>
                <div className="mt-1 font-semibold">
                  {safeLoyalty.newBalance.toLocaleString()}
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="mt-5 rounded-[24px] bg-white/88 px-5 py-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-3xl leading-none tracking-tight text-slate-950">
                Transaction Ledger
              </div>
              <div className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                {safeItems.length} {safeItems.length === 1 ? 'item' : 'items'}
              </div>
            </div>
            <div className="hidden text-right text-xs text-slate-500 sm:block">
              <div>{safeBusiness.phone}</div>
              <div>{safeBusiness.email}</div>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {safeItems.length > 0 ? (
              safeItems.map((item) => (
                <div
                  key={item.id || `${item.product_id}-${item.quantity}`}
                  className="flex gap-3 rounded-2xl bg-slate-50/80 px-3 py-3"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-200/80 text-slate-500">
                    <UserRound className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-950">
                          {item?.product?.name || 'Unknown Item'}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {item?.product?.sku || 'N/A'} · Qty {item?.quantity ?? 0}
                          {(item?.discount_percent || 0) > 0
                            ? ` · ${item.discount_percent}% off`
                            : ''}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-slate-950">
                          {formatKSh(item?.line_total ?? 0)}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {formatKSh(item?.unit_price ?? 0)} each
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
              <EmptyState title="No items" compact />
              </div>
            )}
          </div>

          <div className="mt-6 border-t border-dashed border-slate-300 pt-5">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-4 text-slate-600">
                <span>Subtotal</span>
                <span>{formatKSh(safeTotals.subtotal)}</span>
              </div>
              {itemDiscountsTotal > 0 && (
                <div className="flex justify-between gap-4 text-amber-700">
                  <span>Item Discounts</span>
                  <span>-{formatKSh(Math.round(itemDiscountsTotal))}</span>
                </div>
              )}
              {safeTotals.discountAmount > 0 && (
                <div className="flex justify-between gap-4 text-amber-700">
                  <span>Discount</span>
                  <span>-{formatKSh(safeTotals.discountAmount)}</span>
                </div>
              )}
              {safeTotals.taxAmount > 0 && (
                <div className="flex justify-between gap-4 text-slate-600">
                  <span>Tax</span>
                  <span>+{formatKSh(safeTotals.taxAmount)}</span>
                </div>
              )}
            </div>
            <div className="mt-5 flex items-end justify-between gap-4">
              <div className="text-[1.2rem] font-semibold uppercase tracking-[0.18em] text-slate-950">
                Total
              </div>
              <div className="text-[2rem] font-semibold tracking-tight text-slate-950">
                {formatKSh(safeTotals.totalAmount)}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-[24px] bg-white/76 px-5 py-5">
          <div className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Cashier</div>
              <div className="mt-1 font-medium text-slate-950">{safeCashier.name}</div>
            </div>
            <div className="sm:text-right">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Location</div>
              <div className="mt-1 font-medium text-slate-950">{safeBranch.name}</div>
              {safeBusiness.address && (
                <div className="mt-1 text-xs text-slate-500">{safeBusiness.address}</div>
              )}
            </div>
          </div>
          {safeNotes && (
            <div className="mt-4 rounded-2xl bg-slate-50 px-3 py-3 text-xs text-slate-600">
              <span className="font-semibold text-slate-700">Note:</span> {safeNotes}
            </div>
          )}
          <div className="mt-4 text-center text-xs text-slate-500">
            {safeBusiness.thankYouMessage}
            {safeBusiness.footerText ? ` · ${safeBusiness.footerText}` : ''}
            {safeBusiness.taxPin ? ` · Tax ID: ${safeBusiness.taxPin}` : ''}
          </div>
        </section>
      </article>

      <article className="receipt-print hidden">
        <header className="text-center text-[11px]">
          <div className="text-[10px] font-semibold uppercase tracking-[0.26em]">WINNMATT</div>
          <div className="mt-1 text-base font-semibold">{safeBusiness.name}</div>
          {safeBranch.headerText && <div className="mt-1">{safeBranch.headerText}</div>}
          <div className="mt-1">
            {safeBranch.name}
            {safeBranch.code ? ` · ${safeBranch.code}` : ''}
          </div>
          {safeBusiness.phone && <div className="mt-1">{safeBusiness.phone}</div>}
          {safeBusiness.address && <div className="mt-1">{safeBusiness.address}</div>}
        </header>

        <div className="receipt-print-divider mt-3 border-t border-dashed border-slate-400" />

        <section className="receipt-print-row mt-3 space-y-1 text-[11px]">
          <div className="flex justify-between gap-4">
            <span className="font-semibold">Receipt #</span>
            <span>{safeReceiptNumber}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Date</span>
            <span>{dateStr}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Time</span>
            <span>{timeStr}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Cashier</span>
            <span>{safeCashier.name}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Customer</span>
            <span>{safeCustomer.name || 'Walk-in Customer'}</span>
          </div>
          {safeCustomer.phone && (
            <div className="flex justify-between gap-4">
              <span>Phone</span>
              <span>{safeCustomer.phone}</span>
            </div>
          )}
        </section>

        <div className="receipt-print-divider mt-3 border-t border-dashed border-slate-400" />

        <section className="receipt-print-row mt-3">
          <table className="text-[11px]">
            <thead>
              <tr className="border-b border-black/15">
                <th className="pb-1 text-left font-semibold">Item</th>
                <th className="pb-1 text-right font-semibold">Qty</th>
                <th className="pb-1 text-right font-semibold">Price</th>
                <th className="pb-1 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {safeItems.map((item) => (
                <tr key={item.id || `${item.product_id}-${item.quantity}`}>
                  <td className="pr-2">
                    <div>{item?.product?.name || 'Unknown Item'}</div>
                    <div className="text-[10px] text-black/70">
                      {item?.product?.sku || 'N/A'}
                      {(item?.discount_percent || 0) > 0
                        ? ` · ${item.discount_percent}% off`
                        : ''}
                    </div>
                  </td>
                  <td className="text-right">{item?.quantity ?? 0}</td>
                  <td className="text-right">{formatKSh(item?.unit_price ?? 0)}</td>
                  <td className="text-right">{formatKSh(item?.line_total ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="receipt-print-divider mt-3 border-t border-dashed border-slate-400" />

        <section className="receipt-print-row mt-3 space-y-1 text-[11px]">
          <div className="flex justify-between gap-4">
            <span>Subtotal</span>
            <span>{formatKSh(safeTotals.subtotal)}</span>
          </div>
          {itemDiscountsTotal > 0 && (
            <div className="flex justify-between gap-4">
              <span>Item Discounts</span>
              <span>-{formatKSh(Math.round(itemDiscountsTotal))}</span>
            </div>
          )}
          {safeTotals.discountAmount > 0 && (
            <div className="flex justify-between gap-4">
              <span>Discount</span>
              <span>-{formatKSh(safeTotals.discountAmount)}</span>
            </div>
          )}
          {safeTotals.taxAmount > 0 && (
            <div className="flex justify-between gap-4">
              <span>Tax</span>
              <span>+{formatKSh(safeTotals.taxAmount)}</span>
            </div>
          )}
          <div className="flex justify-between gap-4 border-t border-black/15 pt-2 text-sm font-semibold">
            <span>Total</span>
            <span>{formatKSh(safeTotals.totalAmount)}</span>
          </div>
        </section>

        <div className="receipt-print-divider mt-3 border-t border-dashed border-slate-400" />

        <section className="receipt-print-row mt-3 space-y-1 text-[11px]">
          <div className="flex justify-between gap-4">
            <span>Payment Method</span>
            <span>{safePaymentMethod}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Status</span>
            <span>{safePaymentStatusLabel}</span>
          </div>
        </section>

        {showLoyaltySection && safeLoyalty && (
          <>
            <div className="receipt-print-divider mt-3 border-t border-dashed border-slate-400" />
            <section className="receipt-print-row mt-3 space-y-1 text-[11px]">
              <div className="flex justify-between gap-4">
                <span>Points Earned</span>
                <span>+{safeLoyalty.pointsEarned.toLocaleString()}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span>Points Redeemed</span>
                <span>-{safeLoyalty.pointsRedeemed.toLocaleString()}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span>New Balance</span>
                <span>{safeLoyalty.newBalance.toLocaleString()} pts</span>
              </div>
            </section>
          </>
        )}

        {safeNotes && (
          <>
            <div className="receipt-print-divider mt-3 border-t border-dashed border-slate-400" />
            <div className="receipt-print-row mt-3 text-[11px]">Note: {safeNotes}</div>
          </>
        )}

        <div className="receipt-print-divider mt-3 border-t border-dashed border-slate-400" />

        <footer className="receipt-print-footer mt-3 text-center text-[11px]">
          {safeBusiness.thankYouMessage && <div>{safeBusiness.thankYouMessage}</div>}
          {safeBusiness.footerText && <div className="mt-1">{safeBusiness.footerText}</div>}
          {safeBusiness.taxPin && <div className="mt-1">Tax ID: {safeBusiness.taxPin}</div>}
          <div className="mt-1">Powered by Winnmatt POS</div>
        </footer>
      </article>
    </div>
  )
}
