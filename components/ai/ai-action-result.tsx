'use client'

import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle, XCircle, Info } from 'lucide-react'
import type { ActionResult } from '@/lib/ai/types'

interface AIActionResultProps {
  result: ActionResult
}

/**
 * Renders the result of an AI action execution in the chat
 */
export function AIActionResult({ result }: AIActionResultProps) {
  const isSuccess = result.result.success
  const data = result.result.data as any

  return (
    <Card className={`border ${isSuccess ? 'border-green-200' : 'border-red-200'}`}>
      <CardContent className="pt-3 pb-3">
        <div className="flex items-start gap-3">
          {isSuccess ? (
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
          ) : (
            <XCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            {result.result.summary && (
              <p className={`text-sm whitespace-pre-wrap ${isSuccess ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>
                {result.result.summary}
              </p>
            )}
            {result.result.error && (
              <p className="text-sm text-red-600 mt-1">{result.result.error}</p>
            )}

            {/* Show data summary for read operations */}
            {isSuccess && data && Array.isArray(data) && data.length > 0 && (
              <div className="mt-2 text-xs text-muted-foreground">
                <p className="font-medium mb-1 flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Results ({data.length} item{data.length !== 1 ? 's' : ''})
                </p>
                <ul className="space-y-1 max-h-40 overflow-y-auto">
                  {data.slice(0, 10).map((item: Record<string, unknown>, i: number) => (
                    <li key={i} className="bg-background rounded px-2 py-1">
                      {item.name ? String(item.name) : item.full_name ? String(item.full_name) : item.receipt_number ? `#${item.receipt_number}` : `Item ${i + 1}`}
                      {item.total_amount ? ` — KSh ${Number(item.total_amount).toLocaleString()}` : ''}
                      {item.selling_price ? ` — KSh ${Number(item.selling_price)}` : ''}
                      {item.quantity !== undefined ? ` — qty: ${item.quantity}` : ''}
                    </li>
                  ))}
                  {data.length > 10 && (
                    <li className="text-muted-foreground italic px-2">...and {data.length - 10} more</li>
                  )}
                </ul>
              </div>
            )}

            {/* Show single object data */}
            {isSuccess && data && !Array.isArray(data) && typeof data === 'object' && data !== null && (
              <div className="mt-2 text-xs text-muted-foreground bg-background rounded p-2 max-h-40 overflow-y-auto">
                {Object.entries(data as Record<string, unknown>)
                  .filter(([_, v]) => typeof v !== 'object' || v === null)
                  .slice(0, 15)
                  .map(([key, value]) => (
                    <div key={key} className="flex gap-2">
                      <span className="font-medium min-w-[120px]">{key}:</span>
                      <span className="font-mono">{String(value ?? '—')}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
