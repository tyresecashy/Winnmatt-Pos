'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from '@/hooks/use-toast'
import {
  getAutomationRules, getAutomationRule, createAutomationRule, updateAutomationRule,
  toggleAutomationRule, deleteAutomationRule, upsertCondition, deleteCondition,
  upsertAction, deleteAction, getAutomationEvents, getAutomationLogs, getAutomationStats,
  type AutomationRule, type AutomationEvent, type AutomationLog
} from '@/lib/modules/automation'
import { getScheduledTasks, checkScheduledTasks, type ScheduledTask } from '@/lib/automation/scheduler'
import {
  Zap, Activity, Clock, AlertTriangle, CheckCircle, XCircle, Plus, Trash2,
  Play, Pause, RefreshCw, Settings, Bell, FileText, Calendar
} from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

const EVENT_TYPES = [
  'sale.completed', 'sale.voided', 'sale.returned',
  'stock.changed', 'stock.low', 'stock.out',
  'customer.created', 'customer.updated',
  'shift.opened', 'shift.closed',
  'price.changed', 'invoice.overdue',
  'scheduler.daily_close', 'scheduler.inventory_check',
]

const ACTION_TYPES = [
  { value: 'notify', label: 'Send Notification' },
  { value: 'audit', label: 'Write Audit Log' },
]

const OPERATORS = ['=', '!=', '>', '<', '>=', '<=', 'IN', 'NOT_IN', 'CONTAINS', 'EXISTS', 'NOT_EXISTS']

