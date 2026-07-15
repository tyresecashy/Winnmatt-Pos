'use client'

import { useState } from 'react'
import {
  ArrowLeft, User, FileText, Target, Clock, CalendarDays,
  Mail, Phone, Building2, Briefcase, BadgeCheck, AlertCircle,
  Plus, Trash2, Edit3, CheckCircle, XCircle
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import Link from 'next/link'
import { formatKSh } from '@/lib/currency'
import { useToast } from '@/components/ui/use-toast'
import { EmptyState } from '@/components/ui/empty-state'
import { addEmployeeDocument, deleteEmployeeDocument, addEmployeeGoal, updateGoalProgress, deleteGoal } from '@/lib/modules/workforce'

interface EmployeeDocument {
  id: string
  document_name: string
  document_type: string
  file_url: string | null
  created_at: string
}

interface EmployeeGoal {
  id: string
  title: string
  description: string | null
  target_value: number
  current_value: number
  status: string
  metric?: string
  start_date?: string
  end_date?: string
}

export interface EmployeeData {
  id: string
  user_id: string
  employee_id: string | null
  staff_number: string | null
  national_id: string | null
  kra_pin: string | null
  nhif_number: string | null
  nssf_number: string | null
  department_id: string | null
  position: string | null
  hire_date: string | null
  employment_type: string
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  emergency_contact_relation: string | null
  photo_url: string | null
  digital_signature_url: string | null
  employment_status: string
  created_at: string
  updated_at: string
  user?: {
    id: string
    full_name: string
    email: string
    role: string
    branch_id: string
    branch?: { id: string; name: string; code: string } | null
  } | null
  department?: { id: string; name: string } | null
  goals?: EmployeeGoal[]
  documents?: EmployeeDocument[]
}

export interface ClockEvent {
  id: string
  event_type: string
  timestamp: string
  method: string
  notes: string | null
}

export interface LeaveRequestItem {
  id: string
  leave_type: string
  start_date: string
  end_date: string
  status: string
  reason: string | null
  approved_by_name: string | null
  approved_at: string | null
  created_at: string
}

const employmentTypeLabels: Record<string, string> = {
  full_time: 'Full Time',
  part_time: 'Part Time',
  contract: 'Contract',
  intern: 'Intern',
  casual: 'Casual',
}

const statusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  suspended: 'secondary',
  terminated: 'destructive',
  resigned: 'secondary',
}

const eventTypeLabels: Record<string, string> = {
  clock_in: 'Clock In',
  clock_out: 'Clock Out',
  break_start: 'Break Start',
  break_end: 'Break End',
}

const leaveStatusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pending', variant: 'secondary' },
  approved: { label: 'Approved', variant: 'default' },
  rejected: { label: 'Rejected', variant: 'destructive' },
  cancelled: { label: 'Cancelled', variant: 'outline' },
}

