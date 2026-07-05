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
import { Textarea } from '@/components/ui/textarea'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { formatKSh } from '@/lib/currency'
import {
  getRegisters,
  getCashDrawers,
  getCashEvents,
  getCashSummary,
  recordCashEvent,
  createRegister,
  createCashDrawer,
  updateRegister,
} from '@/lib/cash-actions'
import {
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Layers,
  Plus,
  Monitor,
  Printer,
  Scan,
  Wifi,
  Battery,
  Search,
  User,
  Receipt,
  ChevronRight,
  Edit,
} from 'lucide-react'

interface CashDrawerRecord {
  id: string
  drawer_name: string
  branch_id: string
  register_id: string | null
  status: 'open' | 'closed' | 'counted'
  current_balance: number
  expected_balance: number
  last_variance: number | null
  opened_at: string | null
  closed_at: string | null
  created_at: string
  register?: { id: string; register_name: string; status: string } | null
}

interface RegisterRecord {
  id: string
  register_name: string
  branch_id: string
  serial_number: string | null
  register_type: string | null
  status: string
  health_score: number | null
  battery_level: number | null
  printer_status: string | null
  scanner_status: string | null
  network_status: string | null
  last_login: string | null
  current_cashier_id: string | null
  created_at: string
  branch?: { id: string; name: string; code: string } | null
  current_cashier?: { id: string; full_name: string } | null
}

interface CashEventRecord {
  id: string
  register_id: string | null
  drawer_id: string | null
  branch_id: string
  event_type: string
  amount: number
  balance_before: number | null
  balance_after: number | null
  reference_type: string | null
  reference_id: string | null
  reason: string
  performed_by: string
  approved_by: string | null
  notes: string | null
  created_at: string
  performer?: { id: string; full_name: string } | null
  approver?: { id: string; full_name: string } | null
}

interface CashSummaryData {
  totalCashIn: number
  totalCashOut: number
  netCash: number
  openDrawers: number
  totalDrawers: number
  totalVariance: number
  eventCount: number
}

const EVENT_TYPE_OPTIONS = [
  { value: 'cash_sale', label: 'Cash Sale', color: 'text-green-600' },
  { value: 'paid_in', label: 'Paid In', color: 'text-green-600' },
  { value: 'opening_float', label: 'Opening Float', color: 'text-green-600' },
  { value: 'cash_refund', label: 'Cash Refund', color: 'text-red-600' },
  { value: 'paid_out', label: 'Paid Out', color: 'text-red-600' },
  { value: 'safe_drop', label: 'Safe Drop', color: 'text-red-600' },
  { value: 'cash_pickup', label: 'Cash Pickup', color: 'text-red-600' },
  { value: 'adjustment', label: 'Adjustment', color: 'text-amber-600' },
]

const IN_EVENTS = ['cash_sale', 'paid_in', 'opening_float']

