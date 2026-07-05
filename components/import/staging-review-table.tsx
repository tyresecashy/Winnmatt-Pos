/**
 * Staging Review Table Component
 * Admin view of imported products with anomalies and publish controls
 */

'use client'

import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/contexts/auth-context'
import {
  MoreVertical,
  AlertTriangle,
  CheckCircle,
  XCircle,
  DollarSign,
  Zap,
} from 'lucide-react'
import {
  approveStagingProduct,
  rejectStagingProduct,
  updateStagingPrice,
} from '@/lib/staging-actions'
import type { PriceAnomaly, ProductDeduplication } from '@/lib/product-ingestion.types'

interface StagingProduct {
  product_id: string
  batch_id: string
  normalized_name: string
  brand?: string
  unit?: string
  barcode?: string
  listed_price?: number
  suggested_selling_price?: number
  review_status: string
  confidence_score: number
  anomalies: PriceAnomaly[]
  deduplications: ProductDeduplication[]
  created_at: string
}

interface StagingReviewTableProps {
  products: StagingProduct[]
  onApprove?: () => void
  onReject?: () => void
}

export function StagingReviewTable({
  products,
  onApprove,
  onReject,
}: StagingReviewTableProps) {
  const { toast } = useToast()
  const { user } = useAuth()
  const [editingPrice, setEditingPrice] = useState<string | null>(null)
  const [newPrices, setNewPrices] = useState<Record<string, number>>({})
  const [approveAlert, setApproveAlert] = useState<string | null>(null)
  const [rejectAlert, setRejectAlert] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [loading, setLoading] = useState(false)

  const handleApprove = async (productId: string) => {
    if (!user?.id) return

    setLoading(true)
    try {
      await approveStagingProduct(productId, user.id)
      toast({
        title: 'Product approved',
        description: 'Product is ready for publishing',
      })
      setApproveAlert(null)
      onApprove?.()
    } catch (error: unknown) {
      toast({
        title: 'Approval failed',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async (productId: string) => {
    if (!user?.id) return

    setLoading(true)
    try {
      await rejectStagingProduct(productId, rejectReason || 'No reason provided', user.id)
      toast({
        title: 'Product rejected',
        description: 'Product will not be published',
      })
      setRejectAlert(null)
      setRejectReason('')
      onReject?.()
    } catch (error: unknown) {
      toast({
        title: 'Rejection failed',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handlePriceUpdate = async (productId: string) => {
    const newPrice = newPrices[productId]
    if (!newPrice) return

    setLoading(true)
    try {
      await updateStagingPrice(productId, newPrice)
      toast({
        title: 'Price updated',
        description: `Set to KES ${newPrice}`,
      })
      setEditingPrice(null)
      setNewPrices((prev) => {
        const updated = { ...prev }
        delete updated[productId]
        return updated
      })
      onApprove?.()
    } catch (error: unknown) {
      toast({
        title: 'Update failed',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: 'bg-yellow-50',
      approved: 'bg-green-50',
      published: 'bg-blue-50',
      rejected: 'bg-red-50',
      suspect_duplicate: 'bg-orange-50',
    }
    return statusMap[status] || ''
  }

  const hasCriticalIssues = (product: StagingProduct) => {
    return product.anomalies.some((a) => a.severity === 'critical')
  }

  return (
    <div className="w-full overflow-x-auto border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="w-12">
              <input type="checkbox" />
            </TableHead>
            <TableHead className="min-w-[200px]">Product</TableHead>
            <TableHead className="w-24">Brand</TableHead>
            <TableHead className="w-20">Unit</TableHead>
            <TableHead className="w-24">Listed Price</TableHead>
            <TableHead className="w-28">Suggested Price</TableHead>
            <TableHead className="w-20">Status</TableHead>
            <TableHead className="w-12">Issues</TableHead>
            <TableHead className="w-12">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <TableRow
              key={product.product_id}
              className={`${getStatusColor(product.review_status)} ${
                hasCriticalIssues(product) ? 'border-l-4 border-red-500' : ''
              }`}
            >
              <TableCell>
                <input type="checkbox" />
              </TableCell>

              <TableCell>
                <div className="space-y-1">
                  <p className="font-medium text-sm">{product.normalized_name}</p>
                  <p className="text-xs text-gray-500">
                    Confidence: {product.confidence_score}%
                  </p>
                  {product.barcode && (
                    <p className="text-xs text-gray-400">Barcode: {product.barcode}</p>
                  )}
                </div>
              </TableCell>

              <TableCell className="text-sm">
                {product.brand || <span className="text-gray-400">—</span>}
              </TableCell>

              <TableCell className="text-sm">
                {product.unit || <span className="text-gray-400">—</span>}
              </TableCell>

              <TableCell className="text-sm">
                {product.listed_price ? (
                  <span>KES {product.listed_price.toLocaleString()}</span>
                ) : (
                  <span className="text-amber-600">Missing</span>
                )}
              </TableCell>

              <TableCell>
                {editingPrice === product.product_id ? (
                  <div className="flex gap-1">
                    <Input
                      type="number"
                      value={newPrices[product.product_id] || ''}
                      onChange={(e) =>
                        setNewPrices((prev) => ({
                          ...prev,
                          [product.product_id]: parseInt(e.target.value) || 0,
                        }))
                      }
                      className="h-8 w-20 text-sm"
                      placeholder="KES"
                      disabled={loading}
                    />
                    <Button
                      size="sm"
                      variant="default"
                      className="h-8 px-2 text-xs"
                      onClick={() => handlePriceUpdate(product.product_id)}
                      disabled={loading}
                    >
                      Save
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">
                      KES {product.suggested_selling_price?.toLocaleString() || '—'}
                    </span>
                    <button
                      onClick={() => setEditingPrice(product.product_id)}
                      className="text-blue-600 hover:text-blue-800 text-xs ml-2"
                    >
                      <DollarSign className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </TableCell>

              <TableCell>
                <Badge
                  variant={
                    product.review_status === 'approved'
                      ? 'default'
                      : product.review_status === 'pending'
                      ? 'secondary'
                      : 'outline'
                  }
                  className="text-xs"
                >
                  {product.review_status}
                </Badge>
              </TableCell>

              <TableCell>
                <div className="flex gap-1">
                  {hasCriticalIssues(product) && (
                    <div className="relative group">
                      <AlertTriangle className="w-4 h-4 text-red-600 cursor-help" />
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block bg-red-900 text-white text-xs rounded p-2 w-48 z-10">
                        {product.anomalies
                          .filter((a) => a.severity === 'critical')
                          .map((a) => (
                            <p key={a.id} className="mb-1">
                              {a.description}
                            </p>
                          ))}
                      </div>
                    </div>
                  )}
                  {product.deduplications.length > 0 && (
                    <div className="relative group">
                      <Zap className="w-4 h-4 text-yellow-600 cursor-help" />
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block bg-yellow-900 text-white text-xs rounded p-2 w-48 z-10">
                        <p className="font-semibold mb-1">Potential Duplicates:</p>
                        {product.deduplications.slice(0, 3).map((d) => (
                          <p key={d.id} className="mb-1">
                            {d.dedup_method} ({d.confidence}%)
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </TableCell>

              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" disabled={loading}>
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {product.review_status !== 'approved' && (
                      <DropdownMenuItem
                        onClick={() => setApproveAlert(product.product_id)}
                      >
                        <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                        Approve
                      </DropdownMenuItem>
                    )}
                    {product.review_status !== 'rejected' && (
                      <DropdownMenuItem
                        onClick={() => setRejectAlert(product.product_id)}
                      >
                        <XCircle className="w-4 h-4 mr-2 text-red-600" />
                        Reject
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Approve Alert */}
      <AlertDialog open={!!approveAlert} onOpenChange={() => setApproveAlert(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Product?</AlertDialogTitle>
            <AlertDialogDescription>
              This product will be ready for publishing to live products. You can
              publish multiple approved products in batch.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => approveAlert && handleApprove(approveAlert)}
            disabled={loading}
          >
            Approve
          </AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Alert */}
      <AlertDialog open={!!rejectAlert} onOpenChange={() => setRejectAlert(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Product?</AlertDialogTitle>
            <AlertDialogDescription>
              This product will not be published. Provide a reason (optional).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Input
              placeholder="Reason for rejection..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => rejectAlert && handleReject(rejectAlert)}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700"
          >
            Reject
          </AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
