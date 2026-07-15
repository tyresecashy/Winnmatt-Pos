'use client'

import { useState, useEffect, useCallback, startTransition } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { ReportPreview } from '@/components/reports/report-preview'
import { ScheduledReports } from '@/components/reports/scheduled-reports'
import {
  getReportTemplates,
  getReportTemplate,
  generateReport,
  getScheduledReports,
  createScheduledReport,
  deleteScheduledReport,
  getReportAnalytics,
} from '@/lib/modules/reports'
import type { ReportTemplate, ScheduledReport } from '@/lib/analytics/report-builder'
import {
  FileText,
  Clock,
  BarChart3,
  LayoutDashboard,
  Layers,
  RefreshCw,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

export default function ReportBuilderPage() {
  const [templates, setTemplates] = useState<ReportTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null)
  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>([])
  const [analytics, setAnalytics] = useState<{ totalTemplates: number; scheduledReports: number; popularTemplates: ReportTemplate[] } | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [templateList, reports, overview] = await Promise.all([
        getReportTemplates(),
        getScheduledReports(),
        getReportAnalytics(),
      ])
      setTemplates(templateList)
      setScheduledReports(reports)
      setAnalytics(overview)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    startTransition(() => { loadData() })
  }, [loadData])

  const handleGenerate = useCallback(async (templateId: string, startDate: string, endDate: string) => {
    const result = await generateReport(templateId, { startDate, endDate })
    return result as unknown as { generatedAt: string; widgets: { widget: { id: string }; data: Record<string, unknown>; error?: string }[] }
  }, [])

  const handleCreateScheduled = useCallback(async (data: Omit<ScheduledReport, 'id' | 'lastRun' | 'nextRun'>) => {
    const result = await createScheduledReport(data.templateId, data as unknown as Record<string, unknown>, data.frequency)
    if (result.success) {
      setScheduledReports(prev => [...prev, data as unknown as ScheduledReport])
    }
  }, [])

  const handleDeleteScheduled = useCallback(async (id: string) => {
    const success = await deleteScheduledReport(id)
    if (success) {
      setScheduledReports(prev => prev.filter(r => r.id !== id))
    }
  }, [])

  const handleSelectTemplate = useCallback(async (templateId: string) => {
    const tmpl = templates.find(t => t.id === templateId) || await getReportTemplate(templateId)
    setSelectedTemplate(tmpl)
  }, [templates])

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-7 w-7" />
            Report Builder
          </h1>
          <p className="text-muted-foreground mt-1">Create, preview, and schedule business reports</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Templates</p>
                <p className="text-xl font-bold">{analytics?.totalTemplates || templates.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-chart-2/10 flex items-center justify-center text-chart-2">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Scheduled Reports</p>
                <p className="text-xl font-bold">{analytics?.scheduledReports || scheduledReports.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-chart-3/10 flex items-center justify-center text-chart-3">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Widget Types</p>
                <p className="text-xl font-bold">
                  {new Set(templates.flatMap(t => t.widgets.map(w => w.type))).size}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main content — Tabs */}
      <Tabs defaultValue="library" className="space-y-4">
        <TabsList>
          <TabsTrigger value="library" className="flex items-center gap-1.5">
            <Layers className="h-4 w-4" />
            Report Library
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex items-center gap-1.5">
            <LayoutDashboard className="h-4 w-4" />
            Preview
          </TabsTrigger>
          <TabsTrigger value="scheduled" className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            Scheduled
          </TabsTrigger>
        </TabsList>

        {/* Library Tab */}
        <TabsContent value="library">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4].map(i => (
                <Card key={i}>
                  <CardContent className="p-5">
                    <Skeleton className="h-5 w-3/4 mb-2" />
                    <Skeleton className="h-3 w-full mb-3" />
                    <Skeleton className="h-3 w-1/2 mb-4" />
                    <div className="flex gap-2">
                      <Skeleton className="h-6 w-16" />
                      <Skeleton className="h-6 w-16" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : templates.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <EmptyState icon={FileText} title="No report templates yet" description="Report templates allow you to quickly generate common business reports with pre-configured metrics and charts." compact />
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((template) => (
                <Card
                  key={template.id}
                  className={`cursor-pointer transition-all hover:border-primary/50 hover:shadow-sm ${
                    selectedTemplate?.id === template.id ? 'ring-1 ring-primary border-primary' : ''
                  }`}
                  onClick={() => handleSelectTemplate(template.id)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-sm">{template.name}</h3>
                      <div className="flex gap-1">
                        {[...new Set(template.widgets.map(w => w.type))].map(type => (
                          <Badge key={type} variant="outline" className="text-[10px] px-1.5 capitalize">
                            {type}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{template.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">
                        {template.widgets.length} widget{template.widgets.length !== 1 ? 's' : ''}
                      </span>
                      <div className="flex gap-1">
                        {template.tags?.slice(0, 3).map(tag => (
                          <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Preview Tab */}
        <TabsContent value="preview">
          <ReportPreview template={selectedTemplate} onGenerate={handleGenerate} />
        </TabsContent>

        {/* Scheduled Tab */}
        <TabsContent value="scheduled">
          <ScheduledReports
            reports={scheduledReports}
            templates={templates}
            loading={loading}
            onCreate={handleCreateScheduled}
            onDelete={handleDeleteScheduled}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
