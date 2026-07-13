import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle, MinusCircle } from 'lucide-react'

interface GrantBadgeProps {
  grantType: string
}

/**
 * Badge for permission grant types: allow (green check), deny (red x), or none (neutral).
 * Replaces inline grant-type badge logic duplicated across permission pages.
 */
export function GrantBadge({ grantType }: GrantBadgeProps) {
  if (grantType === 'allow') {
    return (
      <Badge className="gap-1 border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400">
        <CheckCircle2 className="h-3 w-3" />Allow
      </Badge>
    )
  }
  if (grantType === 'deny') {
    return (
      <Badge className="gap-1 border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
        <XCircle className="h-3 w-3" />Deny
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      <MinusCircle className="h-3 w-3" />None
    </Badge>
  )
}
