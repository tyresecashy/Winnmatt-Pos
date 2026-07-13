'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  FileText,
  AlertTriangle,
  AlertCircle,
  Skull,
  Users,
  ShieldAlert,
  Server,
  CheckCircle2,
  Activity,
  Clock,
  ArrowRight,
  Bug,
  FlaskConical,
  GitBranch,
} from 'lucide-react'
import {
  getAuditStats,
  getIncidents,
  getDeployments,
  getSecurityOverview,
  getTestingStatus,
  getSystemInfo,
  getAuditLog,
  type AuditEntry,
  type Incident,
} from '@/lib/modules/enterprise'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { EmptyState } from '@/components/ui/empty-state'

// ─── Types ──────────────────────────────────────────────────────────────────

interface AuditStats {
  totalEntries: number
  last24h: number
  criticalCount: number
  warningCount: number
}

interface SystemInfo {
  userCount: number
  branchCount: number
  nodeEnv: string
  nextPublicAppUrl: string
  lastAuditLog: string | null
  version: string
}

interface SecurityData {
  users: unknown[]
  stats: { total: number; active: number; superAdmins: number; admins: number; staff: number }
  severityCounts: { critical: number; high: number }
}

interface TestingData {
  suites: unknown[]
  summary: { total: number; passed: number; failed: number; passRate: number }
}

// ─── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  color,
  href,
}: {
  title: string
  value: string | number
  sub?: string
  icon: React.ElementType
  color: string
  href: string
}) {
  return (
    <Link href={href}>
      <Card className="cursor-pointer transition-colors hover:bg-accent/50">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Icon className={`h-4 w-4 ${color}`} />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{value}</div>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </CardContent>
      </Card>
    </Link>
  )
}

// ─── Severity Badge ─────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: string }) {
  const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    info: { label: 'Info', variant: 'secondary' },
    warning: { label: 'Warning', variant: 'secondary' },
    error: { label: 'Error', variant: 'destructive' },
    critical: { label: 'Critical', variant: 'destructive' },
  }
  const c = config[severity] || { label: severity, variant: 'outline' as const }
  return <Badge variant={c.variant}>{c.label}</Badge>
}

