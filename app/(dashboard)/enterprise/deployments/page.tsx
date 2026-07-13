'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Rocket, RefreshCw, CheckCircle2, XCircle, Loader2, Clock, ArrowUpRight } from 'lucide-react'
import { getDeployments, type DeploymentEntry } from '@/lib/modules/enterprise'
import { formatDistanceToNow } from 'date-fns'
import { EmptyState } from '@/components/ui/empty-state'

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string }> = {
  success: { icon: CheckCircle2, color: 'text-success' },
  failed: { icon: XCircle, color: 'text-destructive' },
  rolling: { icon: Loader2, color: 'text-blue-500' },
  pending: { icon: Clock, color: 'text-muted-foreground' },
}

export default function DeploymentsPage() {
  const [deployments, setDeployments] = useState<DeploymentEntry[]>([])
  const [currentVersion, setCurrentVersion] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const result = await getDeployments()
        setDeployments(result.deployments)
        setCurrentVersion(result.currentVersion)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const successCount = deployments.filter(d => d.status === 'success').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Rocket className="h-7 w-7" />
            Deployments
          </h1>
          <p className="text-muted-foreground mt-1">Deployment history and environment tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-sm gap-1">
            <ArrowUpRight className="h-3 w-3" />
            v{currentVersion}
          </Badge>
          <Button variant="outline" onClick={() => window.location.reload()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-4 pb-3"><Skeleton className="h-10 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <Rocket className="h-4 w-4 text-primary shrink-0" />
              <div>
                <p className="text-2xl font-bold">{deployments.length}</p>
                <p className="text-xs text-muted-foreground">Total Deployments</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
              <div>
                <p className="text-2xl font-bold">{successCount}</p>
                <p className="text-xs text-muted-foreground">Successful</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-2xl font-bold">v{currentVersion}</p>
                <p className="text-xs text-muted-foreground">Current Version</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Deployment History</CardTitle>
          <CardDescription>Recent deployments across all environments</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : deployments.length === 0 ? (
            <EmptyState title="No deployment history available" compact />
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[19px] top-2 bottom-2 w-px bg-border" />

              <div className="space-y-6">
                {deployments.map((dep, i) => {
                  const StatusIcon = STATUS_CONFIG[dep.status]?.icon || Clock
                  return (
                    <div key={dep.id} className="relative flex gap-4 pl-2">
                      {/* Timeline dot */}
                      <div className={`relative z-10 mt-0.5 h-10 w-10 rounded-full border-2 bg-background flex items-center justify-center shrink-0 ${
                        dep.status === 'success' ? 'border-success' :
                        dep.status === 'failed' ? 'border-destructive' :
                        dep.status === 'rolling' ? 'border-blue-500' :
                        'border-border'
                      }`}>
                        <StatusIcon className={`h-4 w-4 ${
                          dep.status === 'success' ? 'text-success' :
                          dep.status === 'failed' ? 'text-destructive' :
                          dep.status === 'rolling' ? 'text-blue-500' :
                          'text-muted-foreground'
                        } ${dep.status === 'rolling' ? 'animate-spin' : ''}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{dep.description}</span>
                          <Badge variant={dep.status === 'success' ? 'default' : dep.status === 'failed' ? 'destructive' : 'secondary'} className="text-xs">
                            {dep.status}
                          </Badge>
                          <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">
                            v{dep.version}
                          </code>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>by {dep.deployed_by}</span>
                          <span>in {dep.environment}</span>
                          <span>{formatDistanceToNow(new Date(dep.deployed_at), { addSuffix: true })}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
