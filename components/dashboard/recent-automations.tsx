'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Zap, CheckCircle, AlertTriangle, Clock } from 'lucide-react'
import { getAutomationStats, type AutomationEvent } from '@/lib/automation-actions'

export function RecentAutomations() {
  const [events, setEvents] = useState<AutomationEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadEvents()
  }, [])

  async function loadEvents() {
    const stats = await getAutomationStats()
    setEvents(stats.recentEvents)
    setLoading(false)
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleString('en-KE', {
      hour12: false,
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function eventIcon(type: string) {
    if (type.startsWith('sale')) return <CheckCircle className="h-4 w-4 text-green-500" />
    if (type.startsWith('stock')) return <AlertTriangle className="h-4 w-4 text-amber-500" />
    if (type.startsWith('shift')) return <Clock className="h-4 w-4 text-blue-500" />
    return <Zap className="h-4 w-4 text-purple-500" />
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Zap className="h-4 w-4 text-yellow-500" />
          Recent Automations
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center text-muted-foreground py-4 text-sm">Loading...</div>
        ) : events.length === 0 ? (
          <div className="text-center text-muted-foreground py-4 text-sm">
            No automation events yet
          </div>
        ) : (
          <div className="space-y-3">
            {events.slice(0, 5).map(event => (
              <div key={event.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {eventIcon(event.event_type)}
                  <span className="text-sm">{event.event_type}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={event.processed ? 'default' : 'secondary'} className="text-xs">
                    {event.processed ? 'Done' : 'Pending'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{formatTime(event.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
