'use client'

import { useState, useEffect, useCallback, startTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts'
import { ArrowLeft, Clock, Users, RefreshCw, TrendingUp, CheckCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { workforceAnalyticsService } from '@/lib/analytics/workforce-analytics'
import type { WorkforceMetrics, TaskEfficiency, AttendancePattern, LaborCostAnalysis, TaskDurationAnalysis } from '@/lib/analytics/workforce-analytics'
import { AIInsightSection } from '@/components/ai/ai-insight-section'
import { analyzeWorkforceAI } from '@/lib/modules/ai'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d']

export default function WorkforceAnalyticsPage() {
  const router = useRouter()
  const [dateRange, setDateRange] = useState('30d')
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<WorkforceMetrics | null>(null)
  const [taskEfficiency, setTaskEfficiency] = useState<TaskEfficiency[]>([])
  const [attendance, setAttendance] = useState<AttendancePattern[]>([])
  const [laborCost, setLaborCost] = useState<LaborCostAnalysis[]>([])
  const [taskDuration, setTaskDuration] = useState<TaskDurationAnalysis[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const end = new Date(); const start = new Date()
      if (dateRange === '7d') start.setDate(start.getDate() - 7)
      else if (dateRange === '30d') start.setDate(start.getDate() - 30)
      else if (dateRange === '90d') start.setDate(start.getDate() - 90)
      else start.setFullYear(start.getFullYear() - 1)
      const { startDate, endDate } = { startDate: start.toISOString(), endDate: end.toISOString() }
      const [m, te, att, lc, td] = await Promise.all([
        workforceAnalyticsService.getWorkforceMetrics(startDate, endDate),
        workforceAnalyticsService.getTaskEfficiency(startDate, endDate),
        workforceAnalyticsService.getAttendancePattern(startDate, endDate),
        workforceAnalyticsService.getLaborCostAnalysis(startDate, endDate),
        workforceAnalyticsService.getTaskDurationAnalysis(),
      ])
      setMetrics(m)
      setTaskEfficiency(te)
      setAttendance(att)
      setLaborCost(lc)
      setTaskDuration(td)
    } finally { setLoading(false) }
  }, [dateRange])

  useEffect(() => { startTransition(() => { loadData() }) }, [dateRange, loadData])

  const fmt = (n: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(n)

  if (loading) return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-md" />
          <Skeleton className="h-8 w-52" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-[180px]" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}><CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader><CardContent><Skeleton className="h-8 w-28" /></CardContent></Card>
        ))}
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9 w-32" />)}
      </div>
      <Card><CardHeader><Skeleton className="h-5 w-36" /></CardHeader><CardContent><Skeleton className="h-[350px] w-full rounded-lg" /></CardContent></Card>
    </div>
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/analytics')}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-3xl font-bold">Workforce Analytics</h1>
        </div>
        <div className="flex items-center gap-3">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={loadData}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</Button>
        </div>
      </div>

      <AIInsightSection
        title="AI Workforce Insights"
        description="AI analysis of team productivity, attendance, and labor costs"
        analyzeFn={() => analyzeWorkforceAI({
          metrics: {
            totalWorkers: metrics?.totalWorkers || 0,
            activeWorkers: metrics?.activeWorkers || 0,
            averageTaskCompletionRate: metrics?.averageTaskCompletionRate || 0,
            averageEfficiencyScore: metrics?.averageEfficiencyScore || 0,
            totalHoursWorked: metrics?.totalHoursWorked || 0,
            laborCost: metrics?.laborCost || 0,
          },
          taskEfficiency: (taskEfficiency || []).map(t => ({
            workerName: t.workerName || 'Unknown',
            completionRate: t.completionRate || 0,
            efficiencyScore: t.efficiencyScore || 0,
          })),
          attendance: (attendance || []).map(a => ({
            workerName: a.workerName || 'Unknown',
            attendanceRate: a.attendanceRate || 0,
          })),
          laborCostAnalysis: (laborCost || []).map(l => ({
            period: l.period || 'Unknown',
            totalCost: l.totalCost || 0,
            costPerHour: l.costPerHour || 0,
            overtimeHours: l.overtimeHours || 0,
          })),
        })}
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Active Workers</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{metrics?.activeWorkers || 0}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Avg Task Completion</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{(metrics?.averageTaskCompletionRate || 0).toFixed(1)}%</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Avg Efficiency</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{(metrics?.averageEfficiencyScore || 0).toFixed(1)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total Tasks</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{(metrics as any)?.totalTasks || 0}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="efficiency">
        <TabsList>
          <TabsTrigger value="efficiency"><CheckCircle className="h-4 w-4 mr-2" /> Task Efficiency</TabsTrigger>
          <TabsTrigger value="attendance"><Clock className="h-4 w-4 mr-2" /> Attendance</TabsTrigger>
          <TabsTrigger value="labor"><TrendingUp className="h-4 w-4 mr-2" /> Labor Cost</TabsTrigger>
          <TabsTrigger value="duration"><Clock className="h-4 w-4 mr-2" /> Task Duration</TabsTrigger>
        </TabsList>

        <TabsContent value="efficiency" className="mt-4">
          <Card><CardHeader><CardTitle>Worker Task Efficiency</CardTitle></CardHeader>
            <CardContent className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={taskEfficiency} layout="vertical"><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" domain={[0, 100]} /><YAxis type="category" dataKey="workerName" /><Tooltip /><Bar dataKey="completionRate" fill="#8884d8" name="Completion %" /></BarChart>
              </ResponsiveContainer>
            </CardContent></Card>
        </TabsContent>

        <TabsContent value="attendance" className="mt-4">
          <Card><CardHeader><CardTitle>Attendance Patterns</CardTitle></CardHeader>
            <CardContent className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={attendance}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="workerName" /><YAxis /><Tooltip /><Bar dataKey="attendanceRate" fill="#00C49F" name="Attendance %" /></BarChart>
              </ResponsiveContainer>
            </CardContent></Card>
        </TabsContent>

        <TabsContent value="labor" className="mt-4">
          <Card><CardHeader><CardTitle>Labor Cost Analysis</CardTitle></CardHeader>
            <CardContent className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={laborCost}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="workerName" /><YAxis /><Tooltip /><Bar dataKey="cost" fill="#FF8042" name="Labor Cost" /></BarChart>
              </ResponsiveContainer>
            </CardContent></Card>
        </TabsContent>

        <TabsContent value="duration" className="mt-4">
          <Card><CardHeader><CardTitle>Task Duration Analysis</CardTitle></CardHeader>
            <CardContent className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={taskDuration}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="workerName" /><YAxis /><Tooltip /><Bar dataKey="avgDuration" fill="#FFBB28" name="Avg Duration (mins)" /></BarChart>
              </ResponsiveContainer>
            </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
