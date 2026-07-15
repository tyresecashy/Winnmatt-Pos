/**
 * Publish Dialog Component
 * Admin dialog to publish approved staging products to live products
 */

'use client'

import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/auth-context'
import { Loader2, Send } from 'lucide-react'
import { publishBatchToLive } from '@/lib/modules/system'

interface PublishDialogProps {
  batchId: string
  approvedCount: number
  onPublishComplete?: () => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function PublishDialog({
  batchId,
  approvedCount,
  onPublishComplete,
  open = false,
  onOpenChange,
}: PublishDialogProps) {
  const [internalOpen, setInternalOpen] = useState(open)
  const [loading, setLoading] = useState(false)
  const [published, setPublished] = useState<{ success?: boolean; published?: number; updated?: number; total?: number; error?: string } | null>(null)
  const { toast } = useToast()
  const { user } = useAuth()

  const isOpen = open !== undefined ? open : internalOpen
  const setOpen = onOpenChange || setInternalOpen

  const handlePublish = async () => {
    if (!user?.id) {
      toast({
        title: 'Error',
        description: 'Not authenticated',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      const result = await publishBatchToLive(batchId, user.id)

      if (!result.success && result.error) {
        toast({
          title: 'Publish error',
          description: result.error,
          variant: 'destructive',
        })
        setOpen(false)
        return
      }

      setPublished(result)

      toast({
        title: 'Published!',
        description: `${(result as unknown as { total?: number }).total ?? ''} products published to live catalog`,
      })

      // Close dialog after showing results
      setTimeout(() => {
        setPublished(null)
        setOpen(false)
        onPublishComplete?.()
      }, 3000)
    } catch (error: unknown) {
      toast({
        title: 'Publish failed',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Publish to Live Products?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <div>
              <p className="font-semibold">Ready to publish:</p>
              <p className="text-lg text-green-600">{approvedCount} products</p>
            </div>

            {published && (
              <div className="bg-green-50 border border-green-200 rounded p-3 text-sm rounded">
                <p className="font-semibold text-green-900 mb-2">Published!</p>
                <ul className="space-y-1 text-green-800">
                  <li>• New products: {published.published}</li>
                  <li>• Updated products: {published.updated}</li>
                  <li>• Total: {published.total}</li>
                </ul>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-800">
              <p className="font-semibold mb-2">What happens:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Approved products move to live products table</li>
                <li>New products are created, duplicates are updated</li>
                <li>POS can immediately sell these products</li>
                <li>Current live prices not overwritten for existing products</li>
              </ul>
            </div>

            <p className="text-bold text-red-600">
              ⚠️ This action cannot be undone. Verify all prices are correct.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {!published ? (
          <>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePublish}
              disabled={loading || approvedCount === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Publish {approvedCount} Products
                </>
              )}
            </AlertDialogAction>
          </>
        ) : (
          <Button
            onClick={() => {
              setPublished(null)
              setOpen(false)
              onPublishComplete?.()
            }}
            className="w-full"
          >
            Done
          </Button>
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}
