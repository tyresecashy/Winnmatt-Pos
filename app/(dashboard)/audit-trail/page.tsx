'use client'
import { logger } from '@/lib/logger'

import { useState, useMemo, useEffect, useCallback, startTransition } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { getSystemAuditLog } from '@/lib/modules/system'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Activity,
  Search,
  Filter,
  Clock,
  User,
  Shield,
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle,
  Download,
  RefreshCw,
  Loader2,
  Calendar,
  Eye,
  FileText,
  Settings,
  ShoppingCart,
  DollarSign,
  Package,
  LogOut,
  LogIn,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

type Severity = 'info' | 'warning' | 'error' | 'critical'
type EventType =
  | 'All'
  | 'Sales'
  | 'Inventory'
  | 'Employees'
  | 'Purchases'
  | 'Customers'
  | 'Promotions'
  | 'Admin'
  | 'Cash'
  | 'Notifications'
  | 'Hardware'
  | 'Launch'
  | 'Authentication'

interface AuditEntry {
  id: string
  timestamp: Date
  user: string
  action: string
  entityType: string
  entityBadge: EventType
  severity: Severity
  ipAddress: string
  details: Record<string, unknown> | null
}

type AuditLogDbRow = Awaited<ReturnType<typeof getSystemAuditLog>>[number]

/** Map a system_audit_log row to the client-side AuditEntry shape. */
function mapAuditRow(row: AuditLogDbRow): AuditEntry {
  return {
    id: row.id,
    timestamp: new Date(row.created_at ?? ''),
    user: (row.user?.full_name) || 'System',
    action: row.action,
    entityType: (row.entity_type) || '',
    entityBadge: badgeFromEntityType((row.entity_type) || ''),
    severity: (row.severity as Severity) || 'info',
    ipAddress: (row.ip_address) || '',
    details: (row.details as Record<string, unknown>) || null,
  }
}

function badgeFromEntityType(entityType: string): EventType {
  const map: Record<string, EventType> = {
    sale: 'Sales',
    product: 'Inventory',
    inventory: 'Inventory',
    employee_profile: 'Employees',
    purchase_order: 'Purchases',
    customer: 'Customers',
    promotion: 'Promotions',
    user: 'Admin',
    system: 'Admin',
    report: 'Admin',
    cash_management: 'Cash',
    cash: 'Cash',
    notification: 'Notifications',
    hardware: 'Hardware',
    launch: 'Launch',
    authentication: 'Authentication',
    auth: 'Authentication',
    tax: 'Admin',
    payroll: 'Admin',
    refund: 'Sales',
    stock_alert: 'Inventory',
  }
  return map[entityType.toLowerCase()] || 'Admin'
}

const SEVERITY_STYLES: Record<Severity, string> = {
  info: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400',
  warning:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400',
  error: 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400',
  critical:
    'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-400',
}

const SEVERITY_ICONS: Record<Severity, React.ElementType> = {
  info: Info,
  warning: AlertTriangle,
  error: XCircle,
  critical: Shield,
}

const ENTITY_BADGE_STYLES: Record<string, string> = {
  Sales: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  Inventory: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-400',
  Employees: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400',
  Purchases: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400',
  Customers: 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-400',
  Promotions: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400',
  Admin: 'bg-slate-100 text-slate-700 dark:bg-slate-950 dark:text-slate-400',
  Cash: 'bg-lime-100 text-lime-700 dark:bg-lime-950 dark:text-lime-400',
  Notifications: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400',
  Hardware: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-950 dark:text-neutral-400',
  Launch: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400',
  Authentication: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-400',
}

const EVENT_TYPES: EventType[] = [
  'All',
  'Sales',
  'Inventory',
  'Employees',
  'Purchases',
  'Customers',
  'Promotions',
  'Admin',
  'Cash',
  'Notifications',
  'Hardware',
  'Launch',
  'Authentication',
]

const SEVERITIES: { label: string; value: Severity | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Info', value: 'info' },
  { label: 'Warning', value: 'warning' },
  { label: 'Error', value: 'error' },
  { label: 'Critical', value: 'critical' },
]

