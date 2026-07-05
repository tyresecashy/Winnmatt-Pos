"use client"

import { logger } from '@/lib/logger';
import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Loader2, Bell, BellRing, CheckCheck, Info, AlertTriangle, XCircle, CheckCircle, Clock, ExternalLink } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  getNotificationRules,
} from "@/lib/notification-actions"

interface Notification {
  id: string
  title: string
  body: string
  event_type: string
  severity: string
  is_read: boolean
  created_at: string
  action_url: string | null
  reference_type: string | null
  reference_id: string | null
}

interface NotificationRule {
  id: string
  event_type: string
  delivery_method: string
  recipient: string
  is_active: boolean
  label: string | null
  branch_id: string | null
}

const severityConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  info: { icon: <Info className="h-4 w-4" />, color: "text-blue-600 bg-blue-100 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800", label: "Info" },
  warning: { icon: <AlertTriangle className="h-4 w-4" />, color: "text-amber-600 bg-amber-100 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800", label: "Warning" },
  critical: { icon: <XCircle className="h-4 w-4" />, color: "text-red-600 bg-red-100 dark:bg-red-950/40 border-red-200 dark:border-red-800", label: "Critical" },
  success: { icon: <CheckCircle className="h-4 w-4" />, color: "text-green-600 bg-green-100 dark:bg-green-950/40 border-green-200 dark:border-green-800", label: "Success" },
}

function formatTimestamp(ts: string) {
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString()
}

export default function NotificationsPage() {
  const { profile, authState } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [rules, setRules] = useState<NotificationRule[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [severityFilter, setSeverityFilter] = useState<string>("all")
  const [rulesLoading, setRulesLoading] = useState(false)

  const loadData = useCallback(async () => {
    if (!profile?.id) return
    setIsLoading(true)
    try {
      const [notifs, count] = await Promise.all([
        getNotifications(profile.id),
        getUnreadCount(profile.id),
      ])
      setNotifications(notifs as Notification[])
      setUnreadCount(count)
    } catch (error) {
      logger.error("Failed to load notifications:", error)
    } finally {
      setIsLoading(false)
    }
  }, [profile])

  const loadRules = useCallback(async () => {
    if (!profile?.branch_id) return
    setRulesLoading(true)
    try {
      const data = await getNotificationRules(profile.branch_id)
      setRules(data as NotificationRule[])
    } catch (error) {
      logger.error("Failed to load notification rules:", error)
    } finally {
      setRulesLoading(false)
    }
  }, [profile])

  useEffect(() => {
    if (authState === "authenticated") {
      void loadData()
    }
  }, [authState, loadData])

  useEffect(() => {
    if (authState === "authenticated") {
      void loadRules()
    }
  }, [authState, loadRules])

  const handleMarkAsRead = async (notificationId: string) => {
    await markAsRead(notificationId)
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
    )
    setUnreadCount((prev) => Math.max(0, prev - 1))
  }

  const handleMarkAllAsRead = async () => {
    if (!profile?.id) return
    await markAllAsRead(profile.id)
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }

  const filteredNotifications = useMemo(() => {
    if (severityFilter === "all") return notifications
    return notifications.filter((n) => n.severity === severityFilter)
  }, [notifications, severityFilter])

  const unreadFiltered = useMemo(
    () => filteredNotifications.filter((n) => !n.is_read).length,
    [filteredNotifications]
  )

  if (authState === "loading") {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex min-h-[220px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex min-h-[220px] items-center justify-center text-muted-foreground">
            Please sign in to view notifications.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications Center</h1>
          <p className="text-muted-foreground">
            Manage your alerts and notification preferences
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={() => void handleMarkAllAsRead()}>
            <CheckCheck className="h-4 w-4 mr-2" />
            Mark All Read
          </Button>
        )}
      </div>

      <Tabs defaultValue="inbox" className="w-full">
        <TabsList>
          <TabsTrigger value="inbox" className="gap-2">
            <Bell className="h-4 w-4" />
            Inbox
            {unreadCount > 0 && (
              <Badge variant="default" className="ml-1 h-5 px-1.5 text-xs">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="rules" className="gap-2">
            <BellRing className="h-4 w-4" />
            Notification Rules
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="space-y-4">
          <div className="flex items-center gap-4">
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="success">Success</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Showing {filteredNotifications.length} notifications
              {unreadFiltered > 0 && ` (${unreadFiltered} unread)`}
            </p>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : filteredNotifications.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Bell className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-lg font-medium">No notifications</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {severityFilter !== "all"
                    ? "No notifications match the selected severity."
                    : "You're all caught up!"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredNotifications.map((notification) => {
                const sev = severityConfig[notification.severity] || severityConfig.info
                return (
                  <Card
                    key={notification.id}
                    className={`cursor-pointer transition-colors hover:bg-accent/50 ${
                      !notification.is_read ? "border-l-4 border-l-primary" : "opacity-80"
                    }`}
                    onClick={() => {
                      if (!notification.is_read) {
                        void handleMarkAsRead(notification.id)
                      }
                    }}
                  >
                    <CardContent className="flex items-start gap-4 py-4">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${sev.color}`}>
                        {sev.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className={`text-sm font-medium ${!notification.is_read ? "text-foreground" : "text-muted-foreground"}`}>
                              {notification.title}
                            </p>
                            {notification.body && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {notification.body}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {!notification.is_read && (
                              <span className="h-2 w-2 rounded-full bg-primary" title="Unread" />
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatTimestamp(notification.created_at)}
                          </span>
                          <Badge variant="outline" className="text-xs capitalize">
                            {notification.event_type || sev.label}
                          </Badge>
                          {notification.action_url && (
                            <a
                              href={notification.action_url}
                              className="flex items-center gap-1 text-xs text-primary hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="h-3 w-3" />
                              View
                            </a>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="rules">
          <Card>
            <CardHeader>
              <CardTitle>Notification Rules</CardTitle>
              <CardDescription>
                Configure when and how notifications are delivered
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rulesLoading ? (
                <div className="space-y-3 py-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : rules.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                    <BellRing className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-lg font-medium">No notification rules</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Rules determine how you receive notifications.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Active</TableHead>
                      <TableHead>Event Type</TableHead>
                      <TableHead>Delivery Method</TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Label</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell>
                          <Switch
                            checked={rule.is_active}
                            onCheckedChange={() => {
                              setRules((prev) =>
                                prev.map((r) =>
                                  r.id === rule.id ? { ...r, is_active: !r.is_active } : r
                                )
                              )
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {rule.event_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="capitalize">{rule.delivery_method}</TableCell>
                        <TableCell className="text-muted-foreground">{rule.recipient}</TableCell>
                        <TableCell className="text-muted-foreground">{rule.label || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
