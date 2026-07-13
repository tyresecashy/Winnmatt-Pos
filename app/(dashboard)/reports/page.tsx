'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/ui/empty-state'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from '@/hooks/use-toast'
import { generateTrialBalance, generateProfitAndLoss, generateBalanceSheet, generateCashFlowStatement, type TrialBalanceRow, type PLReport, type BalanceSheetReport } from '@/lib/modules/finance'
import { formatKSh } from '@/lib/currency'
import { exportToCSV, exportToExcel } from '@/lib/export-utils'
import { BarChart3, FileText, Scale, TrendingUp, RefreshCw, Printer, Download } from 'lucide-react'

export default function ReportsPage() {
  const [loading, setLoading] = useState(false)
  const [startDate, setStartDate] = useState(`${new Date().getFullYear()}-01-01`)
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])

  const [trialBalance, setTrialBalance] = useState<TrialBalanceRow | null>(null)
  const [plReport, setPlReport] = useState<PLReport | null>(null)
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetReport | null>(null)
  const [cashFlow, setCashFlow] = useState<{
    operating: { netIncome: number; description: string }
    investing: { items: unknown[]; total: number; description: string }
    financing: { items: unknown[]; total: number; description: string }
    cashAccounts: number
  } | null>(null)

  async function loadReport(type: string) {
    setLoading(true)
    try {
      switch (type) {
        case 'trial':
          setTrialBalance(await generateTrialBalance(startDate, endDate) as unknown as TrialBalanceRow)
          break
        case 'pl':
          setPlReport(await generateProfitAndLoss(startDate, endDate) as unknown as PLReport)
          break
        case 'balance':
          setBalanceSheet(await generateBalanceSheet(endDate))
          break
        case 'cashflow':
          setCashFlow(await generateCashFlowStatement(startDate, endDate))
          break
      }
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to load report', variant: 'destructive' })
    }
    setLoading(false)
  }

  function handlePrint() {
    window.print()
  }

  function handleExportTrialBalance() {
    if (!trialBalance) return
    const rows = trialBalance.accounts.map(a => ({
      Code: a.code,
      Account: a.name,
      Type: a.account_type,
      Debit: a.debit,
      Credit: a.credit,
    }))
    exportToCSV(rows, `trial-balance-${endDate}`)
  }

  function handleExportPL() {
    if (!plReport) return
    const rows = [
      ...plReport.revenue.map(a => ({ Category: 'Revenue', Account: a.name, Amount: a.balance })),
      ...plReport.expenses.map(a => ({ Category: 'Expense', Account: a.name, Amount: a.balance })),
    ]
    exportToCSV(rows, `profit-loss-${endDate}`)
  }

  function handleExportBalanceSheet() {
    if (!balanceSheet) return
    const rows = [
      ...balanceSheet.assets.map(a => ({ Category: 'Asset', Account: a.name, Amount: a.balance })),
      ...balanceSheet.liabilities.map(a => ({ Category: 'Liability', Account: a.name, Amount: a.balance })),
      ...balanceSheet.equity.map(a => ({ Category: 'Equity', Account: a.name, Amount: a.balance })),
    ]
    exportToCSV(rows, `balance-sheet-${endDate}`)
  }

  function handleExportCashFlow() {
    if (!cashFlow) return
    const rows = [
      { Category: 'Operating', Description: cashFlow.operating.description, Amount: cashFlow.operating.netIncome },
      { Category: 'Investing', Description: cashFlow.investing.description, Amount: cashFlow.investing.total },
      { Category: 'Financing', Description: cashFlow.financing.description, Amount: cashFlow.financing.total },
    ]
    exportToCSV(rows, `cash-flow-${endDate}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-blue-500" />
            Financial Reports
          </h1>
          <p className="text-muted-foreground mt-1">Generate financial statements and reports</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}><Printer className="h-4 w-4 mr-2" /> Print</Button>
        </div>
      </div>

      {/* Date Range Selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-end">
            <div>
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label>End Date</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <Badge variant="outline" className="text-sm">
              Period: {new Date(startDate).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })} — {new Date(endDate).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' })}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="trial" onValueChange={loadReport}>
        <TabsList>
          <TabsTrigger value="trial" className="flex items-center gap-1"><FileText className="h-4 w-4" /> Trial Balance</TabsTrigger>
          <TabsTrigger value="pl" className="flex items-center gap-1"><TrendingUp className="h-4 w-4" /> Profit & Loss</TabsTrigger>
          <TabsTrigger value="balance" className="flex items-center gap-1"><Scale className="h-4 w-4" /> Balance Sheet</TabsTrigger>
          <TabsTrigger value="cashflow" className="flex items-center gap-1"><BarChart3 className="h-4 w-4" /> Cash Flow</TabsTrigger>
        </TabsList>

        {/* Trial Balance */}
        <TabsContent value="trial">
          <Card>
            <CardHeader>
              <CardTitle>Trial Balance</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8"><RefreshCw className="h-6 w-6 animate-spin" /></div>
              ) : trialBalance ? (
                <>
                  <div className="flex justify-end mb-4 gap-2">
                    <Button variant="outline" size="sm" onClick={handleExportTrialBalance}><Download className="h-4 w-4 mr-1" /> CSV</Button>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Account</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead className="text-right">Credit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {trialBalance.accounts.map(a => (
                        <TableRow key={a.id}>
                          <TableCell className="font-mono text-sm">{a.code}</TableCell>
                          <TableCell>{a.name}</TableCell>
                          <TableCell><Badge variant="outline" className="capitalize">{a.account_type}</Badge></TableCell>
                          <TableCell className="text-right">{a.debit > 0 ? formatKSh(a.debit) : '—'}</TableCell>
                          <TableCell className="text-right">{a.credit > 0 ? formatKSh(a.credit) : '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="mt-4 flex justify-end gap-8 text-lg font-bold border-t pt-4">
                    <span>Total Debit: {formatKSh(trialBalance.totalDebit)}</span>
                    <span>Total Credit: {formatKSh(trialBalance.totalCredit)}</span>
                    <span className={Math.abs(trialBalance.totalDebit - trialBalance.totalCredit) < 0.01 ? 'text-green-600' : 'text-red-600'}>
                      Difference: {formatKSh(Math.abs(trialBalance.totalDebit - trialBalance.totalCredit))}
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-center text-muted-foreground py-8">Click a tab to load the report</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profit & Loss */}
        <TabsContent value="pl">
          <Card>
            <CardHeader><CardTitle>Profit & Loss Statement</CardTitle></CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8"><RefreshCw className="h-6 w-6 animate-spin" /></div>
              ) : plReport ? (
                <div className="space-y-6">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={handleExportPL}><Download className="h-4 w-4 mr-1" /> CSV</Button>
                  </div>
                  {/* Revenue */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-green-700">Revenue</h3>
                    <Table>
                      <TableHeader>
                        <TableRow><TableHead>Account</TableHead><TableHead className="text-right">Amount</TableHead></TableRow>
                      </TableHeader>
                      <TableBody>
                        {plReport.revenue.map(a => (
                          <TableRow key={a.id}><TableCell>{a.name}</TableCell><TableCell className="text-right">{formatKSh(a.balance)}</TableCell></TableRow>
                        ))}
                        {plReport.revenue.length === 0 && <TableRow><TableCell colSpan={2} className="text-muted-foreground"><EmptyState title="No revenue recorded" compact /></TableCell></TableRow>}
                      </TableBody>
                    </Table>
                    <div className="text-right font-bold mt-2">Total Revenue: {formatKSh(plReport.totalRevenue)}</div>
                  </div>

                  {/* Expenses */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-red-700">Expenses</h3>
                    <Table>
                      <TableHeader>
                        <TableRow><TableHead>Account</TableHead><TableHead className="text-right">Amount</TableHead></TableRow>
                      </TableHeader>
                      <TableBody>
                        {plReport.expenses.map(a => (
                          <TableRow key={a.id}><TableCell>{a.name}</TableCell><TableCell className="text-right">{formatKSh(a.balance)}</TableCell></TableRow>
                        ))}
                        {plReport.expenses.length === 0 && <TableRow><TableCell colSpan={2} className="text-muted-foreground"><EmptyState title="No expenses recorded" compact /></TableCell></TableRow>}
                      </TableBody>
                    </Table>
                    <div className="text-right font-bold mt-2">Total Expenses: {formatKSh(plReport.totalExpenses)}</div>
                  </div>

                  {/* Net Income */}
                  <div className={`text-xl font-bold text-right border-t-2 pt-4 ${plReport.netIncome >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    Net Income: {formatKSh(plReport.netIncome)}
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">Click &quot;Profit & Loss&quot; tab to load</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Balance Sheet */}
        <TabsContent value="balance">
          <Card>
            <CardHeader><CardTitle>Balance Sheet</CardTitle></CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8"><RefreshCw className="h-6 w-6 animate-spin" /></div>
              ) : balanceSheet ? (
                <>
                  <div className="flex justify-end mb-4 gap-2">
                    <Button variant="outline" size="sm" onClick={handleExportBalanceSheet}><Download className="h-4 w-4 mr-1" /> CSV</Button>
                  </div>
                  <div className="grid grid-cols-3 gap-6">
                  {/* Assets */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-blue-700">Assets</h3>
                    {balanceSheet.assets.map(a => (
                      <div key={a.id} className="flex justify-between py-1 border-b"><span className="text-sm">{a.name}</span><span className="text-sm">{formatKSh(a.balance)}</span></div>
                    ))}
                    <div className="text-right font-bold mt-2 text-blue-800">Total: {formatKSh(balanceSheet.totalAssets)}</div>
                  </div>

                  {/* Liabilities */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-red-700">Liabilities</h3>
                    {balanceSheet.liabilities.map(a => (
                      <div key={a.id} className="flex justify-between py-1 border-b"><span className="text-sm">{a.name}</span><span className="text-sm">{formatKSh(a.balance)}</span></div>
                    ))}
                    <div className="text-right font-bold mt-2 text-red-800">Total: {formatKSh(balanceSheet.totalLiabilities)}</div>
                  </div>

                  {/* Equity */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-muted-foreground">Equity</h3>
                    {balanceSheet.equity.map(a => (
                      <div key={a.id} className="flex justify-between py-1 border-b"><span className="text-sm">{a.name}</span><span className="text-sm">{formatKSh(a.balance)}</span></div>
                    ))}
                    <div className="text-right font-bold mt-2 text-foreground">Total: {formatKSh(balanceSheet.totalEquity)}</div>
                  </div>
                </div>
                </>
              ) : (
                <div className="text-center text-muted-foreground py-8">Click &quot;Balance Sheet&quot; tab to load</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cash Flow */}
        <TabsContent value="cashflow">
          <Card>
            <CardHeader><CardTitle>Cash Flow Statement</CardTitle></CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8"><RefreshCw className="h-6 w-6 animate-spin" /></div>
              ) : cashFlow ? (
                <div className="space-y-6">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={handleExportCashFlow}><Download className="h-4 w-4 mr-1" /> CSV</Button>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h3 className="font-semibold text-blue-800">Operating Activities</h3>
                    <p className="text-sm text-blue-700 mt-1">{cashFlow.operating.description}</p>
                    <p className="text-lg font-bold mt-2">Net Income: {formatKSh(cashFlow.operating.netIncome)}</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <h3 className="font-semibold text-foreground">Investing Activities</h3>
                    <p className="text-sm text-muted-foreground mt-1">{cashFlow.investing.description}</p>
                    <p className="text-lg font-bold mt-2">Total: {formatKSh(cashFlow.investing.total)}</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <h3 className="font-semibold text-foreground">Financing Activities</h3>
                    <p className="text-sm text-muted-foreground mt-1">{cashFlow.financing.description}</p>
                    <p className="text-lg font-bold mt-2">Total: {formatKSh(cashFlow.financing.total)}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">Cash accounts tracked: {cashFlow.cashAccounts}</p>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">Click &quot;Cash Flow&quot; tab to load</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
