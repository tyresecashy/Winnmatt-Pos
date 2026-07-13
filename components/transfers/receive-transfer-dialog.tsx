'use client'

import { useState, useEffect, startTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/hooks/use-toast'
import { getStockTransfer, receiveStockTransfer } from '@/lib/modules/transfers'
import { ArrowRight, Download, Package, AlertTriangle } from 'lucide-react'

interface ReceiveItemEntry {
  itemId: string
  productId: string
  productName: string
  productSku: string
  quantityDispatched: number
  quantityReceived: string
}

interface ReceiveTransferDialogProps {
  transferId: string | null
  onClose: () => void
  onSuccess: () => void
}

export function ReceiveTransferDialog({ transferId, onClose, onSuccess }: ReceiveTransferDialogProps) {
  const [items, setItems] = useState<ReceiveItemEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [transferNumber, setTransferNumber] = useState<string>('')
  const [fromBranch, setFromBranch] = useState<string>('')
  const [toBranch, setToBranch] = useState<string>('')

  // Load transfer details when dialog opens
  useEffect(() => {
    startTransition(() => {
      if (!transferId) return

      setLoading(true)
      setLoadError(null)
      setItems([])

      getStockTransfer(transferId)
        .then(data => {
          if (!data) {
            setLoadError('Transfer not found')
            return
          }

          setTransferNumber(data.transfer_number || data.id.slice(0, 8))
          setFromBranch(data.from_branch?.name || data.from_branch_id)
          setToBranch(data.to_branch?.name || data.to_branch_id)

          const entries: ReceiveItemEntry[] = (data.items || []).map(item => ({
            itemId: item.id,
            productId: item.product_id,
            productName: item.product?.name || item.product_id.slice(0, 8),
            productSku: item.product?.sku || '',
            quantityDispatched: item.quantity_requested,
            quantityReceived: String(item.quantity_requested),
          }))
          setItems(entries)
        })
        .catch(err => {
          setLoadError(err instanceof Error ? err.message : 'Failed to load transfer')
        })
        .finally(() => setLoading(false))
    })
  }, [transferId])

  async function handleSubmit() {
    if (!transferId || items.length === 0) return

    // Validate all quantities
    for (const item of items) {
      const qty = parseInt(item.quantityReceived, 10)
      if (isNaN(qty) || qty < 0) {
        toast({ title: 'Invalid Quantity', description: `Invalid quantity for "${item.productName}"`, variant: 'destructive' })
        return
      }
    }

    // Confirm partial receipts with variance
    const hasVariance = items.some(item => parseInt(item.quantityReceived, 10) !== item.quantityDispatched)
    if (hasVariance && !confirm('One or more items have a quantity mismatch. Continue with variance?')) {
      return
    }

    setSubmitting(true)
    try {
      const result = await receiveStockTransfer(
        transferId,
        items.map(item => ({
          item_id: item.itemId,
          product_id: item.productId,
          quantity_received: parseInt(item.quantityReceived, 10),
        })),
        ''
      )

      if (result.success) {
        toast({ title: 'Transfer Received', description: `Stock has been received at ${toBranch}` })
        onSuccess()
        onClose()
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to receive transfer', variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to receive transfer', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  function updateQuantity(index: number, value: string) {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, quantityReceived: value } : item))
  }

  const open = !!transferId

  return (
    <Dialog open={open} onOpenChange={openSet => { if (!openSet && !submitting) onClose() }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-success" />
            Receive Stock Transfer
          </DialogTitle>
          <DialogDescription>
            {loading ? 'Loading transfer details...' : `Receive items from ${fromBranch} → ${toBranch}`}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : loadError ? (
          <div className="py-8 text-center">
            <p className="text-destructive font-medium">{loadError}</p>
            <Button variant="outline" className="mt-4" onClick={onClose}>Close</Button>
          </div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No items in this transfer
          </div>
        ) : (
          <>
            {/* Transfer header info */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
              <Package className="h-4 w-4" />
              <span className="font-medium text-foreground">{transferNumber}</span>
              <ArrowRight className="h-3 w-3" />
              <span>{fromBranch}</span>
              <ArrowRight className="h-3 w-3" />
              <span>{toBranch}</span>
            </div>

            {/* Items table */}
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-center">Dispatched</TableHead>
                    <TableHead className="text-center">Received</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, i) => {
                    const qty = parseInt(item.quantityReceived, 10)
                    const validQty = !isNaN(qty) && qty >= 0
                    const variance = validQty ? qty - item.quantityDispatched : 0
                    const hasVariance = variance !== 0

                    return (
                      <TableRow key={item.itemId}>
                        <TableCell>
                          <div className="font-medium">{item.productName}</div>
                          {item.productSku && (
                            <div className="text-xs text-muted-foreground font-mono">{item.productSku}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-medium">{item.quantityDispatched}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            min={0}
                            value={item.quantityReceived}
                            onChange={e => updateQuantity(i, e.target.value)}
                            className="w-24 text-center h-9 mx-auto"
                            disabled={submitting}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          {validQty && hasVariance ? (
                            <Badge variant="outline" className={variance > 0 ? 'bg-success/10 text-success border-success/30' : 'bg-destructive/10 text-destructive border-destructive/30'}>
                              {variance > 0 ? '+' : ''}{variance}
                            </Badge>
                          ) : validQty ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <span className="text-xs text-destructive">Invalid</span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Variance summary */}
            {items.some(item => {
              const qty = parseInt(item.quantityReceived, 10)
              return !isNaN(qty) && qty >= 0 && qty !== item.quantityDispatched
            }) && (
              <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Quantity variance detected</p>
                  <p className="text-xs mt-0.5">Some items have different quantities than dispatched. The system will record these as variances.</p>
                </div>
              </div>
            )}
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !!loadError || items.length === 0 || submitting}
          >
            {submitting ? (
              <>Processing...</>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Receive Transfer
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
