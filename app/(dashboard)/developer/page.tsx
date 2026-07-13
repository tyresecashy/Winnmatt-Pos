"use client"

import { logger } from "@/lib/logger"
import { useEffect, useState, startTransition } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Terminal, Flag, Database, History, Beaker, Loader2, CheckCircle, XCircle, Code, RefreshCw, Activity } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { getDatabaseTableCounts, getSystemHealth } from "@/lib/modules/system"
import { getAllFeatureFlags, toggleFeatureFlag } from "@/lib/feature-flags"
import type { FeatureFlag } from "@/lib/feature-flags"

interface SystemHealth {
  totalProducts: number
  totalCustomers: number
  totalSales: number
  todaySales: number
  activeUsers: number
}

interface TableCount {
  table: string
  count: number
}

export default function DeveloperPage() {
  const { profile, authState } = useAuth()
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([])
  const [featureFlagsLoading, setFeatureFlagsLoading] = useState(true)
  const [apiMethod, setApiMethod] = useState<string>("GET")
  const [apiUrl, setApiUrl] = useState("")
  const [apiBody, setApiBody] = useState("")
  const [apiResponse, setApiResponse] = useState("")
  const [apiLoading, setApiLoading] = useState(false)

  // Real data state
  const [dbCounts, setDbCounts] = useState<TableCount[]>([])
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function loadData() {
    setLoadingData(true)
    setFeatureFlagsLoading(true)
    try {
      const [counts, health, flags] = await Promise.all([
        getDatabaseTableCounts(),
        getSystemHealth(),
        getAllFeatureFlags(),
      ])
      setDbCounts(counts)
      setSystemHealth(health)
      setFeatureFlags(flags)
    } catch (error) {
      logger.error('Failed to load developer data:', error)
    } finally {
      setLoadingData(false)
      setFeatureFlagsLoading(false)
    }
  }

  useEffect(() => {
    startTransition(() => { loadData() })
  }, [])

  async function handleRefresh() {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  const toggleFlag = async (flag: FeatureFlag) => {
    const result = await toggleFeatureFlag(flag.id)
    if (result.success) {
      setFeatureFlags((prev) =>
        prev.map((f) => (f.id === flag.id ? { ...f, enabled: !f.enabled } : f))
      )
    }
  }

  const handleApiTest = async () => {
    if (!apiUrl) return
    setApiLoading(true)
    setApiResponse("")
    try {
      const options: RequestInit = { method: apiMethod }
      if (apiMethod !== "GET" && apiBody) {
        options.headers = { "Content-Type": "application/json" }
        options.body = apiBody
      }
      const start = performance.now()
      const res = await fetch(apiUrl, options)
      const elapsed = (performance.now() - start).toFixed(0)
      const text = await res.text()
      let formatted: string
      try {
        formatted = JSON.stringify(JSON.parse(text), null, 2)
      } catch {
        formatted = text
      }
      setApiResponse(
        `// ${res.status} ${res.statusText} (${elapsed}ms)\n\n${formatted}`
      )
    } catch (error) {
      setApiResponse(`// Network Error\n\n${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setApiLoading(false)
    }
  }

  if (authState === "loading") {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex min-h-[220px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!profile || (profile.role !== "super_admin" && profile.role !== "admin")) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center min-h-[220px] text-center">
            <Terminal className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-lg font-medium">Access Restricted</p>
            <p className="text-sm text-muted-foreground mt-1">
              This page is only available to administrators.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Terminal className="h-6 w-6" />
          Developer Console
        </h1>
        <p className="text-muted-foreground">System diagnostics, feature flags, and API tools</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-muted-foreground" />
              <CardTitle>System Health</CardTitle>
            </div>
            <CardDescription>Key metrics at a glance</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingData ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : systemHealth ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Total Products</p>
                  <p className="text-2xl font-bold">{systemHealth.totalProducts.toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Total Customers</p>
                  <p className="text-2xl font-bold">{systemHealth.totalCustomers.toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Total Sales</p>
                  <p className="text-2xl font-bold">{systemHealth.totalSales.toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Today&apos;s Sales</p>
                  <p className="text-2xl font-bold text-green-600">{systemHealth.todaySales.toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Active Users</p>
                  <p className="text-2xl font-bold">{systemHealth.activeUsers.toLocaleString()}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Failed to load system health</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Database Inspector</CardTitle>
              </div>
              <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            <CardDescription>Record counts across all tables</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingData ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Table</TableHead>
                      <TableHead className="text-right">Records</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dbCounts.map((row) => (
                      <TableRow key={row.table}>
                        <TableCell>
                          <code className="text-xs font-mono">{row.table}</code>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {row.count.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                    {dbCounts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-sm text-muted-foreground py-4">
                          No tables found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Feature Flags</CardTitle>
            </div>
            <CardDescription>Toggle system features on and off</CardDescription>
          </CardHeader>
          <CardContent>
            {featureFlagsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                {featureFlags.map((flag) => (
                  <div key={flag.key} className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{flag.name}</p>
                        <Badge
                          variant={flag.enabled ? "default" : "secondary"}
                          className="text-[10px] h-4 px-1"
                        >
                          {flag.enabled ? "ON" : "OFF"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{flag.description}</p>
                      <code className="text-[10px] text-muted-foreground mt-0.5 block">
                        {flag.key}
                      </code>
                    </div>
                    <Switch checked={flag.enabled} onCheckedChange={() => toggleFlag(flag)} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Migration History</CardTitle>
            </div>
            <CardDescription>Database migration log from supabase/migrations/</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[300px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="text-muted-foreground font-mono text-xs">001</TableCell>
                    <TableCell className="font-medium">Initial Schema</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50 dark:bg-green-950/30 dark:text-green-400">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Applied
                      </Badge>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground font-mono text-xs">002</TableCell>
                    <TableCell className="font-medium">Seed Data + Categories</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50 dark:bg-green-950/30 dark:text-green-400">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Applied
                      </Badge>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground font-mono text-xs">003</TableCell>
                    <TableCell className="font-medium">Phase 4 Credit + Invoicing</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50 dark:bg-green-950/30 dark:text-green-400">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Applied
                      </Badge>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground font-mono text-xs">004</TableCell>
                    <TableCell className="font-medium">Fix RLS Credit Functions</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50 dark:bg-green-950/30 dark:text-green-400">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Applied
                      </Badge>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Beaker className="h-5 w-5 text-muted-foreground" />
              <CardTitle>API Tester</CardTitle>
            </div>
            <CardDescription>Send test requests to API endpoints</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Select value={apiMethod} onValueChange={setApiMethod}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                  <SelectItem value="PATCH">PATCH</SelectItem>
                  <SelectItem value="DELETE">DELETE</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="/api/endpoint"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                className="flex-1 font-mono text-xs"
              />
              <Button
                size="sm"
                onClick={() => void handleApiTest()}
                disabled={apiLoading || !apiUrl}
              >
                {apiLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Code className="h-3 w-3" />
                )}
                Send
              </Button>
            </div>
            {apiMethod !== "GET" && (
              <Textarea
                placeholder='{"key": "value"}'
                value={apiBody}
                onChange={(e) => setApiBody(e.target.value)}
                className="font-mono text-xs min-h-[80px]"
              />
            )}
            {apiResponse && (
              <div className="relative">
                <pre className="rounded-md bg-muted p-4 text-xs font-mono overflow-x-auto max-h-[300px] whitespace-pre-wrap">
                  {apiResponse}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
    </div>
  )
}
