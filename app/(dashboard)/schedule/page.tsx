'use client'

import { useEffect, useState, useCallback, startTransition } from 'react'
import { logger } from '@/lib/logger'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar, Plus, RefreshCw, User, Clock, ChevronLeft, ChevronRight, Copy, Trash2 } from 'lucide-react'
import { 
  getWorkerRoles, 
  getWorkerAssignments,
  getWorkerShifts,
  createWorkerShift,
  deleteWorkerShift,
  type WorkerRole, 
  type WorkerAssignment 
} from '@/lib/task-management'
import { useBranch } from '@/contexts/branch-context'

interface Shift {
  id: string
  employee_id: string
  branch_id: string
  shift_date: string
  start_time: string
  end_time: string
  role_id: string | null
  area: string | null
  status: string
  notes: string | null
  employee?: {
    first_name: string
    last_name: string
    staff_number: string
  }
  role?: WorkerRole
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

export default function SchedulePage() {
  const { branchId } = useBranch()
  
  const [shifts, setShifts] = useState<Shift[]>([])
  const [roles, setRoles] = useState<WorkerRole[]>([])
  const [assignments, setAssignments] = useState<WorkerAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [currentWeekStart, setCurrentWeekStart] = useState(getWeekStart(new Date()))
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [selectedDate, setSelectedDate] = useState('')
  
  // Create form state
  const [newEmployeeId, setNewEmployeeId] = useState('')
  const [newRoleId, setNewRoleId] = useState('')
  const [newStartTime, setNewStartTime] = useState('08:00')
  const [newEndTime, setNewEndTime] = useState('17:00')
  const [newArea, setNewArea] = useState('')
  const [newNotes, setNewNotes] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const weekDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(currentWeekStart)
        d.setDate(d.getDate() + i)
        return d
      })
      const startDate = weekDays[0].toISOString().split('T')[0]
      const endDate = weekDays[6].toISOString().split('T')[0]

      const [shiftsData, rolesData, assignmentsData] = await Promise.all([
        getWorkerShifts(branchId || '', startDate, endDate),
        getWorkerRoles(),
        getWorkerAssignments(branchId || undefined),
      ])

      setShifts(shiftsData)
      setRoles(rolesData)
      setAssignments(assignmentsData)
    } catch (error) {
      logger.error('Failed to load schedule data:', error)
    } finally {
      setLoading(false)
    }
  }, [branchId, currentWeekStart])

  useEffect(() => {
    startTransition(() => { loadData() })
  }, [branchId, currentWeekStart, loadData])

  function getWeekStart(date: Date): Date {
    const d = new Date(date)
    d.setDate(d.getDate() - d.getDay())
    return d
  }

  function getWeekDays(): Date[] {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(currentWeekStart)
      d.setDate(d.getDate() + i)
      return d
    })
  }

  async function handleCreateShift() {
    if (!newEmployeeId || !selectedDate || !branchId) return

    const result = await createWorkerShift({
      employee_id: newEmployeeId,
      branch_id: branchId,
      shift_date: selectedDate,
      start_time: newStartTime,
      end_time: newEndTime,
      role_id: newRoleId || null,
      area: newArea || null,
      notes: newNotes || null,
    })

    if (result.success) {
      setShowCreateDialog(false)
      resetForm()
      await loadData()
    }
  }

  async function handleDeleteShift(shiftId: string) {
    if (!confirm('Delete this shift?')) return

    const result = await deleteWorkerShift(shiftId)
    if (result.success) {
      await loadData()
    }
  }

  function resetForm() {
    setNewEmployeeId('')
    setNewRoleId('')
    setNewStartTime('08:00')
    setNewEndTime('17:00')
    setNewArea('')
    setNewNotes('')
  }

  function getShiftsForDate(date: Date): Shift[] {
    const dateStr = date.toISOString().split('T')[0]
    return shifts.filter(s => s.shift_date === dateStr)
  }

  function formatTime(time: string): string {
    const [hours, minutes] = time.split(':')
    const h = parseInt(hours)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12 = h % 12 || 12
    return `${h12}:${minutes} ${ampm}`
  }

  const weekDays = getWeekDays()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Shift Schedule</h1>
          <p className="text-muted-foreground">
            Schedule workers for shelf stocking, cleaning, and other tasks
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Shift
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Shift</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Date *</Label>
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Worker *</Label>
                  <Select value={newEmployeeId} onValueChange={setNewEmployeeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select worker" />
                    </SelectTrigger>
                    <SelectContent>
                      {assignments.length === 0 ? (
                        <SelectItem value="__none__" disabled>No workers assigned</SelectItem>
                      ) : assignments.map((a) => (
                        <SelectItem key={a.employee_id} value={a.employee_id}>
                          {a.employee ? `${a.employee.first_name} ${a.employee.last_name}` : 'Unknown Worker'}
                          {a.role?.name ? ` (${a.role.name})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Role</Label>
                  <Select value={newRoleId} onValueChange={setNewRoleId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.length === 0 ? (
                        <SelectItem value="__none__" disabled>No roles available</SelectItem>
                      ) : roles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Start Time *</Label>
                    <Input
                      type="time"
                      value={newStartTime}
                      onChange={(e) => setNewStartTime(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>End Time *</Label>
                    <Input
                      type="time"
                      value={newEndTime}
                      onChange={(e) => setNewEndTime(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label>Area</Label>
                  <Input
                    value={newArea}
                    onChange={(e) => setNewArea(e.target.value)}
                    placeholder="e.g., Aisle 1-5, Checkout"
                  />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Input
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="Additional notes..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateShift} disabled={!newEmployeeId || !selectedDate}>
                  Create Shift
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => {
            const prev = new Date(currentWeekStart)
            prev.setDate(prev.getDate() - 7)
            setCurrentWeekStart(prev)
          }}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Previous Week
        </Button>
        <h2 className="text-lg font-semibold">
          {weekDays[0].toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })} - {weekDays[6].toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' })}
        </h2>
        <Button
          variant="outline"
          onClick={() => {
            const next = new Date(currentWeekStart)
            next.setDate(next.getDate() + 7)
            setCurrentWeekStart(next)
          }}
        >
          Next Week
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>

      {/* Weekly Calendar */}
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((day, index) => {
          const dayShifts = getShiftsForDate(day)
          const isToday = day.toISOString().split('T')[0] === new Date().toISOString().split('T')[0]

          return (
            <Card key={index} className={isToday ? 'border-primary' : ''}>
              <CardHeader className="p-3">
                <CardTitle className="text-sm text-center">
                  <div className={isToday ? 'text-primary font-bold' : ''}>
                    {DAYS_OF_WEEK[day.getDay()]}
                  </div>
                  <div className="text-lg">{day.getDate()}</div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2 space-y-1">
                {dayShifts.length === 0 ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-8 text-xs text-muted-foreground"
                    onClick={() => {
                      setSelectedDate(day.toISOString().split('T')[0])
                      setShowCreateDialog(true)
                    }}
                  >
                    + Add Shift
                  </Button>
                ) : (
                  dayShifts.map((shift) => (
                    <div
                      key={shift.id}
                      className="p-2 rounded text-xs border"
                      style={{
                        backgroundColor: shift.role?.color + '20' || '#f3f4f6',
                        borderColor: shift.role?.color || '#e5e7eb',
                      }}
                    >
                      <div className="font-medium truncate">
                        {shift.employee?.first_name} {shift.employee?.last_name}
                      </div>
                      <div className="text-muted-foreground">
                        {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                      </div>
                      {shift.role && (
                        <Badge
                          variant="secondary"
                          className="mt-1 text-[10px]"
                          style={{ backgroundColor: shift.role.color + '30' }}
                        >
                          {shift.role.name}
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 mt-1"
                        onClick={() => handleDeleteShift(shift.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Shift Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold">{shifts.length}</p>
              <p className="text-sm text-muted-foreground">Total Shifts</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">
                {new Set(shifts.map(s => s.employee_id)).size}
              </p>
              <p className="text-sm text-muted-foreground">Workers Scheduled</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">
                {shifts.reduce((sum, s) => {
                  const [startH, startM] = s.start_time.split(':').map(Number)
                  const [endH, endM] = s.end_time.split(':').map(Number)
                  return sum + (endH * 60 + endM - startH * 60 - startM) / 60
                }, 0).toFixed(0)}
              </p>
              <p className="text-sm text-muted-foreground">Total Hours</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">
                {new Set(shifts.map(s => s.role_id).filter(Boolean)).size}
              </p>
              <p className="text-sm text-muted-foreground">Roles Covered</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
