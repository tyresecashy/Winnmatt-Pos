'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import type { PendingAction, ToolResult, ActionResult } from '@/lib/ai/types'

interface AIActionCardProps {
  action: PendingAction
  onConfirm: (tool: string, args: Record<string, unknown>) => Promise<ToolResult>
  onCancel: () => void
}

export function AIActionCard({ action, onConfirm, onCancel }: AIActionCardProps) {
  const [executing, setExecuting] = useState(false)
  const [result, setResult] = useState<ToolResult | null>(null)

  const handleConfirm = async () => {
    setExecuting(true)
    try {
      const res = await onConfirm(action.tool, action.arguments)
      setResult(res)
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Execution failed',
      })
    }
    setExecuting(false)
  }

  if (result) {
    return (
      <Card className={`border-2 ${result.success ? 'border-green-200 bg-green-50 dark:bg-green-950/20' : 'border-red-200 bg-red-50 dark:bg-red-950/20'}`}>
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            {result.success ? (
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
            )}
            <div>
              <p className={`font-medium ${result.success ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>
                {result.success ? 'Action completed' : 'Action failed'}
              </p>
              {result.summary && (
                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{result.summary}</p>
              )}
              {result.error && (
                <p className="text-sm text-red-600 mt-1">{result.error}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-2 border-amber-200 bg-amber-50 dark:bg-amber-950/20">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2 text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4" />
          Pending Action
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <p className="text-sm font-medium">{action.toolDescription}</p>
        <div className="mt-2 text-xs text-muted-foreground space-y-1 bg-background/50 rounded p-2">
          {Object.entries(action.arguments).map(([key, value]) => (
            <div key={key} className="flex gap-2">
              <span className="font-medium min-w-[100px]">{key}:</span>
              <span className="font-mono">{String(value)}</span>
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter className="px-4 pb-3 pt-0 flex gap-2">
        <Button
          size="sm"
          onClick={handleConfirm}
          disabled={executing}
          className="bg-amber-600 hover:bg-amber-700 text-white"
        >
          {executing ? (
            <>
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Executing...
            </>
          ) : (
            'Confirm & Execute'
          )}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onCancel}
          disabled={executing}
        >
          Cancel
        </Button>
      </CardFooter>
    </Card>
  )
}
