'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertTriangle, Brain, RefreshCw, Sparkles, X } from 'lucide-react'
import { AIInsightCard } from './ai-insight-card'
import type { AIInsight } from '@/lib/modules/ai'

interface AIInsightSectionProps {
  title: string
  description?: string
  analyzeFn: () => Promise<AIInsight[]>
  /** Default false — loads immediately when set to true */
  autoLoad?: boolean
}

export function AIInsightSection({ title, description, analyzeFn }: AIInsightSectionProps) {
  const [insights, setInsights] = useState<AIInsight[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(true)

  const handleAnalyze = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await analyzeFn()
      setInsights(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              {description && (
                <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {insights && insights.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
                className="h-8 px-2"
              >
                {expanded ? <X className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              </Button>
            )}
            {insights && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAnalyze}
                disabled={loading}
                className="h-8"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            )}
            {!insights && !loading && (
              <Button
                variant="default"
                size="sm"
                onClick={handleAnalyze}
                disabled={loading}
                className="h-8"
              >
                {loading ? (
                  <RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                )}
                {loading ? 'Analyzing...' : 'Run AI Analysis'}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {loading && (
        <CardContent className="pb-4">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-3 p-4">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}

      {error && (
        <CardContent className="pb-4">
          <div className="flex items-start gap-3 rounded-md bg-red-50 dark:bg-red-900/20 p-3 border border-red-200 dark:border-red-800">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-300">Analysis Error</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>
              <Button variant="outline" size="sm" onClick={handleAnalyze} className="mt-2 h-7 text-xs">
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry
              </Button>
            </div>
          </div>
        </CardContent>
      )}

      {insights && insights.length > 0 && expanded && (
        <CardContent className="pb-4 space-y-3">
          {insights.map((insight) => (
            <AIInsightCard key={insight.id} insight={insight} />
          ))}
        </CardContent>
      )}

      {insights && insights.length === 0 && !loading && !error && (
        <CardContent className="pb-4">
          <p className="text-sm text-muted-foreground text-center py-4">
            No significant insights found for this period.
          </p>
        </CardContent>
      )}

      {!insights && !loading && !error && (
        <CardContent className="pb-4">
          <p className="text-xs text-muted-foreground text-center py-2">
            Click <strong>Run AI Analysis</strong> to generate AI-powered insights from your data.
          </p>
        </CardContent>
      )}
    </Card>
  )
}
