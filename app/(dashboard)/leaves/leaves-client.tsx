'use client'

import { useState } from 'react'
import { CalendarDays, CheckCircle, XCircle, Clock, AlertCircle, Plus, Search } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/ui/empty-state'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { applyForLeave, updateLeaveStatus, cancelLeave } from '@/lib/modules/workforce'
import { useToast } from '@/components/ui/use-toast'

interface LeaveRequest {
  id: string
  employee_profile_id: string
  employee_name?: string
  employee_photo?: string
  leave_type: string
  start_date: string
  end_date: string
  reason: string | null
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  approved_by: string | null
  approved_by_name?: string | null
  approved_at: string | null
  created_at: string
}

interface LeaveStats {
  total: number
  pending: number
  approved: number
  rejected: number
  cancelled: number
  type_breakdown: Record<string, number>
}

interface EmployeeProfile {
  id: string
  user_id: string
  photo_url: string | null
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' }> = {
  pending: { label: 'Pending', variant: 'ghost' },
  approved: { label: 'Approved', variant: 'default' },
  rejected: { label: 'Rejected', variant: 'destructive' },
  cancelled: { label: 'Cancelled', variant: 'outline' },
}

const leaveTypeLabels: Record<string, string> = {
  annual: 'Annual Leave',
  sick: 'Sick Leave',
  personal: 'Personal Leave',
  maternity: 'Maternity Leave',
  paternity: 'Paternity Leave',
  bereavement: 'Bereavement Leave',
  other: 'Other',
}

export function LeavesClient({
  initialLeaves,
  stats,
  employeeNames,
  profiles,
}: {
  initialLeaves: LeaveRequest[]
  stats: LeaveStats
  employeeNames: Record<string, string>
  profiles: EmployeeProfile[]
}) {
  const { toast } = useToast()
  const [leaves, setLeaves] = useState(initialLeaves)
  const [activeTab, setActiveTab] = useState('all')
  const [showApplyDialog, setShowApplyDialog] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Apply form
  const [leaveType, setLeaveType] = useState('annual')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')

  const displayed = leaves.filter(lr => {
    const matchesTab = activeTab === 'all' || lr.status === activeTab
    const sq = searchQuery.toLowerCase()
    const matchesSearch = !sq ||
      (lr.employee_name && lr.employee_name.toLowerCase().includes(sq)) ||
      lr.leave_type.toLowerCase().includes(sq)
    return matchesTab && matchesSearch
  })

  async function handleApply(e: React.FormEvent) {
    e.preventDefault()
    if (!startDate || !endDate) return
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.set('leave_type', leaveType)
      fd.set('start_date', startDate)
      fd.set('end_date', endDate)
      fd.set('reason', reason)
      const result = await applyForLeave(fd)
      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' })
      } else {
        toast({ title: 'Success', description: 'Leave request submitted' })
        setShowApplyDialog(false)
        setLeaveType('annual'); setStartDate(''); setEndDate(''); setReason('')
      }
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' })
    } finally { setSubmitting(false) }
  }

  async function handleApprove(id: string) {
    setSubmitting(true)
    try {
      const result = await updateLeaveStatus(id, 'approved')
      if (result.error) toast({ title: 'Error', description: result.error, variant: 'destructive' })
      else toast({ title: 'Success', description: 'Leave approved' })
    } finally { setSubmitting(false) }
  }

  async function handleReject(id: string) {
    setSubmitting(true)
    try {
      const result = await updateLeaveStatus(id, 'rejected')
      if (result.error) toast({ title: 'Error', description: result.error, variant: 'destructive' })
      else toast({ title: 'Done', description: 'Leave rejected' })
    } finally { setSubmitting(false) }
  }

  async function handleCancel(id: string) {
    setSubmitting(true)
    try {
      const result = await cancelLeave(id)
      if (result.error) toast({ title: 'Error', description: result.error, variant: 'destructive' })
      else toast({ title: 'Cancelled', description: 'Leave request cancelled' })
    } finally { setSubmitting(false) }
  }

  function calcDays(start: string, end: string) {
    const s = new Date(start); const e = new Date(end)
    return Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leave Requests</h1>
          <p className="text-muted-foreground">Apply for leave, manage team requests</p>
        </div>
        <Button onClick={() => setShowApplyDialog(true)}>
          <Plus className="mr-2 h-4 w-4" /> Apply for Leave
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Leave Types</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xs space-y-1">
              {Object.entries(stats.type_breakdown).slice(0, 4).map(([type, count]) => (
                <div key={type} className="flex justify-between">
                  <span className="capitalize">{leaveTypeLabels[type] || type}</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs + Search */}
      <div className="flex items-center justify-between gap-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-64">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or type..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Leave Type</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Approved By</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayed.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8"><EmptyState title="No leave requests found" compact /></TableCell>
              </TableRow>
            ) : displayed.map((lr) => {
              const cfg = statusConfig[lr.status] || { label: lr.status, variant: 'secondary' as const }
              return (
                <TableRow key={lr.id}>
                  <TableCell className="font-medium">{lr.employee_name || 'Unknown'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {leaveTypeLabels[lr.leave_type] || lr.leave_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {new Date(lr.start_date).toLocaleDateString()} — {new Date(lr.end_date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{calcDays(lr.start_date, lr.end_date)}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground text-xs">
                    {lr.reason || '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={cfg.variant as 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost'}>{cfg.label}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {lr.approved_by_name || '-'}
                    {lr.approved_at && <div>{new Date(lr.approved_at).toLocaleDateString()}</div>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      {lr.status === 'pending' && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => handleApprove(lr.id)} className="text-green-600">
                            <CheckCircle className="h-3.5 w-3.5 mr-1" /> Approve
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleReject(lr.id)} className="text-red-600">
                            <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleCancel(lr.id)}>
                            Cancel
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Apply Dialog */}
      <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply for Leave</DialogTitle>
            <DialogDescription>Submit a leave request for manager approval</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleApply} className="space-y-4">
            <div className="space-y-2">
              <Label>Leave Type</Label>
              <Select value={leaveType} onValueChange={setLeaveType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['annual', 'sick', 'personal', 'maternity', 'paternity', 'bereavement', 'other'] as const).map(t => (
                    <SelectItem key={t} value={t} className="capitalize">
                      {leaveTypeLabels[t] || t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
              </div>
            </div>
            {startDate && endDate && new Date(endDate) >= new Date(startDate) && (
              <p className="text-xs text-muted-foreground">
                Duration: {calcDays(startDate, endDate)} day(s)
              </p>
            )}
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea
                placeholder="Brief explanation..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowApplyDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Request'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
