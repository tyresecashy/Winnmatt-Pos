'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  ClipboardCheck, 
  Plus, 
  RefreshCw, 
  Search,
  CheckCircle,
  Clock,
  AlertTriangle,
  User,
  MapPin,
  Camera,
  MessageSquare,
  Timer,
  BarChart3,
  Users,
  Calendar,
  Package,
  Trash2,
  Eye,
  Play,
  Pause,
  Square,
} from 'lucide-react'
import { 
  getTasks, 
  createTask, 
  updateTaskStatus, 
  assignTask,
  getTaskCategories,
  getTaskTemplates,
  getWorkerRoles,
  getWorkerAssignments,
  logTaskTime,
  toggleChecklistItem,
  type Task,
  type TaskCategory,
  type WorkerRole,
  type WorkerAssignment,
  type TaskChecklistItem
} from '@/lib/task-management'
import { useAuth } from '@/contexts/auth-context'
import { useBranch } from '@/contexts/branch-context'
import { formatKSh } from '@/lib/currency'

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-800',
  normal: 'bg-blue-100 text-blue-800',
  high: 'bg-yellow-100 text-yellow-800',
  urgent: 'bg-red-100 text-red-800',
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Clock className="h-4 w-4" />,
  in_progress: <Play className="h-4 w-4" />,
  completed: <CheckCircle className="h-4 w-4" />,
  cancelled: <Trash2 className="h-4 w-4" />,
  overdue: <AlertTriangle className="h-4 w-4" />,
  blocked: <AlertTriangle className="h-4 w-4" />,
}

