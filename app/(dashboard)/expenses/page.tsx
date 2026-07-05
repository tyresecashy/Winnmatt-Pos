'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
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
import { exportToCSV } from '@/lib/export-utils'
import {
  getExpenseCategories, createExpenseCategory, updateExpenseCategory, deleteExpenseCategory,
  getExpenses, createExpense, updateExpense, deleteExpense,
  approveExpense, getExpenseStats, getExpenseById,
  getRecurringExpenses, createRecurringExpense, toggleRecurringExpense, deleteRecurringExpense,
  type Expense, type ExpenseCategory, type ExpenseStats, type RecurringExpense,
} from '@/lib/expenses-actions'
import {
  Search, Plus, MoreHorizontal, Receipt, Coins, AlertCircle, CheckCircle, XCircle,
  TrendingUp, TrendingDown, Loader2, Edit3, Trash2, Eye, RotateCcw,
  Banknote, Calendar, Building2, FileText, Check, X, ArrowUpDown,
  RefreshCw, Wallet, Download,
} from 'lucide-react'

// ─── Icon mapping ────────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Zap: <ZapIcon />, Building2: <Building2 className="h-4 w-4" />,
  Users: <UsersIcon />, Package: <PackageIcon />,
  Wrench: <WrenchIcon />, Megaphone: <MegaphoneIcon />,
  Truck: <TruckIcon />, Shield: <ShieldIcon />,
  FileBadge: <FileBadgeIcon />, Banknote: <Banknote className="h-4 w-4" />,
  Monitor: <MonitorIcon />, MoreHorizontal: <MoreHorizontal className="h-4 w-4" />,
}

