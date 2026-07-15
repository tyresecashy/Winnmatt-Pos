'use client'
import { logger } from '@/lib/logger';

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle, AlertCircle, Clock, LogOut } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { openShift, getActiveShift, closeShift, getShiftSummary } from '@/lib/modules/cash'
import { formatKSh } from '@/lib/currency'

interface ShiftOperationsProps {
  branchId: string
  cashierId: string
  cashierName: string
}

interface ShiftRow {
  id: string
  shift_number: string
  branch_id: string
  cashier_id: string
  status: string
  opening_float: number
  opened_at: string
  closed_at: string | null
  closing_notes: string | null
  register_id: string | null
  drawer_id: string | null
  created_at: string | null
  updated_at: string | null
  reopened_at: string | null
  reopened_by: string | null
}

interface ShiftSummaryRow {
  id: string | null
  status?: string
  payment_breakdown?: {
    cash_sales: number
    card_sales: number
    mpesa_sales: number
    difference: number
  } | null
  transaction_count?: number
  opened_at?: string | null
  opened_by?: string | null
  cashier?: string | null
  shift_number?: string
  opening_float?: number | null
  branch_id?: string | null
  cash_sales?: number | null
  card_sales?: number | null
  mpesa_sales?: number | null
  closed_at?: string | null
  closed_by?: string | null
}

// Shift summary has dynamic fields from shift_summaries view — use loose type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ShiftSummary = any