export default function TasksPage() {
  const { profile } = useAuth()
  const { branchId } = useBranch()
  
  const [tasks, setTasks] = useState<Task[]>([])
  const [categories, setCategories] = useState<TaskCategory[]>([])
  const [roles, setRoles] = useState<WorkerRole[]>([])
  const [assignments, setAssignments] = useState<WorkerAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [showTaskDetails, setShowTaskDetails] = useState(false)
  
  // Create form state
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newCategoryId, setNewCategoryId] = useState('')
  const [newPriority, setNewPriority] = useState<string>('normal')
  const [newDueDate, setNewDueDate] = useState('')
  const [newLocation, setNewLocation] = useState('')
  const [newAssignedTo, setNewAssignedTo] = useState('')

  useEffect(() => {
    loadData()
  }, [branchId])

  async function loadData() {
    setLoading(true)
    try {
      const [tasksData, categoriesData, rolesData, assignmentsData] = await Promise.all([
        getTasks({ branchId: branchId || undefined, limit: 100 }),
        getTaskCategories(),
        getWorkerRoles(),
        getWorkerAssignments(branchId || undefined),
      ])
      
      setTasks(tasksData.tasks)
      setCategories(categoriesData)
      setRoles(rolesData)
      setAssignments(assignmentsData)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateTask() {
    if (!newTitle || !branchId) return

    const result = await createTask(newTitle, branchId, {
      description: newDescription || undefined,
      categoryId: newCategoryId || undefined,
      priority: newPriority as Task['priority'],
      dueDate: newDueDate || undefined,
      location: newLocation || undefined,
      assignedTo: newAssignedTo || undefined,
      assignedBy: profile?.id,
    })

    if (result.success) {
      setShowCreateDialog(false)
      resetForm()
      await loadData()
    }
  }

  async function handleUpdateStatus(taskId: string, status: Task['status']) {
    const result = await updateTaskStatus(taskId, status)
    if (result.success) {
      await loadData()
    }
  }

  async function handleStartTask(taskId: string) {
    await logTaskTime(taskId, profile?.id || '', 'start')
    await loadData()
  }

  async function handleCompleteTask(taskId: string) {
    await logTaskTime(taskId, profile?.id || '', 'end')
    await loadData()
  }

  function resetForm() {
    setNewTitle('')
    setNewDescription('')
    setNewCategoryId('')
    setNewPriority('normal')
    setNewDueDate('')
    setNewLocation('')
    setNewAssignedTo('')
  }

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter
    const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter
    return matchesSearch && matchesStatus && matchesPriority
  })

  // Stats
  const pendingTasks = tasks.filter(t => t.status === 'pending').length
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length
  const completedTasks = tasks.filter(t => t.status === 'completed').length
  const overdueTasks = tasks.filter(t => t.status === 'overdue').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Task Management</h1>
          <p className="text-muted-foreground">
            Manage tasks for shelf stockers, cleaners, and floor staff
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
                Create Task
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Title *</Label>
                  <Input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g., Restock Aisle 5"
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Task description..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Category</Label>
                    <Select value={newCategoryId} onValueChange={setNewCategoryId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Priority</Label>
                    <Select value={newPriority} onValueChange={setNewPriority}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Due Date</Label>
                    <Input
                      type="datetime-local"
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Location</Label>
                    <Input
                      value={newLocation}
                      onChange={(e) => setNewLocation(e.target.value)}
                      placeholder="e.g., Aisle 5"
                    />
                  </div>
                </div>
                <div>
                  <Label>Assign To</Label>
                  <Select value={newAssignedTo} onValueChange={setNewAssignedTo}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select worker (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {assignments.map((assignment) => (
                        <SelectItem key={assignment.employee_id} value={assignment.employee_id}>
                          {assignment.employee?.first_name} {assignment.employee?.last_name}
                          {assignment.role?.name ? ` - ${assignment.role.name}` : assignment.employee?.staff_number ? ` (${assignment.employee.staff_number})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateTask} disabled={!newTitle}>
                  Create Task
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{pendingTasks}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Play className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{inProgressTasks}</p>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{completedTasks}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{overdueTasks}</p>
                <p className="text-xs text-muted-foreground">Overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tasks Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{task.title}</div>
                      {task.description && (
                        <div className="text-xs text-muted-foreground mt-1 max-w-[200px] truncate">
                          {task.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {task.category ? (
                      <Badge style={{ backgroundColor: task.category.color + '20', color: task.category.color }}>
                        {task.category.name}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {task.assignee ? (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {task.assignee.first_name} {task.assignee.last_name}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={PRIORITY_COLORS[task.priority]}>
                      {task.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {STATUS_ICONS[task.status]}
                      <span className="capitalize">{task.status.replace('_', ' ')}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {task.due_date ? new Date(task.due_date).toLocaleString() : '-'}
                  </TableCell>
                  <TableCell>
                    {task.location ? (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        <span className="text-sm">{task.location}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedTask(task)
                          setShowTaskDetails(true)
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {task.status === 'pending' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleStartTask(task.id)}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                      {task.status === 'in_progress' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCompleteTask(task.id)}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Task Details Dialog */}
      {selectedTask && (
        <Dialog open={showTaskDetails} onOpenChange={setShowTaskDetails}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedTask.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="flex items-center gap-2 mt-1">
                    {STATUS_ICONS[selectedTask.status]}
                    <span className="capitalize">{selectedTask.status.replace('_', ' ')}</span>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Priority</Label>
                  <Badge className={`mt-1 ${PRIORITY_COLORS[selectedTask.priority]}`}>
                    {selectedTask.priority}
                  </Badge>
                </div>
              </div>
              
              {selectedTask.description && (
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="mt-1">{selectedTask.description}</p>
                </div>
              )}
              
              {selectedTask.instructions && (
                <div>
                  <Label className="text-muted-foreground">Instructions</Label>
                  <div className="mt-1 p-3 bg-muted rounded-lg whitespace-pre-wrap text-sm">
                    {selectedTask.instructions}
                  </div>
                </div>
              )}
              
              {selectedTask.checklist_items && selectedTask.checklist_items.length > 0 && (
                <div>
                  <Label className="text-muted-foreground">Checklist</Label>
                  <div className="mt-2 space-y-2">
                    {selectedTask.checklist_items.map((item) => (
                      <div key={item.id} className="flex items-center gap-2">
                        <Switch
                          checked={item.is_completed}
                          onCheckedChange={() => toggleChecklistItem(item.id, profile?.id || '')}
                        />
                        <span className={item.is_completed ? 'line-through text-muted-foreground' : ''}>
                          {item.title}
                        </span>
                        {item.is_required && (
                          <Badge variant="outline" className="text-[10px]">Required</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Location</Label>
                  <p className="mt-1">{selectedTask.location || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Due Date</Label>
                  <p className="mt-1">
                    {selectedTask.due_date ? new Date(selectedTask.due_date).toLocaleString() : '-'}
                  </p>
                </div>
              </div>
              
              {selectedTask.completion_notes && (
                <div>
                  <Label className="text-muted-foreground">Completion Notes</Label>
                  <p className="mt-1">{selectedTask.completion_notes}</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowTaskDetails(false)}>
                Close
              </Button>
              {selectedTask.status === 'pending' && (
                <Button onClick={() => handleStartTask(selectedTask.id)}>
                  Start Task
                </Button>
              )}
              {selectedTask.status === 'in_progress' && (
                <Button onClick={() => handleCompleteTask(selectedTask.id)}>
                  Complete Task
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
