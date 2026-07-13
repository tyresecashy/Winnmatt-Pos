'use client'

import { logger } from '@/lib/logger'

import { useCallback, useEffect, useState, startTransition } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import { getEmployees } from '@/lib/employee-actions'
import {
  getAttendanceReport,
  getShiftTemplates,
  getEmployeeSchedules,
  addEmployeeSchedule,
} from '@/lib/modules/workforce'
import { Calendar, Plus, ChevronLeft, ChevronRight } from 'lucide-react'

function getWeekDates(date: Date): Date[] {
  const start = new Date(date)
  const day = start.getDay()
  const diff = start.getDate() - day + (day === 0 ? -6 : 1)
  start.setDate(diff)
  start.setHours(0, 0, 0, 0)
  const dates: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    dates.push(d)
  }
  return dates
}

function formatTime(isoString?: string | null): string {
  if (!isoString) return '-'
  const d = new Date(isoString)
  return d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function computeTotalBreakMs(events: { event_type: string; timestamp: string }[]): number {
  let total = 0
  let breakStart: number | null = null
  for (const e of events) {
    if (e.event_type === 'break_start') breakStart = new Date(e.timestamp).getTime()
    else if (e.event_type === 'break_end' && breakStart !== null) {
      total += new Date(e.timestamp).getTime() - breakStart
      breakStart = null
    }
  }
  if (breakStart !== null) total += Date.now() - breakStart
  return total
}

function computeWorkingHours(events: { event_type: string; timestamp: string }[]): string {
  const clockIn = events.find((e) => e.event_type === 'clock_in')
  const clockOut = events.find((e) => e.event_type === 'clock_out')
  if (!clockIn) return '-'
  const start = new Date(clockIn.timestamp).getTime()
  const end = clockOut ? new Date(clockOut.timestamp).getTime() : Date.now()
  const netMs = Math.max(0, end - start - computeTotalBreakMs(events))
  const hours = Math.floor(netMs / 3600000)
  const minutes = Math.floor((netMs % 3600000) / 60000)
  return `${hours}h ${minutes}m`
}

export default function AttendancePage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0])
  const [employees, setEmployees] = useState<any[]>([])
  const [attendance, setAttendance] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [scheduleLoading, setScheduleLoading] = useState(true)
  const [schedules, setSchedules] = useState<any[]>([])
  const [shiftTemplates, setShiftTemplates] = useState<any[]>([])
  const [weekDates, setWeekDates] = useState<Date[]>(() => getWeekDates(new Date()))

  const [showScheduleDialog, setShowScheduleDialog] = useState(false)
  const [scheduleEmployee, setScheduleEmployee] = useState('')
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleStart, setScheduleStart] = useState('')
  const [scheduleEnd, setScheduleEnd] = useState('')

  const branchId = profile?.branch_id

  const loadAttendance = useCallback(async () => {
    if (!branchId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [attendanceData, empData] = await Promise.all([
        getAttendanceReport(branchId, attendanceDate),
        getEmployees(branchId),
      ])
      setAttendance(attendanceData)
      setEmployees(empData)
    } catch (error) {
      logger.error('Failed to load attendance:', error)
    } finally {
      setLoading(false)
    }
  }, [branchId, attendanceDate])

  const loadSchedule = useCallback(async () => {
    if (!branchId) {
      setScheduleLoading(false)
      return
    }
    setScheduleLoading(true)
    try {
      const [scheduleData, templates, empData] = await Promise.all([
        getEmployeeSchedules(
          branchId,
          weekDates[0].toISOString().split('T')[0],
          weekDates[6].toISOString().split('T')[0]
        ),
        getShiftTemplates(branchId),
        getEmployees(branchId),
      ])
      setSchedules(scheduleData)
      setShiftTemplates(templates)
      if (empData.length > 0) setEmployees(empData)
    } catch (error) {
      logger.error('Failed to load schedule:', error)
    } finally {
      setScheduleLoading(false)
    }
  }, [branchId, weekDates])

  useEffect(() => {
    startTransition(() => { void loadAttendance() })
  }, [loadAttendance])

  useEffect(() => {
    startTransition(() => { void loadSchedule() })
  }, [loadSchedule])

  const handleAddSchedule = async () => {
    if (!branchId || !scheduleEmployee || !scheduleDate || !scheduleStart || !scheduleEnd) {
      toast({ title: 'Error', description: 'Please fill all fields', variant: 'destructive' })
      return
    }
    const result = await addEmployeeSchedule({
      employee_profile_id: scheduleEmployee,
      branch_id: branchId,
      date: scheduleDate,
      start_time: scheduleStart,
      end_time: scheduleEnd,
    })
    setShowScheduleDialog(false)
    if (result.success) {
      toast({ title: 'Schedule Added', description: 'Employee schedule has been created' })
      void loadSchedule()
    } else {
      toast({ title: 'Error', description: result.error || 'Failed to add schedule', variant: 'destructive' })
    }
  }

  const statusBadge = (status: string) => {
    const map: Record<string, { variant: 'default' | 'secondary' | 'outline' | 'destructive'; label: string }> = {
      completed: { variant: 'default', label: 'Completed' },
      on_shift: { variant: 'secondary', label: 'On Shift' },
      on_break: { variant: 'outline', label: 'On Break' },
      absent: { variant: 'destructive', label: 'Absent' },
    }
    const v = map[status] || { variant: 'destructive' as const, label: status }
    return <Badge variant={v.variant}>{v.label}</Badge>
  }

  const getClockEvent = (events: { event_type: string; timestamp: string }[], type: string) => {
    const event = events.find((e) => e.event_type === type)
    return event ? formatTime(event.timestamp) : '-'
  }

  const weekDateStrings = weekDates.map((d) => d.toISOString().split('T')[0])

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Attendance &amp; Scheduling</h1>
          <p className="text-sm text-muted-foreground">Manage employee attendance and work schedules</p>
        </div>
      </div>

      <Tabs defaultValue="attendance">
        <TabsList>
          <TabsTrigger value="attendance">Today&apos;s Attendance</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Daily Attendance</CardTitle>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={attendanceDate}
                    onChange={(e) => setAttendanceDate(e.target.value)}
                    className="w-44"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : attendance.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No attendance records found for this date
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Clock In</TableHead>
                      <TableHead>Clock Out</TableHead>
                      <TableHead>Total Breaks</TableHead>
                      <TableHead>Working Hours</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendance.map((record) => (
                      <TableRow key={record.userId}>
                        <TableCell className="font-medium">
                          {record.user?.full_name || 'Unknown'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {record.user?.role || '-'}
                        </TableCell>
                        <TableCell>{statusBadge(record.status)}</TableCell>
                        <TableCell className="text-sm">
                          {getClockEvent(record.events, 'clock_in')}
                        </TableCell>
                        <TableCell className="text-sm">
                          {getClockEvent(record.events, 'clock_out')}
                        </TableCell>
                        <TableCell className="text-sm">{record.totalBreaks}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {computeWorkingHours(record.events)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Weekly Schedule</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const prev = new Date(weekDates[0])
                      prev.setDate(prev.getDate() - 7)
                      setWeekDates(getWeekDates(prev))
                    }}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const next = new Date(weekDates[0])
                      next.setDate(next.getDate() + 7)
                      setWeekDates(getWeekDates(next))
                    }}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      setScheduleEmployee('')
                      setScheduleDate(weekDates[0].toISOString().split('T')[0])
                      setScheduleStart('')
                      setScheduleEnd('')
                      setShowScheduleDialog(true)
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Add Schedule
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {scheduleLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 min-w-[140px] bg-background">
                          Employee
                        </TableHead>
                        {weekDates.map((d) => (
                          <TableHead key={d.toISOString()} className="min-w-[100px] text-center">
                            <div className="text-xs text-muted-foreground">
                              {d.toLocaleDateString('en-KE', { weekday: 'short' })}
                            </div>
                            <div>
                              {d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employees.map((emp) => (
                        <TableRow key={emp.id}>
                          <TableCell className="sticky left-0 bg-background font-medium">
                            {emp.user?.full_name || 'Unknown'}
                          </TableCell>
                          {weekDateStrings.map((ds) => {
                            const sched = schedules.find(
                              (s) => s.employee_profile_id === emp.id && s.date === ds
                            )
                            return (
                              <TableCell key={ds} className="text-center text-sm">
                                {sched ? (
                                  <div className="flex flex-col items-center gap-0.5">
                                    <span className="text-xs font-medium">
                                      {sched.shift_template?.name || 'Shift'}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {sched.start_time?.slice(0, 5)} - {sched.end_time?.slice(0, 5)}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            )
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Schedule</DialogTitle>
            <DialogDescription>Assign a work schedule to an employee</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="emp-select">Employee</Label>
              <Select value={scheduleEmployee} onValueChange={setScheduleEmployee}>
                <SelectTrigger id="emp-select">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.length === 0 ? (
                    <SelectItem value="__none__" disabled>No employees found for this branch</SelectItem>
                  ) : employees.map((emp) => (
                    <SelectItem key={emp.user_id} value={emp.id}>
                      {emp.user?.full_name || 'Unknown'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sched-date">Date</Label>
              <Input
                id="sched-date"
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sched-start">Start Time</Label>
                <Input
                  id="sched-start"
                  type="time"
                  value={scheduleStart}
                  onChange={(e) => setScheduleStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sched-end">End Time</Label>
                <Input
                  id="sched-end"
                  type="time"
                  value={scheduleEnd}
                  onChange={(e) => setScheduleEnd(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddSchedule} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Add Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
