'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Printer, Download, Share2, X } from 'lucide-react'
import { formatKSh } from '@/lib/currency'
import { escapeHtml } from '@/lib/export-utils'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ReceiptItem {
  name: string
  quantity: number
  unit_price: number
  total: number
}

interface ReceiptData {
  order_number: string
  date: string
  time: string
  cashier: string
  branch: string
  items: ReceiptItem[]
  subtotal: number
  tax: number
  total: number
  payment_method: string
  amount_tendered?: number
  change?: number
  loyalty_points?: number
  customer_name?: string
}

interface MobileReceiptProps {
  receipt: ReceiptData
  onClose?: () => void
  onPrint?: () => void
  onDownload?: () => void
  onShare?: () => void
}

// ─── Mobile Receipt Component ───────────────────────────────────────────────

export function MobileReceipt({
  receipt,
  onClose,
  onPrint,
  onDownload,
  onShare,
}: MobileReceiptProps) {
  const handlePrint = () => {
    // Escape user-controlled values to prevent XSS in document.write
    const safeBranch = escapeHtml(receipt.branch)
    const safeOrderNumber = escapeHtml(receipt.order_number)
    const safeCashier = escapeHtml(receipt.cashier)
    const safeCustomerName = receipt.customer_name ? escapeHtml(receipt.customer_name) : ''
    const safePaymentMethod = escapeHtml(receipt.payment_method.toUpperCase())

    // Create printable content
    const printContent = `
      <div style="font-family: monospace; font-size: 12px; max-width: 300px; margin: 0 auto;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="margin: 0;">WINNMATT</h2>
          <p style="margin: 5px 0;">${safeBranch}</p>
          <p style="margin: 5px 0;">${receipt.date} ${receipt.time}</p>
        </div>
        
        <p style="margin: 5px 0;"><strong>Order:</strong> ${safeOrderNumber}</p>
        <p style="margin: 5px 0;"><strong>Cashier:</strong> ${safeCashier}</p>
        ${safeCustomerName ? `<p style="margin: 5px 0;"><strong>Customer:</strong> ${safeCustomerName}</p>` : ''}
        
        <hr style="margin: 15px 0; border: none; border-top: 1px dashed #000;" />
        
        ${receipt.items.map(item => `
          <div style="display: flex; justify-content: space-between; margin: 5px 0;">
            <span>${escapeHtml(item.name)}</span>
            <span>${formatKSh(item.total)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin: 5px 0; font-size: 10px; color: #666;">
            <span>${item.quantity} × ${formatKSh(item.unit_price)}</span>
            <span></span>
          </div>
        `).join('')}
        
        <hr style="margin: 15px 0; border: none; border-top: 1px dashed #000;" />
        
        <div style="display: flex; justify-content: space-between; margin: 5px 0;">
          <span>Subtotal:</span>
          <span>${formatKSh(receipt.subtotal)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 5px 0;">
          <span>VAT (16%):</span>
          <span>${formatKSh(receipt.tax)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 10px 0; font-size: 14px; font-weight: bold;">
          <span>TOTAL:</span>
          <span>${formatKSh(receipt.total)}</span>
        </div>
        
        <hr style="margin: 15px 0; border: none; border-top: 1px dashed #000;" />
        
        <div style="display: flex; justify-content: space-between; margin: 5px 0;">
          <span>Payment:</span>
          <span>${safePaymentMethod}</span>
        </div>
        ${receipt.amount_tendered ? `
          <div style="display: flex; justify-content: space-between; margin: 5px 0;">
            <span>Tendered:</span>
            <span>${formatKSh(receipt.amount_tendered)}</span>
          </div>
        ` : ''}
        ${receipt.change !== undefined && receipt.change > 0 ? `
          <div style="display: flex; justify-content: space-between; margin: 5px 0;">
            <span>Change:</span>
            <span>${formatKSh(receipt.change)}</span>
          </div>
        ` : ''}
        ${receipt.loyalty_points ? `
          <div style="display: flex; justify-content: space-between; margin: 5px 0;">
            <span>Points Earned:</span>
            <span>${receipt.loyalty_points}</span>
          </div>
        ` : ''}
        
        <div style="text-align: center; margin-top: 20px; font-size: 10px; color: #666;">
          <p>Thank you for shopping with us!</p>
          <p>Visit us at www.winnmatt.com</p>
        </div>
      </div>
    `

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Receipt - ${safeOrderNumber}</title>
            <style>
              body { margin: 0; padding: 20px; }
              @media print {
                body { padding: 0; }
              }
            </style>
          </head>
          <body>
            ${printContent}
            <script>window.print(); window.close();</script>
          </body>
        </html>
      `)
      printWindow.document.close()
    }
    
    onPrint?.()
  }

  const handleDownload = () => {
    const content = `
WINNMATT - ${receipt.branch}
${receipt.date} ${receipt.time}

Order: ${receipt.order_number}
Cashier: ${receipt.cashier}
${receipt.customer_name ? `Customer: ${receipt.customer_name}` : ''}

--------------------------------
${receipt.items.map(item => 
  `${item.name}\n  ${item.quantity} × ${formatKSh(item.unit_price)} = ${formatKSh(item.total)}`
).join('\n')}
--------------------------------

Subtotal: ${formatKSh(receipt.subtotal)}
VAT (16%): ${formatKSh(receipt.tax)}
TOTAL: ${formatKSh(receipt.total)}

Payment: ${receipt.payment_method.toUpperCase()}
${receipt.amount_tendered ? `Tendered: ${formatKSh(receipt.amount_tendered)}` : ''}
${receipt.change !== undefined && receipt.change > 0 ? `Change: ${formatKSh(receipt.change)}` : ''}
${receipt.loyalty_points ? `Points Earned: ${receipt.loyalty_points}` : ''}

Thank you for shopping with us!
    `.trim()

    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `receipt-${receipt.order_number}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    onDownload?.()
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Receipt - ${receipt.order_number}`,
          text: `WinnMatt Receipt\nOrder: ${receipt.order_number}\nTotal: ${formatKSh(receipt.total)}`,
        })
      } catch (error) {
        console.error('Share failed:', error)
      }
    }
    
    onShare?.()
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end md:items-center justify-center">
      <Card className="w-full max-w-md rounded-t-xl md:rounded-xl max-h-[90vh] overflow-hidden flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg">Receipt</CardTitle>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </CardHeader>
        
        <CardContent className="flex-1 overflow-y-auto">
          {/* Receipt Content */}
          <div className="font-mono text-sm space-y-4 p-4 bg-white text-black rounded-lg">
            {/* Header */}
            <div className="text-center">
              <h3 className="text-lg font-bold">WINNMATT</h3>
              <p className="text-xs">{receipt.branch}</p>
              <p className="text-xs">{receipt.date} {receipt.time}</p>
            </div>

            {/* Order Info */}
            <div className="space-y-1">
              <p><strong>Order:</strong> {receipt.order_number}</p>
              <p><strong>Cashier:</strong> {receipt.cashier}</p>
              {receipt.customer_name && (
                <p><strong>Customer:</strong> {receipt.customer_name}</p>
              )}
            </div>

            <Separator className="border-dashed" />

            {/* Items */}
            <div className="space-y-2">
              {receipt.items.map((item, index) => (
                <div key={index}>
                  <div className="flex justify-between">
                    <span>{item.name}</span>
                    <span>{formatKSh(item.total)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{item.quantity} × {formatKSh(item.unit_price)}</span>
                  </div>
                </div>
              ))}
            </div>

            <Separator className="border-dashed" />

            {/* Totals */}
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatKSh(receipt.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>VAT (16%):</span>
                <span>{formatKSh(receipt.tax)}</span>
              </div>
              <div className="flex justify-between font-bold text-base">
                <span>TOTAL:</span>
                <span>{formatKSh(receipt.total)}</span>
              </div>
            </div>

            <Separator className="border-dashed" />

            {/* Payment Info */}
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Payment:</span>
                <span>{receipt.payment_method.toUpperCase()}</span>
              </div>
              {receipt.amount_tendered && (
                <div className="flex justify-between">
                  <span>Tendered:</span>
                  <span>{formatKSh(receipt.amount_tendered)}</span>
                </div>
              )}
              {receipt.change !== undefined && receipt.change > 0 && (
                <div className="flex justify-between">
                  <span>Change:</span>
                  <span>{formatKSh(receipt.change)}</span>
                </div>
              )}
              {receipt.loyalty_points && (
                <div className="flex justify-between">
                  <span>Points Earned:</span>
                  <span>{receipt.loyalty_points}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="text-center text-xs text-muted-foreground mt-4">
              <p>Thank you for shopping with us!</p>
              <p>Visit us at www.winnmatt.com</p>
            </div>
          </div>
        </CardContent>

        {/* Action Buttons */}
        <div className="p-4 border-t grid grid-cols-3 gap-2">
          <Button
            variant="outline"
            onClick={handlePrint}
            className="flex flex-col items-center justify-center h-16"
          >
            <Printer className="h-5 w-5 mb-1" />
            <span className="text-xs">Print</span>
          </Button>
          <Button
            variant="outline"
            onClick={handleDownload}
            className="flex flex-col items-center justify-center h-16"
          >
            <Download className="h-5 w-5 mb-1" />
            <span className="text-xs">Download</span>
          </Button>
          <Button
            variant="outline"
            onClick={handleShare}
            className="flex flex-col items-center justify-center h-16"
          >
            <Share2 className="h-5 w-5 mb-1" />
            <span className="text-xs">Share</span>
          </Button>
        </div>
      </Card>
    </div>
  )
}
