'use client'

import { startTransition, useEffect, useCallback, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
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
import {
  FileText,
  Search,
  RefreshCw,
  AlertTriangle,
  Info,
  AlertCircle,
  Skull,
  Clock,
  Users,
  ShieldAlert,
} from 'lucide-react'
import { getAuditLog, getAuditStats, type AuditEntry } from '@/lib/modules/enterprise'
import { formatDistanceToNow } from 'date-fns'

const SEVERITY_CONFIG: Record<string, { icon: typeof Info; color: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  info: { icon: Info, color: 'text-blue-500', variant: 'secondary' },
  warning: { icon: AlertTriangle, color: 'text-warning', variant: 'secondary' },
  error: { icon: AlertCircle, color: 'text-destructive', variant: 'destructive' },
  critical: { icon: Skull, color: 'text-destructive', variant: 'destructive' },
}

const ENTITY_TYPES = ['all', 'sale', 'user', 'product', 'inventory', 'payment', 'shift', 'branch', 'feature_flag', 'deployment']

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [stats, setStats] = useState<{
    totalEntries: number
    last24h: number
    criticalCount: number
    warningCount: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [entityFilter, setEntityFilter] = useState('all')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const PAGE_SIZE = 50

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [result, statsResult] = await Promise.all([
        getAuditLog({
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
          severity: severityFilter !== 'all' ? severityFilter : undefined,
          entity_type: entityFilter !== 'all' ? entityFilter : undefined,
          search: searchQuery || undefined,
        }),
        getAuditStats(),
      ])
      setEntries(result.data)
      setTotal(result.total)
      if (statsResult) setStats(statsResult)
    } finally {
      setLoading(false)
    }
  }, [page, severityFilter, entityFilter, searchQuery])

  useEffect(() => { startTransition(() => { loadData() }) }, [loadData])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-7 w-7" />
            Audit Log
          </h1>
          <p className="text-muted-foreground mt-1">System-wide audit trail of all changes and actions</p>
        </div>
        <Button variant="outline" onClick={loadData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      {stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalEntries.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Entries</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                <Clock className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.last24h}</p>
                <p className="text-xs text-muted-foreground">Last 24 Hours</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <ShieldAlert className="h-4 w-4 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold text-destructive">{stats.criticalCount}</p>
                <p className="text-xs text-muted-foreground">Errors / Critical</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-warning/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-4 w-4 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-warning">{stats.warningCount}</p>
                <p className="text-xs text-muted-foreground">Warnings</p>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-4 pb-3"><Skeleton className="h-10 w-full" /></CardContent></Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search actions or entity types..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(0) }}
            className="pl-10"
          />
        </div>
        <Select value={severityFilter} onValueChange={(v) => { setSeverityFilter(v); setPage(0) }}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Severity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
        <Select value={entityFilter} onValueChange={(v) => { setEntityFilter(v); setPage(0) }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Entity Type" /></SelectTrigger>
          <SelectContent>
            {ENTITY_TYPES.map(t => (
              <SelectItem key={t} value={t}>{t === 'all' ? 'All Entities' : t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead className="w-[100px]">Severity</TableHead>
                <TableHead className="w-[120px]">Branch</TableHead>
                <TableHead className="w-[140px]">IP Address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                  ))}
                </TableRow>
              )) : entries.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12"><EmptyState title="No audit entries found" compact /></TableCell></TableRow>
              ) : (entries.map((entry) => {
                const SevIcon = SEVERITY_CONFIG[entry.severity]?.icon || Info
                return (
                  <TableRow key={entry.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3 shrink-0" />
                        {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {entry.user?.full_name || <span className="text-muted-foreground italic">System</span>}
                      {entry.user?.role && (
                        <span className="text-xs text-muted-foreground ml-1">({entry.user.role})</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm max-w-[200px] truncate" title={entry.action}>
                      {entry.action}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {entry.entity_type ? (
                        <div className="flex items-center gap-1">
                          <span>{entry.entity_type}</span>
                          {entry.entity_id && (
                            <span className="text-xs font-mono truncate max-w-[80px]" title={entry.entity_id}>
                              #{entry.entity_id.slice(0, 8)}
                            </span>
                          )}
                        </div>
                      ) : <span className="text-muted-foreground italic">—</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={SEVERITY_CONFIG[entry.severity]?.variant || 'outline'} className="gap-1">
                        <SevIcon className="h-3 w-3" />
                        {entry.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {entry.branch?.name || <span className="text-muted-foreground italic">—</span>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {entry.ip_address || <span className="text-muted-foreground italic">—</span>}
                    </TableCell>
                  </TableRow>
                )
              }))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
