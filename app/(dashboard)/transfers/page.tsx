'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, ArrowRight, Package, Loader2, AlertCircle, Lock } from 'lucide-react'
import { getTransfers } from '@/lib/transfer-actions'
import { NewTransferDialog } from '@/components/transfers/new-transfer-dialog'

interface Transfer {
  id: string
  product: string
  quantity: number
  fromBranch: string
  toBranch: string
  createdAt: string
  notes?: string
  status: string
}

export default function TransfersPage() {
  const { profile, authState } = useAuth()
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const hasTransfersRef = useRef(false)

  const canManageTransfers = ['owner', 'admin', 'manager'].includes(profile?.role || '')
  const needsBranchAssignment = Boolean(profile && profile.role !== 'owner' && !profile.branch_id)

  useEffect(() => {
    hasTransfersRef.current = transfers.length > 0
  }, [transfers.length])

  const loadTransfers = useCallback(async (options?: { background?: boolean }) => {
    if (authState === 'loading') {
      return
    }

    if (!profile || !canManageTransfers || needsBranchAssignment) {
      setTransfers([])
      setLoading(false)
      return
    }

    const shouldShowLoading = !options?.background || !hasTransfersRef.current
    if (shouldShowLoading) {
      setLoading(true)
    }

    try {
      const data = await getTransfers()
      setTransfers(data)
    } catch (error) {
      console.error('Error fetching transfers:', error)
      if (!options?.background) {
        setTransfers([])
      }
    } finally {
      if (shouldShowLoading) {
        setLoading(false)
      }
    }
  }, [authState, canManageTransfers, needsBranchAssignment, profile])

  useEffect(() => {
    void loadTransfers()
  }, [loadTransfers])

  const stats = useMemo(() => {
    const completed = transfers.filter((transfer) => transfer.status === 'completed').length
    const unitsMoved = transfers.reduce((sum, transfer) => sum + transfer.quantity, 0)

    return {
      total: transfers.length,
      completed,
      unitsMoved,
    }
  }, [transfers])

  const showNotesColumn = useMemo(
    () => transfers.some((transfer) => transfer.notes),
    [transfers]
  )

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-KE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Branch Transfers</h1>
          <p className="text-muted-foreground">Manage stock transfers between branches</p>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          disabled={!canManageTransfers || needsBranchAssignment}
          title={
            !canManageTransfers
              ? 'Transfers require owner, admin, or manager access'
              : needsBranchAssignment
                ? 'Assign this user to a branch before creating transfers'
                : 'New Transfer'
          }
        >
          <Plus className="mr-2 h-4 w-4" />
          New Transfer
        </Button>
      </div>

      {!canManageTransfers && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <Lock className="h-4 w-4 text-yellow-700" />
          <AlertDescription className="text-yellow-900">
            Transfers are limited to owners, admins, and managers.
          </AlertDescription>
        </Alert>
      )}

      {needsBranchAssignment && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertCircle className="h-4 w-4 text-yellow-700" />
          <AlertDescription className="text-yellow-900">
            Your account must be assigned to a branch before transfers can be viewed or created.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Transfers</CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Completed</CardDescription>
            <CardTitle className="text-3xl text-green-600">{stats.completed}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Units Moved</CardDescription>
            <CardTitle className="text-3xl text-primary">{stats.unitsMoved}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Transfers</CardTitle>
          <CardDescription>
            {profile?.role === 'owner' ? 'Stock movements across all branches' : 'Stock movements involving your branch'}
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
            <div className="py-8 text-center text-muted-foreground">
              <Package className="mx-auto mb-2 h-12 w-12 opacity-20" />
              <p>
                {canManageTransfers && !needsBranchAssignment
                  ? 'No transfers found yet.'
                  : 'Transfer history is unavailable for this account.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  {showNotesColumn && <TableHead>Notes</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((transfer) => (
                  <TableRow key={transfer.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                          <Package className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <span className="font-medium">{transfer.product}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{transfer.quantity} units</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">{transfer.fromBranch}</span>
                        <ArrowRight className="h-4 w-4 text-primary" />
                        <span className="text-muted-foreground">{transfer.toBranch}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(transfer.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          transfer.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-muted text-muted-foreground'
                        }
                      >
                        {transfer.status.charAt(0).toUpperCase() + transfer.status.slice(1)}
                      </Badge>
                    </TableCell>
                    {showNotesColumn && (
                      <TableCell className="text-sm text-muted-foreground">
                        {transfer.notes ? (
                          <span title={transfer.notes} className="block max-w-xs truncate">
                            {transfer.notes}
                          </span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <NewTransferDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => {
          void loadTransfers({ background: true })
        }}
      />
    </div>
  )
}
