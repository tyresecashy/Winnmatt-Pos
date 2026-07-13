'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronRight, ChevronDown, ShoppingCart, Calendar, RefreshCw, XCircle, Clock } from 'lucide-react'
import { formatKSh } from '@/lib/currency'

export interface EmployeeStatsData {
  todaySalesCount: number
  todaySalesTotal: number
  monthSalesCount: number
  monthSalesTotal: number
  refundCount: number
  voidCount: number
  clockedIn: boolean
  onBreak: boolean
}

interface EmployeePerformanceCardProps {
  employeeName: string
  employeeInitial: string
  subtitle: string
  expanded: boolean
  statsLoading: boolean
  stats: EmployeeStatsData | null
  onToggle: () => void
}

export function EmployeePerformanceCard({
  employeeName,
  employeeInitial,
  subtitle,
  expanded,
  statsLoading,
  stats,
  onToggle,
}: EmployeePerformanceCardProps) {
  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
              {employeeInitial || '?'}
            </div>
            <div>
              <CardTitle className="text-base">{employeeName}</CardTitle>
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent>
          {statsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : stats ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg border p-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ShoppingCart className="h-3.5 w-3.5" />
                  Today&apos;s Sales
                </div>
                <p className="mt-1 text-lg font-bold">{formatKSh(stats.todaySalesTotal)}</p>
                <p className="text-xs text-muted-foreground">{stats.todaySalesCount} transactions</p>
              </div>
              <div className="rounded-lg border p-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  Monthly Sales
                </div>
                <p className="mt-1 text-lg font-bold">{formatKSh(stats.monthSalesTotal)}</p>
                <p className="text-xs text-muted-foreground">{stats.monthSalesCount} transactions</p>
              </div>
              <div className="rounded-lg border p-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refunds
                </div>
                <p className="mt-1 text-lg font-bold">{stats.refundCount}</p>
              </div>
              <div className="rounded-lg border p-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <XCircle className="h-3.5 w-3.5" />
                  Voids
                </div>
                <p className="mt-1 text-lg font-bold">{stats.voidCount}</p>
              </div>
              <div className="rounded-lg border p-3 col-span-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  Attendance Today
                </div>
                <div className="mt-1 flex items-center gap-2">
                  {stats.clockedIn ? (
                    <Badge variant={stats.onBreak ? 'secondary' : 'default'}>
                      {stats.onBreak ? 'On Break' : 'Clocked In'}
                    </Badge>
                  ) : (
                    <Badge variant="outline">Not Clocked In</Badge>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">Could not load stats</p>
          )}
        </CardContent>
      )}
    </Card>
  )
}
