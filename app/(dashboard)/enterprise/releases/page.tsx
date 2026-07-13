'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Package, GitCommit, ArrowUpRight } from 'lucide-react'
import { getReleases, type ReleaseEntry } from '@/lib/modules/enterprise'
import { EmptyState } from '@/components/ui/empty-state'

const TYPE_CONFIG: Record<string, { color: string }> = {
  major: { color: 'bg-destructive/10 text-destructive border-destructive/20' },
  minor: { color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  patch: { color: 'bg-muted text-muted-foreground border-border' },
  hotfix: { color: 'bg-warning/10 text-warning border-warning/20' },
}

export default function ReleasesPage() {
  const [releases, setReleases] = useState<ReleaseEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const result = await getReleases()
        setReleases(result)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Package className="h-7 w-7" />
          Releases
        </h1>
        <p className="text-muted-foreground mt-1">Version history, changelogs, and release notes</p>
      </div>

      {/* Release Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Version History</CardTitle>
          <CardDescription>Notable changes and improvements across releases</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="border-l-2 border-border pl-6 space-y-2">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-64" />
                  <div className="space-y-1 mt-3">
                    {Array.from({ length: 4 }).map((_, j) => (
                      <Skeleton key={j} className="h-4 w-full" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : releases.length === 0 ? (
            <EmptyState title="No releases recorded" compact />
          ) : (
            <div className="relative space-y-0">
              {releases.map((release, i) => {
                const config = TYPE_CONFIG[release.type] || TYPE_CONFIG.patch
                return (
                  <div key={release.version} className="relative pl-8 pb-8 last:pb-0">
                    {/* Timeline line */}
                    {i < releases.length - 1 && (
                      <div className="absolute left-[15px] top-4 bottom-0 w-px bg-border" />
                    )}

                    {/* Timeline dot */}
                    <div className="absolute left-[7px] top-1.5 w-[18px] h-[18px] rounded-full border-2 bg-background border-primary" />

                    {/* Version badge */}
                    <div className="flex items-center gap-3 mb-1">
                      <div className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.color}`}>
                        <ArrowUpRight className="h-3 w-3" />
                        v{release.version}
                      </div>
                      <Badge variant="outline" className="text-xs font-normal">
                        {release.type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{release.date}</span>
                    </div>

                    {/* Title */}
                    <h3 className="font-medium text-sm mt-1">{release.title}</h3>

                    {/* Changes */}
                    <ul className="mt-2 space-y-1">
                      {release.changes.map((change, ci) => (
                        <li key={ci} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <GitCommit className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary/60" />
                          <span>{change}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
