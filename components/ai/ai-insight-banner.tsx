'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Info, Lightbulb, RefreshCw, X } from 'lucide-react'
import type { AIInsight } from '@/lib/modules/ai'

interface AIInsightBannerProps {
  analyzeFn: () => Promise<AIInsight[]>
  /** Maximum number of alerts to show */
  maxAlerts?: number
  /** Filter to only show high/medium priority */
  minPriority?: 'high' | 'medium' | 'low'
}

export function AIInsightBanner({
  analyzeFn,
  maxAlerts = 3,
  minPriority = 'medium',
}: AIInsightBannerProps) {
  const [insights, setInsights] = useState<AIInsight[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)

  const handleAnalyze = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await analyzeFn()
      const filtered = result.filter((ins) => {
        if (minPriority === 'high') return ins.priority === 'high'
        if (minPriority === 'medium') return ins.priority === 'high' || ins.priority === 'medium'
        return true
      })
      setInsights(filtered.slice(0, maxAlerts))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load alerts.')
    } finally {
      setLoading(false)
    }
  }

  if (dismissed) return null

  if (!insights && !loading && !error) {
    return (
      <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
        <CardContent className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span className="text-sm text-amber-800 dark:text-amber-300">
              Check for AI-powered inventory alerts
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleAnalyze} disabled={loading} className="h-7 text-xs">
              {loading ? (
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Lightbulb className="h-3 w-3 mr-1" />
              )}
              {loading ? 'Analyzing...' : 'Run Check'}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setDismissed(true)} className="h-6 w-6">
              <X className="h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20">
        <CardContent className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="text-sm text-red-800 dark:text-red-300">{error}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleAnalyze} className="h-7 text-xs">
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setDismissed(true)} className="h-6 w-6">
              <X className="h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-3 flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-primary animate-spin" />
          <span className="text-sm text-muted-foreground">Analyzing inventory data...</span>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      {insights?.map((insight) => (
        <Card
          key={insight.id}
          className={`border-l-4 ${
            insight.priority === 'high'
              ? 'border-l-red-500 bg-red-50/50 dark:bg-red-950/20'
              : insight.priority === 'medium'
              ? 'border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20'
              : 'border-l-green-500 bg-green-50/50 dark:bg-green-950/20'
          }`}
        >
          <CardContent className="p-3 flex items-start gap-3">
            <div className="mt-0.5">
              {insight.priority === 'high' ? (
                <AlertTriangle className="h-4 w-4 text-red-600" />
              ) : insight.priority === 'medium' ? (
                <Info className="h-4 w-4 text-amber-600" />
              ) : (
                <Lightbulb className="h-4 w-4 text-green-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{insight.title}</p>
                <Badge
                  variant="outline"
                  className={
                    insight.priority === 'high'
                      ? 'bg-red-100 text-red-700 border-red-200 text-xs'
                      : insight.priority === 'medium'
                      ? 'bg-amber-100 text-amber-700 border-amber-200 text-xs'
                      : 'bg-green-100 text-green-700 border-green-200 text-xs'
                  }
                >
                  {insight.priority}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{insight.summary}</p>
              {insight.recommendation && (
                <p className="text-xs font-medium text-primary mt-1">→ {insight.recommendation}</p>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={() => setDismissed(true)} className="h-6 w-6 shrink-0">
              <X className="h-3 w-3" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
