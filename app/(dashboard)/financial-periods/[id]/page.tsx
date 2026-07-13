'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Calendar, Lock, FileText, TrendingUp, BookOpen, AlertTriangle } from 'lucide-react'
import { formatKSh } from '@/lib/currency'
import { EmptyState } from '@/components/ui/empty-state'
import { toast } from '@/components/ui/use-toast'
import { getFinancialPeriods, closeFinancialPeriod, getJournalEntries, generateProfitAndLoss, generateBalanceSheet, type FinancialPeriod, type JournalEntry, type PLReport, type BalanceSheetReport } from '@/lib/modules/finance'

export default function FinancialPeriodDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<FinancialPeriod | null>(null)
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([])
  const [pnl, setPnl] = useState<PLReport | null>(null)
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetReport | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const periods = await getFinancialPeriods()
        const found = periods.find(p => p.id === params.id)
        setPeriod(found || null)
        if (found) {
          const [entries, pl, bs] = await Promise.all([
            getJournalEntries({ startDate: found.start_date, endDate: found.end_date, limit: 100 }),
            found.status === 'closed' ? generateProfitAndLoss(found.start_date, found.end_date) : Promise.resolve(null),
            found.status === 'closed' ? generateBalanceSheet(found.end_date) : Promise.resolve(null),
          ])
          setJournalEntries(entries)
          setPnl(pl as unknown as PLReport | null)
          setBalanceSheet(bs)
        }
      } catch (err: unknown) {
        toast({ title: 'Error', description: err instanceof Error ? err.message : String(err), variant: 'destructive' })
      } finally {
        setLoading(false)
      }
    }
    if (params.id) load()
  }, [params.id])

  async function handleClose() {
    if (!confirm('Are you sure you want to close this period? This will lock all entries.')) return
    setClosing(true)
    try {
      const result = await closeFinancialPeriod(params.id as string, '')
      if (result.success) {
        toast({ title: 'Period closed' })
        const periods = await getFinancialPeriods()
        setPeriod(periods.find(p => p.id === params.id) || null)
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' })
      }
    } finally {
      setClosing(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (!period) {
    return (
      <div className="p-6">
        <EmptyState
          icon={AlertTriangle}
          title="Financial period not found"
          actions={[{ label: 'Back to Periods', onClick: () => router.push('/financial-periods'), variant: 'outline', icon: ArrowLeft }]}
        />
      </div>
    )
  }

  const totalDebits = journalEntries.reduce((s, e) => s + (e.total_debit || 0), 0)
  const totalCredits = journalEntries.reduce((s, e) => s + (e.total_credit || 0), 0)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/financial-periods')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{period.name}</h1>
            <Badge variant={period.status === 'open' ? 'default' : 'secondary'}>
              {period.status === 'open' ? 'Open' : 'Closed'}
            </Badge>
          </div>
          <div className="flex items-center gap-3 mt-1 text-muted-foreground">
            <span className="capitalize">{period.period_type}</span>
            <Separator orientation="vertical" className="h-4" />
            <Calendar className="h-4 w-4" />
            <span>{new Date(period.start_date).toLocaleDateString()} — {new Date(period.end_date).toLocaleDateString()}</span>
          </div>
        </div>
        {period.status === 'open' && (
          <Button size="sm" onClick={handleClose} disabled={closing}>
            <Lock className="h-4 w-4 mr-2" /> {closing ? 'Closing...' : 'Close Period'}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Journal Entries</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{journalEntries.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Total Debits</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{formatKSh(totalDebits)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Total Credits</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{formatKSh(totalCredits)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Balanced</CardTitle></CardHeader>
          <CardContent>
            <p className={`text-xl font-bold ${totalDebits === totalCredits ? 'text-green-600' : 'text-red-600'}`}>
              {totalDebits === totalCredits ? 'Yes' : 'No'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="overview"><BookOpen className="h-4 w-4 mr-2" /> Journal Entries ({journalEntries.length})</TabsTrigger>
          <TabsTrigger value="pnl" disabled={period.status !== 'closed'}><TrendingUp className="h-4 w-4 mr-2" /> P&L</TabsTrigger>
          <TabsTrigger value="balance" disabled={period.status !== 'closed'}><FileText className="h-4 w-4 mr-2" /> Balance Sheet</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          {journalEntries.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-muted-foreground"><EmptyState title="No journal entries in this period" compact /></CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="text-left p-3 font-medium">Date</th>
                      <th className="text-left p-3 font-medium">Description</th>
                      <th className="text-right p-3 font-medium">Debit</th>
                      <th className="text-right p-3 font-medium">Credit</th>
                      <th className="text-left p-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {journalEntries.map(entry => (
                      <tr key={entry.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="p-3 text-sm">{new Date(entry.entry_date || entry.created_at).toLocaleDateString()}</td>
                        <td className="p-3 text-sm font-medium">{entry.description}</td>
                        <td className="p-3 text-right font-mono text-red-600">{formatKSh(entry.total_debit || 0)}</td>
                        <td className="p-3 text-right font-mono text-green-600">{formatKSh(entry.total_credit || 0)}</td>
                        <td className="p-3"><Badge variant="outline">{entry.status || 'posted'}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="pnl" className="space-y-4 mt-4">
          {!pnl ? (
            <Card><CardContent className="p-6 text-center text-muted-foreground">Close the period to view P&L</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle>Revenue</CardTitle></CardHeader>
                <CardContent>
                  {(pnl.revenue || []).length === 0 ? (
                    <EmptyState title="No revenue entries" compact />
                  ) : (
                    <div className="space-y-2">
                      {pnl.revenue.map((item, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span>{item.name}</span>
                          <span className="font-medium">{formatKSh(item.balance)}</span>
                        </div>
                      ))}
                      <Separator />
                      <div className="flex justify-between font-bold">
                        <span>Total Revenue</span>
                        <span className="text-green-600">{formatKSh(pnl.totalRevenue)}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Expenses</CardTitle></CardHeader>
                <CardContent>
                  {(pnl.expenses || []).length === 0 ? (
                    <EmptyState title="No expense entries" compact />
                  ) : (
                    <div className="space-y-2">
                      {pnl.expenses.map((item, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span>{item.name}</span>
                          <span className="font-medium">{formatKSh(item.balance)}</span>
                        </div>
                      ))}
                      <Separator />
                      <div className="flex justify-between font-bold">
                        <span>Total Expenses</span>
                        <span className="text-red-600">{formatKSh(pnl.totalExpenses || 0)}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card className="md:col-span-2">
                <CardHeader><CardTitle>Net Profit / Loss</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <span className="text-lg">Net Result</span>
                    <span className={`text-2xl font-bold ${pnl.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatKSh(pnl.netIncome)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="balance" className="space-y-4 mt-4">
          {!balanceSheet ? (
            <Card><CardContent className="p-6 text-center text-muted-foreground">Close the period to view Balance Sheet</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle>Assets</CardTitle></CardHeader>
                <CardContent>
                  {(balanceSheet.assets || []).length === 0 ? (
                    <EmptyState title="No asset entries" compact />
                  ) : (
                    <div className="space-y-2">
                      {balanceSheet.assets.map((item, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span>{item.name}</span>
                          <span className="font-medium">{formatKSh(item.balance)}</span>
                        </div>
                      ))}
                      <Separator />
                      <div className="flex justify-between font-bold">
                        <span>Total Assets</span>
                        <span>{formatKSh(balanceSheet.totalAssets)}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Liabilities & Equity</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {(balanceSheet.liabilities || []).length > 0 && (
                      <>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Liabilities</p>
                        {balanceSheet.liabilities.map((item, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span>{item.name}</span>
                            <span className="font-medium">{formatKSh(item.balance)}</span>
                          </div>
                        ))}
                      </>
                    )}
                    {(balanceSheet.equity || []).length > 0 && (
                      <>
                        <Separator />
                        <p className="text-xs font-medium text-muted-foreground mb-1">Equity</p>
                        {balanceSheet.equity.map((item, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span>{item.name}</span>
                            <span className="font-medium">{formatKSh(item.balance)}</span>
                          </div>
                        ))}
                      </>
                    )}
                    <Separator />
                    <div className="flex justify-between font-bold">
                      <span>Total Liabilities & Equity</span>
                      <span>{formatKSh(balanceSheet.totalLiabilities + balanceSheet.totalEquity)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