// ─── Status Dot ─────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: 'ok' | 'warning' | 'critical' }) {
  const colors = { ok: 'bg-green-500', warning: 'bg-yellow-500', critical: 'bg-red-500' }
  return <span className={`inline-block h-2 w-2 rounded-full ${colors[status]} mr-2`} />
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function EnterpriseOverviewPage() {
  const [loading, setLoading] = useState(true)
  const [auditStats, setAuditStats] = useState<AuditStats | null>(null)
  const [incidents, setIncidents] = useState<{ incidents: Incident[]; stats: unknown } | null>(null)
  const [deployments, setDeployments] = useState<{ deployments: unknown[]; currentVersion: string } | null>(null)
  const [security, setSecurity] = useState<SecurityData | null>(null)
  const [testing, setTesting] = useState<TestingData | null>(null)
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)
  const [recentAudit, setRecentAudit] = useState<AuditEntry[]>([])

  useEffect(() => {
    async function load() {
      try {
        const [as, inc, dep, sec, test, info, audit] = await Promise.all([
          getAuditStats(),
          getIncidents(7),
          getDeployments(),
          getSecurityOverview(),
          getTestingStatus(),
          getSystemInfo(),
          getAuditLog({ limit: 10 }),
        ])
        setAuditStats(as)
        setIncidents(inc)
        setDeployments(dep as { deployments: unknown[]; currentVersion: string })
        setSecurity(sec as SecurityData | null)
        setTesting(test as TestingData)
        setSystemInfo(info as SystemInfo | null)
        setRecentAudit(audit.data || [])
      } catch {
        // Individual load failures are tolerable
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  const passRate = testing?.summary.passRate ?? 0
  const systemStatus: 'ok' | 'warning' | 'critical' =
    (auditStats?.criticalCount ?? 0) > 0 || (incidents?.incidents.length ?? 0) > 0
      ? 'critical'
      : (auditStats?.warningCount ?? 0) > 5
        ? 'warning'
        : 'ok'

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Enterprise Operations</h1>
          <p className="text-muted-foreground mt-1">
            System-wide health, security, and deployment overview
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusDot status={systemStatus} />
          <span className="text-sm font-medium">
            {systemStatus === 'ok'
              ? 'All Systems Operational'
              : systemStatus === 'warning'
                ? 'Attention Required'
                : 'Critical Issues Detected'}
          </span>
        </div>
      </div>

      {/* Row 1: Health Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          title="Audit Log"
          value={auditStats?.last24h ?? 0}
          sub={`${auditStats?.totalEntries ?? 0} total · ${auditStats?.criticalCount ?? 0} critical`}
          icon={FileText}
          color="text-blue-500"
          href="/enterprise/audit"
        />
        <StatCard
          title="Incidents"
          value={incidents?.incidents.length ?? 0}
          sub={`Last 7d · ${(incidents as { stats: { criticalCount: number } } | null)?.stats?.criticalCount ?? 0} critical`}
          icon={AlertCircle}
          color="text-red-500"
          href="/enterprise/incidents"
        />
        <StatCard
          title="Deployments"
          value={deployments?.currentVersion ?? '—'}
          sub={`${deployments?.deployments.length ?? 0} total`}
          icon={GitBranch}
          color="text-green-500"
          href="/enterprise/deployments"
        />
        <StatCard
          title="Security"
          value={`${security?.stats.active ?? 0}/${security?.stats.total ?? 0}`}
          sub={`${security?.stats.superAdmins ?? 0} super_admins`}
          icon={ShieldAlert}
          color="text-purple-500"
          href="/enterprise/security"
        />
        <StatCard
          title="Tests"
          value={`${passRate}%`}
          sub={`${testing?.summary.failed ?? 0} failed · ${testing?.summary.passed ?? 0} passed`}
          icon={FlaskConical}
          color="text-cyan-500"
          href="/enterprise/testing"
        />
        <StatCard
          title="Config"
          value={systemInfo?.branchCount ?? 0}
          sub={`${systemInfo?.userCount ?? 0} users · v${systemInfo?.version ?? '—'}`}
          icon={Server}
          color="text-orange-500"
          href="/enterprise/config"
        />
      </div>

      {/* Row 2: Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Latest Audit Entries */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Latest Audit Entries</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/enterprise/audit">
                View All <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentAudit.length === 0 ? (
              <EmptyState title="No audit entries found" compact />
            ) : (
              <div className="space-y-3">
                {recentAudit.slice(0, 8).map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <SeverityBadge severity={entry.severity} />
                      <span className="truncate">{entry.action}</span>
                    </div>
                    <span className="text-muted-foreground shrink-0 ml-2">
                      {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Latest Incidents */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Latest Incidents (7d)</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/enterprise/incidents">
                View All <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {!incidents || incidents.incidents.length === 0 ? (
              <EmptyState title="No incidents in the last 7 days" compact />
            ) : (
              <div className="space-y-3">
                {incidents.incidents.slice(0, 5).map((inc) => (
                  <div key={inc.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <SeverityBadge severity={inc.severity} />
                      <span className="truncate">{inc.action}</span>
                    </div>
                    <span className="text-muted-foreground shrink-0 ml-2">
                      {formatDistanceToNow(new Date(inc.created_at), { addSuffix: true })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Quick Actions / Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Security Snapshot */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-purple-500" />
              Security Snapshot
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Active Users</span>
              <span className="font-medium">{security?.stats.active ?? 0}/{security?.stats.total ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Super Admins</span>
              <span className="font-medium">{security?.stats.superAdmins ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Admins</span>
              <span className="font-medium">{security?.stats.admins ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Branches</span>
              <span className="font-medium">{systemInfo?.branchCount ?? 0}</span>
            </div>
            <Button variant="outline" size="sm" className="w-full mt-2" asChild>
              <Link href="/enterprise/security">
                <Users className="mr-1 h-3 w-3" /> Manage Users
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Latest Release */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-green-500" />
              Latest Release
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant="outline">v{deployments?.currentVersion ?? '—'}</Badge>
              <span className="text-muted-foreground">Current build</span>
            </div>
            <p className="text-muted-foreground mt-2">
              Environment: <span className="font-medium text-foreground">{systemInfo?.nodeEnv ?? '—'}</span>
            </p>
            <Button variant="outline" size="sm" className="w-full mt-2" asChild>
              <Link href="/enterprise/releases">
                <Clock className="mr-1 h-3 w-3" /> View Release History
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Feature Flag Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-4 w-4 text-orange-500" />
              Feature Flags
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Node Environment</span>
              <span className="font-medium">{systemInfo?.nodeEnv ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">App URL</span>
              <span className="font-medium truncate max-w-[180px]">{systemInfo?.nextPublicAppUrl ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Audit</span>
              <span className="font-medium">
                {systemInfo?.lastAuditLog
                  ? formatDistanceToNow(new Date(systemInfo.lastAuditLog), { addSuffix: true })
                  : '—'}
              </span>
            </div>
            <Button variant="outline" size="sm" className="w-full mt-2" asChild>
              <Link href="/enterprise/config">
                <Server className="mr-1 h-3 w-3" /> Manage Configuration
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
