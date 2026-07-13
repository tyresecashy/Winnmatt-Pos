"use client"
import { logger } from '@/lib/logger';

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Store,
  Plus,
  MapPin,
  Building2,
  Search,
  Loader2,
  Edit2,
  ToggleLeft,
  ToggleRight,
  Phone,
  Mail,
  User,
} from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
import { useAuth } from "@/contexts/auth-context"
import { getBranches, createBranch, updateBranch, toggleBranchStatus, getBranchManagers } from "@/lib/modules/branches"
import type { BranchRow } from "@/lib/modules/branches"

const TYPE_LABELS: Record<string, string> = {
  main: "Main",
  branch: "Branch",
  warehouse: "Warehouse",
}

const TYPE_VARIANTS: Record<string, string> = {
  main: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200",
  branch: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200",
  warehouse: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200",
}

const TIMEZONE_OPTIONS = [
  "Africa/Nairobi",
  "Africa/Dar_es_Salaam",
  "Africa/Kampala",
  "Africa/Kigali",
  "Africa/Addis_Ababa",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Africa/Lagos",
  "Africa/Casablanca",
  "UTC",
]

const DEFAULT_FORM = {
  name: "",
  code: "",
  location: "",
  phone: "",
  email: "",
  latitude: "",
  longitude: "",
  open_time: "",
  close_time: "",
  tax_id: "",
  tax_rate: "",
  manager_id: "none",
  timezone: "Africa/Nairobi",
  type: "branch",
  is_main: false,
}

