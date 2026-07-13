'use client'

import { useState } from 'react'
import type { Shift } from '@/lib/types/database'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Play,
  Square,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Monitor,
  Plus,
} from 'lucide-react'
import { formatKSh } from '@/lib/currency'


interface RegisterOption {
  id: string
  register_name: string
}

interface QuickShiftDialogProps {
  mode: 'open' | 'close'
  activeShift: Shift | null
  cashierName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenShift: (openingFloat: number, registerId?: string) => Promise<Shift | null>
  onCloseShift: (countedCash: number, closingNotes?: string) => Promise<{ success: boolean; overShort?: number }>
  registers?: RegisterOption[]
  onCreateRegister?: () => Promise<RegisterOption | null>
}

export function QuickShiftDialog({
  mode,
  activeShift,
  cashierName,
  open,
  onOpenChange,
  onOpenShift,
  onCloseShift,
  registers,
  onCreateRegister,
}: QuickShiftDialogProps) {
  const [openingFloat, setOpeningFloat] = useState('0')
  const [countedCash, setCountedCash] = useState('')
  const [closingNotes, setClosingNotes] = useState('')
  const [selectedRegisterId, setSelectedRegisterId] = useState<string>('')
  const [creatingRegister, setCreatingRegister] = useState(false)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ success: boolean; overShort?: number; shift?: Shift } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleReset = () => {
    setOpeningFloat('0')
    setCountedCash('')
    setClosingNotes('')
    setSelectedRegisterId('')
    setResult(null)
    setError(null)
    setSaving(false)
  }

  const handleCreateRegister = async () => {
    if (!onCreateRegister) return
    setCreatingRegister(true)
    setError(null)
    try {
      const reg = await onCreateRegister()
      if (reg) {
        setSelectedRegisterId(reg.id)
      } else {
        setError('Failed to create register.')
      }
    } catch {
      setError('An error occurred while creating the register.')
    } finally {
      setCreatingRegister(false)
    }
  }

  const handleOpen = async () => {
    setError(null)
    const float = parseFloat(openingFloat)
    if (isNaN(float) || float < 0) {
      setError('Please enter a valid opening float amount')
      return
    }
    if (!selectedRegisterId) {
      setError('Please select a register')
      return
    }
    setSaving(true)
    try {
      const shift = await onOpenShift(float, selectedRegisterId)
      if (shift) {
        setResult({ success: true, shift })
      } else {
        setError('Failed to open shift. Please try again.')
      }
    } catch {
      setError('An error occurred while opening the shift.')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = async () => {
    setError(null)
    const cash = parseFloat(countedCash)
    if (isNaN(cash) || cash < 0) {
      setError('Please enter a valid counted cash amount')
      return
    }
    setSaving(true)
    try {
      const res = await onCloseShift(cash, closingNotes || undefined)
      if (res.success) {
        setResult(res)
      } else {
        setError('Failed to close shift. Please try again.')
      }
    } catch {
      setError('An error occurred while closing the shift.')
    } finally {
      setSaving(false)
    }
  }

  const handleDone = () => {
    handleReset()
    onOpenChange(false)
  }

  if (result?.success && mode === 'open') {
    return (
      <Dialog open={open} onOpenChange={(v) => { if (!v) { handleDone() } }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-success">
              <CheckCircle2 className="h-5 w-5" />
              Shift Opened
            </DialogTitle>
            <DialogDescription>
              Your shift has been opened successfully.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Shift Number</span>
              <span className="font-mono font-medium">{(result.shift as { shift_number?: string })?.shift_number || '—'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Opening Float</span>
              <span className="font-medium">{formatKSh(openingFloat ? parseFloat(openingFloat) : 0)}</span>
            </div>
          </div>
          <Button onClick={handleDone} className="w-full">
            Start Selling
          </Button>
        </DialogContent>
      </Dialog>
    )
  }

  if (result?.success && mode === 'close') {
    const overShort = result.overShort ?? 0
    return (
      <Dialog open={open} onOpenChange={(v) => { if (!v) { handleDone() } }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              Shift Closed
            </DialogTitle>
            <DialogDescription>
              Shift closed successfully.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Status</span>
              <span className={overShort >= 0 ? 'text-success font-medium' : 'text-destructive font-medium'}>
                {overShort >= 0 ? 'Balanced' : 'Short'}
              </span>
            </div>
            {overShort !== 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{overShort > 0 ? 'Over' : 'Short'}</span>
                <span className={overShort > 0 ? 'text-success font-medium' : 'text-destructive font-medium'}>
                  {formatKSh(Math.abs(overShort))}
                </span>
              </div>
            )}
          </div>
          <Button onClick={handleDone} className="w-full">
            Done
          </Button>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { handleReset(); onOpenChange(v) } }}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'open' ? (
              <>
                <Play className="h-5 w-5 text-success" />
                Open Shift
              </>
            ) : (
              <>
                <Square className="h-5 w-5 text-destructive" />
                Close Shift
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {mode === 'open'
              ? `Start a new shift for ${cashierName}`
              : `Close the current shift #${activeShift?.shift_number || ''}`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {mode === 'open' ? (
            <>
              {/* Register Selector */}
              <div className="space-y-2">
                <Label htmlFor="register-select">Register</Label>
                {registers && registers.length > 0 ? (
                  <Select
                    value={selectedRegisterId}
                    onValueChange={setSelectedRegisterId}
                  >
                    <SelectTrigger id="register-select" className="w-full">
                      <SelectValue placeholder="Select a register" />
                    </SelectTrigger>
                    <SelectContent>
                      {registers.map((reg) => (
                        <SelectItem key={reg.id} value={reg.id}>
                          <span className="flex items-center gap-2">
                            <Monitor className="h-3.5 w-3.5" />
                            {reg.register_name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm text-muted-foreground">
                      No registers found for this branch.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCreateRegister}
                      disabled={creatingRegister}
                      className="w-full"
                    >
                      {creatingRegister ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4 mr-2" />
                      )}
                      Create Register
                    </Button>
                  </div>
                )}
              </div>

              {/* Opening Float */}
              <div className="space-y-2">
                <Label htmlFor="opening-float">Opening Float (KES)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="opening-float"
                    type="number"
                    min="0"
                    step="50"
                    value={openingFloat}
                    onChange={(e) => setOpeningFloat(e.target.value)}
                    className="pl-9"
                    placeholder="0"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  The initial cash amount in your register drawer.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="counted-cash">Counted Cash in Drawer (KES)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="counted-cash"
                    type="number"
                    min="0"
                    step="50"
                    value={countedCash}
                    onChange={(e) => setCountedCash(e.target.value)}
                    className="pl-9"
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="closing-notes">Closing Notes (optional)</Label>
                <Input
                  id="closing-notes"
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  placeholder="Any notes about this shift"
                />
              </div>
            </>
          )}

          <Button
            className="w-full"
            onClick={mode === 'open' ? handleOpen : handleClose}
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {mode === 'open' ? 'Opening...' : 'Closing...'}
              </>
            ) : (
              <>
                {mode === 'open' ? (
                  <Play className="h-4 w-4 mr-2" />
                ) : (
                  <Square className="h-4 w-4 mr-2" />
                )}
                {mode === 'open' ? 'Open Shift' : 'Close Shift'}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
