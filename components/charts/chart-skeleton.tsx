import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

/**
 * Reusable chart skeleton for analytics pages.
 * Matches the layout of chart cards in analytics pages.
 */
export function ChartSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardHeader><Skeleton className="h-5 w-36" /></CardHeader>
          <CardContent><Skeleton className="h-[300px] w-full rounded-lg" /></CardContent>
        </Card>
      ))}
    </div>
  )
}
