'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/components/ui/use-toast'
import { formatKSh } from '@/lib/currency'
import {
  getJournalEntries, getJournalEntry, createJournalEntry, voidJournalEntry,
  getAccounts,
  type JournalEntry, type JournalEntryLine, type Account,
} from '@/lib/finance-actions'
import {
  BookOpen, Plus, MoreHorizontal, Search, Loader2, Eye, XCircle,
  FileText, Calendar, ArrowUpDown, RefreshCw, Filter, ChevronDown,
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  posted: 'Posted',
  voided: 'Voided',
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  posted: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  voided: 'bg-red-100 text-red-700 border-red-200',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GeneralLedgerPage() {
  const { toast } = useToast()

  // ── Data State ──
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')

  // ── UI State ──
  const [searchTerm, setSearchTerm] = useState('')
  const [showDetail, setShowDetail] = useState(false)
  const [detailEntry, setDetailEntry] = useState<JournalEntry | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [saving, setSaving] = useState(false)

  // ── Create Form ──
  const [createForm, setCreateForm] = useState({
    entry_date: new Date().toISOString().split('T')[0],
    description: '',
    notes: '',
    lines: [
      { account_id: '', debit: '', credit: '', description: '' },
      { account_id: '', debit: '', credit: '', description: '' },
    ] as Array<{ account_id: string; debit: string; credit: string; description: string }>,
  })

  // ── Date Filters ──
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // ── Load Data ──
  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [entriesData, accountsData] = await Promise.all([
        getJournalEntries({
          startDate: dateFrom || undefined,
          endDate: dateTo || undefined,
          limit: 200,
        }),
        getAccounts(),
      ])
      setEntries(entriesData)
      setAccounts(accountsData)
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast, dateFrom, dateTo])

  useEffect(() => { loadData() }, [loadData])

  // ── Filtered Entries ──
  const filteredEntries = useMemo(() => {
    let result = entries
    if (activeTab !== 'all') {
      result = result.filter(e => e.status === activeTab)
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(e =>
        e.entry_number.toLowerCase().includes(term) ||
        e.description.toLowerCase().includes(term)
      )
    }
    return result
  }, [entries, activeTab, searchTerm])

  // ── Open Detail ──
  const openDetail = async (entry: JournalEntry) => {
    setLoadingDetail(true)
    setShowDetail(true)
    try {
      const detail = await getJournalEntry(entry.id)
      setDetailEntry(detail)
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setLoadingDetail(false)
    }
  }

  // ── Void Entry ──
  const handleVoid = async (entry: JournalEntry) => {
    const reason = prompt(`Enter reason for voiding ${entry.entry_number}:`)
    if (!reason) return

    try {
      await voidJournalEntry(entry.id, reason)
      toast({ title: 'Entry voided' })
      loadData()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    }
  }

  // ── Add Line to Create Form ──
  const addLine = () => {
    setCreateForm(f => ({
      ...f,
      lines: [...f.lines, { account_id: '', debit: '', credit: '', description: '' }],
    }))
  }

  // ── Remove Line from Create Form ──
  const removeLine = (index: number) => {
    if (createForm.lines.length <= 2) return
    setCreateForm(f => ({
      ...f,
      lines: f.lines.filter((_, i) => i !== index),
    }))
  }

  // ── Update Line ──
  const updateLine = (index: number, field: string, value: string) => {
    setCreateForm(f => ({
      ...f,
      lines: f.lines.map((line, i) =>
        i === index ? { ...line, [field]: value } : line
      ),
    }))
  }

  // ── Calculate Totals ──
  const totalDebit = createForm.lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0)
  const totalCredit = createForm.lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0)
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01

  // ── Create Journal Entry ──
  const handleCreate = async () => {
    if (!createForm.description) {
      toast({ title: 'Validation', description: 'Description is required', variant: 'destructive' })
      return
    }

    if (!isBalanced) {
      toast({ title: 'Validation', description: 'Debits must equal credits', variant: 'destructive' })
      return
    }

    const validLines = createForm.lines.filter(l => l.account_id && (parseFloat(l.debit) || parseFloat(l.credit)))
    if (validLines.length < 2) {
      toast({ title: 'Validation', description: 'At least 2 lines required', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      await createJournalEntry({
        entry_date: createForm.entry_date,
        description: createForm.description,
        notes: createForm.notes || undefined,
        lines: validLines.map(l => ({
          account_id: l.account_id,
          debit: parseFloat(l.debit) || 0,
          credit: parseFloat(l.credit) || 0,
          description: l.description || undefined,
        })),
      })
      toast({ title: 'Journal entry created' })
      setShowCreateDialog(false)
      setCreateForm({
        entry_date: new Date().toISOString().split('T')[0],
        description: '',
        notes: '',
        lines: [
          { account_id: '', debit: '', credit: '', description: '' },
          { account_id: '', debit: '', credit: '', description: '' },
        ],
      })
      loadData()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // ── Loading State ──
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72 mt-1" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <Card>
          <CardContent className="p-4">
            <Skeleton className="h-[400px] w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            General Ledger
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            View and manage journal entries across your business
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New Entry
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Entries</p>
            <p className="text-2xl font-bold">{entries.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Posted</p>
            <p className="text-2xl font-bold text-emerald-600">
              {entries.filter(e => e.status === 'posted').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Draft</p>
            <p className="text-2xl font-bold text-slate-600">
              {entries.filter(e => e.status === 'draft').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Voided</p>
            <p className="text-2xl font-bold text-red-600">
              {entries.filter(e => e.status === 'voided').length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="posted">Posted</TabsTrigger>
            <TabsTrigger value="draft">Draft</TabsTrigger>
            <TabsTrigger value="voided">Voided</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="pl-9 w-36"
              placeholder="From"
            />
          </div>
          <span className="text-muted-foreground">to</span>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="pl-9 w-36"
              placeholder="To"
            />
          </div>
        </div>

        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search entries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Entries Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Entry #</TableHead>
                <TableHead className="w-28">Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-24">Reference</TableHead>
                <TableHead className="w-28 text-right">Debit</TableHead>
                <TableHead className="w-28 text-right">Credit</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No journal entries found
                  </TableCell>
                </TableRow>
              ) : (
                filteredEntries.map((entry) => (
                  <TableRow key={entry.id} className="group cursor-pointer hover:bg-muted/50" onClick={() => openDetail(entry)}>
                    <TableCell className="font-mono font-medium">{entry.entry_number}</TableCell>
                    <TableCell>{new Date(entry.entry_date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <p className="font-medium truncate max-w-[300px]">{entry.description}</p>
                      {entry.lines && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {entry.lines.length} line{(entry.lines.length || 0) !== 1 ? 's' : ''}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {entry.reference_type ? `${entry.reference_type}` : '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {entry.total_debit > 0 ? formatKSh(entry.total_debit) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {entry.total_credit > 0 ? formatKSh(entry.total_credit) : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_COLORS[entry.status]}>
                        {STATUS_LABELS[entry.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openDetail(entry) }}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          {entry.status === 'posted' && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={(e) => { e.stopPropagation(); handleVoid(entry) }}
                                className="text-red-600"
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Void Entry
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {detailEntry?.entry_number || 'Journal Entry'}
            </DialogTitle>
            <DialogDescription>{detailEntry?.description}</DialogDescription>
          </DialogHeader>

          {loadingDetail ? (
            <div className="py-8 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : detailEntry ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Date</p>
                  <p className="font-medium">{new Date(detailEntry.entry_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge variant="outline" className={STATUS_COLORS[detailEntry.status]}>
                    {STATUS_LABELS[detailEntry.status]}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Reference</p>
                  <p className="font-medium capitalize">{detailEntry.reference_type || '-'}</p>
                </div>
              </div>

              {detailEntry.notes && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm">{detailEntry.notes}</p>
                </div>
              )}

              <Separator />

              <div>
                <p className="text-sm font-medium mb-2">Journal Entry Lines</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead className="text-right w-28">Debit</TableHead>
                      <TableHead className="text-right w-28">Credit</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailEntry.lines?.map((line: JournalEntryLine) => (
                      <TableRow key={line.id}>
                        <TableCell className="text-muted-foreground">{line.line_number}</TableCell>
                        <TableCell>
                          <p className="font-medium">{(line.account as any)?.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {(line.account as any)?.account_number}
                          </p>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {line.debit > 0 ? formatKSh(line.debit) : ''}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {line.credit > 0 ? formatKSh(line.credit) : ''}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {line.description || ''}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold border-t-2">
                      <TableCell colSpan={2}>Total</TableCell>
                      <TableCell className="text-right">{formatKSh(detailEntry.total_debit)}</TableCell>
                      <TableCell className="text-right">{formatKSh(detailEntry.total_credit)}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Create Entry Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Journal Entry</DialogTitle>
            <DialogDescription>
              Create a new journal entry. Debits must equal credits.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Entry Date *</Label>
                <Input
                  type="date"
                  value={createForm.entry_date}
                  onChange={(e) => setCreateForm(f => ({ ...f, entry_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Description *</Label>
                <Input
                  placeholder="e.g. Office rent payment"
                  value={createForm.description}
                  onChange={(e) => setCreateForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                placeholder="Optional notes"
                value={createForm.notes}
                onChange={(e) => setCreateForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>

            <Separator />

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Journal Entry Lines</Label>
                <Button variant="outline" size="sm" onClick={addLine}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add Line
                </Button>
              </div>

              <div className="space-y-2">
                {createForm.lines.map((line, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-4">
                      <Select
                        value={line.account_id}
                        onValueChange={(v) => updateLine(index, 'account_id', v)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Account" />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map((acc) => (
                            <SelectItem key={acc.id} value={acc.id}>
                              {acc.account_number} - {acc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Input
                        placeholder="Debit"
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.debit}
                        onChange={(e) => updateLine(index, 'debit', e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        placeholder="Credit"
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.credit}
                        onChange={(e) => updateLine(index, 'credit', e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="col-span-3">
                      <Input
                        placeholder="Description"
                        value={line.description}
                        onChange={(e) => updateLine(index, 'description', e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="col-span-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => removeLine(index)}
                        disabled={createForm.lines.length <= 2}
                      >
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-8 mt-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Total Debit: </span>
                  <span className="font-bold">{formatKSh(totalDebit)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Credit: </span>
                  <span className="font-bold">{formatKSh(totalCredit)}</span>
                </div>
                <div>
                  {isBalanced ? (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                      Balanced
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                      Unbalanced
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving || !isBalanced}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Create Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
