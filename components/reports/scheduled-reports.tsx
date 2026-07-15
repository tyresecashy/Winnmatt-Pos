'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Clock,
  Plus,
  Trash2,
  Calendar,
  FileText,
  Mail,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import type { ScheduledReport, ReportTemplate } from '@/lib/analytics/report-builder'

interface ScheduledReportsProps {
  reports: ScheduledReport[]
  templates: ReportTemplate[]
  loading?: boolean
  onCreate: (data: Omit<ScheduledReport, 'id' | 'lastRun' | 'nextRun'>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
}

const FORMAT_LABELS: Record<string, string> = {
  pdf: 'PDF',
  excel: 'Excel',
  csv: 'CSV',
}

export function ScheduledReports({ reports, templates, loading, onCreate, onDelete }: ScheduledReportsProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    templateId: '',
    name: '',
    frequency: 'weekly' as 'daily' | 'weekly' | 'monthly',
    recipients: '',
    format: 'pdf' as 'pdf' | 'excel' | 'csv',
    isActive: true,
  })
  const [saving, setSaving] = useState(false)

  const handleCreate = async () => {
    if (!formData.templateId || !formData.name) return
    setSaving(true)
    try {
      await onCreate({
        templateId: formData.templateId,
        name: formData.name,
        frequency: formData.frequency,
        recipients: formData.recipients.split(',').map(r => r.trim()).filter(Boolean),
        format: formData.format,
        isActive: formData.isActive,
      })
      setDialogOpen(false)
      setFormData({
        templateId: '',
        name: '',
        frequency: 'weekly',
        recipients: '',
        format: 'pdf',
        isActive: true,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Scheduled Reports
          </CardTitle>
          <CardDescription>Automate report generation and delivery</CardDescription>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              Schedule
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Schedule a Report</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Report Template</Label>
                <Select
                  value={formData.templateId}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, templateId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.length === 0 ? (
                      <SelectItem value="__none__" disabled>No templates available</SelectItem>
                    ) : templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Report Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Weekly Sales Report"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Select
                    value={formData.frequency}
                    onValueChange={(v: string) => setFormData(prev => ({ ...prev, frequency: v as 'daily' | 'weekly' | 'monthly' }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Format</Label>
                  <Select
                    value={formData.format}
                    onValueChange={(v: string) => setFormData(prev => ({ ...prev, format: v as 'pdf' | 'excel' | 'csv' }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pdf">PDF</SelectItem>
                      <SelectItem value="excel">Excel</SelectItem>
                      <SelectItem value="csv">CSV</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Recipients (comma-separated emails)</Label>
                <Input
                  value={formData.recipients}
                  onChange={(e) => setFormData(prev => ({ ...prev, recipients: e.target.value }))}
                  placeholder="admin@winnmatt.com, manager@winnmatt.com"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Active</Label>
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(v) => setFormData(prev => ({ ...prev, isActive: v }))}
                />
              </div>

              <Button className="w-full" onClick={handleCreate} disabled={saving || !formData.templateId || !formData.name}>
                {saving ? 'Saving...' : 'Create Schedule'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Calendar className="h-10 w-10 text-muted-foreground mb-3" />
            <EmptyState title="No scheduled reports yet" compact />
            <p className="text-xs text-muted-foreground mt-1">Schedule automated report delivery to your inbox</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <div key={report.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{report.name}</span>
                    <Badge variant={report.isActive ? 'default' : 'secondary'} className="text-[10px] px-1.5">
                      {report.isActive ? 'Active' : 'Paused'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      {FREQUENCY_LABELS[report.frequency] || report.frequency}
                    </span>
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {report.recipients.length} recipient{report.recipients.length !== 1 ? 's' : ''}
                    </span>
                    <Badge variant="outline" className="text-[10px] px-1">
                      {FORMAT_LABELS[report.format] || report.format.toUpperCase()}
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => onDelete(report.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
