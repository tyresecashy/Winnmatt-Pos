'use client'

import { useCallback, useEffect, useMemo, useState, startTransition } from 'react'
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
  getBankAccounts, createBankAccount, deleteBankAccount,
  getBankTransactions, createBankTransaction, reconcileBankTransaction,
  getBankStats, getAccounts,
  type BankAccount, type Account,
} from '@/lib/modules/finance'

interface BankTransaction {
  id: string
  bank_account_id: string
  transaction_date: string
  description: string
  transaction_type: string
  amount: number
  reference_number: string | null
  is_reconciled: boolean
  balance_after: number | null
  created_at: string
}
import {
  Landmark, Plus, MoreHorizontal, Search, Loader2, Edit3, Trash2,
  ArrowDownCircle, ArrowUpCircle, RefreshCw, CheckCircle, Building2,
  Wallet, TrendingUp, AlertCircle, Calendar, DollarSign, CreditCard,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

// ─── Constants ────────────────────────────────────────────────────────────────

const TX_TYPE_LABELS: Record<string, string> = {
  deposit: 'Deposit',
  withdrawal: 'Withdrawal',
  transfer: 'Transfer',
  fee: 'Fee',
  interest: 'Interest',
  reconciliation: 'Reconciliation',
}

const TX_TYPE_COLORS: Record<string, string> = {
  deposit: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  withdrawal: 'bg-red-100 text-red-700 border-red-200',
  transfer: 'bg-blue-100 text-blue-700 border-blue-200',
  fee: 'bg-amber-100 text-amber-700 border-amber-200',
  interest: 'bg-purple-100 text-purple-700 border-purple-200',
  reconciliation: 'bg-slate-100 text-slate-700 border-slate-200',
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  current: 'Current Account',
  savings: 'Savings Account',
  petty_cash: 'Petty Cash',
  float: 'Float',
  loan: 'Loan Account',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BankingPage() {
  const { toast } = useToast()

  // ── Data State ──
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [chartAccounts, setChartAccounts] = useState<Account[]>([])
  const [stats, setStats] = useState<{
    totalBalance: number
    accountCount: number
    recentTransactions: number
    unreconciled: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('accounts')

  // ── Selected Account ──
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null)
  const [transactions, setTransactions] = useState<BankTransaction[]>([])
  const [loadingTransactions, setLoadingTransactions] = useState(false)

  // ── UI State ──
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateAccount, setShowCreateAccount] = useState(false)
  const [showCreateTx, setShowCreateTx] = useState(false)
  const [saving, setSaving] = useState(false)

  // ── Create Account Form ──
  const [accountForm, setAccountForm] = useState({
    bank_name: '',
    account_name: '',
    account_number: '',
    account_type: 'current',
    opening_balance: '',
    chart_account_id: '',
  })

  // ── Create Transaction Form ──
  const [txForm, setTxForm] = useState({
    transaction_date: new Date().toISOString().split('T')[0],
    description: '',
    transaction_type: 'deposit',
    amount: '',
    reference_number: '',
  })

  // ── Load Data ──
  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [accountsData, statsData, chartData] = await Promise.all([
        getBankAccounts(),
        getBankStats(),
        getAccounts(),
      ])
      setBankAccounts(accountsData)
      setStats(statsData)
      setChartAccounts(chartData.filter(a => ['1020', '1030', '1000', '1010', '2500'].includes(a.code)))
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { startTransition(() => { loadData() }) }, [loadData])

  // ── Load Transactions ──
  const loadTransactions = useCallback(async (accountId: string) => {
    setLoadingTransactions(true)
    try {
      const txData = await getBankTransactions(accountId)
      setTransactions(txData)
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' })
    } finally {
      setLoadingTransactions(false)
    }
  }, [toast])

  useEffect(() => {
    startTransition(() => {
      if (selectedAccount) {
        loadTransactions(selectedAccount.id)
      }
    })
  }, [selectedAccount, loadTransactions])

  // ── Filtered Accounts ──
  const filteredAccounts = useMemo(() => {
    if (!searchTerm) return bankAccounts
    const term = searchTerm.toLowerCase()
    return bankAccounts.filter(a =>
      a.bank_name.toLowerCase().includes(term) ||
      a.account_name.toLowerCase().includes(term) ||
      (a.account_number || '').toLowerCase().includes(term)
    )
  }, [bankAccounts, searchTerm])

  // ── Create Bank Account ──
  const handleCreateAccount = async () => {
    if (!accountForm.bank_name || !accountForm.account_name) {
      toast({ title: 'Validation', description: 'Bank name and account name are required', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      await createBankAccount({
        account_id: accountForm.chart_account_id,
        bank_name: accountForm.bank_name,
        account_name: accountForm.account_name,
        account_number: accountForm.account_number || undefined,
        account_type: accountForm.account_type,
        opening_balance: parseFloat(accountForm.opening_balance) || 0,
      })
      toast({ title: 'Bank account created' })
      setShowCreateAccount(false)
      setAccountForm({ bank_name: '', account_name: '', account_number: '', account_type: 'current', opening_balance: '', chart_account_id: '' })
      loadData()
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // ── Create Transaction ──
  const handleCreateTx = async () => {
    if (!selectedAccount || !txForm.description || !txForm.amount) {
      toast({ title: 'Validation', description: 'Description and amount are required', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      await createBankTransaction({
        bank_account_id: selectedAccount.id,
        transaction_date: txForm.transaction_date,
        description: txForm.description,
        transaction_type: txForm.transaction_type,
        amount: parseFloat(txForm.amount),
        reference_number: txForm.reference_number || undefined,
      })
      toast({ title: 'Transaction recorded' })
      setShowCreateTx(false)
      setTxForm({ transaction_date: new Date().toISOString().split('T')[0], description: '', transaction_type: 'deposit', amount: '', reference_number: '' })
      loadTransactions(selectedAccount.id)
      loadData()
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // ── Reconcile ──
  const handleReconcile = async (tx: BankTransaction) => {
    try {
      await reconcileBankTransaction(tx.id, {})
      toast({ title: 'Transaction reconciled' })
      if (selectedAccount) loadTransactions(selectedAccount.id)
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' })
    }
  }

  // ── Delete Account ──
  const handleDeleteAccount = async (account: BankAccount) => {
    if (!confirm(`Delete bank account ${account.account_name}?`)) return

    try {
      const result = await deleteBankAccount(account.id)
      if (result.success) {
        toast({ title: 'Account deleted' })
        if (selectedAccount?.id === account.id) setSelectedAccount(null)
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
        <Card><CardContent className="p-4"><Skeleton className="h-[300px] w-full" /></CardContent></Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Landmark className="h-6 w-6" />
            Banking Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage bank accounts, record transactions, and reconcile balances
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowCreateAccount(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New Account
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Total Balance</p>
              <Landmark className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold">{formatKSh(stats?.totalBalance || 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Accounts</p>
              <Building2 className="h-4 w-4 text-blue-600" />
            </div>
            <p className="text-2xl font-bold">{stats?.accountCount || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Last 30 Days</p>
              <TrendingUp className="h-4 w-4 text-purple-600" />
            </div>
            <p className="text-2xl font-bold">{stats?.recentTransactions || 0} txns</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Unreconciled</p>
              <AlertCircle className="h-4 w-4 text-amber-600" />
            </div>
            <p className="text-2xl font-bold">{stats?.unreconciled || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Content */}
      <div className="grid grid-cols-12 gap-6">
        {/* Bank Accounts List */}
        <div className="col-span-4">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Bank Accounts</CardTitle>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-8"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y max-h-[400px] overflow-y-auto">
                {filteredAccounts.length === 0 ? (
                  <EmptyState icon={Landmark} title="No bank accounts found" compact />
                ) : (
                  filteredAccounts.map((account) => (
                    <div
                      key={account.id}
                      className={`px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                        selectedAccount?.id === account.id ? 'bg-muted' : ''
                      }`}
                      onClick={() => setSelectedAccount(account)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{account.account_name}</p>
                          <p className="text-xs text-muted-foreground">{account.bank_name}</p>
                        </div>
                        <p className="font-bold text-sm">{formatKSh(account.current_balance ?? 0)}</p>
                      </div>
                      {account.account_number && (
                        <p className="text-xs text-muted-foreground mt-1 font-mono">
                          {account.account_number}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Transaction Detail */}
        <div className="col-span-8">
          {selectedAccount ? (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{selectedAccount.account_name}</CardTitle>
                    <CardDescription>
                      {selectedAccount.bank_name} • Balance: {formatKSh(selectedAccount.current_balance ?? 0)}
                    </CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setShowCreateTx(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Record Transaction
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loadingTransactions ? (
                  <div className="py-8 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-28">Type</TableHead>
                        <TableHead className="w-28 text-right">Amount</TableHead>
                        <TableHead className="w-28 text-right">Balance</TableHead>
                        <TableHead className="w-12">Status</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            <EmptyState icon={ArrowDownCircle} title="No transactions yet" compact />
                          </TableCell>
                        </TableRow>
                      ) : (
                        transactions.map((tx) => (
                          <TableRow key={tx.id}>
                            <TableCell className="text-sm">
                              {new Date(tx.transaction_date).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <p className="font-medium text-sm">{tx.description}</p>
                              {tx.reference_number && (
                                <p className="text-xs text-muted-foreground font-mono">
                                  Ref: {tx.reference_number}
                                </p>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={TX_TYPE_COLORS[tx.transaction_type]}>
                                {TX_TYPE_LABELS[tx.transaction_type]}
                              </Badge>
                            </TableCell>
                            <TableCell className={`text-right font-medium ${tx.amount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {tx.amount >= 0 ? '+' : ''}{formatKSh(tx.amount)}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {tx.balance_after != null ? formatKSh(tx.balance_after) : '-'}
                            </TableCell>
                            <TableCell>
                              {tx.is_reconciled ? (
                                <CheckCircle className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleReconcile(tx)}
                                  title="Reconcile"
                                >
                                  <RefreshCw className="h-3 w-3 text-muted-foreground" />
                                </Button>
                              )}
                            </TableCell>
                            <TableCell></TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full flex items-center justify-center min-h-[300px]">
              <div className="text-center text-muted-foreground">
                <Landmark className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">Select a bank account</p>
                <p className="text-sm">to view transactions</p>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Create Account Dialog */}
      <Dialog open={showCreateAccount} onOpenChange={setShowCreateAccount}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Bank Account</DialogTitle>
            <DialogDescription>Link a bank account to your chart of accounts</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Bank Name *</Label>
              <Input
                placeholder="e.g. KCB Bank"
                value={accountForm.bank_name}
                onChange={(e) => setAccountForm(f => ({ ...f, bank_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Account Name *</Label>
              <Input
                placeholder="e.g. Main Business Account"
                value={accountForm.account_name}
                onChange={(e) => setAccountForm(f => ({ ...f, account_name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Account Number</Label>
                <Input
                  placeholder="e.g. 1234567890"
                  value={accountForm.account_number}
                  onChange={(e) => setAccountForm(f => ({ ...f, account_number: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Account Type</Label>
                <Select
                  value={accountForm.account_type}
                  onValueChange={(v) => setAccountForm(f => ({ ...f, account_type: v }))}
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Opening Balance</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={accountForm.opening_balance}
                  onChange={(e) => setAccountForm(f => ({ ...f, opening_balance: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Chart of Accounts Link</Label>
                <Select
                  value={accountForm.chart_account_id}
                  onValueChange={(v) => setAccountForm(f => ({ ...f, chart_account_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {chartAccounts.length === 0 ? (
                      <SelectItem value="__none__" disabled>No eligible accounts found</SelectItem>
                    ) : chartAccounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.code} - {acc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateAccount(false)}>Cancel</Button>
            <Button onClick={handleCreateAccount} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Transaction Dialog */}
      <Dialog open={showCreateTx} onOpenChange={setShowCreateTx}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Transaction</DialogTitle>
            <DialogDescription>
              Record a transaction for {selectedAccount?.account_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={txForm.transaction_date}
                  onChange={(e) => setTxForm(f => ({ ...f, transaction_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Type *</Label>
                <Select
                  value={txForm.transaction_type}
                  onValueChange={(v) => setTxForm(f => ({ ...f, transaction_type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TX_TYPE_LABELS).filter(([k]) => k !== 'reconciliation').map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description *</Label>
              <Input
                placeholder="e.g. Office rent payment"
                value={txForm.description}
                onChange={(e) => setTxForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={txForm.amount}
                  onChange={(e) => setTxForm(f => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Reference Number</Label>
                <Input
                  placeholder="e.g. CHQ001"
                  value={txForm.reference_number}
                  onChange={(e) => setTxForm(f => ({ ...f, reference_number: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateTx(false)}>Cancel</Button>
            <Button onClick={handleCreateTx} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
