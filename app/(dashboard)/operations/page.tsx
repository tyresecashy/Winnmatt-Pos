'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { getSystemHealth, getSystemAuditLog } from '@/lib/system-health-actions'
import { formatKSh } from '@/lib/currency'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { AnimatedCounter } from '@/components/ui/animated-counter'
import {
  Users, Package, ShoppingCart, DollarSign, Monitor, MonitorOff,
  Clock, AlertTriangle, Activity, Database, Server, RefreshCw, FileText,
  Wifi, HardDrive
} from 'lucide-react'

interface SystemHealthData {
  database: { users: number; sales: number; products: number }
  registers: { total: number; online: number; offline: number }
  today: { sales: number; revenue: number }
  errors: { last24h: number; warnings24h: number }
  performance: { avgCheckoutTimeSeconds: number }
  timestamp: string
}

interface AuditEntry {
  id: string
  action: string
  entity_type: string
  entity_id: string
  details: Record<string, unknown>
  severity: string
  created_at: string
  user: { full_name: string; role: string }
  branch: { name: string }
}

interface HealthStatus {
  label: string
  status: 'healthy' | 'degraded' | 'down'
  detail: string
  icon: typeof Activity
}

const severityVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  info: 'secondary',
  warning: 'default',
  error: 'destructive',
  critical: 'destructive',
}

const severityClass: Record<string, string> = {
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-800',
  warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800',
  error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-800',
  critical: 'bg-red-950 text-red-100 dark:bg-red-950 dark:text-red-100 border-red-800',
}

function StatusDot({ status }: { status: HealthStatus['status'] }) {
  const colors: Record<string, string> = {
    healthy: 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]',
    degraded: 'bg-yellow-500 shadow-[0_0_6px_rgba(234,179,8,0.5)]',
    down: 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]',
  }
  return <span className={`inline-block h-3 w-3 rounded-full ${colors[status]} mr-2 shrink-0`} />
}

