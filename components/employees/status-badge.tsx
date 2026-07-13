import { Badge } from '@/components/ui/badge'
import type { VariantProps } from 'class-variance-authority'

const STATUS_VARIANTS: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
  active: { variant: 'default', label: 'Active' },
  inactive: { variant: 'secondary', label: 'Inactive' },
  terminated: { variant: 'destructive', label: 'Terminated' },
  on_leave: { variant: 'outline', label: 'On Leave' },
}

interface EmployeeStatusBadgeProps {
  status: string | null | undefined
}

/**
 * Badge for employee status (active / inactive / terminated / on_leave).
 * Use this instead of inlining the switch in every page/component.
 */
export function EmployeeStatusBadge({ status }: EmployeeStatusBadgeProps) {
  const v = STATUS_VARIANTS[status ?? ''] ?? { variant: 'secondary' as const, label: status || 'Unknown' }
  return <Badge variant={v.variant}>{v.label}</Badge>
}