function ZapIcon() { return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10" /></svg> }
function UsersIcon() { return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg> }
function PackageIcon() { return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16.5 9.4 7.55 4.24" /><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.29 7 12 12 20.71 7" /><line x1="12" y1="22" x2="12" y2="12" /></svg> }
function WrenchIcon() { return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg> }
function MegaphoneIcon() { return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 11 18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></svg> }
function TruckIcon() { return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 18H3c-.6 0-1-.4-1-1V7c0-.6.4-1 1-1h10c.6 0 1 .4 1 1v11" /><path d="M14 9h4l4 4v4c0 .6-.4 1-1 1h-2" /><circle cx="7" cy="18" r="2.5" /><circle cx="17" cy="18" r="2.5" /></svg> }
function ShieldIcon() { return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg> }
function FileBadgeIcon() { return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><path d="M10 12h.01" /><path d="M14 12h.01" /><path d="M10 16h4" /></svg> }
function MonitorIcon() { return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg> }

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const { profile } = useAuth()
  const { toast } = useToast()

  // ── Data State ──
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [stats, setStats] = useState<ExpenseStats | null>(null)
  const [recurring, setRecurring] = useState<RecurringExpense[]>([])
  const [loading, setLoading] = useState(true)

  // ── UI State ──
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [activeTab, setActiveTab] = useState('all-expenses')

  // ── Dialog State ──
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState<Expense | null>(null)
  const [showDetailDialog, setShowDetailDialog] = useState<Expense | null>(null)
  const [showCategoriesDialog, setShowCategoriesDialog] = useState(false)
  const [showCategoryForm, setShowCategoryForm] = useState<ExpenseCategory | null>(null)
  const [showRecurringDialog, setShowRecurringDialog] = useState(false)
  const [showApproveDialog, setShowApproveDialog] = useState<Expense | null>(null)
  const [approveAction, setApproveAction] = useState<'approved' | 'rejected'>('approved')
  const [rejectionReason, setRejectionReason] = useState('')

  // ── Form State ──
  const emptyForm: {
    category_id: string
    amount_cents: number
    description: string
    vendor: string
    expense_date: string
    payment_method: string
    reference_number: string
    notes: string
    status: 'pending' | 'approved' | 'rejected'
  } = {
    category_id: '',
    amount_cents: 0,
    description: '',
    vendor: '',
    expense_date: new Date().toISOString().split('T')[0],
    payment_method: 'cash',
    reference_number: '',
    notes: '',
    status: 'approved',
  }
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  // ── Recurring Form ──
  const emptyRecurringForm = {
    category_id: '',
    amount_cents: 0,
    description: '',
    vendor: '',
    frequency: 'monthly' as const,
    next_date: new Date().toISOString().split('T')[0],
    payment_method: 'bank_transfer',
    notes: '',
  }
  const [recurringForm, setRecurringForm] = useState(emptyRecurringForm)
  const [recurringSaving, setRecurringSaving] = useState(false)

  const branchId = profile?.branch_id

  // ── Data Loading ──
  const loadData = useCallback(async () => {
    if (!branchId) return
    setLoading(true)
    try {
      const [cats, expResult, statsData, recData] = await Promise.all([
        getExpenseCategories(),
        getExpenses({ branchId, limit: 200 }),
        getExpenseStats(branchId),
        getRecurringExpenses(branchId),
      ])
      setCategories(cats)
      setExpenses(expResult.data)
      setTotalCount(expResult.total)
      setStats(statsData)
      setRecurring(recData)
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to load expenses', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [branchId, toast])

  useEffect(() => { void loadData() }, [loadData])

  // ── Filtered Expenses ──
  const filteredExpenses = useMemo(() => {
    let result = expenses
    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      result = result.filter(e =>
        e.description.toLowerCase().includes(q) ||
        (e.vendor || '').toLowerCase().includes(q) ||
        (e.reference_number || '').toLowerCase().includes(q)
      )
    }
    if (statusFilter !== 'all') result = result.filter(e => e.status === statusFilter)
    if (categoryFilter !== 'all') result = result.filter(e => e.category_id === categoryFilter)
    return result
  }, [expenses, searchTerm, statusFilter, categoryFilter])

  // ── Create/Edit Expense ──
  const handleSaveExpense = async () => {
    if (!branchId || !profile?.id) return
    if (!form.category_id || !form.description || form.amount_cents <= 0) {
      toast({ title: 'Validation', description: 'Category, description, and amount are required', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      if (showEditDialog) {
        const result = await updateExpense(showEditDialog.id, {
          category_id: form.category_id,
          amount_cents: form.amount_cents,
          description: form.description,
          vendor: form.vendor || null,
          expense_date: form.expense_date,
          payment_method: form.payment_method,
          reference_number: form.reference_number || null,
          notes: form.notes || null,
        })
        if (!result.success) throw new Error(result.error)
        toast({ title: 'Updated', description: 'Expense updated successfully' })
      } else {
        const result = await createExpense({
          branch_id: branchId,
          category_id: form.category_id,
          amount_cents: form.amount_cents,
          description: form.description,
          vendor: form.vendor || null,
          expense_date: form.expense_date,
          payment_method: form.payment_method,
          reference_number: form.reference_number || null,
          receipt_url: null,
          notes: form.notes || null,
          status: form.status,
          rejection_reason: null,
          created_by: profile.id,
          is_recurring: false,
          recurring_id: null,
        })
        if (!result.success) throw new Error(result.error)
        toast({ title: 'Created', description: 'Expense recorded successfully' })
      }
      setShowCreateDialog(false)
      setShowEditDialog(null)
      setForm(emptyForm)
      void loadData()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to save', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (expense: Expense) => {
    setForm({
      category_id: expense.category_id,
      amount_cents: expense.amount_cents,
      description: expense.description,
      vendor: expense.vendor || '',
      expense_date: expense.expense_date,
      payment_method: expense.payment_method,
      reference_number: expense.reference_number || '',
      notes: expense.notes || '',
      status: expense.status,
    })
    setShowEditDialog(expense)
  }

  const handleDelete = async (id: string) => {
    const result = await deleteExpense(id)
    if (result.success) {
      toast({ title: 'Deleted', description: 'Expense deleted' })
      void loadData()
    } else {
      toast({ title: 'Error', description: result.error || 'Failed to delete', variant: 'destructive' })
    }
  }

  const handleApprove = async () => {
    if (!showApproveDialog) return
    const result = await approveExpense(showApproveDialog.id, approveAction, rejectionReason)
    if (result.success) {
      toast({ title: approveAction === 'approved' ? 'Approved' : 'Rejected', description: `Expense ${approveAction}` })
      setShowApproveDialog(null)
      setRejectionReason('')
      void loadData()
    } else {
      toast({ title: 'Error', description: result.error || 'Failed', variant: 'destructive' })
    }
  }

  const handleExportExpenses = () => {
    const rows = filteredExpenses.map(e => ({
      Date: new Date(e.expense_date).toLocaleDateString('en-KE'),
      Description: e.description,
      Category: e.category?.name || '',
      Vendor: e.vendor || '',
      Amount_KSh: e.amount_cents,
      Status: e.status,
      Payment_Method: e.payment_method,
      Reference: e.reference_number || '',
    }))
    exportToCSV(rows, `expenses-export-${new Date().toISOString().split('T')[0]}`)
    toast({ title: 'Exported', description: `${rows.length} expenses exported to CSV` })
  }

  // ── Category Management ──
  const handleSaveCategory = async () => {
    if (!showCategoryForm) return
    if (!showCategoryForm.name) {
      toast({ title: 'Error', description: 'Category name required', variant: 'destructive' })
      return
    }
    const result = showCategoryForm.id
      ? await updateExpenseCategory(showCategoryForm.id, {
          name: showCategoryForm.name,
          description: showCategoryForm.description,
          color: showCategoryForm.color,
          icon: showCategoryForm.icon,
        })
      : await createExpenseCategory({
          name: showCategoryForm.name,
          description: showCategoryForm.description || null,
          color: showCategoryForm.color || '#6366f1',
          icon: showCategoryForm.icon || 'Receipt',
        })

    if (result) {
      toast({ title: showCategoryForm.id ? 'Updated' : 'Created', description: 'Category saved' })
      setShowCategoryForm(null)
      const cats = await getExpenseCategories()
      setCategories(cats)
    } else {
      toast({ title: 'Error', description: 'Failed to save category', variant: 'destructive' })
    }
  }

  // ── Recurring ──
  const handleSaveRecurring = async () => {
    if (!branchId || !profile?.id) return
    if (!recurringForm.category_id || !recurringForm.description || recurringForm.amount_cents <= 0) {
      toast({ title: 'Validation', description: 'Category, description, and amount required', variant: 'destructive' })
      return
    }
    setRecurringSaving(true)
    try {
      const result = await createRecurringExpense({
        branch_id: branchId,
        category_id: recurringForm.category_id,
        amount_cents: recurringForm.amount_cents,
        description: recurringForm.description,
        vendor: recurringForm.vendor || null,
        frequency: recurringForm.frequency,
        next_date: recurringForm.next_date,
        end_date: null,
        payment_method: recurringForm.payment_method,
        notes: recurringForm.notes || null,
        is_active: true,
        created_by: profile.id,
      })
      if (!result.success) throw new Error(result.error)
      toast({ title: 'Created', description: 'Recurring expense set up' })
      setShowRecurringDialog(false)
      setRecurringForm(emptyRecurringForm)
      void loadData()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' })
    } finally {
      setRecurringSaving(false)
    }
  }

  // ── Render ──
  if (!branchId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Wallet className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <h2 className="text-lg font-semibold">No Branch Selected</h2>
          <p className="text-sm text-muted-foreground mt-1">Select a branch to manage expenses.</p>
        </div>
      </div>
    )
  }

  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'admin'

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Expenses</h1>
          <p className="text-sm text-muted-foreground">Track and manage operational expenses</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button variant="outline" onClick={() => setShowCategoriesDialog(true)}>
              <Edit3 className="h-4 w-4 mr-2" />
              Categories
            </Button>
          )}
          <Button variant="outline" onClick={() => setShowRecurringDialog(true)}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Recurring
          </Button>
          <Button onClick={() => { setForm(emptyForm); setShowCreateDialog(true) }}>
            <Plus className="h-4 w-4 mr-2" />
            Record Expense
          </Button>
          <Button variant="outline" onClick={handleExportExpenses}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <Card key={i}><CardContent className="pt-6"><Skeleton className="h-8 w-24" /></CardContent></Card>)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
                <Coins className="h-3 w-3" /> Total Expenses (12mo)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatKSh(stats?.total_expenses_cents || 0)}</p>
              <p className="text-xs text-muted-foreground">{stats?.expense_count || 0} transactions</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> Monthly Avg
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {formatKSh(stats?.monthly_totals.length
                  ? Math.round(stats.total_expenses_cents / stats.monthly_totals.length)
                  : 0)}
              </p>
              <p className="text-xs text-muted-foreground">across {stats?.monthly_totals.length || 0} months</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Pending Approval
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${(stats?.pending_count || 0) > 0 ? 'text-amber-600' : ''}`}>
                {stats?.pending_count || 0}
              </p>
              <p className="text-xs text-muted-foreground">awaiting review</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
                <Building2 className="h-3 w-3" /> Categories
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{categories.length}</p>
              <p className="text-xs text-muted-foreground">expense categories</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all-expenses">All Expenses</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="recurring">Recurring</TabsTrigger>
        </TabsList>

        {/* ── ALL EXPENSES TAB ── */}
        <TabsContent value="all-expenses" className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search expenses..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="space-y-3 p-4">
                  {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : filteredExpenses.length === 0 ? (
                <div className="text-center py-12">
                  <Wallet className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground">No expenses found</p>
                  <Button variant="outline" className="mt-3" onClick={() => setShowCreateDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" /> Record First Expense
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExpenses.map(expense => (
                      <TableRow key={expense.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setShowDetailDialog(expense)}>
                        <TableCell className="text-sm whitespace-nowrap">
                          {new Date(expense.expense_date).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </TableCell>
                        <TableCell className="font-medium max-w-[200px] truncate">{expense.description}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="text-xs gap-1"
                            style={{ borderColor: expense.category?.color || '#e2e8f0', color: expense.category?.color }}
                          >
                            {expense.category?.name || 'Uncategorized'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{expense.vendor || '—'}</TableCell>
                        <TableCell className="font-mono font-medium">{formatKSh(expense.amount_cents)}</TableCell>
                        <TableCell>
                          <StatusBadge status={expense.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setShowDetailDialog(expense) }}>
                                <Eye className="h-4 w-4 mr-2" /> View Details
                              </DropdownMenuItem>
                              {isAdmin && expense.status !== 'approved' && expense.status !== 'rejected' && (
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setShowApproveDialog(expense); setApproveAction('approved') }}>
                                  <CheckCircle className="h-4 w-4 mr-2 text-green-600" /> Approve
                                </DropdownMenuItem>
                              )}
                              {isAdmin && expense.status !== 'rejected' && (
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setShowApproveDialog(expense); setApproveAction('rejected') }}>
                                  <XCircle className="h-4 w-4 mr-2 text-red-600" /> Reject
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(expense) }}>
                                <Edit3 className="h-4 w-4 mr-2" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={(e) => { e.stopPropagation(); handleDelete(expense.id) }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ANALYTICS TAB ── */}
        <TabsContent value="analytics" className="space-y-4">
          {loading ? (
            <div className="grid grid-cols-2 gap-4">
              {[1,2].map(i => <Card key={i}><CardContent className="pt-6"><Skeleton className="h-48 w-full" /></CardContent></Card>)}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {/* Category Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Expense by Category</CardTitle>
                  <CardDescription>Breakdown of approved expenses</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 max-h-[400px] overflow-y-auto">
                  {(stats?.category_breakdown || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">No approved expenses yet</p>
                  ) : (
                    (stats?.category_breakdown || []).map(cat => (
                      <div key={cat.category_name} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                            <span className="truncate">{cat.category_name}</span>
                          </div>
                          <span className="font-medium shrink-0 ml-2">{formatKSh(cat.total_cents)}</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full transition-all"
                            style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>{cat.count} transactions</span>
                          <span>{cat.percentage}%</span>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Monthly Trend */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Monthly Trend</CardTitle>
                  <CardDescription>Approved expenses by month</CardDescription>
                </CardHeader>
                <CardContent>
                  {(stats?.monthly_totals || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">No data yet</p>
                  ) : (
                    <div className="space-y-2">
                      {stats?.monthly_totals.slice(0, 12).map(m => {
                        const maxTotal = Math.max(...(stats?.monthly_totals || []).map(x => x.total_cents), 1)
                        const heightPct = (m.total_cents / maxTotal) * 100
                        return (
                          <div key={`${m.year}-${m.month}`} className="flex items-center gap-3 text-sm">
                            <span className="w-16 text-muted-foreground text-xs">{m.month_name} {String(m.year).slice(2)}</span>
                            <div className="flex-1 bg-muted rounded-full h-5 relative overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all"
                                style={{ width: `${Math.max(heightPct, 2)}%` }}
                              />
                            </div>
                            <span className="w-28 text-right font-mono text-xs">{formatKSh(m.total_cents)}</span>
                            <span className="w-12 text-right text-[10px] text-muted-foreground">{m.expense_count}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Top Vendors */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Top Vendors</CardTitle>
                  <CardDescription>By total spend</CardDescription>
                </CardHeader>
                <CardContent>
                  {(stats?.top_vendors || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">No vendor data yet</p>
                  ) : (
                    <div className="space-y-2">
                      {stats?.top_vendors.map(v => (
                        <div key={v.vendor} className="flex items-center justify-between text-sm">
                          <span className="truncate flex-1">{v.vendor}</span>
                          <span className="font-mono text-xs mx-2">{formatKSh(v.total_cents)}</span>
                          <span className="text-[10px] text-muted-foreground">({v.count}x)</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Approved</span>
                    <span className="font-medium">{stats?.approved_count || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Pending Approval</span>
                    <span className="font-medium text-amber-600">{stats?.pending_count || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Rejected</span>
                    <span className="font-medium text-red-600">{stats?.rejected_count || 0}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Categories Used</span>
                    <span className="font-medium">{stats?.category_breakdown.length || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Active Recurring</span>
                    <span className="font-medium">{recurring.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Top Category</span>
                    <span className="font-medium truncate max-w-[150px]">
                      {stats?.category_breakdown[0]?.category_name || '—'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ── RECURRING TAB ── */}
        <TabsContent value="recurring">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm">Recurring Expenses</CardTitle>
                <CardDescription>Automatically generate expenses on schedule</CardDescription>
              </div>
              <Button size="sm" onClick={() => setShowRecurringDialog(true)}>
                <Plus className="h-4 w-4 mr-2" /> Add Recurring
              </Button>
            </CardHeader>
            <CardContent>
              {recurring.length === 0 ? (
                <div className="text-center py-12">
                  <RefreshCw className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground">No recurring expenses set up</p>
                  <Button variant="outline" className="mt-3" onClick={() => setShowRecurringDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" /> Set Up Recurring
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {recurring.map(rec => (
                    <div key={rec.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="rounded-full p-2 shrink-0" style={{ backgroundColor: (rec.category?.color || '#6366f1') + '20' }}>
                          <RefreshCw className="h-4 w-4" style={{ color: rec.category?.color || '#6366f1' }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{rec.description}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline" className="text-[10px]">{rec.frequency}</Badge>
                            <span>{rec.vendor || '—'}</span>
                            <span>Next: {new Date(rec.next_date).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-mono font-medium">{formatKSh(rec.amount_cents)}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={async () => {
                            const r = await toggleRecurringExpense(rec.id, !rec.is_active)
                            if (r.success) void loadData()
                          }}
                        >
                          {rec.is_active ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive"
                          onClick={async () => {
                            const r = await deleteRecurringExpense(rec.id)
                            if (r.success) { toast({ title: 'Deleted' }); void loadData() }
                            else { toast({ title: 'Error', description: r.error, variant: 'destructive' }) }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* CREATE / EDIT EXPENSE DIALOG */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <Dialog open={showCreateDialog || !!showEditDialog} onOpenChange={(open) => {
        if (!open) { setShowCreateDialog(false); setShowEditDialog(null); setForm(emptyForm) }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{showEditDialog ? 'Edit Expense' : 'Record Expense'}</DialogTitle>
            <DialogDescription>
              {showEditDialog ? 'Update the expense details' : 'Enter the details of the expense'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={form.category_id} onValueChange={(v) => setForm(p => ({ ...p, category_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount (KSh) *</Label>
              <Input
                type="number" min={0} placeholder="0"
                value={form.amount_cents > 0 ? String(form.amount_cents) : ''}
                onChange={(e) => setForm(p => ({ ...p, amount_cents: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Description *</Label>
              <Input
                placeholder="What was this expense for?"
                value={form.description}
                onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={form.expense_date}
                onChange={(e) => setForm(p => ({ ...p, expense_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={form.payment_method} onValueChange={(v) => setForm(p => ({ ...p, payment_method: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                  <SelectItem value="mpesa">M-Pesa</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Vendor</Label>
              <Input
                placeholder="Vendor name"
                value={form.vendor}
                onChange={(e) => setForm(p => ({ ...p, vendor: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Reference #</Label>
              <Input
                placeholder="Invoice or receipt #"
                value={form.reference_number}
                onChange={(e) => setForm(p => ({ ...p, reference_number: e.target.value }))}
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Additional notes..."
                value={form.notes}
                onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))}
                rows={2}
              />
            </div>
            {!showEditDialog && (
              <div className="space-y-2 col-span-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm(p => ({ ...p, status: v as 'pending' | 'approved' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">Approved (immediate)</SelectItem>
                    <SelectItem value="pending">Pending Approval</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); setShowEditDialog(null); setForm(emptyForm) }}>
              Cancel
            </Button>
            <Button onClick={handleSaveExpense} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : (showEditDialog ? 'Update' : 'Save Expense')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* EXPENSE DETAIL DIALOG */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <Dialog open={!!showDetailDialog} onOpenChange={(open) => { if (!open) setShowDetailDialog(null) }}>
        <DialogContent className="sm:max-w-md">
          {showDetailDialog && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-muted-foreground" />
                  Expense Details
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{showDetailDialog.description}</h3>
                    <p className="text-sm text-muted-foreground">{showDetailDialog.vendor || 'No vendor'}</p>
                  </div>
                  <StatusBadge status={showDetailDialog.status} size="lg" />
                </div>

                <div className="rounded-lg bg-muted/30 p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-bold text-xl">{formatKSh(showDetailDialog.amount_cents)}</span>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Category</span><p className="font-medium">{showDetailDialog.category?.name || '—'}</p></div>
                    <div><span className="text-muted-foreground">Date</span><p className="font-medium">{new Date(showDetailDialog.expense_date).toLocaleDateString()}</p></div>
                    <div><span className="text-muted-foreground">Payment</span><p className="font-medium capitalize">{showDetailDialog.payment_method}</p></div>
                    <div><span className="text-muted-foreground">Reference</span><p className="font-medium">{showDetailDialog.reference_number || '—'}</p></div>
                  </div>
                  {showDetailDialog.notes && (
                    <>
                      <Separator />
                      <div className="text-sm">
                        <span className="text-muted-foreground">Notes</span>
                        <p className="mt-1">{showDetailDialog.notes}</p>
                      </div>
                    </>
                  )}
                </div>

                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Recorded by: {showDetailDialog.creator?.full_name || 'Unknown'}</p>
                  {showDetailDialog.approved_by && (
                    <p>Approved by: {showDetailDialog.approver?.full_name || 'Unknown'} {showDetailDialog.approved_at ? `on ${new Date(showDetailDialog.approved_at).toLocaleString()}` : ''}</p>
                  )}
                  {showDetailDialog.rejection_reason && (
                    <p className="text-red-600">Rejection reason: {showDetailDialog.rejection_reason}</p>
                  )}
                  <p>Created: {new Date(showDetailDialog.created_at).toLocaleString()}</p>
                </div>

                {isAdmin && showDetailDialog.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={() => { setShowDetailDialog(null); setShowApproveDialog(showDetailDialog); setApproveAction('approved') }}
                    >
                      <Check className="h-4 w-4 mr-2" /> Approve
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => { setShowDetailDialog(null); setShowApproveDialog(showDetailDialog); setApproveAction('rejected') }}
                    >
                      <X className="h-4 w-4 mr-2" /> Reject
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* APPROVE / REJECT DIALOG */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <Dialog open={!!showApproveDialog} onOpenChange={(open) => { if (!open) { setShowApproveDialog(null); setRejectionReason('') } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {approveAction === 'approved' ? (
                <><CheckCircle className="h-5 w-5 text-green-600" /> Approve Expense</>
              ) : (
                <><XCircle className="h-5 w-5 text-red-600" /> Reject Expense</>
              )}
            </DialogTitle>
            <DialogDescription>
              {showApproveDialog?.description} &middot; {showApproveDialog ? formatKSh(showApproveDialog.amount_cents) : ''}
            </DialogDescription>
          </DialogHeader>
          {approveAction === 'rejected' && (
            <div className="space-y-2 py-2">
              <Label>Reason for rejection *</Label>
              <Textarea
                placeholder="Explain why this expense is rejected..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
              />
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowApproveDialog(null); setRejectionReason('') }}>Cancel</Button>
            <Button
              variant={approveAction === 'approved' ? 'default' : 'destructive'}
              onClick={handleApprove}
              disabled={approveAction === 'rejected' && !rejectionReason.trim()}
            >
              {approveAction === 'approved' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* CATEGORIES MANAGEMENT DIALOG */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <Dialog open={showCategoriesDialog} onOpenChange={setShowCategoriesDialog}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Expense Categories</DialogTitle>
            <DialogDescription>Manage expense categories used across the branch</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-2">
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: cat.color + '20' }}>
                    <span style={{ color: cat.color }}>{CATEGORY_ICONS[cat.icon] || <Receipt className="h-4 w-4" />}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{cat.name}</p>
                    {cat.description && <p className="text-xs text-muted-foreground">{cat.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost" size="sm" className="h-8 w-8 p-0"
                    onClick={() => {
                      setShowCategoryForm(cat)
                    }}
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive"
                    onClick={async () => {
                      const r = await deleteExpenseCategory(cat.id)
                      if (r.success) {
                        toast({ title: 'Deleted' })
                        setCategories(await getExpenseCategories())
                      } else {
                        toast({ title: 'Error', description: r.error, variant: 'destructive' })
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t pt-4">
            <Button onClick={() => setShowCategoryForm({ id: '', name: '', description: '', color: '#6366f1', icon: 'Receipt', sort_order: 0, is_active: true, created_at: '' })}>
              <Plus className="h-4 w-4 mr-2" /> Add Category
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Category Form (sub-dialog) ── */}
      <Dialog open={!!showCategoryForm && showCategoriesDialog} onOpenChange={(open) => { if (!open) setShowCategoryForm(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{showCategoryForm?.id ? 'Edit Category' : 'New Category'}</DialogTitle>
          </DialogHeader>
          {showCategoryForm && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={showCategoryForm.name}
                  onChange={(e) => setShowCategoryForm(p => p ? { ...p, name: e.target.value } : null)}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={showCategoryForm.description || ''}
                  onChange={(e) => setShowCategoryForm(p => p ? { ...p, description: e.target.value } : null)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Color</Label>
                  <Input
                    type="color"
                    value={showCategoryForm.color}
                    onChange={(e) => setShowCategoryForm(p => p ? { ...p, color: e.target.value } : null)}
                    className="h-9 p-1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Icon</Label>
                  <Select
                    value={showCategoryForm.icon}
                    onValueChange={(v) => setShowCategoryForm(p => p ? { ...p, icon: v } : null)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['Receipt', 'Zap', 'Building2', 'Users', 'Package', 'Wrench', 'Megaphone', 'Truck', 'Shield', 'FileBadge', 'Banknote', 'Monitor', 'MoreHorizontal'].map(icon => (
                        <SelectItem key={icon} value={icon}>{icon}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCategoryForm(null)}>Cancel</Button>
                <Button onClick={handleSaveCategory}>Save</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* RECURRING EXPENSE DIALOG */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <Dialog open={showRecurringDialog} onOpenChange={(open) => { if (!open) { setShowRecurringDialog(false); setRecurringForm(emptyRecurringForm) } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set Up Recurring Expense</DialogTitle>
            <DialogDescription>Automatically create expenses on a schedule</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-2 col-span-2">
              <Label>Description *</Label>
              <Input
                placeholder="e.g. Monthly rent, Internet bill"
                value={recurringForm.description}
                onChange={(e) => setRecurringForm(p => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={recurringForm.category_id} onValueChange={(v) => setRecurringForm(p => ({ ...p, category_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount (KSh) *</Label>
              <Input
                type="number" min={0} placeholder="0"
                value={recurringForm.amount_cents > 0 ? String(recurringForm.amount_cents) : ''}
                onChange={(e) => setRecurringForm(p => ({ ...p, amount_cents: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select value={recurringForm.frequency} onValueChange={(v) => setRecurringForm(p => ({ ...p, frequency: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Next Date</Label>
              <Input
                type="date"
                value={recurringForm.next_date}
                onChange={(e) => setRecurringForm(p => ({ ...p, next_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Vendor</Label>
              <Input
                placeholder="Vendor name"
                value={recurringForm.vendor}
                onChange={(e) => setRecurringForm(p => ({ ...p, vendor: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={recurringForm.payment_method} onValueChange={(v) => setRecurringForm(p => ({ ...p, payment_method: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="mpesa">M-Pesa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Notes</Label>
              <Input
                placeholder="Optional notes"
                value={recurringForm.notes}
                onChange={(e) => setRecurringForm(p => ({ ...p, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowRecurringDialog(false); setRecurringForm(emptyRecurringForm) }}>Cancel</Button>
            <Button onClick={handleSaveRecurring} disabled={recurringSaving}>
              {recurringSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : 'Set Up'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status, size }: { status: string; size?: 'sm' | 'lg' }) {
  const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    approved: { label: 'Approved', variant: 'default' },
    pending: { label: 'Pending', variant: 'secondary' },
    rejected: { label: 'Rejected', variant: 'destructive' },
  }
  const c = config[status] || { label: status, variant: 'outline' as const }
  return <Badge variant={c.variant} className={size === 'lg' ? 'px-3 py-1' : ''}>{c.label}</Badge>
}