export default function AutomationPage() {
  const [rules, setRules] = useState<AutomationRule[]>([])
  const [events, setEvents] = useState<AutomationEvent[]>([])
  const [logs, setLogs] = useState<AutomationLog[]>([])
  const [schedules, setSchedules] = useState<ScheduledTask[]>([])
  const [stats, setStats] = useState({ totalRules: 0, activeRules: 0, totalEvents: 0, totalActionsExecuted: 0, failedActions: 0, recentEvents: [] as AutomationEvent[] })
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingRule, setEditingRule] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', description: '', trigger_event: '', priority: 0, cooldown_ms: 0, max_daily: '' })
  const [createForm, setCreateForm] = useState({ name: '', description: '', trigger_event: '', priority: 0, cooldown_ms: 0, max_daily: '' })

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [rulesData, eventsData, logsData, statsData, schedulesData] = await Promise.all([
      getAutomationRules(),
      getAutomationEvents(50),
      getAutomationLogs(50),
      getAutomationStats(),
      getScheduledTasks(),
    ])
    setRules(rulesData)
    setEvents(eventsData)
    setLogs(logsData)
    setStats(statsData)
    setSchedules(schedulesData)
    setLoading(false)
  }

  async function handleCreate() {
    if (!createForm.name || !createForm.trigger_event) {
      toast({ title: 'Error', description: 'Name and trigger event are required', variant: 'destructive' })
      return
    }
    const result = await createAutomationRule({
      name: createForm.name,
      description: createForm.description,
      trigger_event: createForm.trigger_event,
      priority: createForm.priority,
      cooldown_ms: createForm.cooldown_ms,
      max_daily: createForm.max_daily ? parseInt(createForm.max_daily) : undefined,
    })
    if (result.success) {
      toast({ title: 'Created', description: `Rule "${createForm.name}" created` })
      setShowCreateDialog(false)
      setCreateForm({ name: '', description: '', trigger_event: '', priority: 0, cooldown_ms: 0, max_daily: '' })
      loadAll()
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' })
    }
  }

  async function handleEdit() {
    if (!editingRule) return
    const result = await updateAutomationRule(editingRule, {
      name: editForm.name,
      description: editForm.description,
      trigger_event: editForm.trigger_event,
      priority: editForm.priority,
      cooldown_ms: editForm.cooldown_ms,
      max_daily: editForm.max_daily ? parseInt(editForm.max_daily) : undefined,
    })
    if (result.success) {
      toast({ title: 'Updated', description: 'Rule updated' })
      setShowEditDialog(false)
      loadAll()
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' })
    }
  }

  async function handleToggle(ruleId: string) {
    const result = await toggleAutomationRule(ruleId)
    if (result.success) {
      toast({ title: result.is_active ? 'Enabled' : 'Disabled', description: 'Rule toggled' })
      loadAll()
    }
  }

  async function handleDelete(ruleId: string, name: string) {
    if (!confirm(`Delete rule "${name}"?`)) return
    const result = await deleteAutomationRule(ruleId)
    if (result.success) {
      toast({ title: 'Deleted', description: `Rule "${name}" deleted` })
      loadAll()
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' })
    }
  }

  async function handleRunScheduler() {
    const result = await checkScheduledTasks()
    toast({ title: 'Scheduler Run', description: `Checked ${result.checked} tasks, executed ${result.executed}` })
    loadAll()
  }

  function openEditDialog(rule: AutomationRule) {
    setEditingRule(rule.id)
    setEditForm({
      name: rule.name,
      description: rule.description || '',
      trigger_event: rule.trigger_event,
      priority: rule.priority,
      cooldown_ms: rule.cooldown_ms,
      max_daily: rule.max_daily?.toString() || '',
    })
    setShowEditDialog(true)
  }

  function formatTime(iso: string | null) {
    if (!iso) return '—'
    return new Date(iso).toLocaleString('en-KE', { hour12: false, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  function eventIcon(type: string) {
    if (type.startsWith('sale')) return <CheckCircle className="h-4 w-4 text-green-500" />
    if (type.startsWith('stock')) return <AlertTriangle className="h-4 w-4 text-amber-500" />
    if (type.startsWith('shift')) return <Clock className="h-4 w-4 text-blue-500" />
    if (type.startsWith('customer')) return <Bell className="h-4 w-4 text-purple-500" />
    return <Activity className="h-4 w-4 text-gray-500" />
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Zap className="h-8 w-8 text-yellow-500" />
            Automation Center
          </h1>
          <p className="text-muted-foreground mt-1">Manage business rules, notifications, and scheduled tasks</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRunScheduler}>
            <Play className="h-4 w-4 mr-2" /> Run Scheduler
          </Button>
          <Button onClick={() => loadAll}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> New Rule</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Automation Rule</DialogTitle>
                <DialogDescription>Define a new business rule that triggers on events</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Rule Name</Label>
                  <Input value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} placeholder="e.g. Low Stock Alert" />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea value={createForm.description} onChange={e => setCreateForm({ ...createForm, description: e.target.value })} placeholder="What this rule does..." />
                </div>
                <div>
                  <Label>Trigger Event</Label>
                  <Select value={createForm.trigger_event} onValueChange={v => setCreateForm({ ...createForm, trigger_event: v })}>
                    <SelectTrigger><SelectValue placeholder="Select event..." /></SelectTrigger>
                    <SelectContent>
                      {EVENT_TYPES.map(et => <SelectItem key={et} value={et}>{et}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Priority</Label>
                    <Input type="number" value={createForm.priority} onChange={e => setCreateForm({ ...createForm, priority: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <Label>Cooldown (ms)</Label>
                    <Input type="number" value={createForm.cooldown_ms} onChange={e => setCreateForm({ ...createForm, cooldown_ms: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <Label>Max Daily</Label>
                    <Input type="number" value={createForm.max_daily} onChange={e => setCreateForm({ ...createForm, max_daily: e.target.value })} placeholder="Unlimited" />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
                <Button onClick={handleCreate}>Create Rule</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Rules</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{stats.totalRules}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Active Rules</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-green-600">{stats.activeRules}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Events Processed</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-blue-600">{stats.totalEvents}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Actions Executed</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-purple-600">{stats.totalActionsExecuted}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Failed Actions</CardTitle></CardHeader>
          <CardContent><div className={`text-3xl font-bold ${stats.failedActions > 0 ? 'text-red-600' : 'text-green-600'}`}>{stats.failedActions}</div></CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules" className="flex items-center gap-1"><Settings className="h-4 w-4" /> Rules ({rules.length})</TabsTrigger>
          <TabsTrigger value="events" className="flex items-center gap-1"><Activity className="h-4 w-4" /> Events ({events.length})</TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-1"><FileText className="h-4 w-4" /> Logs ({logs.length})</TabsTrigger>
          <TabsTrigger value="schedules" className="flex items-center gap-1"><Calendar className="h-4 w-4" /> Schedules ({schedules.length})</TabsTrigger>
        </TabsList>

        {/* Rules Tab */}
        <TabsContent value="rules">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Cooldown</TableHead>
                    <TableHead>Daily Limit</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map(rule => (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{rule.name}</div>
                          {rule.description && <div className="text-xs text-muted-foreground">{rule.description}</div>}
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{rule.trigger_event}</Badge></TableCell>
                      <TableCell>{rule.priority}</TableCell>
                      <TableCell>
                        <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                          {rule.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>{rule.cooldown_ms > 0 ? `${rule.cooldown_ms / 1000}s` : '—'}</TableCell>
                      <TableCell>{rule.max_daily || 'Unlimited'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="sm" onClick={() => handleToggle(rule.id)}>
                            {rule.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openEditDialog(rule)}>
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(rule.id, rule.name)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rules.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        <EmptyState icon={Zap} title="No automation rules yet" description="Create one to get started." compact />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Events Tab */}
        <TabsContent value="events">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map(event => (
                    <TableRow key={event.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {eventIcon(event.event_type)}
                          <Badge variant="outline">{event.event_type}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{event.source}</TableCell>
                      <TableCell>
                        {event.entity_type && <span className="text-sm">{event.entity_type}</span>}
                        {event.entity_id && <span className="text-xs text-muted-foreground ml-1">({event.entity_id.slice(0, 8)}...)</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={event.processed ? 'default' : 'secondary'}>
                          {event.processed ? 'Processed' : 'Pending'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatTime(event.created_at)}</TableCell>
                    </TableRow>
                  ))}
                  {events.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        <EmptyState icon={Activity} title="No events recorded yet" description="Events appear when automations fire." compact />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Rule</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell>
                        {log.status === 'success' ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : log.status === 'failed' ? (
                          <XCircle className="h-4 w-4 text-red-500" />
                        ) : (
                          <Clock className="h-4 w-4 text-gray-400" />
                        )}
                      </TableCell>
                      <TableCell><Badge variant="outline">{log.action_type}</Badge></TableCell>
                      <TableCell className="text-sm">
                        {log.rule ? log.rule.name : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {log.duration_ms ? `${log.duration_ms}ms` : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-red-500 max-w-[200px] truncate">
                        {log.error_msg || '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatTime(log.created_at)}</TableCell>
                    </TableRow>
                  ))}
                  {logs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        <EmptyState icon={FileText} title="No action logs yet" description="Logs appear when rules execute actions." compact />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Schedules Tab */}
        <TabsContent value="schedules">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Run</TableHead>
                    <TableHead>Next Run</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedules.map(task => (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">{task.name}</TableCell>
                      <TableCell><Badge variant="outline">{task.cron_expr}</Badge></TableCell>
                      <TableCell>
                        <Badge variant={task.is_active ? 'default' : 'secondary'}>
                          {task.is_active ? 'Active' : 'Paused'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatTime(task.last_run)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatTime(task.next_run)}</TableCell>
                    </TableRow>
                  ))}
                  {schedules.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        <EmptyState icon={Clock} title="No scheduled tasks configured" compact />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Automation Rule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Rule Name</Label>
              <Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
            </div>
            <div>
              <Label>Trigger Event</Label>
              <Select value={editForm.trigger_event} onValueChange={v => setEditForm({ ...editForm, trigger_event: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map(et => <SelectItem key={et} value={et}>{et}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Priority</Label>
                <Input type="number" value={editForm.priority} onChange={e => setEditForm({ ...editForm, priority: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Cooldown (ms)</Label>
                <Input type="number" value={editForm.cooldown_ms} onChange={e => setEditForm({ ...editForm, cooldown_ms: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Max Daily</Label>
                <Input type="number" value={editForm.max_daily} onChange={e => setEditForm({ ...editForm, max_daily: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button onClick={handleEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