export default function CashManagementPage() {
  const { profile } = useAuth()
  const { toast } = useToast()

  const [summary, setSummary] = useState<CashSummaryData | null>(null)
  const [drawers, setDrawers] = useState<CashDrawerRecord[]>([])
  const [registers, setRegisters] = useState<RegisterRecord[]>([])
  const [events, setEvents] = useState<CashEventRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('drawers-registers')

  // Drawer event history
  const [selectedDrawer, setSelectedDrawer] = useState<CashDrawerRecord | null>(null)
  const [drawerEvents, setDrawerEvents] = useState<CashEventRecord[]>([])
  const [drawerEventsOpen, setDrawerEventsOpen] = useState(false)

  // Create drawer dialog
  const [showCreateDrawer, setShowCreateDrawer] = useState(false)
  const [drawerName, setDrawerName] = useState('')
  const [drawerRegisterId, setDrawerRegisterId] = useState('')
  const [creatingDrawer, setCreatingDrawer] = useState(false)

  // Create register dialog
  const [showCreateRegister, setShowCreateRegister] = useState(false)
  const [registerName, setRegisterName] = useState('')
  const [registerSerial, setRegisterSerial] = useState('')
  const [registerType, setRegisterType] = useState('')
  const [creatingRegister, setCreatingRegister] = useState(false)

  // Record event dialog
  const [showRecordEvent, setShowRecordEvent] = useState(false)
  const [eventType, setEventType] = useState('')
  const [eventAmount, setEventAmount] = useState('')
  const [eventReason, setEventReason] = useState('')
  const [eventNotes, setEventNotes] = useState('')
  const [eventDrawerId, setEventDrawerId] = useState('')
  const [recordingEvent, setRecordingEvent] = useState(false)

  // Edit register dialog
  const [showEditRegister, setShowEditRegister] = useState(false)
  const [editingRegister, setEditingRegister] = useState<RegisterRecord | null>(null)
  const [editStatus, setEditStatus] = useState('')
  const [editHealthScore, setEditHealthScore] = useState('')
  const [editBatteryLevel, setEditBatteryLevel] = useState('')
  const [editPrinterStatus, setEditPrinterStatus] = useState('')
  const [editScannerStatus, setEditScannerStatus] = useState('')
  const [editNetworkStatus, setEditNetworkStatus] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  // Event search
  const [eventSearch, setEventSearch] = useState('')
  const [eventTypeFilter, setEventTypeFilter] = useState('')

  const branchId = profile?.branch_id

  const loadData = useCallback(async () => {
    if (!branchId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [fetchedSummary, fetchedDrawers, fetchedRegisters, fetchedEvents] = await Promise.all([
        getCashSummary(branchId),
        getCashDrawers(branchId),
        getRegisters(branchId),
        getCashEvents(branchId, { limit: 100 }),
      ])
      setSummary(fetchedSummary)
      setDrawers(fetchedDrawers as CashDrawerRecord[])
      setRegisters(fetchedRegisters as RegisterRecord[])
      setEvents(fetchedEvents as CashEventRecord[])
    } catch (error) {
      logger.error('Failed to load cash management data:', error)
    } finally {
      setLoading(false)
    }
  }, [branchId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const handleViewDrawerEvents = async (drawer: CashDrawerRecord) => {
    setSelectedDrawer(drawer)
    try {
      const fetched = await getCashEvents(branchId!, { drawerId: drawer.id })
      setDrawerEvents(fetched as CashEventRecord[])
    } catch (error) {
      logger.error('Failed to load drawer events:', error)
      setDrawerEvents([])
    }
    setDrawerEventsOpen(true)
  }

  const handleCreateDrawer = async () => {
    if (!drawerName.trim() || !branchId) return
    setCreatingDrawer(true)
    try {
      const result = await createCashDrawer({
        drawer_name: drawerName.trim(),
        branch_id: branchId,
        register_id: drawerRegisterId || undefined,
      })
      if (result.success) {
        toast({ title: 'Drawer Created', description: `${drawerName.trim()} has been created` })
        setShowCreateDrawer(false)
        setDrawerName('')
        setDrawerRegisterId('')
        void loadData()
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to create drawer', variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Error', description: 'An unexpected error occurred', variant: 'destructive' })
    } finally {
      setCreatingDrawer(false)
    }
  }

  const handleCreateRegister = async () => {
    if (!registerName.trim() || !branchId) return
    setCreatingRegister(true)
    try {
      const result = await createRegister({
        register_name: registerName.trim(),
        branch_id: branchId,
        serial_number: registerSerial.trim() || undefined,
        register_type: registerType || undefined,
      })
      if (result.success) {
        toast({ title: 'Register Created', description: `${registerName.trim()} has been created` })
        setShowCreateRegister(false)
        setRegisterName('')
        setRegisterSerial('')
        setRegisterType('')
        void loadData()
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to create register', variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Error', description: 'An unexpected error occurred', variant: 'destructive' })
    } finally {
      setCreatingRegister(false)
    }
  }

  const handleRecordEvent = async () => {
    if (!eventType || !eventAmount || !eventReason.trim() || !branchId || !profile?.id) {
      toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' })
      return
    }
    const amount = parseFloat(eventAmount)
    if (isNaN(amount) || amount <= 0) {
      toast({ title: 'Error', description: 'Amount must be a positive number', variant: 'destructive' })
      return
    }
    setRecordingEvent(true)
    try {
      const result = await recordCashEvent({
        branch_id: branchId,
        drawer_id: eventDrawerId || undefined,
        event_type: eventType,
        amount,
        reason: eventReason.trim(),
        performed_by: profile.id,
        notes: eventNotes.trim() || undefined,
      })
      if (result.success) {
        toast({ title: 'Event Recorded', description: 'Cash event has been recorded' })
        setShowRecordEvent(false)
        setEventType('')
        setEventAmount('')
        setEventReason('')
        setEventNotes('')
        setEventDrawerId('')
        void loadData()
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to record event', variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Error', description: 'An unexpected error occurred', variant: 'destructive' })
    } finally {
      setRecordingEvent(false)
    }
  }

  const handleEditRegister = (register: RegisterRecord) => {
    setEditingRegister(register)
    setEditStatus(register.status || '')
    setEditHealthScore(String(register.health_score ?? ''))
    setEditBatteryLevel(String(register.battery_level ?? ''))
    setEditPrinterStatus(register.printer_status || '')
    setEditScannerStatus(register.scanner_status || '')
    setEditNetworkStatus(register.network_status || '')
    setShowEditRegister(true)
  }

  const handleSaveEditRegister = async () => {
    if (!editingRegister) return
    setSavingEdit(true)
    try {
      const result = await updateRegister(editingRegister.id, {
        status: editStatus || null,
        health_score: editHealthScore ? parseInt(editHealthScore) : null,
        battery_level: editBatteryLevel ? parseInt(editBatteryLevel) : null,
        printer_status: editPrinterStatus || null,
        scanner_status: editScannerStatus || null,
        network_status: editNetworkStatus || null,
      })
      if (result.success) {
        toast({ title: 'Register Updated', description: `${editingRegister.register_name} has been updated` })
        setShowEditRegister(false)
        setEditingRegister(null)
        void loadData()
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to update register', variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Error', description: 'An unexpected error occurred', variant: 'destructive' })
    } finally {
      setSavingEdit(false)
    }
  }

  const getHealthColor = (score: number | null) => {
    if (score === null) return 'bg-gray-300'
    if (score >= 80) return 'bg-green-500'
    if (score >= 50) return 'bg-amber-500'
    return 'bg-red-500'
  }

  const getHealthLabel = (score: number | null) => {
    if (score === null) return 'N/A'
    if (score >= 80) return 'Good'
    if (score >= 50) return 'Fair'
    return 'Poor'
  }

  const getBatteryIcon = (level: number | null) => {
    if (level === null) return <Battery className="h-4 w-4 text-muted-foreground" />
    if (level >= 70) return <Battery className="h-4 w-4 text-green-600" />
    if (level >= 30) return <Battery className="h-4 w-4 text-amber-600" />
    return <Battery className="h-4 w-4 text-red-600" />
  }

  const getStatusBadge = (status: string | null | undefined) => {
    switch (status) {
      case 'online':
        return <Badge variant="default" className="bg-green-600">Online</Badge>
      case 'offline':
        return <Badge variant="destructive">Offline</Badge>
      case 'maintenance':
        return <Badge variant="secondary">Maintenance</Badge>
      default:
        return <Badge variant="outline">{status || 'Unknown'}</Badge>
    }
  }

  const getDrawerStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge className="bg-green-600">Open</Badge>
      case 'closed':
        return <Badge variant="secondary">Closed</Badge>
      case 'counted':
        return <Badge variant="default">Counted</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getEventTypeBadge = (type: string) => {
    const opt = EVENT_TYPE_OPTIONS.find((o) => o.value === type)
    const isIn = IN_EVENTS.includes(type)
    return (
      <Badge variant={isIn ? 'default' : 'destructive'} className={isIn ? 'bg-green-600' : undefined}>
        {opt?.label || type}
      </Badge>
    )
  }

  const filteredEvents = events.filter((e) => {
    if (eventTypeFilter && e.event_type !== eventTypeFilter) return false
    if (eventSearch) {
      const q = eventSearch.toLowerCase()
      return (
        e.reason.toLowerCase().includes(q) ||
        e.performer?.full_name?.toLowerCase().includes(q) ||
        e.event_type.toLowerCase().includes(q)
      )
    }
    return true
  })

  const summaryCards = summary
    ? [
        { title: 'Total Cash In (Today)', value: formatKSh(summary.totalCashIn), icon: ArrowUpRight, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950' },
        { title: 'Total Cash Out', value: formatKSh(summary.totalCashOut), icon: ArrowDownRight, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950' },
        { title: 'Net Cash', value: formatKSh(summary.netCash), icon: DollarSign, color: summary.netCash >= 0 ? 'text-green-600' : 'text-red-600', bg: 'bg-blue-50 dark:bg-blue-950' },
        { title: 'Open Drawers', value: `${summary.openDrawers} / ${summary.totalDrawers}`, icon: Layers, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950' },
        { title: 'Variance', value: formatKSh(summary.totalVariance), icon: Wallet, color: summary.totalVariance === 0 ? 'text-muted-foreground' : 'text-red-600', bg: 'bg-purple-50 dark:bg-purple-950' },
      ]
    : []

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cash Management Center</h1>
          <p className="text-sm text-muted-foreground">
            Manage cash drawers, registers, and record cash events
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-7 w-20" />
                </CardContent>
              </Card>
            ))
          : summaryCards.map((card) => (
              <Card key={card.title}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground">
                    {card.title}
                  </CardTitle>
                  <div className={`rounded-lg p-1.5 ${card.bg}`}>
                    <card.icon className={`h-4 w-4 ${card.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className={`text-xl font-bold ${card.color}`}>{card.value}</div>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex w-full">
          <TabsTrigger value="drawers-registers" className="flex-1 text-xs">Drawers & Registers</TabsTrigger>
          <TabsTrigger value="cash-events" className="flex-1 text-xs">Cash Events</TabsTrigger>
          <TabsTrigger value="register-management" className="flex-1 text-xs">Register Mgmt</TabsTrigger>
        </TabsList>

        {/* ── Drawers & Registers Tab ── */}
        <TabsContent value="drawers-registers">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Cash Drawers */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Cash Drawers</CardTitle>
                  <Button size="sm" className="gap-1.5" onClick={() => setShowCreateDrawer(true)}>
                    <Plus className="h-3.5 w-3.5" />
                    New Drawer
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : drawers.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No cash drawers found
                  </p>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {drawers.map((drawer) => (
                        <div
                          key={drawer.id}
                          className="flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                          onClick={() => handleViewDrawerEvents(drawer)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Wallet className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="font-medium text-sm truncate">{drawer.drawer_name}</span>
                              {getDrawerStatusBadge(drawer.status)}
                            </div>
                            <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
                              <span>Bal: {formatKSh(drawer.current_balance)}</span>
                              <span>Expected: {formatKSh(drawer.expected_balance)}</span>
                              {drawer.last_variance != null && drawer.last_variance !== 0 && (
                                <span className="text-red-500">
                                  Variance: {formatKSh(drawer.last_variance)}
                                </span>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            {/* Registers */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Registers</CardTitle>
                  <Button size="sm" className="gap-1.5" onClick={() => setShowCreateRegister(true)}>
                    <Plus className="h-3.5 w-3.5" />
                    New Register
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : registers.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No registers found
                  </p>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {registers.map((reg) => (
                        <div
                          key={reg.id}
                          className="flex items-center justify-between rounded-lg border p-3"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Monitor className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="font-medium text-sm truncate">{reg.register_name}</span>
                              {getStatusBadge(reg.status)}
                            </div>
                            <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                              {reg.current_cashier && (
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {reg.current_cashier.full_name}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <span className={`inline-block h-2 w-2 rounded-full ${getHealthColor(reg.health_score)}`} />
                                {getHealthLabel(reg.health_score)}
                              </span>
                              {reg.last_login && (
                                <span>
                                  Last: {new Date(reg.last_login).toLocaleDateString('en-KE', { day: '2-digit', month: 'short' })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Cash Events Tab ── */}
        <TabsContent value="cash-events">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-lg">Cash Events</CardTitle>
                <Button className="gap-1.5" onClick={() => setShowRecordEvent(true)}>
                  <Plus className="h-4 w-4" />
                  Record Event
                </Button>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search events..."
                    className="pl-9"
                    value={eventSearch}
                    onChange={(e) => setEventSearch(e.target.value)}
                  />
                </div>
                <Select value={eventTypeFilter || 'all'} onValueChange={(v) => setEventTypeFilter(v === 'all' ? '' : v)}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {EVENT_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredEvents.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {eventSearch || eventTypeFilter ? 'No matching events found' : 'No cash events recorded yet'}
                </p>
              ) : (
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead className="hidden md:table-cell">Balance Before</TableHead>
                        <TableHead className="hidden md:table-cell">Balance After</TableHead>
                        <TableHead>Performer</TableHead>
                        <TableHead className="hidden lg:table-cell">Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEvents.map((event) => (
                        <TableRow key={event.id}>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {new Date(event.created_at).toLocaleDateString('en-KE', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </TableCell>
                          <TableCell>{getEventTypeBadge(event.event_type)}</TableCell>
                          <TableCell>
                            <span className={`font-mono text-sm font-medium ${IN_EVENTS.includes(event.event_type) ? 'text-green-600' : 'text-red-600'}`}>
                              {IN_EVENTS.includes(event.event_type) ? '+' : '-'}{formatKSh(event.amount)}
                            </span>
                          </TableCell>
                          <TableCell className="hidden font-mono text-sm md:table-cell">
                            {event.balance_before != null ? formatKSh(event.balance_before) : '-'}
                          </TableCell>
                          <TableCell className="hidden font-mono text-sm md:table-cell">
                            {event.balance_after != null ? formatKSh(event.balance_after) : '-'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {event.performer?.full_name || 'System'}
                          </TableCell>
                          <TableCell className="hidden max-w-[200px] truncate text-sm lg:table-cell">
                            {event.reason}
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

        {/* ── Register Management Tab ── */}
        <TabsContent value="register-management">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">All Registers</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : registers.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No registers found
                </p>
              ) : (
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Health</TableHead>
                        <TableHead className="hidden md:table-cell">Printer</TableHead>
                        <TableHead className="hidden md:table-cell">Scanner</TableHead>
                        <TableHead className="hidden md:table-cell">Network</TableHead>
                        <TableHead className="hidden md:table-cell">Battery</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {registers.map((reg) => (
                        <TableRow key={reg.id}>
                          <TableCell>
                            <div>
                              <span className="font-medium text-sm">{reg.register_name}</span>
                              {reg.register_type && (
                                <span className="ml-2 text-xs text-muted-foreground">({reg.register_type})</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(reg.status)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="relative h-2 w-16 overflow-hidden rounded-full bg-primary/20">
                                <div
                                  className={`h-full w-full transition-all ${getHealthColor(reg.health_score)}`}
                                  style={{ transform: `translateX(-${100 - (reg.health_score ?? 0)}%)` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {getHealthLabel(reg.health_score)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {reg.printer_status ? (
                              <div className="flex items-center gap-1.5">
                                <Printer className={`h-4 w-4 ${reg.printer_status === 'online' ? 'text-green-600' : 'text-red-600'}`} />
                                <span className="text-xs capitalize">{reg.printer_status}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {reg.scanner_status ? (
                              <div className="flex items-center gap-1.5">
                                <Scan className={`h-4 w-4 ${reg.scanner_status === 'online' ? 'text-green-600' : 'text-red-600'}`} />
                                <span className="text-xs capitalize">{reg.scanner_status}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {reg.network_status ? (
                              <div className="flex items-center gap-1.5">
                                <Wifi className={`h-4 w-4 ${reg.network_status === 'online' ? 'text-green-600' : 'text-red-600'}`} />
                                <span className="text-xs capitalize">{reg.network_status}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <div className="flex items-center gap-1.5">
                              {getBatteryIcon(reg.battery_level)}
                              <span className="text-xs">
                                {reg.battery_level != null ? `${reg.battery_level}%` : '-'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-1.5"
                              onClick={() => handleEditRegister(reg)}
                            >
                              <Edit className="h-3.5 w-3.5" />
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
      </Tabs>

      {/* ── Drawer Event History Dialog ── */}
      <Dialog open={drawerEventsOpen} onOpenChange={setDrawerEventsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Event History — {selectedDrawer?.drawer_name}
            </DialogTitle>
            <DialogDescription>
              {selectedDrawer && (
                <span>
                  Status: {selectedDrawer.status} | Balance: {formatKSh(selectedDrawer.current_balance)} | Variance: {selectedDrawer.last_variance != null ? formatKSh(selectedDrawer.last_variance) : 'N/A'}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          {drawerEvents.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No events recorded for this drawer
            </p>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Performer</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drawerEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {new Date(event.created_at).toLocaleDateString('en-KE', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell>{getEventTypeBadge(event.event_type)}</TableCell>
                      <TableCell>
                        <span className={`font-mono text-sm font-medium ${IN_EVENTS.includes(event.event_type) ? 'text-green-600' : 'text-red-600'}`}>
                          {IN_EVENTS.includes(event.event_type) ? '+' : '-'}{formatKSh(event.amount)}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {event.performer?.full_name || 'System'}
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">
                        {event.reason}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Create Drawer Dialog ── */}
      <Dialog open={showCreateDrawer} onOpenChange={setShowCreateDrawer}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Cash Drawer</DialogTitle>
            <DialogDescription>Add a new cash drawer to this branch</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="drawer-name">Drawer Name *</Label>
              <Input
                id="drawer-name"
                placeholder="e.g. Main Drawer, Register 1 Drawer"
                value={drawerName}
                onChange={(e) => setDrawerName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="drawer-register">Register (optional)</Label>
              <Select value={drawerRegisterId} onValueChange={setDrawerRegisterId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a register" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {registers.map((reg) => (
                    <SelectItem key={reg.id} value={reg.id}>
                      {reg.register_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDrawer(false)}>
              Cancel
            </Button>
            <Button
              disabled={!drawerName.trim() || creatingDrawer}
              onClick={handleCreateDrawer}
              className="gap-1.5"
            >
              {creatingDrawer ? 'Creating...' : 'Create Drawer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create Register Dialog ── */}
      <Dialog open={showCreateRegister} onOpenChange={setShowCreateRegister}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Register</DialogTitle>
            <DialogDescription>Add a new POS register</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="register-name">Register Name *</Label>
              <Input
                id="register-name"
                placeholder="e.g. Register 1, Front Counter"
                value={registerName}
                onChange={(e) => setRegisterName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-serial">Serial Number</Label>
              <Input
                id="register-serial"
                placeholder="Optional serial number"
                value={registerSerial}
                onChange={(e) => setRegisterSerial(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-type">Register Type</Label>
              <Select value={registerType} onValueChange={setRegisterType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="main">Main</SelectItem>
                  <SelectItem value="mobile">Mobile</SelectItem>
                  <SelectItem value="backup">Backup</SelectItem>
                  <SelectItem value="kiosk">Kiosk</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateRegister(false)}>
              Cancel
            </Button>
            <Button
              disabled={!registerName.trim() || creatingRegister}
              onClick={handleCreateRegister}
              className="gap-1.5"
            >
              {creatingRegister ? 'Creating...' : 'Create Register'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Record Event Dialog ── */}
      <Dialog open={showRecordEvent} onOpenChange={setShowRecordEvent}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Cash Event</DialogTitle>
            <DialogDescription>Log a cash in, out, or adjustment event</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="event-type">Event Type *</Label>
              <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select event type" />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-drawer">Drawer (optional)</Label>
              <Select value={eventDrawerId} onValueChange={setEventDrawerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a drawer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {drawers.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.drawer_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-amount">Amount (KSh) *</Label>
              <Input
                id="event-amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={eventAmount}
                onChange={(e) => setEventAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-reason">Reason *</Label>
              <Input
                id="event-reason"
                placeholder="e.g. Daily safe drop, customer refund..."
                value={eventReason}
                onChange={(e) => setEventReason(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-notes">Notes</Label>
              <Textarea
                id="event-notes"
                placeholder="Additional notes (optional)"
                value={eventNotes}
                onChange={(e) => setEventNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRecordEvent(false)}>
              Cancel
            </Button>
            <Button
              disabled={!eventType || !eventAmount || !eventReason.trim() || recordingEvent}
              onClick={handleRecordEvent}
              className="gap-1.5"
            >
              {recordingEvent ? (
                'Recording...'
              ) : (
                <>
                  <Receipt className="h-4 w-4" />
                  Record Event
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Register Dialog ── */}
      <Dialog open={showEditRegister} onOpenChange={setShowEditRegister}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Register — {editingRegister?.register_name}</DialogTitle>
            <DialogDescription>Update register status and hardware status</DialogDescription>
          </DialogHeader>
          {editingRegister && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Health Score (0-100)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={editHealthScore}
                    onChange={(e) => setEditHealthScore(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Battery Level (0-100)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={editBatteryLevel}
                    onChange={(e) => setEditBatteryLevel(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Printer</Label>
                  <Select value={editPrinterStatus} onValueChange={setEditPrinterStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="offline">Offline</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Scanner</Label>
                  <Select value={editScannerStatus} onValueChange={setEditScannerStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="offline">Offline</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Network</Label>
                  <Select value={editNetworkStatus} onValueChange={setEditNetworkStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="offline">Offline</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditRegister(false)}>
              Cancel
            </Button>
            <Button
              disabled={savingEdit}
              onClick={handleSaveEditRegister}
              className="gap-1.5"
            >
              {savingEdit ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