const PAGE_SIZE = 20

function formatTimestamp(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function getUserInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function getEntityIcon(type: EventType): React.ElementType {
  const icons: Record<string, React.ElementType> = {
    Sales: ShoppingCart,
    Inventory: Package,
    Employees: User,
    Purchases: FileText,
    Customers: User,
    Promotions: DollarSign,
    Admin: Settings,
    Cash: DollarSign,
    Notifications: Activity,
    Hardware: Settings,
    Launch: Clock,
    Authentication: LogIn,
  }
  return icons[type] || Activity
}

function SkeletonRow() {
  return (
    <TableRow>
      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
      <TableCell><div className="flex items-center gap-2"><Skeleton className="h-7 w-7 rounded-full" /><Skeleton className="h-4 w-24" /></div></TableCell>
      <TableCell><Skeleton className="h-4 w-52" /></TableCell>
      <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
      <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
      <TableCell><Skeleton className="h-4 w-28 font-mono" /></TableCell>
      <TableCell><Skeleton className="h-4 w-8" /></TableCell>
    </TableRow>
  )
}

function DetailsDialog({
  entry,
  open,
  onOpenChange,
}: {
  entry: AuditEntry | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (!entry) return null
  const SeverityIcon = SEVERITY_ICONS[entry.severity]
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SeverityIcon className="h-5 w-5" />
            {entry.action}
          </DialogTitle>
          <DialogDescription>
            Event details for {entry.id} — {formatTimestamp(entry.timestamp)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">User:</span>
              <p className="font-medium">{entry.user}</p>
            </div>
            <div>
              <span className="text-muted-foreground">IP Address:</span>
              <p className="font-mono text-xs">{entry.ipAddress}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Entity:</span>
              <p className="font-medium">{entry.entityType}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Severity:</span>
              <Badge className={SEVERITY_STYLES[entry.severity]}>
                {entry.severity.charAt(0).toUpperCase() + entry.severity.slice(1)}
              </Badge>
            </div>
            <div>
              <span className="text-muted-foreground">Event ID:</span>
              <p className="font-mono text-xs">{entry.id}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Timestamp:</span>
              <p className="font-medium">{formatTimestamp(entry.timestamp)}</p>
            </div>
          </div>
          {entry.details && (
            <div>
              <span className="text-sm text-muted-foreground">Payload:</span>
              <ScrollArea className="mt-1 max-h-64">
                <pre className="rounded-md bg-muted p-4 text-xs font-mono whitespace-pre-wrap break-all">
                  {JSON.stringify(entry.details, null, 2)}
                </pre>
              </ScrollArea>
            </div>
          )}
          {!entry.details && (
            <p className="text-sm text-muted-foreground italic">No additional details available for this event.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function AuditTrailPage() {
  const { profile } = useAuth()

  const [searchQuery, setSearchQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all')
  const [eventTypeFilter, setEventTypeFilter] = useState<EventType>('All')
  const [userFilter, setUserFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [isError, setIsError] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)

  // Real audit data from DB
  const [allEntries, setAllEntries] = useState<AuditEntry[]>([])

  const loadAuditLog = useCallback(async () => {
    setIsLoading(true)
    setIsError(false)
    try {
      const rows = await getSystemAuditLog(200)
      setAllEntries((rows || []).map(mapAuditRow))
    } catch {
      setIsError(true)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    startTransition(() => { loadAuditLog() })
  }, [loadAuditLog])

  const entries = allEntries
  const uniqueUsers = useMemo(() => Array.from(new Set(entries.map(e => e.user))), [entries])

  const filteredEntries = useMemo(() => {
    let result = [...entries]

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (e) =>
          e.action.toLowerCase().includes(q) ||
          e.user.toLowerCase().includes(q) ||
          e.entityType.toLowerCase().includes(q) ||
          e.ipAddress.includes(q) ||
          (e.details && JSON.stringify(e.details).toLowerCase().includes(q)),
      )
    }

    if (dateFrom) {
      const from = new Date(dateFrom)
      result = result.filter((e) => e.timestamp >= from)
    }

    if (dateTo) {
      const to = new Date(dateTo)
      to.setHours(23, 59, 59, 999)
      result = result.filter((e) => e.timestamp <= to)
    }

    if (severityFilter !== 'all') {
      result = result.filter((e) => e.severity === severityFilter)
    }

    if (eventTypeFilter !== 'All') {
      result = result.filter((e) => e.entityBadge === eventTypeFilter)
    }

    if (userFilter !== 'all') {
      result = result.filter((e) => e.user === userFilter)
    }

    result.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

    return result
  }, [entries, searchQuery, dateFrom, dateTo, severityFilter, eventTypeFilter, userFilter])

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE))
  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredEntries.slice(start, start + PAGE_SIZE)
  }, [filteredEntries, currentPage])

  const stats = useMemo(() => {
    const total = entries.length
    const now = new Date()
    const today = entries.filter((e) => e.timestamp.toDateString() === now.toDateString()).length
    const errors = entries.filter((e) => e.severity === 'error' || e.severity === 'critical').length
    const warnings = entries.filter((e) => e.severity === 'warning').length
    return { total, today, errors, warnings }
  }, [entries])

  const handleClearFilters = () => {
    setSearchQuery('')
    setDateFrom('')
    setDateTo('')
    setSeverityFilter('all')
    setEventTypeFilter('All')
    setUserFilter('all')
    setCurrentPage(1)
  }

  const handleRefresh = () => {
    loadAuditLog()
  }

  const handleExport = () => {
    logger.info('Audit log export triggered', { count: filteredEntries.length })
  }

  const handleRowClick = (entry: AuditEntry) => {
    setSelectedEntry(entry)
    setDetailsOpen(true)
  }

  const isFiltered =
    searchQuery || dateFrom || dateTo || severityFilter !== 'all' || eventTypeFilter !== 'All' || userFilter !== 'all'

  const pageNumbers = useMemo(() => {
    const pages: (number | 'ellipsis')[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (currentPage > 3) pages.push('ellipsis')
      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)
      for (let i = start; i <= end; i++) pages.push(i)
      if (currentPage < totalPages - 2) pages.push('ellipsis')
      pages.push(totalPages)
    }
    return pages
  }, [totalPages, currentPage])

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">System Audit Trail</h1>
          <p className="text-sm text-muted-foreground">Complete record of all system activities and events</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleRefresh} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-600" />
              <span className="text-2xl font-bold">{stats.total.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-emerald-600" />
              <span className="text-2xl font-bold">{stats.today}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              <span className="text-2xl font-bold text-red-600">{stats.errors}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Warnings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span className="text-2xl font-bold text-amber-600">{stats.warnings}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Filters</CardTitle>
            </div>
            {isFiltered && (
              <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                Clear Filters
              </Button>
            )}
          </div>
          <CardDescription>Refine the audit log by search, date range, severity, event type, or user</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by action, user, details..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }}
              />
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                className="w-36"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1) }}
                title="From date"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <Input
                type="date"
                className="w-36"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1) }}
                title="To date"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Severity:</span>
            {SEVERITIES.map((s) => {
              const isActive = severityFilter === s.value
              const Icon = s.value !== 'all' ? SEVERITY_ICONS[s.value as Severity] : null
              return (
                <button
                  key={s.value}
                  onClick={() => { setSeverityFilter(s.value as Severity | 'all'); setCurrentPage(1) }}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    isActive
                      ? s.value === 'all'
                        ? 'bg-primary text-primary-foreground'
                        : SEVERITY_STYLES[s.value as Severity]
                      : 'bg-muted text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {Icon && <Icon className="h-3 w-3" />}
                  {s.label}
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Event Type:</span>
            <Select
              value={eventTypeFilter}
              onValueChange={(v) => { setEventTypeFilter(v as EventType); setCurrentPage(1) }}
            >
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((et) => {
                  const Icon = getEntityIcon(et)
                  return (
                    <SelectItem key={et} value={et} className="text-xs">
                      <span className="flex items-center gap-2">
                        <Icon className="h-3 w-3" />
                        {et}
                      </span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">User:</span>
            <Select
              value={userFilter}
              onValueChange={(v) => { setUserFilter(v); setCurrentPage(1) }}
            >
              <SelectTrigger className="w-44 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {(uniqueUsers.length > 0 ? uniqueUsers : []).map((u) => (
                  <SelectItem key={u} value={u} className="text-xs">
                    <span className="flex items-center gap-2">
                      <User className="h-3 w-3" />
                      {u}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Audit Log</CardTitle>
            <p className="text-sm text-muted-foreground">
              {filteredEntries.length} event{filteredEntries.length !== 1 ? 's' : ''}
              {isFiltered && ' found'}
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isError ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <XCircle className="h-12 w-12 text-red-400 mb-4" />
              <h3 className="text-lg font-semibold">Failed to load audit log</h3>
              <p className="text-sm text-muted-foreground mb-4">An unexpected error occurred while fetching events.</p>
              <Button variant="outline" size="sm" className="gap-2" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            </div>
          ) : isLoading ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 8 }).map((_, i) => (
                  <SkeletonRow key={i} />
                ))}
              </TableBody>
            </Table>
          ) : filteredEntries.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No events found"
              description={isFiltered ? 'No events match the current filter criteria. Try adjusting your filters.' : 'The audit log is empty. Events will appear here as system activity occurs.'}
              actions={isFiltered ? [{ label: 'Clear Filters', onClick: handleClearFilters, variant: 'outline' }] : undefined}
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-44">Timestamp</TableHead>
                    <TableHead className="w-36">User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead className="w-28">Entity Type</TableHead>
                    <TableHead className="w-20">Severity</TableHead>
                    <TableHead className="w-32">IP Address</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedEntries.map((entry) => {
                    const SevIcon = SEVERITY_ICONS[entry.severity]
                    const EntityIcon = getEntityIcon(entry.entityBadge)
                    return (
                      <TableRow
                        key={entry.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleRowClick(entry)}
                      >
                        <TableCell className="text-xs whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3 shrink-0 text-muted-foreground" />
                            {formatTimestamp(entry.timestamp)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                              {getUserInitials(entry.user)}
                            </div>
                            <span className="text-sm truncate max-w-[100px]">{entry.user}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{entry.action}</TableCell>
                        <TableCell>
                          <Badge className={`gap-1 border-0 ${ENTITY_BADGE_STYLES[entry.entityBadge] || 'bg-muted text-muted-foreground'}`}>
                            <EntityIcon className="h-3 w-3" />
                            {entry.entityType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={`gap-1 ${SEVERITY_STYLES[entry.severity]}`}>
                            <SevIcon className="h-3 w-3" />
                            {entry.severity.charAt(0).toUpperCase() + entry.severity.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{entry.ipAddress}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => { e.stopPropagation(); handleRowClick(entry) }}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between border-t px-6 py-3">
                <p className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * PAGE_SIZE + 1}–
                  {Math.min(currentPage * PAGE_SIZE, filteredEntries.length)} of {filteredEntries.length}
                </p>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => { e.preventDefault(); setCurrentPage((p) => Math.max(1, p - 1)) }}
                        className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                      />
                    </PaginationItem>
                    {pageNumbers.map((p, i) =>
                      p === 'ellipsis' ? (
                        <PaginationItem key={`e-${i}`}>
                          <span className="flex size-9 items-center justify-center text-xs text-muted-foreground">...</span>
                        </PaginationItem>
                      ) : (
                        <PaginationItem key={p}>
                          <PaginationLink
                            href="#"
                            isActive={p === currentPage}
                            onClick={(e) => { e.preventDefault(); setCurrentPage(p) }}
                          >
                            {p}
                          </PaginationLink>
                        </PaginationItem>
                      ),
                    )}
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => { e.preventDefault(); setCurrentPage((p) => Math.min(totalPages, p + 1)) }}
                        className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <DetailsDialog entry={selectedEntry} open={detailsOpen} onOpenChange={setDetailsOpen} />
    </div>
  )
}