export function ShiftOperations({ branchId, cashierId, cashierName }: ShiftOperationsProps) {
  // State
  const [activeShift, setActiveShift] = useState<ShiftRow | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [shiftLoading, setShiftLoading] = useState(true)

  // Open Shift Dialog
  const [openingFloat, setOpeningFloat] = useState('')
  const [showOpenDialog, setShowOpenDialog] = useState(false)

  // Close Shift Dialog
  const [countedCash, setCountedCash] = useState('')
  const [closingNotes, setClosingNotes] = useState('')
  const [showCloseDialog, setShowCloseDialog] = useState(false)

  // Summary view
  const [shiftSummary, setShiftSummary] = useState<ShiftSummary | null>(null)
  const [showSummary, setShowSummary] = useState(false)

  const { toast } = useToast()

  // Load active shift on mount
  async function loadActiveShift() {
    try {
      setShiftLoading(true)
      const shift = await getActiveShift(branchId, cashierId)
      setActiveShift(shift)
    } catch (error) {
      logger.error('Error loading shift:', error)
    } finally {
      setShiftLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => void loadActiveShift())
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // OPEN SHIFT
  async function handleOpenShift() {
    if (!openingFloat || isNaN(Number(openingFloat))) {
      toast({
        title: 'Invalid Input',
        description: 'Please enter a valid opening float amount',
        variant: 'destructive',
      })
      return
    }

    try {
      setIsLoading(true)
      const amountInCents = Math.round(Number(openingFloat))
      const result = await openShift(branchId, cashierId, amountInCents)

      if (!result.success) {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        })
        return
      }

      toast({
        title: 'Success',
        description: result.message,
      })

      setActiveShift((result.shift ?? null) as ShiftRow | null)
      setOpeningFloat('')
      setShowOpenDialog(false)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to open shift',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  // CLOSE SHIFT
  async function handleCloseShift() {
    if (!countedCash || isNaN(Number(countedCash))) {
      toast({
        title: 'Invalid Input',
        description: 'Please enter the counted cash amount',
        variant: 'destructive',
      })
      return
    }

    try {
      setIsLoading(true)
      const amountInCents = Math.round(Number(countedCash))
      const result = await closeShift(activeShift!.id, amountInCents, closingNotes, cashierId)

      if (!result.success) {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        })
        return
      }

      toast({
        title: 'Success',
        description: result.message,
      })

      setActiveShift(null)
      setCountedCash('')
      setClosingNotes('')
      setShowCloseDialog(false)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to close shift',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  // VIEW SUMMARY
  async function handleViewSummary() {
    try {
      const summary = await getShiftSummary(activeShift!.id)
      setShiftSummary(summary)
      setShowSummary(true)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load shift summary',
        variant: 'destructive',
      })
    }
  }

  if (shiftLoading) {
    return (
      <Card className="w-full bg-slate-900 border-slate-700">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading shift status...
          </div>
        </CardContent>
      </Card>
    )
  }

  // NO ACTIVE SHIFT
  if (!activeShift) {
    return (
      <Card className="w-full bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-100">
            <Clock className="h-5 w-5 text-amber-500" />
            Shift Management
          </CardTitle>
          <CardDescription className="text-slate-400">
            {cashierName} - No active shift
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4 bg-slate-800 border-slate-700">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-slate-300">
              No active shift. Open a shift to start processing transactions.
            </AlertDescription>
          </Alert>

          <Dialog open={showOpenDialog} onOpenChange={setShowOpenDialog}>
            <DialogTrigger asChild>
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700">
                Open Shift
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-700">
              <DialogHeader>
                <DialogTitle className="text-slate-100">Open New Shift</DialogTitle>
                <DialogDescription className="text-slate-400">
                  Enter the opening float amount and click to start your shift.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="opening-float" className="text-slate-300">
                    Opening Float (KShs)
                  </Label>
                  <Input
                    id="opening-float"
                    type="number"
                    placeholder="e.g., 5000"
                    value={openingFloat}
                    onChange={(e) => setOpeningFloat(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500"
                    min="0"
                    step="100"
                  />
                  <p className="text-xs text-slate-400">
                    This is the cash you&apos;re starting with in the register.
                  </p>
                </div>

                <Button
                  onClick={handleOpenShift}
                  disabled={isLoading || !openingFloat}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isLoading ? 'Opening Shift...' : 'Open Shift'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    )
  }

  // ACTIVE SHIFT
  return (
    <>
      <Card className="w-full bg-slate-900 border-emerald-700 border-2">
        <CardHeader className="bg-gradient-to-r from-emerald-950 to-slate-900">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-emerald-400">
                <CheckCircle className="h-5 w-5" />
                {activeShift.shift_number}
              </CardTitle>
              <CardDescription className="text-slate-400">
                {cashierName} - Active since {new Date(activeShift.opened_at).toLocaleTimeString()}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* Opening Float */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
              <p className="text-xs font-medium text-slate-400 uppercase">Opening Float</p>
              <p className="text-2xl font-bold text-emerald-400 mt-2">
                {formatKSh(activeShift.opening_float)}
              </p>
            </div>

            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
              <p className="text-xs font-medium text-slate-400 uppercase">Duration</p>
              <p className="text-2xl font-bold text-blue-400 mt-2">
                {Math.floor(
                  (new Date().getTime() - new Date(activeShift.opened_at).getTime()) / 3600000
                )}{' '}
                hrs
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t border-slate-700">
            <Button
              onClick={handleViewSummary}
              variant="outline"
              className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              View Summary
            </Button>

            <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
              <DialogTrigger asChild>
                <Button className="flex-1 bg-red-600 hover:bg-red-700">
                  <LogOut className="mr-2 h-4 w-4" />
                  Close Shift
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-900 border-slate-700">
                <DialogHeader>
                  <DialogTitle className="text-slate-100">Close Shift - {activeShift.shift_number}</DialogTitle>
                  <DialogDescription className="text-slate-400">
                    Reconcile your cash drawer and close the shift.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                    <p className="text-xs text-slate-400 uppercase font-medium mb-2">Opening Float</p>
                    <p className="text-lg font-bold text-emerald-400">
                      {formatKSh(activeShift.opening_float)}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="counted-cash" className="text-slate-300">
                      Counted Cash in Drawer (KShs)
                    </Label>
                    <Input
                      id="counted-cash"
                      type="number"
                      placeholder="Amount you counted"
                      value={countedCash}
                      onChange={(e) => setCountedCash(e.target.value)}
                      className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500"
                      min="0"
                      step="100"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="closing-notes" className="text-slate-300">
                      Closing Notes (Optional)
                    </Label>
                    <Textarea
                      id="closing-notes"
                      placeholder="Any discrepancies or notes..."
                      value={closingNotes}
                      onChange={(e) => setClosingNotes(e.target.value)}
                      className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 min-h-20"
                    />
                  </div>

                  <Button
                    onClick={handleCloseShift}
                    disabled={isLoading || !countedCash}
                    className="w-full bg-red-600 hover:bg-red-700"
                  >
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isLoading ? 'Closing Shift...' : 'Close Shift'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Shift Summary Modal */}
      {shiftSummary && (
        <Dialog open={showSummary} onOpenChange={setShowSummary}>
          <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-slate-100">Shift Summary</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {shiftSummary.payment_breakdown && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-400 uppercase">Cash Sales</p>
                    <p className="text-lg font-bold text-emerald-400">
                      {formatKSh(shiftSummary.payment_breakdown.cash_sales)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase">Card Sales</p>
                    <p className="text-lg font-bold text-blue-400">
                      {formatKSh(shiftSummary.payment_breakdown.card_sales)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase">M-Pesa Sales</p>
                    <p className="text-lg font-bold text-purple-400">
                      {formatKSh(shiftSummary.payment_breakdown.mpesa_sales)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase">Total Transactions</p>
                    <p className="text-lg font-bold text-slate-300">
                      {shiftSummary.transaction_count || 0}
                    </p>
                  </div>
                </div>
              )}

              {shiftSummary.status === 'closed' && shiftSummary.payment_breakdown && (
                <Alert className={
                  shiftSummary.payment_breakdown.difference === 0
                    ? 'bg-emerald-950 border-emerald-700'
                    : 'bg-amber-950 border-amber-700'
                }>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {shiftSummary.payment_breakdown.difference === 0
                      ? 'Perfect reconciliation!'
                      : shiftSummary.payment_breakdown.difference > 0
                        ? `Over by ${formatKSh(shiftSummary.payment_breakdown.difference)}`
                        : `Short by ${formatKSh(Math.abs(shiftSummary.payment_breakdown.difference))}`}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