export default function OperationsPage() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [health, setHealth] = useState<SystemHealthData | null>(null)
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null)

  const fetchData = useCallback(async () => {
    const [healthData, auditData] = await Promise.all([
      getSystemHealth(),
      getSystemAuditLog(50),
    ])
    if (healthData) setHealth(healthData as SystemHealthData)
    setAuditLog(auditData as AuditEntry[])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchData()
    setTimeout(() => setRefreshing(false), 400)
  }, [fetchData])

  const healthIndicators: HealthStatus[] = [
    {
      label: 'Database',
      status: health ? 'healthy' : 'degraded',
      detail: health
        ? `${health.database.users.toLocaleString()} users · ${health.database.products.toLocaleString()} products · ${health.database.sales.toLocaleString()} sales`
        : 'Unable to connect',
      icon: Database,
    },
    {
      label: 'API Status',
      status: health ? 'healthy' : 'down',
      detail: health ? `Responding · ${new Date(health.timestamp).toLocaleTimeString()}` : 'Not responding',
      icon: Server,
    },
    {
      label: 'Sync Queue',
      status: health && health.registers.offline === 0 ? 'healthy' : health && health.registers.offline > 0 ? 'degraded' : 'down',
      detail: health
        ? `${health.registers.online} online · ${health.registers.offline} offline`
        : 'No data',
      icon: Wifi,
    },
    {
      label: 'Storage',
      status: 'healthy',
      detail: health ? `Avg checkout: ${health.performance.avgCheckoutTimeSeconds}s · ${health.errors.last24h} errors` : 'Checking...',
      icon: HardDrive,
    },
  ]

  if (loading) {
    return (
      <div className="p-6 space-y-6 fade-in">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96 mt-2" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
              <CardContent><Skeleton className="h-8 w-32" /></CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  const statCards = [
    { title: 'Total Users', value: health?.database.users ?? 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950', format: 'number' as const },
    { title: 'Total Products', value: health?.database.products ?? 0, icon: Package, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950', format: 'number' as const },
    { title: "Today's Sales", value: health?.today.sales ?? 0, icon: ShoppingCart, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950', format: 'number' as const },
    { title: "Today's Revenue", value: health?.today.revenue ?? 0, icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950', format: 'currency' as const },
    { title: 'Registers Online', value: health?.registers.online ?? 0, icon: Monitor, color: 'text-cyan-600', bg: 'bg-cyan-50 dark:bg-cyan-950', format: 'number' as const },
    { title: 'Registers Offline', value: health?.registers.offline ?? 0, icon: MonitorOff, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950', format: 'number' as const },
    { title: 'Avg Checkout', value: health?.performance.avgCheckoutTimeSeconds ?? 0, icon: Clock, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-950', format: 'number' as const, suffix: 's' },
    { title: 'Errors (24h)', value: health?.errors.last24h ?? 0, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950', format: 'number' as const },
    { title: 'Warnings (24h)', value: health?.errors.warnings24h ?? 0, icon: FileText, color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-950', format: 'number' as const },
  ]

  return (
    <div className="p-6 space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Operations Center</h1>
          <p className="text-muted-foreground">
            System health, performance metrics, and audit trail overview.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                <div className={`rounded-lg p-2 ${stat.bg}`}>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                {stat.format === 'currency' ? (
                  <p className="text-2xl font-bold">{formatKSh(stat.value as number)}</p>
                ) : (
                  <p className="text-2xl font-bold">
                    <AnimatedCounter value={stat.value as number} />
                    {(stat as any).suffix ? <span className="text-muted-foreground text-lg ml-1">{(stat as any).suffix}</span> : null}
                  </p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-muted-foreground" />
            System Health
          </CardTitle>
          <CardDescription>Real-time status of core system components.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {healthIndicators.map((indicator) => {
              const Icon = indicator.icon
              return (
                <div
                  key={indicator.label}
                  className="flex items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50"
                >
                  <div className={`rounded-lg p-2 ${
                    indicator.status === 'healthy' ? 'bg-green-50 dark:bg-green-950' :
                    indicator.status === 'degraded' ? 'bg-yellow-50 dark:bg-yellow-950' :
                    'bg-red-50 dark:bg-red-950'
                  }`}>
                    <Icon className={`h-5 w-5 ${
                      indicator.status === 'healthy' ? 'text-green-600' :
                      indicator.status === 'degraded' ? 'text-yellow-600' :
                      'text-red-600'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <StatusDot status={indicator.status} />
                      <span className="font-semibold text-sm">{indicator.label}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground truncate">{indicator.detail}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            Recent Audit Log
          </CardTitle>
          <CardDescription>Latest system audit log entries across all branches.</CardDescription>
        </CardHeader>
        <CardContent>
          {auditLog.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No audit log entries found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead className="max-w-md">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLog.map((entry) => (
                  <TableRow
                    key={entry.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedEntry(entry)}
                  >
                    <TableCell className="text-xs font-mono">
                      {new Date(entry.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="font-medium">{entry.user?.full_name || 'System'}</span>
                      <span className="text-muted-foreground ml-1 text-xs">({entry.user?.role || 'N/A'})</span>
                    </TableCell>
                    <TableCell>
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{entry.action}</code>
                    </TableCell>
                    <TableCell className="text-sm capitalize">{entry.entity_type?.replace(/_/g, ' ')}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-xs font-semibold ${severityClass[entry.severity] || severityClass.info}`}
                      >
                        {entry.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <p className="text-sm truncate text-muted-foreground">
                        {entry.details ? JSON.stringify(entry.details).slice(0, 80) : '-'}
                      </p>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedEntry} onOpenChange={(open) => { if (!open) setSelectedEntry(null) }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Audit Log Details</DialogTitle>
            <DialogDescription>
              {selectedEntry?.action} on {selectedEntry?.entity_type?.replace(/_/g, ' ')}
              {selectedEntry?.branch?.name ? ` · Branch: ${selectedEntry.branch.name}` : ''}
            </DialogDescription>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-muted-foreground">Timestamp</span>
                  <p>{new Date(selectedEntry.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">User</span>
                  <p>{selectedEntry.user?.full_name || 'System'} ({selectedEntry.user?.role || 'N/A'})</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Action</span>
                  <p><code className="rounded bg-muted px-1.5 py-0.5 text-xs">{selectedEntry.action}</code></p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Entity Type</span>
                  <p className="capitalize">{selectedEntry.entity_type?.replace(/_/g, ' ')}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Entity ID</span>
                  <p className="font-mono text-xs">{selectedEntry.entity_id || '-'}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Severity</span>
                  <Badge
                    variant="outline"
                    className={`mt-1 text-xs font-semibold ${severityClass[selectedEntry.severity] || severityClass.info}`}
                  >
                    {selectedEntry.severity}
                  </Badge>
                </div>
              </div>
              <div>
                <span className="font-medium text-muted-foreground text-sm">Details</span>
                <pre className="mt-1 rounded-lg bg-muted p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words max-h-64">
                  {JSON.stringify(selectedEntry.details, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
