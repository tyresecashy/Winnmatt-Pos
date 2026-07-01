"use client"
import { logger } from '@/lib/logger';

import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle, Calendar, Lightbulb, RefreshCw, ShoppingBag } from "lucide-react"
import { getSeasonalInsights } from "@/lib/dashboard-actions"
import { formatKSh } from "@/lib/currency"

interface SeasonalData {
  currentMonth: string
  projection: number
  decemberPeak: number
  monthsUntilPeak: number
  recommendation: string
  retailVsWholesale: {
    retail: number
    wholesale: number
  }
}

export function SeasonalInsights() {
  const { profile } = useAuth()
  const [insights, setInsights] = useState<SeasonalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    const fetchInsights = async () => {
      if (!profile?.branch_id) return

      try {
        setLoading(true)
        const data = await getSeasonalInsights(profile.branch_id)
        setError(null)
        setInsights(data)
      } catch (error) {
        logger.error('Error fetching seasonal insights:', error)
        setError('Failed to load seasonal insights')
      } finally {
        setLoading(false)
      }
    }

    fetchInsights()
  }, [profile?.branch_id, retryCount])

  if (loading || !insights) {
    return (
      <Card className="bg-gradient-to-br from-secondary/30 to-background">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <CardTitle>Seasonal Insights</CardTitle>
          </div>
          <CardDescription>Performance trends and projections</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
          {error && (
            <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={() => setRetryCount(c => c + 1)} className="ml-auto">
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-gradient-to-br from-secondary/30 to-background">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <CardTitle>Seasonal Insights</CardTitle>
        </div>
        <CardDescription>Performance trends and projections</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{insights.currentMonth} Projection</span>
            <span className="text-sm font-semibold">{formatKSh(insights.projection)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">December Peak</span>
            <span className="text-sm font-semibold text-primary">{formatKSh(insights.decemberPeak)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Months to Peak</span>
            <span className="text-sm font-semibold">{insights.monthsUntilPeak} months</span>
          </div>
        </div>

        <div className="rounded-lg bg-card p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Lightbulb className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">
              {insights.recommendation}
            </p>
          </div>
        </div>

        <div className="rounded-lg bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Retail vs Wholesale</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-lg font-bold">{formatKSh(insights.retailVsWholesale.retail)}</p>
              <p className="text-xs text-muted-foreground">Retail Sales</p>
            </div>
            <div>
              <p className="text-lg font-bold">{formatKSh(insights.retailVsWholesale.wholesale)}</p>
              <p className="text-xs text-muted-foreground">Wholesale Sales</p>
            </div>
          </div>
        </div>
        {error && (
          <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={() => setRetryCount(c => c + 1)} className="ml-auto">
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
