"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function RecentAutomations() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent Automations</CardTitle>
        <CardDescription>Latest automation executions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground">
          No automations yet
        </div>
      </CardContent>
    </Card>
  )
}
