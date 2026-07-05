'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from '@/hooks/use-toast'
import {
  getFinancialPeriods, createFinancialPeriod, closeFinancialPeriod,
  type FinancialPeriod
} from '@/lib/finance-actions'
import { Calendar, Lock, CheckCircle, Plus, RefreshCw } from 'lucide-react'

export default function FinancialPeriodsPage() {
  const [periods, setPeriods] = useState<FinancialPeriod[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: '',
    period_type: 'monthly',
    start_date: '',
    end_date: '',
  })

  useEffect(() => { loadPeriods() }, [])

  async function loadPeriods() {
    setLoading(true)
    const data = await getFinancialPeriods()
    setPeriods(data)
    setLoading(false)
  }

  async function handleCreate() {
    if (!createForm.name || !createForm.start_date || !createForm.end_date) {
      toast({ title: 'Error', description: 'All fields are required', variant: 'destructive' })
      return
    }
    try {
      const result = await createFinancialPeriod(createForm)
      if (result.success) {
        toast({ title: 'Created', description: 'Financial period created' })
        setShowCreateDialog(false)
        setCreateForm({ name: '', period_type: 'monthly', start_date: '', end_date: '' })
        loadPeriods()
      }
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' })
    }
  }

  async function handleClose(id: string, name: string) {
    if (!confirm(`Close period "${name}"?\n\nThis will:\n- Verify all entries are balanced\n- Create closing journal entries\n- Carry forward balances to retained earnings\n\nThis action cannot be undone.`)) return

    try {
      const result = await closeFinancialPeriod(id)
      toast({ title: 'Closed', description: result.message || `Period "${name}" closed` })
      loadPeriods()
    } catch (err) {
      toast({ title: 'Cannot Close', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' })
    }
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  const openPeriods = periods.filter(p => p.status === 'open')
  const closedPeriods = periods.filter(p => p.status === 'closed')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Calendar className="h-8 w-8 text-blue-500" />
            Financial Periods
          </h1>
          <p className="text-muted-foreground mt-1">Manage fiscal periods and close books</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadPeriods}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</Button>
          <Button onClick={() => setShowCreateDialog(true)}><Plus className="h-4 w-4 mr-2" /> New Period</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Open Periods</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-green-600">{openPeriods.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Closed Periods</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-gray-500">{closedPeriods.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Periods</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{periods.length}</div></CardContent>
        </Card>
      </div>

      {/* Periods Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Periods</CardTitle>
          <CardDescription>Fiscal periods — open periods can still receive journal entries</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Closed At</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {periods.map(period => (
                <TableRow key={period.id}>
                  <TableCell className="font-medium">{period.name}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{period.period_type}</Badge></TableCell>
                  <TableCell>{formatDate(period.start_date)}</TableCell>
                  <TableCell>{formatDate(period.end_date)}</TableCell>
                  <TableCell>
                    {period.status === 'open' ? (
                      <Badge className="bg-green-100 text-green-800">Open</Badge>
                    ) : (
                      <Badge variant="secondary"><Lock className="h-3 w-3 mr-1" /> Closed</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {period.created_at ? formatDate(period.created_at) : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {period.status === 'open' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleClose(period.id, period.name)}
                      >
                        <Lock className="h-4 w-4 mr-1" /> Close Period
                      </Button>
                    )}
                    {period.status === 'closed' && (
                      <CheckCircle className="h-4 w-4 text-green-500 inline" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {periods.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No financial periods yet. Create one to start tracking.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Financial Period</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Period Name</Label>
              <Input value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} placeholder="e.g. FY 2026 Q1" />
            </div>
            <div>
              <Label>Period Type</Label>
              <Select value={createForm.period_type} onValueChange={v => setCreateForm({ ...createForm, period_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date</Label>
                <Input type="date" value={createForm.start_date} onChange={e => setCreateForm({ ...createForm, start_date: e.target.value })} />
              </div>
              <div>
                <Label>End Date</Label>
                <Input type="date" value={createForm.end_date} onChange={e => setCreateForm({ ...createForm, end_date: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Create Period</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
