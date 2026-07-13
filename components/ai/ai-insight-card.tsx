'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  AlertTriangle,
  Lightbulb,
  Star,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
} from 'lucide-react'
import type { AIInsight } from '@/lib/modules/ai'

const priorityConfig: Record<string, { icon: typeof AlertTriangle; className: string }> = {
  high: { icon: AlertTriangle, className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  medium: { icon: Lightbulb, className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  low: { icon: Star, className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
}

const typeIcons: Record<string, typeof TrendingUp> = {
  sales: TrendingUp,
  inventory: TrendingDown,
  finance: Minus,
  customer: Star,
  workforce: TrendingUp,
  dashboard: Sparkles,
  customer_detail: Star,
}

interface AIInsightCardProps {
  insight: AIInsight
}

export function AIInsightCard({ insight }: AIInsightCardProps) {
  const PriorityIcon = priorityConfig[insight.priority]?.icon || Lightbulb
  const TypeIcon = typeIcons[insight.type] || Sparkles
  const priorityClass = priorityConfig[insight.priority]?.className || 'bg-gray-100 text-gray-700'

  return (
    <Card className="border-l-4 border-l-primary/30">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-primary/10 p-1.5">
            <TypeIcon className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold text-sm">{insight.title}</h4>
              <Badge variant="outline" className={priorityClass}>
                <PriorityIcon className="h-3 w-3 mr-1 inline" />
                {insight.priority}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {Math.round(insight.confidence * 100)}% confidence
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{insight.summary}</p>
            <details className="mt-2 group">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                View details
              </summary>
              <div className="mt-2 space-y-2 text-sm">
                <p>{insight.details}</p>
                {insight.recommendation && (
                  <div className="rounded-md bg-primary/5 p-3 border border-primary/10">
                    <p className="text-xs font-medium text-primary mb-1">Recommendation</p>
                    <p className="text-sm">{insight.recommendation}</p>
                  </div>
                )}
              </div>
            </details>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
