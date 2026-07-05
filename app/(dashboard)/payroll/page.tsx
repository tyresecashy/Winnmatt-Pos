'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/hooks/use-toast'
import { formatKSh } from '@/lib/currency'
import {
  getPayrollRuns, createPayrollRun, processPayroll, getPayslips,
  previewTaxCalculation, type PayrollRun
} from '@/lib/payroll-actions'
import { DollarSign, Calculator, Plus, RefreshCw, CheckCircle, Clock } from 'lucide-react'

export default function PayrollPage() {
  const [runs, setRuns] = useState<PayrollRun[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showPreviewDialog, setShowPreviewDialog] = useState(false)
  const [previewSalary, setPreviewSalary] = useState('')
  const [createForm, setCreateForm] = useState({ name: '', period_start: '', period_end: '' })

  useEffect(() => { loadRuns() }, [])

  async function loadRuns() {
    setLoading(true)
    const data = await getPayrollRuns()
    setRuns(data)
    setLoading(false)
  }

  async function handleCreate() {
    if (!createForm.name || !createForm.period_start || !createForm.period_end) {
      toast({ title: 'Error', description: 'All fields required', variant: 'destructive' })
      return
    }
    const result = await createPayrollRun(createForm)
    if (result.success) {
      toast({ title: 'Created', description: 'Payroll run created' })
      setShowCreateDialog(false)
      setCreateForm({ name: '', period_start: '', period_end: '' })
      loadRuns()
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' })
    }
  }

  async function handleProcess(runId: string, name: string) {
    if (!confirm(`Process payroll for "${name}"?\n\nThis will generate payslips for all active employees.`)) return
    const result = await processPayroll(runId)
    if (result.success) {
      toast({
        title: 'Processed',
        description: `${result.employeeCount} employees | Gross: ${formatKSh(result.totalGross || 0)} | Net: ${formatKSh(result.totalNet || 0)}`,
      })
      loadRuns()
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' })
    }
  }

  const preview = previewSalary ? previewTaxCalculation(parseFloat(previewSalary) || 0) : null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <DollarSign className="h-8 w-8 text-green-500" />
            Payroll
          </h1>
          <p className="text-muted-foreground mt-1">Manage employee payroll with PAYE, NHIF, NSSF deductions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowPreviewDialog(true)}><Calculator className="h-4 w-4 mr-2" /> Tax Calculator</Button>
          <Button variant="outline" onClick={loadRuns}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</Button>
          <Button onClick={() => setShowCreateDialog(true)}><Plus className="h-4 w-4 mr-2" /> New Payroll Run</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Runs</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{runs.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Completed</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-green-600">{runs.filter(r => r.status === 'completed').length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Draft</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-amber-600">{runs.filter(r => r.status === 'draft').length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Paid</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{formatKSh(runs.reduce((sum, r) => sum + (r.total_net || 0), 0))}</div></CardContent>
        </Card>
      </div>

      {/* Payroll Runs */}
      <Card>
        <CardHeader><CardTitle>Payroll Runs</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Employees</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Deductions</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map(run => (
                <TableRow key={run.id}>
                  <TableCell className="font-medium">{run.name}</TableCell>
                  <TableCell className="text-sm">{run.period_start} — {run.period_end}</TableCell>
                  <TableCell>{run.employee_count || 0}</TableCell>
                  <TableCell className="text-right">{formatKSh(run.total_gross || 0)}</TableCell>
                  <TableCell className="text-right text-red-600">{formatKSh(run.total_deductions || 0)}</TableCell>
                  <TableCell className="text-right text-green-600">{formatKSh(run.total_net || 0)}</TableCell>
                  <TableCell>
                    <Badge variant={run.status === 'completed' ? 'default' : run.status === 'draft' ? 'secondary' : 'outline'}>
                      {run.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {run.status === 'draft' && (
                      <Button variant="outline" size="sm" onClick={() => handleProcess(run.id, run.name)}>
                        <CheckCircle className="h-4 w-4 mr-1" /> Process
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {runs.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No payroll runs yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Tax Calculator Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kenya Tax Calculator</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Gross Monthly Salary (KSh)</Label>
              <Input type="number" value={previewSalary} onChange={e => setPreviewSalary(e.target.value)} placeholder="e.g. 100000" />
            </div>
            {preview && (
              <div className="space-y-2 border rounded-lg p-4">
                <div className="flex justify-between"><span>Gross Salary</span><span className="font-medium">{formatKSh(preview.grossSalary)}</span></div>
                <hr />
                <div className="flex justify-between text-sm text-muted-foreground"><span>PAYE (Income Tax)</span><span className="text-red-600">-{formatKSh(preview.paye)}</span></div>
                <div className="flex justify-between text-sm text-muted-foreground"><span>NHIF</span><span className="text-red-600">-{formatKSh(preview.nhif)}</span></div>
                <div className="flex justify-between text-sm text-muted-foreground"><span>NSSF</span><span className="text-red-600">-{formatKSh(preview.nssf)}</span></div>
                <div className="flex justify-between text-sm text-muted-foreground"><span>Housing Levy (1.5%)</span><span className="text-red-600">-{formatKSh(preview.housingLevy)}</span></div>
                <hr />
                <div className="flex justify-between text-sm"><span>Total Deductions</span><span className="font-medium text-red-600">{formatKSh(preview.totalDeductions)}</span></div>
                <hr />
                <div className="flex justify-between text-lg font-bold"><span>Net Salary</span><span className="text-green-600">{formatKSh(preview.netSalary)}</span></div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Payroll Run</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Run Name</Label>
              <Input value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} placeholder="e.g. July 2026 Payroll" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Period Start</Label>
                <Input type="date" value={createForm.period_start} onChange={e => setCreateForm({ ...createForm, period_start: e.target.value })} />
              </div>
              <div>
                <Label>Period End</Label>
                <Input type="date" value={createForm.period_end} onChange={e => setCreateForm({ ...createForm, period_end: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Create Run</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
