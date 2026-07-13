'use client'

import { startTransition, useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertTriangle,
  RefreshCw,
  Skull,
  AlertCircle,
  Clock,
  User,
  ShieldAlert,
  Activity,
} from 'lucide-react'
import { getIncidents, type Incident } from '@/lib/modules/enterprise'
import { formatDistanceToNow } from 'date-fns'
import { EmptyState } from '@/components/ui/empty-state'

const PERIOD_OPTIONS = [
  { label: '7 days', value: 7 },
  { label: '14 days', value: 14 },
  { label: '30 days', value: 30 },
]

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [stats, setStats] = useState<{
    totalErrors: number
    criticalCount: number
    errorCount: number
    periodDays: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState(7)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getIncidents(period)
      setIncidents(result.incidents)
      setStats(result.stats)
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => { startTransition(() => { load() }) }, [load])

  const resolved = stats ? stats.totalErrors - stats.criticalCount - stats.errorCount : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <AlertTriangle className="h-7 w-7" />
            Incidents
          </h1>
          <p className="text-muted-foreground mt-1">System errors, warnings, and critical events</p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      {loading && !stats ? (
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-4 pb-3"><Skeleton className="h-10 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <ShieldAlert className="h-4 w-4 text-destructive shrink-0" />
              <div>
                <p className="text-2xl font-bold text-destructive">{stats.criticalCount}</p>
                <p className="text-xs text-muted-foreground">Critical</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <AlertCircle className="h-4 w-4 text-destructive/80 shrink-0" />
              <div>
                <p className="text-2xl font-bold">{stats.errorCount}</p>
                <p className="text-xs text-muted-foreground">Errors</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <Activity className="h-4 w-4 text-success shrink-0" />
              <div>
                <p className="text-2xl font-bold">{stats.totalErrors}</p>
                <p className="text-xs text-muted-foreground">Total (all time)</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-2xl font-bold">{stats.periodDays}d</p>
                <p className="text-xs text-muted-foreground">Reporting Period</p>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Period selector */}
      <div className="flex gap-2">
        {PERIOD_OPTIONS.map(opt => (
          <Button
            key={opt.value}
            variant={period === opt.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriod(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {/* Incidents Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Incidents</CardTitle>
          <CardDescription>Errors and critical events from the last {period} days</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Severity</TableHead>
                <TableHead className="w-[160px]">Timestamp</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>User</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                  ))}
                </TableRow>
              )) : incidents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <EmptyState title="No incidents in the selected period" compact />
                  </TableCell>
                </TableRow>
              ) : (
                incidents.map((inc) => (
                  <TableRow key={inc.id}>
                    <TableCell>
                      <Badge variant={inc.severity === 'critical' ? 'destructive' : 'default'} className="gap-1">
                        {inc.severity === 'critical' ? <Skull className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                        {inc.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(inc.created_at), { addSuffix: true })}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm max-w-[250px] truncate" title={inc.action}>
                      {inc.action}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {inc.entity_type || <span className="italic">—</span>}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3 w-3 text-muted-foreground" />
                        {inc.user?.full_name || <span className="text-muted-foreground italic">System</span>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

import { CheckCircle } from 'lucide-react'