export function EmployeeDetailClient({
  employee,
  clockEvents,
  leaveRequests,
}: {
  employee: EmployeeData
  clockEvents: ClockEvent[]
  leaveRequests: LeaveRequestItem[]
}) {
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [showDocDialog, setShowDocDialog] = useState(false)
  const [showGoalDialog, setShowGoalDialog] = useState(false)
  const [docType, setDocType] = useState('contract')
  const [docName, setDocName] = useState('')
  const [docUrl, setDocUrl] = useState('')
  const [goalTitle, setGoalTitle] = useState('')
  const [goalDesc, setGoalDesc] = useState('')
  const [goalTarget, setGoalTarget] = useState('')
  const [goalMetric, setGoalMetric] = useState('sales_count')
  const [goalStart, setGoalStart] = useState('')
  const [goalEnd, setGoalEnd] = useState('')

  const emp = employee as EmployeeData
  const initials = emp.user?.full_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'EM'

  async function handleAddDoc(e: React.FormEvent) {
    e.preventDefault()
    if (!docName) return
    setSubmitting(true)
    try {
      const result = await addEmployeeDocument({
        employee_profile_id: emp.id,
        document_type: docType,
        document_name: docName,
        file_url: docUrl || undefined,
      })
      if (result.error) toast({ title: 'Error', description: result.error, variant: 'destructive' })
      else {
        toast({ title: 'Success', description: 'Document added' })
        setShowDocDialog(false)
        setDocName(''); setDocUrl('')
      }
    } finally { setSubmitting(false) }
  }

  async function handleDeleteDoc(docId: string) {
    setSubmitting(true)
    try {
      const result = await deleteEmployeeDocument(docId)
      if (result.error) toast({ title: 'Error', description: result.error, variant: 'destructive' })
      else toast({ title: 'Deleted', description: 'Document removed' })
    } finally { setSubmitting(false) }
  }

  async function handleAddGoal(e: React.FormEvent) {
    e.preventDefault()
    if (!goalTitle) return
    setSubmitting(true)
    try {
      const result = await addEmployeeGoal({
        employee_profile_id: emp.id,
        title: goalTitle,
        description: goalDesc || undefined,
        target_value: goalTarget ? parseFloat(goalTarget) : undefined,
        metric: goalMetric,
        start_date: goalStart || undefined,
        end_date: goalEnd || undefined,
      })
      if (result.error) toast({ title: 'Error', description: result.error, variant: 'destructive' })
      else {
        toast({ title: 'Success', description: 'Goal added' })
        setShowGoalDialog(false)
        setGoalTitle(''); setGoalDesc(''); setGoalTarget('')
      }
    } finally { setSubmitting(false) }
  }

  async function handleDeleteGoal(goalId: string) {
    const result = await deleteGoal(goalId)
    if (result.error) toast({ title: 'Error', description: result.error, variant: 'destructive' })
    else toast({ title: 'Deleted', description: 'Goal removed' })
  }

  return (
    <div className="p-6 space-y-6">
      {/* Back button */}
      <div className="flex items-center gap-4">
        <Link href="/employees">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        </Link>
      </div>

      {/* Profile Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-6">
            <Avatar className="h-20 w-20">
              <AvatarFallback className="text-2xl bg-primary text-primary-foreground">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{emp.user?.full_name || 'Unknown'}</h1>
                <Badge variant={statusColors[emp.employment_status] || 'secondary'}>
                  {emp.employment_status}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Briefcase className="h-3.5 w-3.5" /> {emp.position || 'No position'}
                </span>
                <span className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" /> {emp.department?.name || 'No department'}
                </span>
                <span className="flex items-center gap-1">
                  <BadgeCheck className="h-3.5 w-3.5" /> {emp.employee_id || emp.staff_number || 'No ID'}
                </span>
                <span className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" /> {emp.user?.email || 'No email'}
                </span>
                <span className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" /> {emp.user?.branch?.name || 'No branch'}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile"><User className="h-4 w-4 mr-1" /> Profile</TabsTrigger>
          <TabsTrigger value="documents"><FileText className="h-4 w-4 mr-1" /> Documents</TabsTrigger>
          <TabsTrigger value="goals"><Target className="h-4 w-4 mr-1" /> Goals</TabsTrigger>
          <TabsTrigger value="attendance"><Clock className="h-4 w-4 mr-1" /> Attendance</TabsTrigger>
          <TabsTrigger value="leave"><CalendarDays className="h-4 w-4 mr-1" /> Leave History</TabsTrigger>
        </TabsList>

        {/* Tab 1: Profile */}
        <TabsContent value="profile" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader><CardTitle className="text-sm">Personal Information</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="flex justify-between"><span className="text-muted-foreground">Full Name</span><span>{emp.user?.full_name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{emp.user?.email}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Role</span><span className="capitalize">{emp.user?.role}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Employee ID</span><span>{emp.employee_id || '-'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Staff Number</span><span>{emp.staff_number || '-'}</span></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Statutory Information</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="flex justify-between"><span className="text-muted-foreground">National ID</span><span>{emp.national_id || '-'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">KRA PIN</span><span>{emp.kra_pin || '-'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">NHIF</span><span>{emp.nhif_number || '-'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">NSSF</span><span>{emp.nssf_number || '-'}</span></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Employment Details</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="flex justify-between"><span className="text-muted-foreground">Department</span><span>{emp.department?.name || '-'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Position</span><span>{emp.position || '-'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span>{employmentTypeLabels[emp.employment_type] || emp.employment_type}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Hire Date</span><span>{emp.hire_date ? new Date(emp.hire_date).toLocaleDateString() : '-'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Branch</span><span>{emp.user?.branch?.name || '-'}</span></div>
              </CardContent>
            </Card>
          </div>
          {(emp.emergency_contact_name || emp.emergency_contact_phone) && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Emergency Contact</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span>{emp.emergency_contact_name || '-'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span>{emp.emergency_contact_phone || '-'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Relation</span><span>{emp.emergency_contact_relation || '-'}</span></div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab 2: Documents */}
        <TabsContent value="documents" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Employee Documents</h3>
            <Button size="sm" onClick={() => setShowDocDialog(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Document
            </Button>
          </div>
          {(!emp.documents || emp.documents.length === 0) ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground"><EmptyState title="No documents uploaded yet" compact /></CardContent></Card>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>File URL</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emp.documents.map((doc: EmployeeDocument) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">{doc.document_name}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{doc.document_type}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {doc.file_url ? (
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            {doc.file_url}
                          </a>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-xs">{new Date(doc.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteDoc(doc.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Tab 3: Goals */}
        <TabsContent value="goals" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Performance Goals</h3>
            <Button size="sm" onClick={() => setShowGoalDialog(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Goal
            </Button>
          </div>
          {(!emp.goals || emp.goals.length === 0) ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground"><EmptyState title="No goals set yet" compact /></CardContent></Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {emp.goals.map((goal: EmployeeGoal) => {
                const pct = goal.target_value > 0 ? Math.min(100, Math.round((goal.current_value / goal.target_value) * 100)) : 0
                const isComplete = goal.status === 'completed' || pct >= 100
                return (
                  <Card key={goal.id} className={isComplete ? 'border-green-200 bg-green-50/50' : ''}>
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold">{goal.title}</h4>
                          {goal.description && <p className="text-xs text-muted-foreground mt-1">{goal.description}</p>}
                        </div>
                        <div className="flex gap-1">
                          {isComplete ? (
                            <Badge variant="default" className="bg-green-600">Completed</Badge>
                          ) : goal.status === 'cancelled' ? (
                            <Badge variant="outline">Cancelled</Badge>
                          ) : (
                            <Badge variant="secondary">Active</Badge>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteGoal(goal.id)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-3 space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>Progress</span>
                          <span>{goal.current_value} / {goal.target_value} ({pct}%)</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${isComplete ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      {goal.metric && <p className="text-xs text-muted-foreground mt-2 capitalize">Metric: {goal.metric.replace(/_/g, ' ')}</p>}
                      {goal.start_date && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(goal.start_date).toLocaleDateString()} — {goal.end_date ? new Date(goal.end_date).toLocaleDateString() : 'No end date'}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* Tab 4: Attendance */}
        <TabsContent value="attendance" className="space-y-4">
          <h3 className="text-lg font-semibold">Recent Clock Events</h3>
          {clockEvents.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground"><EmptyState title="No clock events recorded" compact /></CardContent></Card>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clockEvents.map((ev) => (
                    <TableRow key={ev.id}>
                      <TableCell className="text-xs">{new Date(ev.timestamp).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {eventTypeLabels[ev.event_type] || ev.event_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="capitalize text-xs">{ev.method}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{ev.notes || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Tab 5: Leave History */}
        <TabsContent value="leave" className="space-y-4">
          <h3 className="text-lg font-semibold">Leave Request History</h3>
          {leaveRequests.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground"><EmptyState title="No leave requests" compact /></CardContent></Card>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Approved By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaveRequests.map((lr) => {
                    const cfg = leaveStatusConfig[lr.status] || { label: lr.status, variant: 'secondary' as const }
                    return (
                      <TableRow key={lr.id}>
                        <TableCell className="capitalize">{lr.leave_type}</TableCell>
                        <TableCell className="text-xs">
                          {new Date(lr.start_date).toLocaleDateString()} — {new Date(lr.end_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{lr.reason || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={cfg.variant}>{cfg.label}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">{lr.approved_by_name || '-'}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Document Dialog */}
      <Dialog open={showDocDialog} onOpenChange={setShowDocDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Document</DialogTitle>
            <DialogDescription>Upload or link an employee document</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddDoc} className="space-y-4">
            <div className="space-y-2">
              <Label>Document Type</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="id">ID Document</SelectItem>
                  <SelectItem value="certificate">Certificate</SelectItem>
                  <SelectItem value="tax">Tax Document</SelectItem>
                  <SelectItem value="disciplinary">Disciplinary</SelectItem>
                  <SelectItem value="training">Training</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Document Name</Label>
              <Input value={docName} onChange={(e) => setDocName(e.target.value)} placeholder="e.g. Employment Contract" required />
            </div>
            <div className="space-y-2">
              <Label>File URL (optional)</Label>
              <Input value={docUrl} onChange={(e) => setDocUrl(e.target.value)} placeholder="https://..." />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDocDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>Add Document</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Goal Dialog */}
      <Dialog open={showGoalDialog} onOpenChange={setShowGoalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Goal</DialogTitle>
            <DialogDescription>Set a performance goal for this employee</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddGoal} className="space-y-4">
            <div className="space-y-2">
              <Label>Goal Title</Label>
              <Input value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)} placeholder="e.g. Monthly Sales Target" required />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={goalDesc} onChange={(e) => setGoalDesc(e.target.value)} rows={2} placeholder="Optional description" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Metric</Label>
                <Select value={goalMetric} onValueChange={setGoalMetric}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sales_count">Sales Count</SelectItem>
                    <SelectItem value="revenue">Revenue</SelectItem>
                    <SelectItem value="items_per_sale">Items per Sale</SelectItem>
                    <SelectItem value="customer_satisfaction">Customer Satisfaction</SelectItem>
                    <SelectItem value="attendance">Attendance</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Target Value</Label>
                <Input type="number" min="0" step="1" value={goalTarget} onChange={(e) => setGoalTarget(e.target.value)} placeholder="e.g. 100" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" value={goalStart} onChange={(e) => setGoalStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input type="date" value={goalEnd} onChange={(e) => setGoalEnd(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowGoalDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>Add Goal</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
