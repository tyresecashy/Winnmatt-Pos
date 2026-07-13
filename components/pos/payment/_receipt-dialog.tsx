'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, Check, RotateCcw, X } from 'lucide-react'
import { ReceiptPreview, type SaleDetailsData } from '@/components/receipt-preview'

interface ReceiptDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  receiptNumber: string
  receiptLoadError: string | null
  fullSaleData: SaleDetailsData | null | undefined
  onRetry: () => void
  onComplete: () => void
  paymentMethodText: string
}

export function ReceiptDialog({
  open,
  onOpenChange,
  receiptNumber,
  receiptLoadError,
  fullSaleData,
  onRetry,
  onComplete,
  paymentMethodText,
}: ReceiptDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto print:max-h-none print:overflow-visible">
        <DialogHeader className="sr-only">
          <DialogTitle>Receipt Preview</DialogTitle>
          <DialogDescription>
            Review the saved receipt, print it, or close the dialog to continue checkout.
          </DialogDescription>
        </DialogHeader>

        {receiptLoadError ? (
          <div className="text-center space-y-4 py-6">
            <div className="h-16 w-16 rounded-full bg-destructive/10 mx-auto flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-destructive">Receipt Not Ready</h3>
              <p className="text-sm text-muted-foreground mt-2">{receiptLoadError}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-left space-y-2 text-sm">
              <div className="space-y-1">
                <p className="font-medium">What you can do:</p>
                <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                  <li>The sale may already be saved.</li>
                  <li>Receipt #: {receiptNumber}</li>
                  <li>Close this window and check recent sales.</li>
                </ul>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={onRetry} className="flex-1">
                <RotateCcw className="h-4 w-4 mr-2" />
                Retry
              </Button>
              <Button onClick={onComplete} className="flex-1">
                <X className="h-4 w-4 mr-2" />
                Close and Continue
              </Button>
            </div>
          </div>
        ) : fullSaleData ? (
          <div className="py-4">
            <ReceiptPreview
              saleData={fullSaleData}
              showPrintButton
              showCloseButton
              onPrint={() => {}}
              onClose={onComplete}
            />
          </div>
        ) : (
          <div className="text-center space-y-4 py-6 max-h-[70vh] overflow-y-auto">
            <div className="h-16 w-16 rounded-full bg-success/10 mx-auto flex items-center justify-center">
              <Check className="h-8 w-8 text-success" />
            </div>
            <div>
              <h3 className="text-xl font-bold">
                {paymentMethodText}
              </h3>
              <p className="text-success font-mono text-lg font-bold mt-2">
                Receipt #{receiptNumber}
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-left space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Skeleton className="h-2 w-2 rounded-full" />
                <p className="text-sm text-muted-foreground">Preparing your receipt...</p>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
