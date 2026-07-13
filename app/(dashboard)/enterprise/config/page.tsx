'use client'

import { startTransition, useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Settings,
  RefreshCw,
  Server,
  Globe,
  Users,
  Building2,
  Package,
  Flag,
} from 'lucide-react'
import {
  getFeatureFlags,
  toggleFeatureFlag,
  getSystemInfo,
} from '@/lib/modules/enterprise'
import type { FeatureFlag } from '@/lib/feature-flags'

export default function ConfigPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [systemInfo, setSystemInfo] = useState<{
    userCount: number
    branchCount: number
    nodeEnv: string
    nextPublicAppUrl: string
    lastAuditLog: string | null
    version: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [f, s] = await Promise.all([getFeatureFlags(), getSystemInfo()])
      setFlags(f || [])
      if (s) setSystemInfo(s)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { startTransition(() => { load() }) }, [load])

  async function handleToggle(id: string) {
    setTogglingId(id)
    await toggleFeatureFlag(id)
    await load()
    setTogglingId(null)
  }

  const enabledCount = flags.filter(f => f.enabled).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Settings className="h-7 w-7" />
            Configuration
          </h1>
          <p className="text-muted-foreground mt-1">Enterprise system configuration and feature flags</p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* System Info */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {loading && !systemInfo ? Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}><CardContent className="pt-4 pb-3"><Skeleton className="h-10 w-full" /></CardContent></Card>
        )) : systemInfo ? (
          <>
            <Card>
              <CardContent className="pt-4 pb-3 flex items-center gap-3">
                <Server className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-lg font-bold capitalize">{systemInfo.nodeEnv}</p>
                  <p className="text-xs text-muted-foreground">Environment</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 flex items-center gap-3">
                <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-lg font-bold">v{systemInfo.version}</p>
                  <p className="text-xs text-muted-foreground">App Version</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 flex items-center gap-3">
                <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-lg font-bold">{systemInfo.userCount}</p>
                  <p className="text-xs text-muted-foreground">Users</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 flex items-center gap-3">
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-lg font-bold">{systemInfo.branchCount}</p>
                  <p className="text-xs text-muted-foreground">Branches</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 flex items-center gap-3">
                <Flag className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-lg font-bold">{flags.length}</p>
                  <p className="text-xs text-muted-foreground">Feature Flags</p>
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      {/* Feature Flags */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5" />
            Feature Flags
          </CardTitle>
          <CardDescription>
            {enabledCount} of {flags.length} flags enabled
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && flags.length === 0 ? (
            <div className="grid gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-1 flex-1">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-64" />
                  </div>
                  <Skeleton className="h-6 w-10" />
                </div>
              ))}
            </div>
          ) : flags.length === 0 ? (
            <EmptyState title="No feature flags configured" compact />
          ) : (
            <div className="grid gap-2">
              {flags.map(flag => (
                <div
                  key={flag.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="space-y-0.5 min-w-0 flex-1 mr-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{flag.name}</span>
                      <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">
                        {flag.key}
                      </code>
                      {flag.rollout_percentage < 100 && (
                        <Badge variant="outline" className="text-xs">{flag.rollout_percentage}% rollout</Badge>
                      )}
                    </div>
                    {flag.description && (
                      <p className="text-xs text-muted-foreground truncate">{flag.description}</p>
                    )}
                    {flag.target_roles && flag.target_roles.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {flag.target_roles.map(role => (
                          <Badge key={role} variant="secondary" className="text-[10px]">{role}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button
                    variant={flag.enabled ? 'default' : 'outline'}
                    size="sm"
                    className={`min-w-[80px] shrink-0 ${flag.enabled ? 'bg-success hover:bg-success/90' : ''}`}
                    onClick={() => handleToggle(flag.id)}
                    disabled={togglingId === flag.id}
                  >
                    {togglingId === flag.id ? '...' : flag.enabled ? 'Enabled' : 'Disabled'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
