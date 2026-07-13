'use client'

import { useEffect, useState, startTransition } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Building2, Users, CreditCard, TrendingUp, RefreshCw, AlertCircle, Search } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { formatKSh } from '@/lib/currency'
import { getCustomersLegacy as getCustomers } from '@/lib/modules/customers'
import type { CustomerRow as Customer } from '@/lib/modules/customers'

export default function BusinessAccountsPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const loadCustomers = async () => {
    setLoading(true)
    setError(null)
    try {
      const all = await getCustomers()
      // Filter to business/wholesale type with credit
      const business = all.filter(
        (c) => (c.type === 'business' || c.type === 'wholesale') && c.credit_limit > 0
      )
      setCustomers(business)
    } catch (err) {
      setError('Failed to load business accounts.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    startTransition(() => { loadCustomers() })
  }, [])

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase()
    return (
      c.name.toLowerCase().includes(q) ||
      (c.phone || '').includes(q) ||
      (c.email || '').toLowerCase().includes(q)
    )
  })

  const totalCreditExtended = customers.reduce((s, c) => s + c.credit_limit, 0)
  const totalOutstanding = customers.reduce((s, c) => s + c.credit_balance, 0)
  const utilizationRate = totalCreditExtended > 0
    ? Math.round((totalOutstanding / totalCreditExtended) * 100)
    : 0

  return (
    <div className="p-6 space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Business Accounts</h1>
          <p className="text-muted-foreground">
            Manage credit accounts for business and wholesale customers
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadCustomers} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="card-hover">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Active Accounts</p>
                <p className="text-2xl font-bold tracking-tight">
                  {loading ? <Skeleton className="h-8 w-16" /> : filtered.length}
                </p>
                <p className="text-xs text-muted-foreground">with credit facilities</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Total Credit Extended</p>
                <p className="text-2xl font-bold tracking-tight text-green-600">
                  {loading ? <Skeleton className="h-8 w-24" /> : formatKSh(totalCreditExtended)}
                </p>
                <p className="text-xs text-muted-foreground">across all accounts</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Outstanding Balance</p>
                <p className="text-2xl font-bold tracking-tight text-amber-600">
                  {loading ? <Skeleton className="h-8 w-24" /> : formatKSh(totalOutstanding)}
                </p>
                <p className="text-xs text-muted-foreground">currently owed</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                <CreditCard className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Utilization Rate</p>
                <p className="text-2xl font-bold tracking-tight">
                  {loading ? <Skeleton className="h-8 w-16" /> : `${utilizationRate}%`}
                </p>
                <p className="text-xs text-muted-foreground">of total credit used</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Error state */}
      {error && (
        <Card className="border-destructive/30">
          <CardContent className="p-6 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <span className="text-sm text-destructive">{error}</span>
            <Button variant="outline" size="sm" onClick={loadCustomers}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Account Holders</CardTitle>
          <CardDescription>
            {filtered.length} business account{filtered.length !== 1 ? 's' : ''} with credit facilities
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No business accounts yet"
              description={search ? 'No accounts match your search.' : 'Create a business or wholesale customer with a credit limit to see them here.'}
              compact
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Credit Limit</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Utilization</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => {
                  const available = c.credit_limit - c.credit_balance
                  const utilPct = c.credit_limit > 0
                    ? Math.round((c.credit_balance / c.credit_limit) * 100)
                    : 0
                  return (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer"
                      onClick={() => {
                        setSelectedCustomer(c)
                        setDetailOpen(true)
                      }}
                    >
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-muted-foreground">{c.phone || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {c.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatKSh(c.credit_limit)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-amber-600">
                        {formatKSh(c.credit_balance)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        {formatKSh(Math.max(available, 0))}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                utilPct > 80
                                  ? 'bg-red-500'
                                  : utilPct > 50
                                  ? 'bg-amber-500'
                                  : 'bg-green-500'
                              }`}
                              style={{ width: `${Math.min(utilPct, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-8 text-right">
                            {utilPct}%
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedCustomer?.name}</DialogTitle>
            <DialogDescription>
              {selectedCustomer?.type === 'wholesale' ? 'Wholesale' : 'Business'} account details
            </DialogDescription>
          </DialogHeader>
          {selectedCustomer && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="text-sm font-medium">{selectedCustomer.phone || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium">{selectedCustomer.email || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Credit Limit</p>
                  <p className="text-sm font-medium">{formatKSh(selectedCustomer.credit_limit)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Outstanding Balance</p>
                  <p className="text-sm font-medium text-amber-600">
                    {formatKSh(selectedCustomer.credit_balance)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Available Credit</p>
                  <p className="text-sm font-medium text-green-600">
                    {formatKSh(Math.max(selectedCustomer.credit_limit - selectedCustomer.credit_balance, 0))}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Loyalty Points</p>
                  <p className="text-sm font-medium">{selectedCustomer.loyalty_points}</p>
                </div>
              </div>
              <div className="rounded-lg border p-4 bg-muted/30">
                <p className="text-xs text-muted-foreground">
                  Account management, payment tracking, and statement generation features
                  will be available in a future update.
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
