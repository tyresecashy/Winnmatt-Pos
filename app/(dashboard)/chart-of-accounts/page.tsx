'use client'

import { startTransition, useCallback, useEffect, useMemo, useState } from 'react'
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
  getAccounts, getAccountsByType, createAccount, updateAccount, deleteAccount,
  getAccountBalances, getFinanceStats,
  type Account,
} from '@/lib/modules/finance'
import {
  BookOpen, Plus, MoreHorizontal, Search, Loader2, Edit3, Trash2,
  Landmark, CreditCard, Wallet, TrendingUp, TrendingDown, ArrowUpDown,
  Eye, RefreshCw, DollarSign, Building2,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  asset: 'Asset',
  liability: 'Liability',
  equity: 'Equity',
  revenue: 'Revenue',
  expense: 'Expense',
  cogs: 'Cost of Goods Sold',
}

const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  asset: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  liability: 'bg-red-100 text-red-700 border-red-200',
  equity: 'bg-purple-100 text-purple-700 border-purple-200',
  revenue: 'bg-blue-100 text-blue-700 border-blue-200',
  expense: 'bg-amber-100 text-amber-700 border-amber-200',
  cogs: 'bg-orange-100 text-orange-700 border-orange-200',
}

const ACCOUNT_TYPE_ICONS: Record<string, React.ReactNode> = {
  asset: <Landmark className="h-4 w-4" />,
  liability: <CreditCard className="h-4 w-4" />,
  equity: <Wallet className="h-4 w-4" />,
  revenue: <TrendingUp className="h-4 w-4" />,
  expense: <TrendingDown className="h-4 w-4" />,
  cogs: <DollarSign className="h-4 w-4" />,
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChartOfAccountsPage() {
  const { toast } = useToast()

  // ── Data State ──
  const [accounts, setAccounts] = useState<Account[]>([])
  const [balances, setBalances] = useState<{
    account_id: string
    account_number: string
    name: string
    account_type: string
    normal_balance: string
    balance: number
  }[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<{
    totalRevenue: number
    totalExpenses: number
    netProfit: number
    cashPosition: number
    accountsReceivable: number
    accountsPayable: number
    inventoryValue: number
    monthlyEntries: number
  } | null>(null)
  const [activeTab, setActiveTab] = useState('all')

  // ── UI State ──
  const [searchTerm, setSearchTerm] = useState('')
  const [showDialog, setShowDialog] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [saving, setSaving] = useState(false)

  // ── Form State ──
  const [form, setForm] = useState({
    account_number: '',
    name: '',
    description: '',
    account_type: 'asset',
    account_subtype: '',
    normal_balance: 'debit',
  })

  // ── Load Data ──
  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const end = new Date().toISOString()
      const start = new Date(Date.now() - 90 * 86400000).toISOString()
      const [accountsData, balancesData, statsData] = await Promise.all([
        getAccounts(),
        getAccountBalances(),
        getFinanceStats(start, end),
      ])
      setAccounts(accountsData)
      setBalances(balancesData.map(b => ({
        account_id: b.id,
        account_number: b.code,
        name: b.name,
        account_type: b.account_type,
        normal_balance: 'debit',
        balance: b.balance,
      })))
      setStats({
        totalRevenue: statsData.totalRevenue,
        totalExpenses: statsData.totalExpenses,
        netProfit: statsData.netIncome,
        cashPosition: statsData.cashBalance,
        accountsReceivable: statsData.accountReceivable,
        accountsPayable: statsData.accountPayable,
        inventoryValue: 0,
        monthlyEntries: 0,
      })
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { startTransition(() => { loadData() }) }, [loadData])

  // ── Filtered Accounts ──
  const filteredAccounts = useMemo(() => {
    let result = accounts
    if (activeTab !== 'all') {
      result = result.filter(a => a.account_type === activeTab)
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(a => {
        const acct = a as unknown as { account_number?: string; code?: string }
        return (
          (acct.account_number || acct.code || '').toLowerCase().includes(term) ||
          a.name.toLowerCase().includes(term) ||
          (a.description || '').toLowerCase().includes(term)
        )
      })
    }
    return result
  }, [accounts, activeTab, searchTerm])

  // ── Balance lookup ──
  const getBalance = (accountId: string) => {
    const b = balances.find(b => b.account_id === accountId)
    return b?.balance || 0
  }

  // ── Stats per type ──
  const typeStats = useMemo(() => {
    const result: Record<string, number> = {}
    for (const b of balances) {
      const type = b.account_type
      result[type] = (result[type] || 0) + Math.max(0, b.balance)
    }
    return result
  }, [balances])

  // ── Open Create Dialog ──
  const openCreate = () => {
    setEditing(null)
    setForm({
      account_number: '',
      name: '',
      description: '',
      account_type: 'asset',
      account_subtype: '',
      normal_balance: 'debit',
    })
    setShowDialog(true)
  }

  // ── Open Edit Dialog ──
  const openEdit = (account: Account) => {
    const acct = account as unknown as { account_number?: string; code?: string; account_subtype?: string; normal_balance?: string }
    setEditing(account)
    setForm({
      account_number: acct.account_number || acct.code || '',
      name: account.name,
      description: account.description || '',
      account_type: account.account_type,
      account_subtype: acct.account_subtype || '',
      normal_balance: acct.normal_balance || 'debit',
    })
    setShowDialog(true)
  }

  // ── Save Account ──
  const handleSave = async () => {
    if (!form.account_number || !form.name) {
      toast({ title: 'Validation', description: 'Account number and name are required', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      if (editing) {
        await updateAccount(editing.id, {
          name: form.name,
          description: form.description || undefined,
          account_subtype: form.account_subtype || undefined,
        })
        toast({ title: 'Account updated' })
      } else {
        await createAccount({
          code: form.account_number,
          name: form.name,
          description: form.description || undefined,
          account_type: form.account_type,
        })
        toast({ title: 'Account created' })
      }
      setShowDialog(false)
      loadData()
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // ── Delete Account ──
  const handleDelete = async (account: Account) => {
    if (!confirm(`Delete account ${(account as unknown as { account_number?: string }).account_number || account.code} - ${account.name}?`)) return

    try {
      const result = await deleteAccount(account.id)
      if (result.success) {
        toast({ title: 'Account deleted' })
        loadData()
      } else {
        toast({ title: 'Cannot delete', description: result.error, variant: 'destructive' })
      }
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' })
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-6 w-28" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-4">
            <Skeleton className="h-[300px] w-full" />
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
            Chart of Accounts
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your accounts and track balances across your business
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            New Account
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { type: 'asset', label: 'Assets', icon: Landmark, color: 'text-emerald-600' },
          { type: 'liability', label: 'Liabilities', icon: CreditCard, color: 'text-red-600' },
          { type: 'equity', label: 'Equity', icon: Wallet, color: 'text-purple-600' },
          { type: 'revenue', label: 'Revenue', icon: TrendingUp, color: 'text-blue-600' },
          { type: 'expense', label: 'Expenses', icon: TrendingDown, color: 'text-amber-600' },
        ].map(({ type, label, icon: Icon, color }) => (
          <Card key={type} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab(type)}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{label}</p>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <p className="text-xl font-bold mt-1">{formatKSh(typeStats[type] || 0)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs + Search */}
      <div className="flex items-center justify-between gap-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <TabsList>
            <TabsTrigger value="all">All Accounts</TabsTrigger>
            <TabsTrigger value="asset">Assets</TabsTrigger>
            <TabsTrigger value="liability">Liabilities</TabsTrigger>
            <TabsTrigger value="equity">Equity</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="expense">Expenses</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search accounts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Accounts Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Accounts ({filteredAccounts.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Number</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="w-32">Type</TableHead>
                <TableHead className="w-36">Subtype</TableHead>
                <TableHead className="w-24 text-right">Balance</TableHead>
                <TableHead className="w-16">Status</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAccounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    <EmptyState icon={BookOpen} title="No accounts found" compact />
                  </TableCell>
                </TableRow>
              ) : (
                filteredAccounts.map((account) => {
                  const balance = getBalance(account.id)
                  return (
                    <TableRow key={account.id} className="group">
                      <TableCell className="font-mono font-medium">{(account as unknown as { account_number?: string }).account_number || account.code}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{account.name}</p>
                          {account.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                              {account.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={ACCOUNT_TYPE_COLORS[account.account_type]}>
                          {ACCOUNT_TYPE_ICONS[account.account_type]}
                          <span className="ml-1">{ACCOUNT_TYPE_LABELS[account.account_type]}</span>
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground capitalize">
                        {((account as unknown as { account_subtype?: string }).account_subtype || '').replace(/_/g, ' ')}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${balance >= 0 ? '' : 'text-red-600'}`}>
                        {formatKSh(Math.abs(balance))}
                      </TableCell>
                      <TableCell>
                        {(account as unknown as { is_system?: boolean }).is_system ? (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            System
                          </Badge>
                        ) : account.is_active ? (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200">
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(account)}>
                              <Edit3 className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            {!((account as unknown as { is_system?: boolean }).is_system) && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleDelete(account)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Account' : 'Create Account'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Update account details' : 'Add a new account to your chart of accounts'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Account Number *</Label>
                <Input
                  placeholder="e.g. 1050"
                  value={form.account_number}
                  onChange={(e) => setForm(f => ({ ...f, account_number: e.target.value }))}
                  disabled={!!editing}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label>Account Type *</Label>
                <Select
                  value={form.account_type}
                  onValueChange={(v) => setForm(f => ({ ...f, account_type: v }))}
                  disabled={!!editing}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                placeholder="e.g. Cash on Hand"
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                placeholder="Brief description of this account"
                value={form.description}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Normal Balance</Label>
                <Select
                  value={form.normal_balance}
                  onValueChange={(v) => setForm(f => ({ ...f, normal_balance: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debit">Debit</SelectItem>
                    <SelectItem value="credit">Credit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Subtype</Label>
                <Input
                  placeholder="e.g. cash, bank"
                  value={form.account_subtype}
                  onChange={(e) => setForm(f => ({ ...f, account_subtype: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
