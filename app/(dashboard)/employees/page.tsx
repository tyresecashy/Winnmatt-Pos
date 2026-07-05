'use client'
import { logger } from '@/lib/logger'

import { useCallback, useEffect, useState } from 'react'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { formatKSh } from '@/lib/currency'
import {
  getEmployees,
  getEmployeeById,
  createEmployeeProfile,
  updateEmployeeProfile,
  getDepartments,
  getEmployeeStats,
} from '@/lib/employee-actions'
import { clockEvent, getTodayClockEvents } from '@/lib/attendance-actions'
import { getUsers } from '@/lib/user-management'
import {
  Search,
  Users,
  Clock,
  Plus,
  BarChart3,
  Activity,
  Calendar,
  ShoppingCart,
  RefreshCw,
  XCircle,
  User,
  Building2,
  Phone,
  FileText,
  Target,
  ChevronRight,
  ChevronDown,
  AlertCircle,
} from 'lucide-react'

interface Department {
  id: string
  name: string
  branch_id?: string
}

interface EmployeeStats {
  todaySalesCount: number
  todaySalesTotal: number
  monthSalesCount: number
  monthSalesTotal: number
  refundCount: number
  voidCount: number
  clockedIn: boolean
  onBreak: boolean
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

export default function EmployeesPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [employees, setEmployees] = useState<any[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDept, setSelectedDept] = useState<string>('all')
  const [activeTab, setActiveTab] = useState('profiles')
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null)
  const [employeeDetail, setEmployeeDetail] = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [showFormDialog, setShowFormDialog] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [expandedStats, setExpandedStats] = useState<Record<string, boolean>>({})
  const [employeeStats, setEmployeeStats] = useState<Record<string, EmployeeStats>>({})
  const [statsLoading, setStatsLoading] = useState<Record<string, boolean>>({})
  const [clockEvents, setClockEvents] = useState<ClockEvent[]>([])
  const [clocking, setClocking] = useState(false)
  const [recentActivity, setRecentActivity] = useState<any[]>([])
  const [availableUsers, setAvailableUsers] = useState<any[]>([])

  const [formData, setFormData] = useState({
    user_id: '',
    employee_id: '',
    staff_number: '',
    national_id: '',
    kra_pin: '',
    nhif_number: '',
    nssf_number: '',
    department_id: '',
    position: '',
    hire_date: '',
    employment_type: 'full_time',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_relation: '',
    employment_status: 'active',
  })

  const loadEmployees = useCallback(async () => {
    const branchId = profile?.branch_id
    setLoading(true)
    try {
      if (branchId) {
        const fetched = await getEmployees(branchId)
        setEmployees(fetched)
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
      setDepartments(fetched)
    } catch (error) {
      logger.error('Failed to load departments:', error)
    }
  }, [profile?.branch_id])

  const loadClockEvents = useCallback(async () => {
    if (!profile?.id) return
    try {
      const events = await getTodayClockEvents(profile.id)
      setClockEvents(events)
    } catch (error) {
      logger.error('Failed to load clock events:', error)
    }
  }, [profile?.id])

  useEffect(() => {
    void loadEmployees()
    void loadDepartments()
    void loadClockEvents()
  }, [loadEmployees, loadDepartments, loadClockEvents])

  const filteredEmployees = employees.filter((emp) => {
    const nameMatch =
      emp.user?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.employee_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.staff_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.position?.toLowerCase().includes(searchQuery.toLowerCase())
    const deptMatch = selectedDept === 'all' || emp.department_id === selectedDept
    return nameMatch && deptMatch
  })

  const handleViewDetail = async (emp: any) => {
    setSelectedEmployee(emp)
    setDetailLoading(true)
    setShowDetailDialog(true)
    try {
      const detail = await getEmployeeById(emp.id)
      setEmployeeDetail(detail)
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
        setEmployeeStats((prev) => ({ ...prev, [empId]: stats as any }))
      }
    } catch (error) {
      logger.error('Failed to load stats:', error)
    } finally {
      setStatsLoading((prev) => ({ ...prev, [empId]: false }))
    }
  }

  const handleOpenCreate = async () => {
    setEditingEmployee(null)
    setFormData({
      user_id: '',
      employee_id: '',
      staff_number: '',
      national_id: '',
      kra_pin: '',
      nhif_number: '',
      nssf_number: '',
      department_id: '',
      position: '',
      hire_date: '',
      employment_type: 'full_time',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      emergency_contact_relation: '',
      employment_status: 'active',
    })
    // Fetch available users for the dropdown
    try {
      const users = await getUsers(profile?.role || 'admin')
      setAvailableUsers(users)
    } catch (e) {
      console.error('Failed to fetch users:', e)
      setAvailableUsers([])
    }
    setShowFormDialog(true)
  }

  const handleOpenEdit = (emp: any) => {
    setEditingEmployee(emp)
    setFormData({
      user_id: emp.user_id || '',
      employee_id: emp.employee_id || '',
      staff_number: emp.staff_number || '',
      national_id: emp.national_id || '',
      kra_pin: emp.kra_pin || '',
      nhif_number: emp.nhif_number || '',
      nssf_number: emp.nssf_number || '',
      department_id: emp.department_id || '',
      position: emp.position || '',
      hire_date: emp.hire_date ? emp.hire_date.split('T')[0] : '',
      employment_type: emp.employment_type || 'full_time',
      emergency_contact_name: emp.emergency_contact_name || '',
      emergency_contact_phone: emp.emergency_contact_phone || '',
      emergency_contact_relation: emp.emergency_contact_relation || '',
      employment_status: emp.employment_status || 'active',
    })
    setShowFormDialog(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editingEmployee) {
        const result = await updateEmployeeProfile(editingEmployee.id, formData)
        if (result.success) {
          toast({ title: 'Employee Updated', description: 'Profile has been updated successfully' })
          setShowFormDialog(false)
          void loadEmployees()
        } else {
          toast({ title: 'Error', description: result.error || 'Failed to update', variant: 'destructive' })
        }
      } else {
        if (!formData.user_id) {
          toast({ title: 'Error', description: 'User selection is required', variant: 'destructive' })
          setSaving(false)
          return
        }
        const result = await createEmployeeProfile(formData)
        if (result.success) {
          toast({ title: 'Employee Created', description: 'Profile has been created successfully' })
          setShowFormDialog(false)
          void loadEmployees()
        } else {
          toast({ title: 'Error', description: result.error || 'Failed to create', variant: 'destructive' })
        }
      }
    } catch (error) {
      toast({ title: 'Error', description: 'An unexpected error occurred', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
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
          title: eventType === 'clock_in' ? 'Clocked In' : eventType === 'clock_out' ? 'Clocked Out' : eventType === 'break_start' ? 'Break Started' : 'Break Ended',
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

  const statusBadge = (status: string | null | undefined) => {
    switch (status) {
      case 'active':
        return <Badge variant="default">Active</Badge>
      case 'inactive':
        return <Badge variant="secondary">Inactive</Badge>
      case 'terminated':
        return <Badge variant="destructive">Terminated</Badge>
      case 'on_leave':
        return <Badge variant="outline">On Leave</Badge>
      default:
        return <Badge variant="secondary">{status || 'Unknown'}</Badge>
    }
  }

  const clockBtn = getClockButtonLabel()

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Workforce Management</h1>
          <p className="text-sm text-muted-foreground">Manage employee profiles, track performance, and monitor attendance</p>
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

        {/* Profiles Tab */}
        <TabsContent value="profiles" className="space-y-4">
          {/* Filters */}
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
                  <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Employee Table */}
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
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {searchQuery || selectedDept !== 'all' ? 'No matching employees found' : 'No employees yet'}
                </p>
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
                                <p className="text-sm font-medium">{emp.user?.full_name || 'Unknown'}</p>
                                <p className="text-xs text-muted-foreground">{emp.user?.email || ''}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{emp.employee_id || '-'}</TableCell>
                          <TableCell className="text-sm">{emp.department?.name || '-'}</TableCell>
                          <TableCell className="text-sm">{emp.position || '-'}</TableCell>
                          <TableCell>{statusBadge(emp.employment_status)}</TableCell>
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

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : employees.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No employees to display</p>
          ) : (
            <div className="space-y-3">
              {filteredEmployees.map((emp) => (
                <Card key={emp.id}>
                  <CardHeader
                    className="cursor-pointer"
                    onClick={() => handleLoadStats(emp.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                          {emp.user?.full_name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <CardTitle className="text-base">{emp.user?.full_name || 'Unknown'}</CardTitle>
                          <p className="text-xs text-muted-foreground">{emp.position || emp.department?.name || ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {expandedStats[emp.id] ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </div>
                  </CardHeader>
                  {expandedStats[emp.id] && (
                    <CardContent>
                      {statsLoading[emp.id] ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {Array.from({ length: 4 }).map((_, i) => (
                            <Skeleton key={i} className="h-20 w-full" />
                          ))}
                        </div>
                      ) : employeeStats[emp.id] ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="rounded-lg border p-3">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <ShoppingCart className="h-3.5 w-3.5" />
                              Today's Sales
                            </div>
                            <p className="mt-1 text-lg font-bold">{formatKSh(employeeStats[emp.id].todaySalesTotal)}</p>
                            <p className="text-xs text-muted-foreground">{employeeStats[emp.id].todaySalesCount} transactions</p>
                          </div>
                          <div className="rounded-lg border p-3">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Calendar className="h-3.5 w-3.5" />
                              Monthly Sales
                            </div>
                            <p className="mt-1 text-lg font-bold">{formatKSh(employeeStats[emp.id].monthSalesTotal)}</p>
                            <p className="text-xs text-muted-foreground">{employeeStats[emp.id].monthSalesCount} transactions</p>
                          </div>
                          <div className="rounded-lg border p-3">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <RefreshCw className="h-3.5 w-3.5" />
                              Refunds
                            </div>
                            <p className="mt-1 text-lg font-bold">{employeeStats[emp.id].refundCount}</p>
                          </div>
                          <div className="rounded-lg border p-3">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <XCircle className="h-3.5 w-3.5" />
                              Voids
                            </div>
                            <p className="mt-1 text-lg font-bold">{employeeStats[emp.id].voidCount}</p>
                          </div>
                          <div className="rounded-lg border p-3 col-span-2">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Clock className="h-3.5 w-3.5" />
                              Attendance Today
                            </div>
                            <div className="mt-1 flex items-center gap-2">
                              {employeeStats[emp.id].clockedIn ? (
                                <Badge variant={employeeStats[emp.id].onBreak ? 'secondary' : 'default'}>
                                  {employeeStats[emp.id].onBreak ? 'On Break' : 'Clocked In'}
                                </Badge>
                              ) : (
                                <Badge variant="outline">Not Clocked In</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="py-4 text-center text-sm text-muted-foreground">Could not load stats</p>
                      )}
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Activity Tab */}
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

      {/* Employee Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Employee Details</DialogTitle>
            <DialogDescription>Full profile information</DialogDescription>
          </DialogHeader>
          {detailLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : employeeDetail ? (
            <div className="space-y-6 max-h-[60vh] overflow-y-auto">
              {/* Basic Info */}
              <div className="rounded-lg bg-muted p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-medium text-primary">
                    {employeeDetail.user?.full_name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <h3 className="font-semibold">{employeeDetail.user?.full_name || 'Unknown'}</h3>
                    <p className="text-sm text-muted-foreground">{employeeDetail.position || 'No position'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Department:</span>
                    <span>{employeeDetail.department?.name || '-'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Employee ID:</span>
                    <span className="font-mono">{employeeDetail.employee_id || '-'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Staff No:</span>
                    <span className="font-mono">{employeeDetail.staff_number || '-'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>{' '}
                    {statusBadge(employeeDetail.employment_status)}
                  </div>
                </div>
              </div>

              {/* KRA/NHIF/NSSF */}
              <div>
                <h4 className="mb-2 text-sm font-medium flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Statutory Information
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-md border p-2.5">
                    <span className="text-xs text-muted-foreground">National ID</span>
                    <p className="font-mono">{employeeDetail.national_id || '-'}</p>
                  </div>
                  <div className="rounded-md border p-2.5">
                    <span className="text-xs text-muted-foreground">KRA PIN</span>
                    <p className="font-mono">{employeeDetail.kra_pin || '-'}</p>
                  </div>
                  <div className="rounded-md border p-2.5">
                    <span className="text-xs text-muted-foreground">NHIF Number</span>
                    <p className="font-mono">{employeeDetail.nhif_number || '-'}</p>
                  </div>
                  <div className="rounded-md border p-2.5">
                    <span className="text-xs text-muted-foreground">NSSF Number</span>
                    <p className="font-mono">{employeeDetail.nssf_number || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div>
                <h4 className="mb-2 text-sm font-medium flex items-center gap-1.5">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  Emergency Contact
                </h4>
                <div className="rounded-md border p-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-xs text-muted-foreground">Name</span>
                      <p>{employeeDetail.emergency_contact_name || '-'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Phone</span>
                      <p>{employeeDetail.emergency_contact_phone || '-'}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-xs text-muted-foreground">Relation</span>
                      <p>{employeeDetail.emergency_contact_relation || '-'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Employment */}
              <div>
                <h4 className="mb-2 text-sm font-medium flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  Employment Details
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-md border p-2.5">
                    <span className="text-xs text-muted-foreground">Type</span>
                    <p className="capitalize">{employeeDetail.employment_type?.replace('_', ' ') || '-'}</p>
                  </div>
                  <div className="rounded-md border p-2.5">
                    <span className="text-xs text-muted-foreground">Hire Date</span>
                    <p>{employeeDetail.hire_date ? new Date(employeeDetail.hire_date).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</p>
                  </div>
                </div>
              </div>

              {/* Documents */}
              {employeeDetail.documents && employeeDetail.documents.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-medium flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    Documents ({employeeDetail.documents.length})
                  </h4>
                  <div className="space-y-1.5">
                    {employeeDetail.documents.map((doc: any) => (
                      <div key={doc.id} className="flex items-center justify-between rounded-md border p-2.5 text-sm">
                        <span>{doc.document_type || 'Document'}</span>
                        <Badge variant="outline">{doc.status || 'pending'}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Goals */}
              {employeeDetail.goals && employeeDetail.goals.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-medium flex items-center gap-1.5">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    Goals ({employeeDetail.goals.length})
                  </h4>
                  <div className="space-y-1.5">
                    {employeeDetail.goals.map((goal: any) => (
                      <div key={goal.id} className="rounded-md border p-2.5 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{goal.title || 'Goal'}</span>
                          <Badge variant={goal.status === 'completed' ? 'default' : goal.status === 'in_progress' ? 'secondary' : 'outline'}>
                            {goal.status?.replace('_', ' ') || 'pending'}
                          </Badge>
                        </div>
                        {goal.description && (
                          <p className="mt-1 text-xs text-muted-foreground">{goal.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">Could not load employee details</p>
          )}
          <DialogFooter>
            {selectedEmployee && (
              <Button variant="outline" onClick={() => { setShowDetailDialog(false); handleOpenEdit(selectedEmployee) }}>
                Edit Profile
              </Button>
            )}
            <Button variant="ghost" onClick={() => setShowDetailDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Employee Dialog */}
      <Dialog open={showFormDialog} onOpenChange={setShowFormDialog}>
        <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEmployee ? 'Edit Employee' : 'Add Employee'}</DialogTitle>
            <DialogDescription>
              {editingEmployee ? 'Update the employee profile information' : 'Fill in the details to create a new employee profile'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-2">
            {/* User Selection (only when creating) */}
            {!editingEmployee && (
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="user_id">Link to User Account *</Label>
                <Select
                  value={formData.user_id}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, user_id: v }))}
                >
                  <SelectTrigger id="user_id">
                    <SelectValue placeholder="Select a user to link" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.length === 0 ? (
                      <SelectItem value="none" disabled>No users available</SelectItem>
                    ) : (
                      availableUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name || user.email} ({user.email})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Links this employee profile to an existing user account</p>
              </div>
            )}

            {/* Employee ID */}
            <div className="space-y-1.5">
              <Label htmlFor="employee_id">Employee ID</Label>
              <Input
                id="employee_id"
                placeholder="Auto-generated if empty"
                value={formData.employee_id}
                onChange={(e) => setFormData((prev) => ({ ...prev, employee_id: e.target.value }))}
              />
            </div>

            {/* Staff Number */}
            <div className="space-y-1.5">
              <Label htmlFor="staff_number">Staff Number</Label>
              <Input
                id="staff_number"
                placeholder="e.g. STF-001"
                value={formData.staff_number}
                onChange={(e) => setFormData((prev) => ({ ...prev, staff_number: e.target.value }))}
              />
            </div>

            {/* National ID */}
            <div className="space-y-1.5">
              <Label htmlFor="national_id">National ID</Label>
              <Input
                id="national_id"
                placeholder="e.g. 12345678"
                value={formData.national_id}
                onChange={(e) => setFormData((prev) => ({ ...prev, national_id: e.target.value }))}
              />
            </div>

            {/* KRA PIN */}
            <div className="space-y-1.5">
              <Label htmlFor="kra_pin">KRA PIN</Label>
              <Input
                id="kra_pin"
                placeholder="e.g. P000123456Z"
                value={formData.kra_pin}
                onChange={(e) => setFormData((prev) => ({ ...prev, kra_pin: e.target.value }))}
              />
            </div>

            {/* NHIF */}
            <div className="space-y-1.5">
              <Label htmlFor="nhif_number">NHIF Number</Label>
              <Input
                id="nhif_number"
                placeholder="NHIF number"
                value={formData.nhif_number}
                onChange={(e) => setFormData((prev) => ({ ...prev, nhif_number: e.target.value }))}
              />
            </div>

            {/* NSSF */}
            <div className="space-y-1.5">
              <Label htmlFor="nssf_number">NSSF Number</Label>
              <Input
                id="nssf_number"
                placeholder="NSSF number"
                value={formData.nssf_number}
                onChange={(e) => setFormData((prev) => ({ ...prev, nssf_number: e.target.value }))}
              />
            </div>

            {/* Department */}
            <div className="space-y-1.5">
              <Label htmlFor="department">Department</Label>
              <Select
                value={formData.department_id}
                onValueChange={(v) => setFormData((prev) => ({ ...prev, department_id: v }))}
              >
                <SelectTrigger id="department">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Position */}
            <div className="space-y-1.5">
              <Label htmlFor="position">Position</Label>
              <Input
                id="position"
                placeholder="e.g. Cashier"
                value={formData.position}
                onChange={(e) => setFormData((prev) => ({ ...prev, position: e.target.value }))}
              />
            </div>

            {/* Hire Date */}
            <div className="space-y-1.5">
              <Label htmlFor="hire_date">Hire Date</Label>
              <Input
                id="hire_date"
                type="date"
                value={formData.hire_date}
                onChange={(e) => setFormData((prev) => ({ ...prev, hire_date: e.target.value }))}
              />
            </div>

            {/* Employment Type */}
            <div className="space-y-1.5">
              <Label htmlFor="employment_type">Employment Type</Label>
              <Select
                value={formData.employment_type}
                onValueChange={(v) => setFormData((prev) => ({ ...prev, employment_type: v }))}
              >
                <SelectTrigger id="employment_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_time">Full Time</SelectItem>
                  <SelectItem value="part_time">Part Time</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="intern">Intern</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Employment Status */}
            {editingEmployee && (
              <div className="space-y-1.5">
                <Label htmlFor="employment_status">Status</Label>
                <Select
                  value={formData.employment_status}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, employment_status: v }))}
                >
                  <SelectTrigger id="employment_status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="on_leave">On Leave</SelectItem>
                    <SelectItem value="terminated">Terminated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Separator for Emergency Contact */}
            <div className="col-span-2">
              <hr className="my-1" />
              <p className="text-sm font-medium text-muted-foreground">Emergency Contact</p>
            </div>

            {/* Emergency Contact Name */}
            <div className="space-y-1.5">
              <Label htmlFor="emergency_name">Contact Name</Label>
              <Input
                id="emergency_name"
                placeholder="Full name"
                value={formData.emergency_contact_name}
                onChange={(e) => setFormData((prev) => ({ ...prev, emergency_contact_name: e.target.value }))}
              />
            </div>

            {/* Emergency Contact Phone */}
            <div className="space-y-1.5">
              <Label htmlFor="emergency_phone">Contact Phone</Label>
              <Input
                id="emergency_phone"
                placeholder="Phone number"
                value={formData.emergency_contact_phone}
                onChange={(e) => setFormData((prev) => ({ ...prev, emergency_contact_phone: e.target.value }))}
              />
            </div>

            {/* Emergency Contact Relation */}
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="emergency_relation">Relation</Label>
              <Input
                id="emergency_relation"
                placeholder="e.g. Spouse, Parent, Sibling"
                value={formData.emergency_contact_relation}
                onChange={(e) => setFormData((prev) => ({ ...prev, emergency_contact_relation: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFormDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editingEmployee ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
