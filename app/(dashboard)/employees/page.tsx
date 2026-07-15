'use client'

import { startTransition, useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { logger } from '@/lib/logger'
import { getEmployeesLegacy as getEmployees } from '@/lib/modules/workforce'
import {
  getEmployee as getEmployeeById,
  getDepartments,
  getEmployeeStats,
  clockEvent,
  getTodayClockEvents,
} from '@/lib/modules/workforce'
import {
  Search,
  Users,
  Clock,
  Plus,
  BarChart3,
  Activity,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { EmployeeFormDialog } from '@/components/employees/employee-form-dialog'
import { EmployeeDetailDialog } from '@/components/employees/employee-detail-dialog'
import { EmployeeStatusBadge } from '@/components/employees/status-badge'
import { CreateDepartmentDialog } from '@/components/departments/create-department-dialog'
import {
  EmployeePerformanceCard,
  type EmployeeStatsData,
} from '@/components/employees/employee-performance-card'
import type { EmployeeDetail } from '@/components/employees/employee-schema'
import type { EmployeeProfile } from '@/lib/modules/workforce'

// ─── Types ────────────────────────────────────────────────────────

interface Department {
  id: string
  name: string
  branch_id?: string
}

interface ClockEvent {
  id: string
  user_id: string
  branch_id: string
  event_type: 'clock_in' | 'clock_out' | 'break_start' | 'break_end'
  timestamp: string
  method: string
  notes: string | null
}

// ─── Page Component ───────────────────────────────────────────────

export default function EmployeesPage() {
  const { profile } = useAuth()
  const { toast } = useToast()

  // Data state
  const [employees, setEmployees] = useState<EmployeeProfile[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDept, setSelectedDept] = useState<string>('all')

  // Tabs
  const [activeTab, setActiveTab] = useState('profiles')

  // Detail dialog
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeProfile | null>(null)
  const [employeeDetail, setEmployeeDetail] = useState<EmployeeDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [showDetailDialog, setShowDetailDialog] = useState(false)

  // Form dialog
  const [showFormDialog, setShowFormDialog] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<EmployeeProfile | null>(null)

  // Department creation dialog
  const [showDeptDialog, setShowDeptDialog] = useState(false)

  // Performance tab
  const [expandedStats, setExpandedStats] = useState<Record<string, boolean>>({})
  const [employeeStats, setEmployeeStats] = useState<Record<string, EmployeeStatsData>>({})
  const [statsLoading, setStatsLoading] = useState<Record<string, boolean>>({})

  // Clock
  const [clockEvents, setClockEvents] = useState<ClockEvent[]>([])
  const [clocking, setClocking] = useState(false)

  // ─── Data Loading ─────────────────────────────────────────────

  const loadEmployees = useCallback(async () => {
    const branchId = profile?.branch_id
    setLoading(true)
    try {
      if (branchId) {
        const fetched = await getEmployees(branchId)
        setEmployees(fetched as EmployeeProfile[])
      }
    } catch (error) {
      logger.error('Failed to load employees:', error)
    } finally {
      setLoading(false)
    }
  }, [profile?.branch_id])

  const loadDepartments = useCallback(async () => {
    try {
      const fetched = await getDepartments(profile?.branch_id || undefined)
      setDepartments(fetched as Department[])
    } catch (error) {
      logger.error('Failed to load departments:', error)
    }
  }, [profile])

  const loadClockEvents = useCallback(async () => {
    if (!profile?.id) return
    try {
      const events = await getTodayClockEvents(profile.id)
      setClockEvents(events as unknown as ClockEvent[])
    } catch (error) {
      logger.error('Failed to load clock events:', error)
    }
  }, [profile])

  useEffect(() => {
    startTransition(() => {
      void loadEmployees()
      void loadDepartments()
      void loadClockEvents()
    })
  }, [loadEmployees, loadDepartments, loadClockEvents])

  // ─── Derived Data ────────────────────────────────────────────

  const filteredEmployees = employees.filter((emp) => {
    const nameMatch =
      emp.user?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.employee_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.staff_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.position?.toLowerCase().includes(searchQuery.toLowerCase())
    const deptMatch = selectedDept === 'all' || emp.department_id === selectedDept
    return nameMatch && deptMatch
  })

  // ─── Handlers ────────────────────────────────────────────────

  const handleViewDetail = async (emp: EmployeeProfile) => {
    setSelectedEmployee(emp)
    setDetailLoading(true)
    setShowDetailDialog(true)
    try {
      const detail = await getEmployeeById(emp.id)
      setEmployeeDetail(detail as EmployeeDetail | null)
    } catch (error) {
      logger.error('Failed to load employee detail:', error)
    } finally {
      setDetailLoading(false)
    }
  }

  const handleLoadStats = async (empId: string) => {
    if (employeeStats[empId]) {
      setExpandedStats((prev) => ({ ...prev, [empId]: !prev[empId] }))
      return
    }
    setStatsLoading((prev) => ({ ...prev, [empId]: true }))
    setExpandedStats((prev) => ({ ...prev, [empId]: true }))
    try {
      const stats = await getEmployeeStats(empId)
      if (stats) {
        setEmployeeStats((prev) => ({ ...prev, [empId]: stats as unknown as EmployeeStatsData }))
      }
    } catch (error) {
      logger.error('Failed to load stats:', error)
    } finally {
      setStatsLoading((prev) => ({ ...prev, [empId]: false }))
    }
  }

  const handleOpenCreate = () => {
    setEditingEmployee(null)
    setShowFormDialog(true)
  }

  const handleOpenEdit = (emp: EmployeeProfile) => {
    setEditingEmployee(emp)
    setShowFormDialog(true)
  }

  const handleOpenCreateDepartment = () => {
    setShowDeptDialog(true)
  }

  const handleDepartmentCreated = (dept: { id: string; name: string }) => {
    void loadDepartments()
  }

  const handleClock = async () => {
    if (!profile?.id || !profile?.branch_id) {
      toast({ title: 'Error', description: 'Cannot clock without a branch assignment', variant: 'destructive' })
      return
    }
    setClocking(true)
    try {
      const lastEvent = clockEvents[clockEvents.length - 1]
      let eventType: 'clock_in' | 'clock_out' | 'break_start' | 'break_end' = 'clock_in'

      if (!lastEvent || lastEvent.event_type === 'clock_out') {
        eventType = 'clock_in'
      } else if (lastEvent.event_type === 'clock_in') {
        eventType = 'break_start'
      } else if (lastEvent.event_type === 'break_start') {
        eventType = 'break_end'
      } else if (lastEvent.event_type === 'break_end') {
        eventType = 'clock_out'
      }

      const result = await clockEvent({
        user_id: profile.id,
        branch_id: profile.branch_id,
        event_type: eventType,
      })

      if (result.success) {
        toast({
          title:
            eventType === 'clock_in'
              ? 'Clocked In'
              : eventType === 'clock_out'
                ? 'Clocked Out'
                : eventType === 'break_start'
                  ? 'Break Started'
                  : 'Break Ended',
          description: 'Attendance event recorded',
        })
        void loadClockEvents()
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to record clock event', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'An unexpected error occurred', variant: 'destructive' })
    } finally {
      setClocking(false)
    }
  }

  const getClockButtonLabel = () => {
    const lastEvent = clockEvents[clockEvents.length - 1]
    if (!lastEvent || lastEvent.event_type === 'clock_out') return { label: 'Clock In', icon: Clock }
    if (lastEvent.event_type === 'clock_in') return { label: 'Start Break', icon: Clock }
    if (lastEvent.event_type === 'break_start') return { label: 'End Break', icon: Clock }
    return { label: 'Clock Out', icon: Clock }
  }

  const clockBtn = getClockButtonLabel()

  // ─── Render ──────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Workforce Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage employee profiles, track performance, and monitor attendance
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="outline"
            className="gap-1.5"
            onClick={handleClock}
            disabled={clocking}
          >
            <clockBtn.icon className="h-4 w-4" />
            {clocking ? '...' : clockBtn.label}
          </Button>
          <Button className="gap-1.5" onClick={handleOpenCreate}>
            <Plus className="h-4 w-4" />
            Add Employee
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="profiles" className="gap-1.5">
            <Users className="h-4 w-4" />
            Profiles
          </TabsTrigger>
          <TabsTrigger value="performance" className="gap-1.5">
            <BarChart3 className="h-4 w-4" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-1.5">
            <Activity className="h-4 w-4" />
            Activity
          </TabsTrigger>
        </TabsList>

        {/* ── Profiles Tab ──────────────────────────────────────── */}
        <TabsContent value="profiles" className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, ID, or position..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={selectedDept} onValueChange={setSelectedDept}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Employees ({filteredEmployees.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : filteredEmployees.length === 0 ? (
                <EmptyState
                  title={searchQuery || selectedDept !== 'all' ? 'No matching employees found' : 'No employees yet'}
                  compact
                />
              ) : (
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>ID</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEmployees.map((emp) => (
                        <TableRow
                          key={emp.id}
                          className="cursor-pointer"
                          onClick={() => handleViewDetail(emp)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                                {emp.user?.full_name?.charAt(0) || '?'}
                              </div>
                              <div>
                                <p className="text-sm font-medium">
                                  {emp.user?.full_name || 'Unknown'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {emp.user?.email || ''}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {emp.employee_id || '-'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {emp.department?.name || '-'}
                          </TableCell>
                          <TableCell className="text-sm">{emp.position || '-'}</TableCell>
                          <TableCell><EmployeeStatusBadge status={emp.employment_status} /></TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleOpenEdit(emp)
                              }}
                            >
                              Edit
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Performance Tab ───────────────────────────────────── */}
        <TabsContent value="performance" className="space-y-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : employees.length === 0 ? (
            <EmptyState title="No employees to display" compact />
          ) : (
            <div className="space-y-3">
              {filteredEmployees.map((emp) => (
                <EmployeePerformanceCard
                  key={emp.id}
                  employeeName={emp.user?.full_name || 'Unknown'}
                  employeeInitial={emp.user?.full_name?.charAt(0) || '?'}
                  subtitle={
                    [emp.position, emp.department?.name].filter(Boolean).join(' · ') || ''
                  }
                  expanded={!!expandedStats[emp.id]}
                  statsLoading={!!statsLoading[emp.id]}
                  stats={employeeStats[emp.id] || null}
                  onToggle={() => handleLoadStats(emp.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Activity Tab ──────────────────────────────────────── */}
        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="py-12 text-center text-sm text-muted-foreground">
                <Activity className="mx-auto mb-3 h-10 w-10 opacity-20" />
                Activity timeline coming soon
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <EmployeeDetailDialog
        open={showDetailDialog}
        onOpenChange={setShowDetailDialog}
        employee={employeeDetail}
        loading={detailLoading}
        onEdit={() => {
          if (selectedEmployee) {
            setShowDetailDialog(false)
            handleOpenEdit(selectedEmployee)
          }
        }}
      />

      {/* Create/Edit Dialog */}
      <EmployeeFormDialog
        open={showFormDialog}
        onOpenChange={setShowFormDialog}
        editingEmployee={editingEmployee}
        departments={departments}
        onSaved={() => {
          void loadEmployees()
        }}
        onDepartmentCreate={handleOpenCreateDepartment}
      />

      {/* Department Creation Dialog */}
      <CreateDepartmentDialog
        open={showDeptDialog}
        onOpenChange={setShowDeptDialog}
        onCreated={handleDepartmentCreated}
      />
    </div>
  )
}
