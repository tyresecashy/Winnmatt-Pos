'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  FlaskConical,
  CheckCircle2,
  XCircle,
  SkipForward,
  Timer,
  RefreshCw,
  Beaker,
  TestTube,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getTestingStatus, type TestSuiteStatus } from '@/lib/modules/enterprise'

export default function TestingPage() {
  const [suites, setSuites] = useState<TestSuiteStatus[]>([])
  const [summary, setSummary] = useState<{ total: number; passed: number; failed: number; passRate: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const result = await getTestingStatus()
        setSuites(result.suites)
        setSummary(result.summary)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <FlaskConical className="h-7 w-7" />
            Test Center
          </h1>
          <p className="text-muted-foreground mt-1">Test suite status and QA overview</p>
        </div>
        <Button variant="outline" onClick={() => window.location.reload()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary */}
      {loading ? (
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-4 pb-3"><Skeleton className="h-10 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <Beaker className="h-4 w-4 text-primary shrink-0" />
              <div>
                <p className="text-2xl font-bold">{summary.total}</p>
                <p className="text-xs text-muted-foreground">Total Tests</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
              <div>
                <p className="text-2xl font-bold text-success">{summary.passed}</p>
                <p className="text-xs text-muted-foreground">Passed</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <XCircle className="h-4 w-4 text-destructive shrink-0" />
              <div>
                <p className="text-2xl font-bold text-destructive">{summary.failed}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0"
                style={{
                  background: summary.passRate >= 90 ? 'hsl(var(--success) / 0.1)' :
                              summary.passRate >= 70 ? 'hsl(var(--warning) / 0.1)' :
                              'hsl(var(--destructive) / 0.1)'
                }}
              >
                <TestTube className="h-4 w-4" style={{
                  color: summary.passRate >= 90 ? 'hsl(var(--success))' :
                         summary.passRate >= 70 ? 'hsl(var(--warning))' :
                         'hsl(var(--destructive))'
                }} />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{
                  color: summary.passRate >= 90 ? 'hsl(var(--success))' :
                         summary.passRate >= 70 ? 'hsl(var(--warning))' :
                         'hsl(var(--destructive))'
                }}>{summary.passRate}%</p>
                <p className="text-xs text-muted-foreground">Pass Rate</p>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Suite Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {loading ? Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            </CardContent>
          </Card>
        )) : suites.map(suite => (
          <Card key={suite.name}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{suite.name}</CardTitle>
                <Badge variant={suite.status === 'pass' ? 'default' : suite.status === 'fail' ? 'destructive' : 'secondary'}
                  className={suite.status === 'pass' ? 'bg-success/10 text-success border-success/20' : ''}>
                  {suite.status === 'pass' ? <CheckCircle2 className="h-3 w-3 mr-1" /> :
                   suite.status === 'fail' ? <XCircle className="h-3 w-3 mr-1" /> :
                   <SkipForward className="h-3 w-3 mr-1" />}
                  {suite.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  <span className="text-muted-foreground">{suite.passed} passed</span>
                </div>
                {suite.failed > 0 && (
                  <div className="flex items-center gap-1.5">
                    <XCircle className="h-3.5 w-3.5 text-destructive" />
                    <span className="text-muted-foreground">{suite.failed} failed</span>
                  </div>
                )}
                {suite.skipped > 0 && (
                  <div className="flex items-center gap-1.5">
                    <SkipForward className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">{suite.skipped} skipped</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Timer className="h-3 w-3" />
                  {suite.duration}
                </div>
                <div className="flex items-center gap-1">
                  <RefreshCw className="h-3 w-3" />
                  {new Date(suite.lastRun).toLocaleTimeString()}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
