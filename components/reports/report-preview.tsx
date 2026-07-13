'use client'

import { useState, useEffect, useCallback, startTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { WidgetRenderer } from '@/components/reports/widget-renderer'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Download,
  FileText,
  RefreshCw,
  BarChart3,
  Table as TableIcon,
  List,
  Activity,
} from 'lucide-react'
import type { ReportTemplate } from '@/lib/analytics/report-builder'

interface ReportWidgetData {
  widget: { id: string }
  data: Record<string, unknown>
  error?: string
}

interface ReportData {
  generatedAt: string
  widgets: ReportWidgetData[]
}

interface ReportPreviewProps {
  template: ReportTemplate | null
  onGenerate: (templateId: string, startDate: string, endDate: string) => Promise<ReportData>
}

const WIDGET_ICONS: Record<string, React.ReactNode> = {
  metric: <Activity className="h-4 w-4" />,
  chart: <BarChart3 className="h-4 w-4" />,
  table: <TableIcon className="h-4 w-4" />,
  list: <List className="h-4 w-4" />,
}

function QuickDateRange({ label, days, onClick }: { label: string; days: number; onClick: (days: number) => void }) {
  return (
    <button
      onClick={() => onClick(days)}
      className="px-3 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-accent transition-colors"
    >
      {label}
    </button>
  )
}

export function ReportPreview({ template, onGenerate }: ReportPreviewProps) {
  const [generating, setGenerating] = useState(false)
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' })
  const [quickRange, setQuickRange] = useState(30)

  // Set default date range on mount
  useEffect(() => {
    startTransition(() => {
      const end = new Date()
      const start = new Date()
      start.setDate(start.getDate() - 30)
      setDateRange({
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      })
    })
  }, [])

  const handleQuickRange = useCallback((days: number) => {
    setQuickRange(days)
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - days)
    setDateRange({
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    })
  }, [])

  const handleGenerate = useCallback(async () => {
    if (!template || !dateRange.startDate || !dateRange.endDate) return
    setGenerating(true)
    try {
      const data = await onGenerate(template.id, dateRange.startDate, dateRange.endDate)
      setReportData(data)
    } finally {
      setGenerating(false)
    }
  }, [template, dateRange, onGenerate])

  // Generate on template change + auto-generate once on first load
  useEffect(() => {
    startTransition(() => {
      if (template && dateRange.startDate && !reportData) {
        handleGenerate()
      }
    })
    // Only re-trigger when template ID changes, not the whole template object
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template?.id, dateRange.startDate, reportData, handleGenerate])

  if (!template) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-[400px]">
          <div className="text-center space-y-2">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">Select a report template to preview</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div>
                <h3 className="text-sm font-medium">{template.name}</h3>
                <p className="text-xs text-muted-foreground">{template.description}</p>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {template.tags?.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Widget type badges */}
              <div className="hidden sm:flex items-center gap-1 mr-2">
                {[...new Set(template.widgets.map(w => w.type))].map((type) => (
                  <span key={type} className="text-[10px] text-muted-foreground flex items-center gap-0.5 capitalize">
                    {WIDGET_ICONS[type]}
                    {type}
                  </span>
                ))}
              </div>

              {/* Quick date ranges */}
              <div className="hidden md:flex items-center gap-1">
                {[
                  { label: '7D', days: 7 },
                  { label: '30D', days: 30 },
                  { label: '90D', days: 90 },
                  { label: '1Y', days: 365 },
                ].map(({ label, days }) => (
                  <QuickDateRange
                    key={days}
                    label={label}
                    days={days}
                    onClick={handleQuickRange}
                  />
                ))}
              </div>

              {/* Date inputs */}
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                  className="h-8 w-[130px] rounded-md border border-border bg-background px-2 text-xs"
                />
                <span className="text-xs text-muted-foreground">—</span>
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                  className="h-8 w-[130px] rounded-md border border-border bg-background px-2 text-xs"
                />
              </div>

              {/* Actions */}
              <Button size="sm" variant="default" onClick={handleGenerate} disabled={generating}>
                {generating ? (
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                )}
                Generate
              </Button>
              <Button size="sm" variant="outline" disabled={!reportData}>
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Export
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Generated timestamp */}
      {reportData?.generatedAt && (
        <p className="text-xs text-muted-foreground text-right">
          Generated: {new Date(reportData.generatedAt).toLocaleString('en-KE')}
        </p>
      )}

      {/* Widget Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {template.widgets.map((widget) => {
          const widgetData = reportData?.widgets?.find((w) => w.widget.id === widget.id)
          return (
            <div key={widget.id} className={widget.position?.w === 4 ? 'md:col-span-2' : ''}>
              <WidgetRenderer
                widget={widget}
                data={widgetData?.data ?? {}}
                loading={generating}
                error={widgetData?.error}
              />
            </div>
          )
        })}
      </div>

      {generating && template.widgets.length === 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