export default function BranchesPage() {
  const { profile, authState } = useAuth()
  const [branches, setBranches] = useState<BranchRow[]>([])
  const [managers, setManagers] = useState<Array<{ id: string; full_name: string }>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingBranch, setEditingBranch] = useState<BranchRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [viewMode, setViewMode] = useState<"grid" | "compare">("grid")
  const [form, setForm] = useState({ ...DEFAULT_FORM })
  const [formError, setFormError] = useState<string | null>(null)
  const [toggleConfirm, setToggleConfirm] = useState<BranchRow | null>(null)

  const canManage = ["super_admin", "admin"].includes(profile?.role || "")

  const loadBranches = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await getBranches()
      setBranches(data || [])
    } catch (error) {
      logger.error("Failed to load branches:", error)
      setBranches([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadManagers = useCallback(async () => {
    try {
      const data = await getBranchManagers()
      setManagers(data || [])
    } catch (error) {
      logger.error("Failed to load managers:", error)
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      await Promise.all([loadBranches(), loadManagers()])
    }
    init()
  }, [loadBranches, loadManagers])

  const resetForm = () => {
    setForm({ ...DEFAULT_FORM })
    setFormError(null)
  }

  const openCreateDialog = () => {
    setEditingBranch(null)
    resetForm()
    setDialogOpen(true)
  }

  const openEditDialog = (branch: BranchRow) => {
    setEditingBranch(branch)
    setForm({
      name: branch.name,
      code: branch.code,
      location: branch.location || "",
      phone: branch.phone || "",
      email: branch.email || "",
      latitude: branch.latitude?.toString() || "",
      longitude: branch.longitude?.toString() || "",
      open_time: branch.open_time || "",
      close_time: branch.close_time || "",
      tax_id: branch.tax_id || "",
      tax_rate: branch.tax_rate?.toString() || "",
      manager_id: branch.manager_id || "none",
      timezone: branch.timezone || "Africa/Nairobi",
      type: branch.type,
      is_main: branch.is_main,
    })
    setFormError(null)
    setDialogOpen(true)
  }

  const handleField = (field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    setFormError(null)

    if (!form.name.trim()) { setFormError("Branch name is required"); return }
    if (!form.code.trim()) { setFormError("Branch code is required"); return }

    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim(),
        location: form.location.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
        open_time: form.open_time.trim() || null,
        close_time: form.close_time.trim() || null,
        tax_id: form.tax_id.trim() || null,
        tax_rate: form.tax_rate ? parseFloat(form.tax_rate) : null,
        manager_id: form.manager_id === "none" ? null : form.manager_id,
        timezone: form.timezone,
        type: form.type as 'main' | 'branch' | 'warehouse',
        is_main: form.is_main,
      }

      let result: BranchRow | null
      if (editingBranch) {
        result = await updateBranch(editingBranch.id, payload) as unknown as BranchRow
      } else {
        result = await createBranch(payload) as unknown as BranchRow
      }

      if (result) {
        setDialogOpen(false)
        void loadBranches()
      } else {
        setFormError(editingBranch ? "Failed to update branch" : "Failed to create branch")
      }
    } catch (error) {
      logger.error("Error saving branch:", error)
      setFormError("An unexpected error occurred")
    } finally {
      setSaving(false)
    }
  }

  const handleToggleStatus = async () => {
    if (!toggleConfirm) return
    const branch = toggleConfirm
    const newActive = branch.status !== "active"
    try {
      await toggleBranchStatus(branch.id, newActive)
      setToggleConfirm(null)
      void loadBranches()
    } catch (error) {
      logger.error("Error toggling branch status:", error)
    }
  }

  const filteredBranches = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase()
    if (!normalized) return branches
    return branches.filter((b) =>
      b.name.toLowerCase().includes(normalized) ||
      b.code.toLowerCase().includes(normalized) ||
      b.location?.toLowerCase().includes(normalized) ||
      b.email?.toLowerCase().includes(normalized)
    )
  }, [searchTerm, branches])

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
            Please sign in to manage branches.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Branches</h1>
          <p className="text-muted-foreground">Manage your business locations</p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreateDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Branch
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingBranch ? "Edit Branch" : "Add Branch"}</DialogTitle>
                  <DialogDescription>
                    {editingBranch ? "Update branch details and settings." : "Create a new business location."}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-5 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        placeholder="e.g. Main Store"
                        value={form.name}
                        onChange={(e) => handleField("name", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="code">Code</Label>
                      <Input
                        id="code"
                        placeholder="e.g. MAIN-001"
                        value={form.code}
                        onChange={(e) => handleField("code", e.target.value.toUpperCase())}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="type">Type</Label>
                      <Select value={form.type} onValueChange={(v) => handleField("type", v)}>
                        <SelectTrigger id="type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="main">Main</SelectItem>
                          <SelectItem value="branch">Branch</SelectItem>
                          <SelectItem value="warehouse">Warehouse</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="timezone">Timezone</Label>
                      <Select value={form.timezone} onValueChange={(v) => handleField("timezone", v)}>
                        <SelectTrigger id="timezone">
                          <SelectValue placeholder="Select timezone" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIMEZONE_OPTIONS.map((tz) => (
                            <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      placeholder="e.g. Nairobi CBD"
                      value={form.location}
                      onChange={(e) => handleField("location", e.target.value)}
                    />
                  </div>

                  <Separator />

                  <p className="text-sm font-medium text-muted-foreground">Contact</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        placeholder="e.g. 0700123456"
                        value={form.phone}
                        onChange={(e) => handleField("phone", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="e.g. branch@winnmatt.com"
                        value={form.email}
                        onChange={(e) => handleField("email", e.target.value)}
                      />
                    </div>
                  </div>

                  <Separator />

                  <p className="text-sm font-medium text-muted-foreground">GPS Coordinates</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="latitude">Latitude</Label>
                      <Input
                        id="latitude"
                        type="number"
                        step="any"
                        placeholder="e.g. -1.2921"
                        value={form.latitude}
                        onChange={(e) => handleField("latitude", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="longitude">Longitude</Label>
                      <Input
                        id="longitude"
                        type="number"
                        step="any"
                        placeholder="e.g. 36.8219"
                        value={form.longitude}
                        onChange={(e) => handleField("longitude", e.target.value)}
                      />
                    </div>
                  </div>

                  <Separator />

                  <p className="text-sm font-medium text-muted-foreground">Operating Hours</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="open_time">Open Time</Label>
                      <Input
                        id="open_time"
                        placeholder="e.g. 08:00"
                        value={form.open_time}
                        onChange={(e) => handleField("open_time", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="close_time">Close Time</Label>
                      <Input
                        id="close_time"
                        placeholder="e.g. 20:00"
                        value={form.close_time}
                        onChange={(e) => handleField("close_time", e.target.value)}
                      />
                    </div>
                  </div>

                  <Separator />

                  <p className="text-sm font-medium text-muted-foreground">Tax Settings</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="tax_id">Tax ID</Label>
                      <Input
                        id="tax_id"
                        placeholder="e.g. VAT-001"
                        value={form.tax_id}
                        onChange={(e) => handleField("tax_id", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tax_rate">Tax Rate (%)</Label>
                      <Input
                        id="tax_rate"
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        placeholder="e.g. 16"
                        value={form.tax_rate}
                        onChange={(e) => handleField("tax_rate", e.target.value)}
                      />
                    </div>
                  </div>

                  <Separator />

                  <p className="text-sm font-medium text-muted-foreground">Assignment</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="manager_id">Manager</Label>
                      <Select value={form.manager_id} onValueChange={(v) => handleField("manager_id", v)}>
                        <SelectTrigger id="manager_id">
                          <SelectValue placeholder="Select manager" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No manager assigned</SelectItem>
                          {managers.map((m) => (
                            <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 flex items-end pb-2">
                      <div className="flex items-center gap-3">
                        <Switch
                          id="is_main"
                          checked={form.is_main}
                          onCheckedChange={(v) => handleField("is_main", v)}
                        />
                        <Label htmlFor="is_main" className="cursor-pointer">Is Main Branch</Label>
                      </div>
                    </div>
                  </div>

                  {formError && (
                    <p className="text-sm text-destructive">{formError}</p>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {editingBranch ? "Update" : "Create"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search branches..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "grid" | "compare")}>
                <TabsList>
                  <TabsTrigger value="grid">Grid</TabsTrigger>
                  <TabsTrigger value="compare">Compare</TabsTrigger>
                </TabsList>
              </Tabs>
              <p className="text-xs text-muted-foreground whitespace-nowrap">
                {filteredBranches.length} of {branches.length} branches
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6 space-y-3">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-32" />
                    <div className="flex gap-2 pt-2">
                      <Skeleton className="h-8 w-8 rounded-md" />
                      <Skeleton className="h-8 w-8 rounded-md" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredBranches.length === 0 ? (
            <EmptyState
              icon={Store}
              title={searchTerm ? "No branches found" : "No branches yet"}
              description={searchTerm ? "Try a different search term." : "Create your first branch to start managing locations."}
              actions={!searchTerm && canManage ? [{ label: 'Add Branch', onClick: openCreateDialog, icon: Plus }] : undefined}
              compact
            />
          ) : viewMode === "compare" ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead>Products</TableHead>
                  <TableHead>Sales Today</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBranches.map((branch) => (
                  <TableRow key={branch.id}>
                    <TableCell className="font-medium">{branch.name}</TableCell>
                    <TableCell>
                      <code className="rounded bg-muted px-2 py-1 text-xs font-mono">{branch.code}</code>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {branch.location || <span className="text-xs italic">Not set</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={branch.status === "active" ? "secondary" : "outline"}>
                        {branch.status === "active" ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {branch.manager_name || <span className="text-xs italic">Unassigned</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">--</TableCell>
                    <TableCell className="text-muted-foreground">--</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {canManage && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => openEditDialog(branch)} title="Edit branch">
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setToggleConfirm(branch)}
                              title={branch.status === "active" ? "Deactivate" : "Activate"}
                            >
                              {branch.status === "active" ? (
                                <ToggleRight className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredBranches.map((branch) => (
                <Card key={branch.id} className="relative overflow-hidden">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{branch.name}</p>
                          <Badge variant="outline" className="mt-1 text-xs font-mono">
                            {branch.code}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      {branch.location && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{branch.location}</span>
                        </div>
                      )}
                      {branch.phone && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          <span>{branch.phone}</span>
                        </div>
                      )}
                      {branch.email && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{branch.email}</span>
                        </div>
                      )}
                      {branch.manager_name && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <User className="h-3.5 w-3.5 shrink-0" />
                          <span>{branch.manager_name}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={branch.status === "active" ? "secondary" : "outline"}>
                        {branch.status === "active" ? "Active" : "Inactive"}
                      </Badge>
                      <Badge variant="outline" className={TYPE_VARIANTS[branch.type] || ""}>
                        {TYPE_LABELS[branch.type] || branch.type}
                      </Badge>
                      {branch.is_main && (
                        <Badge variant="default" className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100">
                          Main
                        </Badge>
                      )}
                    </div>

                    {canManage && (
                      <div className="flex items-center gap-1 pt-1 border-t">
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(branch)} title="Edit branch">
                          <Edit2 className="h-4 w-4" />
                          <span className="ml-1.5 text-xs">Edit</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setToggleConfirm(branch)}
                          title={branch.status === "active" ? "Deactivate" : "Activate"}
                        >
                          {branch.status === "active" ? (
                            <ToggleRight className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="ml-1.5 text-xs">
                            {branch.status === "active" ? "Deactivate" : "Activate"}
                          </span>
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!toggleConfirm} onOpenChange={(open) => { if (!open) setToggleConfirm(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggleConfirm?.status === "active" ? "Deactivate Branch" : "Activate Branch"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggleConfirm?.status === "active"
                ? `Are you sure you want to deactivate "${toggleConfirm?.name}"? This branch will no longer be available for transactions.`
                : `Are you sure you want to activate "${toggleConfirm?.name}"? The branch will be available for transactions.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleStatus}>
              {toggleConfirm?.status === "active" ? "Deactivate" : "Activate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
