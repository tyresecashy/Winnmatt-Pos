"use client"
import { logger } from '@/lib/logger'

import { startTransition, useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { getLaunchReadiness, updateLaunchChecklistItem } from "@/lib/modules/system"
import { CheckCircle2, XCircle, Loader2 } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"

type ChecklistItem = { key: string; label: string }

const CHECKLIST_ITEMS: ChecklistItem[] = [
  { key: "products_imported", label: "Products Imported" },
  { key: "taxes_configured", label: "Taxes Configured" },
  { key: "users_assigned", label: "Users Assigned" },
  { key: "receipt_printer_connected", label: "Receipt Printer Connected" },
  { key: "barcode_scanner_tested", label: "Barcode Scanner Tested" },
  { key: "cash_drawer_tested", label: "Cash Drawer Tested" },
  { key: "payment_methods_enabled", label: "Payment Methods Enabled" },
  { key: "backup_verified", label: "Backup Verified" },
  { key: "branch_hours_set", label: "Branch Hours Set" },
  { key: "loyalty_rules_configured", label: "Loyalty Rules Configured" },
  { key: "first_float_prepared", label: "First Float Prepared" },
  { key: "register_configured", label: "Register Configured" },
  { key: "internet_health_check", label: "Internet Health Check" },
]

const TOTAL_ITEMS = CHECKLIST_ITEMS.length

function getStatusBadge(status: string) {
  switch (status) {
    case "passed":
      return <Badge className="bg-green-600 hover:bg-green-600">Passed</Badge>
    case "in_progress":
      return <Badge className="bg-amber-500 hover:bg-amber-500">In Progress</Badge>
    case "failed":
      return <Badge variant="destructive">Failed</Badge>
    default:
      return <Badge variant="secondary">Incomplete</Badge>
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case "passed": return "bg-green-500"
    case "in_progress": return "bg-amber-500"
    case "failed": return "bg-red-500"
    default: return "bg-muted"
  }
}

export default function LaunchReadinessPage() {
  const { profile, authState } = useAuth()
  const [checklist, setChecklist] = useState<Record<string, boolean> | null>(null)
  const [status, setStatus] = useState("incomplete")
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const [runningCheck, setRunningCheck] = useState(false)

  const branchId = profile?.branch_id

  const loadChecklist = useCallback(async () => {
    if (!branchId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await getLaunchReadiness(branchId) as { items?: Record<string, boolean>; status?: string; last_checked_at?: string } | null
      if (data) {
        setChecklist(data.items ?? null)
        setStatus(data.status ?? '')
        setLastCheckedAt(data.last_checked_at || null)
      }
    } catch (error) {
      logger.error("Failed to load launch readiness:", error)
    } finally {
      setLoading(false)
    }
  }, [branchId])

  useEffect(() => {
    startTransition(() => { void loadChecklist() })
  }, [loadChecklist])

  const handleToggle = async (key: string, currentValue: boolean) => {
    if (!branchId || toggling) return
    setToggling(key)
    const newValue = !currentValue
    setChecklist((prev) => (prev ? { ...prev, [key]: newValue } : prev))

    try {
      const result = await updateLaunchChecklistItem(branchId, key, newValue)
      if (result.success) {
        if (result.status) setStatus(result.status)
      }
    } catch (error) {
      setChecklist((prev) => (prev ? { ...prev, [key]: currentValue } : prev))
      logger.error("Failed to update checklist item:", error)
    } finally {
      setToggling(null)
    }
  }

  const handleRunFinalCheck = async () => {
    if (!branchId || runningCheck) return
    setRunningCheck(true)
    try {
      const data = await getLaunchReadiness(branchId) as { items?: Record<string, boolean>; status?: string; last_checked_at?: string } | null
      if (data) {
        setChecklist(data.items ?? null)
        setStatus(data.status ?? '')
        setLastCheckedAt(data.last_checked_at || null)
      }
    } catch (error) {
      logger.error("Failed to re-verify checklist:", error)
    } finally {
      setRunningCheck(false)
    }
  }

  const completedCount = checklist ? Object.values(checklist).filter(Boolean).length : 0
  const percentage = TOTAL_ITEMS > 0 ? Math.round((completedCount / TOTAL_ITEMS) * 100) : 0

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
            Please sign in to view launch readiness.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Launch Readiness Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Before a branch goes live, verify all requirements
          </p>
        </div>
        {getStatusBadge(status)}
      </div>

      <Card>
        <CardContent className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !checklist ? (
            <EmptyState title="No checklist data" description="Select a branch to view its launch readiness." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {CHECKLIST_ITEMS.map((item) => {
                const checked = checklist[item.key] ?? false
                const isToggling = toggling === item.key
                return (
                  <div
                    key={item.key}
                    onClick={() => handleToggle(item.key, checked)}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50"
                  >
                    <div className="shrink-0">
                      {isToggling ? (
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      ) : checked ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                    <span className={`text-sm font-medium ${checked ? "" : "text-muted-foreground"}`}>
                      {item.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {completedCount} of {TOTAL_ITEMS} items complete
          </p>
          <div className="h-3 w-full overflow-hidden rounded-full bg-primary/10">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getStatusColor(status)}`}
              style={{ width: `${percentage}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-2xl font-bold">{percentage}%</p>
            <p className="text-xs text-muted-foreground">
              Readiness Score
            </p>
          </div>
          {lastCheckedAt && (
            <p className="text-xs text-muted-foreground">
              Last checked: {new Date(lastCheckedAt).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleRunFinalCheck} disabled={runningCheck}>
          {runningCheck && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Run Final Check
        </Button>
      </div>
    </div>
  )
}
