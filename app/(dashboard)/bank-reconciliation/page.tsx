'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from '@/hooks/use-toast'
import {
  getBankAccounts, getReconciliations, getUnreconciledTransactions,
  getUnmatchedJournalEntries, createReconciliation, completeReconciliation
} from '@/lib/finance-actions'
import { formatKSh } from '@/lib/currency'
import { ArrowLeftRight, CheckCircle, Plus, RefreshCw } from 'lucide-react'

interface BankAccount { id: string; account_name: string; account_number: string | null; bank_name: string; current_balance: number }

export default function BankReconciliationPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [selectedAccount, setSelectedAccount] = useState<string>('')
  const [reconciliations, setReconciliations] = useState<any[]>([])
  const [bankTransactions, setBankTransactions] = useState<any[]>([])
  const [journalEntries, setJournalEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [bankBalance, setBankBalance] = useState('')
  const [bookBalance, setBookBalance] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedTx, setSelectedTx] = useState<Set<string>>(new Set())
  const [selectedJE, setSelectedJE] = useState<Set<string>>(new Set())

  useEffect(() => { loadAccounts() }, [])
  useEffect(() => { if (selectedAccount) loadReconciliationData() }, [selectedAccount])

  async function loadAccounts() {
    const data = await getBankAccounts()
    setAccounts(data)
    if (data.length > 0) setSelectedAccount(data[0].id)
    setLoading(false)
  }

  async function loadReconciliationData() {
    if (!selectedAccount) return
    const [recs, txs, jes] = await Promise.all([
      getReconciliations(selectedAccount),
      getUnreconciledTransactions(selectedAccount),
      getUnmatchedJournalEntries(selectedAccount),
    ])
    setReconciliations(recs)
    setBankTransactions(txs)
    setJournalEntries(jes)
    setSelectedTx(new Set())
    setSelectedJE(new Set())
    // Set book balance from account
    const account = accounts.find(a => a.id === selectedAccount)
    if (account) setBookBalance(String(account.current_balance))
  }

  function toggleTx(id: string) {
    const next = new Set(selectedTx)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelectedTx(next)
  }

  function toggleJE(id: string) {
    const next = new Set(selectedJE)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelectedJE(next)
  }

  async function handleCreateReconciliation() {
    if (!bankBalance || !bookBalance) {
      toast({ title: 'Error', description: 'Enter both bank and book balances', variant: 'destructive' })
      return
    }

    const matched = Array.from(selectedTx).map(txId => {
      const jeId = Array.from(selectedJE).pop() || ''
      return { bank_transaction_id: txId, journal_entry_id: jeId }
    })

    try {
      const result = await createReconciliation({
        bank_account_id: selectedAccount,
        reconciliation_date: new Date().toISOString().split('T')[0],
        bank_balance: parseFloat(bankBalance),
        book_balance: parseFloat(bookBalance),
        matched_transactions: matched,
        notes,
      })

      if (result.success) {
        toast({ title: 'Created', description: 'Reconciliation created' })
        setShowNewDialog(false)
        loadReconciliationData()
      }
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' })
    }
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  }

  const account = accounts.find(a => a.id === selectedAccount)
  const difference = (parseFloat(bankBalance) || 0) - (parseFloat(bookBalance) || 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ArrowLeftRight className="h-8 w-8 text-blue-500" />
            Bank Reconciliation
          </h1>
          <p className="text-muted-foreground mt-1">Match bank transactions against journal entries</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadReconciliationData}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</Button>
          <Button onClick={() => setShowNewDialog(true)}><Plus className="h-4 w-4 mr-2" /> New Reconciliation</Button>
        </div>
      </div>

      {/* Account Selector */}
      <div className="flex gap-4 items-center">
        <Label>Bank Account:</Label>
        <Select value={selectedAccount} onValueChange={setSelectedAccount}>
          <SelectTrigger className="w-80"><SelectValue /></SelectTrigger>
          <SelectContent>
            {accounts.map(a => (
              <SelectItem key={a.id} value={a.id}>{a.bank_name} — {a.account_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {account && (
          <Badge variant="outline" className="text-lg">Balance: {formatKSh(account.current_balance)}</Badge>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Unmatched Bank Txns</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-amber-600">{bankTransactions.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Unmatched Journal Entries</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-blue-600">{journalEntries.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Reconciliations</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{reconciliations.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Difference</CardTitle></CardHeader>
          <CardContent><div className={`text-3xl font-bold ${Math.abs(difference) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>{formatKSh(difference)}</div></CardContent>
        </Card>
      </div>

      {/* Two-Panel Matching */}
      <div className="grid grid-cols-2 gap-6">
        {/* Bank Transactions */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Bank Transactions (Unreconciled)</CardTitle></CardHeader>
          <CardContent className="p-0 max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bankTransactions.map(tx => (
                  <TableRow key={tx.id}>
                    <TableCell>
                      <Checkbox checked={selectedTx.has(tx.id)} onCheckedChange={() => toggleTx(tx.id)} />
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(tx.transaction_date)}</TableCell>
                    <TableCell className="text-sm">{tx.description || tx.reference || '—'}</TableCell>
                    <TableCell className={`text-right text-sm ${(tx.debit || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatKSh(tx.debit || tx.credit || 0)}
                    </TableCell>
                  </TableRow>
                ))}
                {bankTransactions.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">All reconciled!</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Journal Entries */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Journal Entry Lines</CardTitle></CardHeader>
          <CardContent className="p-0 max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {journalEntries.map(je => (
                  <TableRow key={je.id}>
                    <TableCell>
                      <Checkbox checked={selectedJE.has(je.id)} onCheckedChange={() => toggleJE(je.id)} />
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(je.journal_entry?.entry_date || '')}</TableCell>
                    <TableCell className="text-sm">{je.journal_entry?.description || je.description || '—'}</TableCell>
                    <TableCell className="text-right text-sm">
                      {formatKSh(je.debit || je.credit || 0)}
                    </TableCell>
                  </TableRow>
                ))}
                {journalEntries.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">No unmatched entries</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Past Reconciliations */}
      <Card>
        <CardHeader><CardTitle>Past Reconciliations</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Bank Balance</TableHead>
                <TableHead>Book Balance</TableHead>
                <TableHead>Difference</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reconciliations.map(r => (
                <TableRow key={r.id}>
                  <TableCell>{formatDate(r.reconciliation_date)}</TableCell>
                  <TableCell>{formatKSh(r.bank_balance)}</TableCell>
                  <TableCell>{formatKSh(r.book_balance)}</TableCell>
                  <TableCell className={Math.abs(r.difference) < 0.01 ? 'text-green-600' : 'text-red-600'}>
                    {formatKSh(r.difference)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.status === 'completed' ? 'default' : 'secondary'}>{r.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {reconciliations.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">No reconciliations yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Bank Reconciliation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Bank Statement Balance</Label>
                <Input type="number" step="0.01" value={bankBalance} onChange={e => setBankBalance(e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <Label>Book Balance (Ledger)</Label>
                <Input type="number" step="0.01" value={bookBalance} onChange={e => setBookBalance(e.target.value)} placeholder="0.00" />
              </div>
            </div>
            {bankBalance && bookBalance && (
              <div className={`p-3 rounded text-center font-medium ${Math.abs(difference) < 0.01 ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                Difference: {formatKSh(difference)}
                {Math.abs(difference) < 0.01 ? ' — Balanced!' : ' — Not balanced'}
              </div>
            )}
            <div>
              <Label>Notes</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional reconciliation notes..." />
            </div>
            <p className="text-sm text-muted-foreground">
              Select transactions and journal entries to match using the checkboxes above, then create the reconciliation.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateReconciliation}>Create Reconciliation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
