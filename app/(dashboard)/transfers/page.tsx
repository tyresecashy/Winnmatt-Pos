'use client'
import { logger } from '@/lib/logger';

import { useState, useEffect, useCallback, useMemo, startTransition } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from '@/hooks/use-toast'
import {
  getStockTransfers,
  approveStockTransfer,
  markInTransit,
  cancelStockTransfer,
  receiveStockTransfer,
  type StockTransfer,
} from '@/lib/modules/transfers'
import { NewTransferDialog } from '@/components/transfers/new-transfer-dialog'
import { ReceiveTransferDialog } from '@/components/transfers/receive-transfer-dialog'
import {
  ArrowRightLeft,
  RefreshCw,
  CheckCircle,
  Truck,
  XCircle,
  Package,
  Plus,
  Loader2,
  AlertCircle,
  Lock,
  ArrowRight,
  Download,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

export default function TransfersPage() {
  const { profile, authState } = useAuth()
  const [transfers, setTransfers] = useState<StockTransfer[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [receiveTransferId, setReceiveTransferId] = useState<string | null>(null)

  const canManageTransfers = ['super_admin', 'admin', 'manager'].includes(profile?.role || '')
  const needsBranchAssignment = Boolean(profile && profile.role !== 'super_admin' && !profile.branch_id)

  const loadTransfers = useCallback(async () => {
    if (authState === 'loading') return
    if (!profile || !canManageTransfers || needsBranchAssignment) {
      setTransfers([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const data = await getStockTransfers(undefined, statusFilter || undefined)
      setTransfers(data)
    } catch (error) {
      logger.error('Error fetching transfers:', error)
      toast({ title: 'Error', description: 'Failed to load transfers', variant: 'destructive' })
      setTransfers([])
    } finally {
      setLoading(false)
    }
  }, [authState, canManageTransfers, needsBranchAssignment, statusFilter, profile])

  useEffect(() => { startTransition(() => { loadTransfers() }) }, [loadTransfers])

  async function handleApprove(id: string) {
    const result = await approveStockTransfer(id)
    if (result.success) { toast({ title: 'Approved' }); loadTransfers() }
    else toast({ title: 'Error', description: result.error, variant: 'destructive' })
  }

  async function handleTransit(id: string) {
    const result = await markInTransit(id)
    if (result.success) { toast({ title: 'In Transit' }); loadTransfers() }
    else toast({ title: 'Error', description: result.error, variant: 'destructive' })
  }

  async function handleCancel(id: string) {
    if (!confirm('Cancel this transfer?')) return
    const result = await cancelStockTransfer(id)
    if (result.success) { toast({ title: 'Cancelled' }); loadTransfers() }
    else toast({ title: 'Error', description: result.error, variant: 'destructive' })
  }

  function handleReceive(transferId: string) {
    setReceiveTransferId(transferId)
  }

  const stats = useMemo(() => ({
    total: transfers.length,
    completed: transfers.filter(t => t.status === 'received').length,
    inTransit: transfers.filter(t => t.status === 'in_transit').length,
  }), [transfers])

  function statusColor(status: string) {
    switch (status) {
      case 'pending': return 'bg-warning/15 text-warning border-warning/30'
      case 'approved': return 'bg-primary/15 text-primary border-primary/30'
      case 'in_transit': return 'bg-chart-3/15 text-chart-3 border-chart-3/30'
      case 'received': return 'bg-success/15 text-success border-success/30'
      case 'cancelled': return 'bg-destructive/15 text-destructive border-destructive/30'
      default: return 'bg-muted text-muted-foreground border-transparent'
    }
  }

  function formatDate(dateStr: string | null | undefined) {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('en-KE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  if (authState === 'loading') {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex min-h-[220px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ArrowRightLeft className="h-8 w-8 text-primary" />
            Stock Transfers
          </h1>
          <p className="text-muted-foreground mt-1">Transfer stock between branches</p>
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={v => setStatusFilter(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All Statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="in_transit">In Transit</SelectItem>
              <SelectItem value="received">Received</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={loadTransfers}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
          <Button
            onClick={() => setDialogOpen(true)}
            disabled={!canManageTransfers || needsBranchAssignment}
            title={
              !canManageTransfers
                ? 'Transfers require super admin, admin, or manager access'
                : needsBranchAssignment
                  ? 'Assign this user to a branch before creating transfers'
                  : 'New Transfer'
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            New Transfer
          </Button>
        </div>
      </div>

      {/* Role / Branch alerts */}
      {!canManageTransfers && (
        <Alert variant="destructive">
          <Lock className="h-4 w-4" />
          <AlertDescription>
            Transfers are limited to super admins, admins, and managers.
          </AlertDescription>
        </Alert>
      )}
      {needsBranchAssignment && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Your account must be assigned to a branch before transfers can be viewed or created.
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Transfers</CardDescription>
            <CardTitle className="text-3xl">{loading ? <Skeleton className="h-8 w-16" /> : stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Completed</CardDescription>
            <CardTitle className="text-3xl text-success">{loading ? <Skeleton className="h-8 w-16" /> : stats.completed}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>In Transit</CardDescription>
            <CardTitle className="text-3xl text-chart-3">{loading ? <Skeleton className="h-8 w-16" /> : stats.inTransit}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Transfers Table */}
      <Card>
        <CardHeader>
          <CardTitle>{statusFilter ? `${statusFilter.replace('_', ' ')} Transfers` : 'All Transfers'}</CardTitle>
          <CardDescription>
            {profile?.role === 'super_admin'
              ? 'Stock movements across all branches'
              : 'Stock movements involving your branch'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : transfers.length === 0 ? (
            <EmptyState
              icon={Package}
              title={canManageTransfers && !needsBranchAssignment ? 'No transfers yet' : 'Unavailable'}
              description={canManageTransfers && !needsBranchAssignment ? 'Create your first transfer to move stock between branches.' : 'Transfer history is unavailable for this account.'}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transfer #</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.transfer_number || t.id.slice(0, 8)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">{t.from_branch?.name || t.from_branch_id}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">{t.to_branch?.name || t.to_branch_id}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {t.items?.length ?? '-'} item{(t.items?.length ?? 0) !== 1 ? 's' : ''}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColor(t.status)}>
                        {t.status.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(t.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        {t.status === 'pending' && (
                          <>
                            <Button variant="outline" size="sm" onClick={() => handleApprove(t.id)}>
                              <CheckCircle className="h-4 w-4 mr-1" /> Approve
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleCancel(t.id)}>
                              <XCircle className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                        {t.status === 'approved' && (
                          <Button variant="outline" size="sm" onClick={() => handleTransit(t.id)}>
                            <Truck className="h-4 w-4 mr-1" /> Ship
                          </Button>
                        )}
                        {t.status === 'in_transit' && (
                          <Button variant="outline" size="sm" onClick={() => handleReceive(t.id)} className="text-success border-success/30 hover:bg-success/10">
                            <Download className="h-4 w-4 mr-1" /> Receive
                          </Button>
                        )}
                        {['pending', 'approved'].includes(t.status) && (
                          <Button variant="ghost" size="sm" onClick={() => handleCancel(t.id)}>
                            <XCircle className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* New Transfer Dialog */}
      <NewTransferDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => { loadTransfers() }}
      />

      {/* Receive Transfer Dialog */}
      <ReceiveTransferDialog
        transferId={receiveTransferId}
        onClose={() => setReceiveTransferId(null)}
        onSuccess={() => { loadTransfers() }}
      />
    </div>
  )
}
