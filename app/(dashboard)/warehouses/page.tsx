"use client"
import { logger } from '@/lib/logger';

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
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
import { Warehouse, Plus, MapPin, Building2, Search, Loader2, Edit2, ToggleLeft, ToggleRight } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { getWarehouses, createWarehouse, updateWarehouse, deleteWarehouse } from "@/lib/warehouse-actions"

type WarehouseRow = {
  id: string
  name: string
  code: string
  branch_id: string | null
  location: string | null
  manager_id: string | null
  type: 'central' | 'branch' | 'regional'
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
}

const typeLabels: Record<string, string> = {
  central: 'Central',
  branch: 'Branch',
  regional: 'Regional',
}

const typeColors: Record<string, string> = {
  central: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200',
  branch: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200',
  regional: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200',
}

export default function WarehousesPage() {
  const { profile, authState } = useAuth()
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([])
  const [branches, setBranches] = useState<Array<{ id: string; name: string; code: string }>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseRow | null>(null)
  const [saving, setSaving] = useState(false)

  const [formName, setFormName] = useState("")
  const [formCode, setFormCode] = useState("")
  const [formType, setFormType] = useState<string>("branch")
  const [formBranchId, setFormBranchId] = useState<string>("none")
  const [formLocation, setFormLocation] = useState("")
  const [formError, setFormError] = useState<string | null>(null)

  const hasLoadedRef = useRef(false)

  const canManage = ["super_admin", "admin"].includes(profile?.role || "")

  const loadWarehouses = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await getWarehouses()
      setWarehouses(data || [])
      hasLoadedRef.current = true
    } catch (error) {
      logger.error("Failed to load warehouses:", error)
      setWarehouses([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadBranches = useCallback(async () => {
    try {
      const { supabaseAdmin } = await import('@/lib/supabase-server')
      const { data } = await supabaseAdmin
        .from('branches')
        .select('id, name, code')
        .order('name')
      setBranches(data || [])
    } catch (error) {
      logger.error("Failed to load branches:", error)
    }
  }, [])

  useEffect(() => {
    void loadWarehouses()
    void loadBranches()
  }, [loadWarehouses, loadBranches])

  const openCreateDialog = () => {
    setEditingWarehouse(null)
    setFormName("")
    setFormCode("")
    setFormType("branch")
    setFormBranchId("none")
    setFormLocation("")
    setFormError(null)
    setDialogOpen(true)
  }

  const openEditDialog = (warehouse: WarehouseRow) => {
    setEditingWarehouse(warehouse)
    setFormName(warehouse.name)
    setFormCode(warehouse.code)
    setFormType(warehouse.type)
    setFormBranchId(warehouse.branch_id || "none")
    setFormLocation(warehouse.location || "")
    setFormError(null)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    setFormError(null)

    if (!formName.trim()) {
      setFormError("Warehouse name is required")
      return
    }
    if (!formCode.trim()) {
      setFormError("Warehouse code is required")
      return
    }
    if (!formType) {
      setFormError("Warehouse type is required")
      return
    }

    setSaving(true)
    try {
      if (editingWarehouse) {
        const result = await updateWarehouse(editingWarehouse.id, {
          name: formName.trim(),
          code: formCode.trim(),
          type: formType as 'central' | 'branch' | 'regional',
          branch_id: formBranchId === "none" ? null : formBranchId,
          location: formLocation.trim() || null,
        })
        if (result) {
          setDialogOpen(false)
          void loadWarehouses()
        } else {
          setFormError("Failed to update warehouse")
        }
      } else {
        const result = await createWarehouse({
          name: formName.trim(),
          code: formCode.trim(),
          type: formType as 'central' | 'branch' | 'regional',
          branch_id: formBranchId === "none" ? null : formBranchId,
          location: formLocation.trim() || null,
        })
        if (result) {
          setDialogOpen(false)
          void loadWarehouses()
        } else {
          setFormError("Failed to create warehouse")
        }
      }
    } catch (error) {
      logger.error("Error saving warehouse:", error)
      setFormError("An unexpected error occurred")
    } finally {
      setSaving(false)
    }
  }

  const handleToggleStatus = async (warehouse: WarehouseRow) => {
    const newStatus = warehouse.status === 'active' ? 'inactive' : 'active'
    try {
      if (newStatus === 'inactive') {
        await deleteWarehouse(warehouse.id)
      } else {
        await updateWarehouse(warehouse.id, { status: 'active' })
      }
      void loadWarehouses()
    } catch (error) {
      logger.error("Error toggling warehouse status:", error)
    }
  }

  const filteredWarehouses = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    if (!normalizedSearch) return warehouses
    return warehouses.filter((w) =>
      w.name.toLowerCase().includes(normalizedSearch) ||
      w.code.toLowerCase().includes(normalizedSearch) ||
      w.location?.toLowerCase().includes(normalizedSearch)
    )
  }, [searchTerm, warehouses])

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
            Please sign in to manage warehouses.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Warehouses</h1>
          <p className="text-muted-foreground">Manage your warehouse locations and zones</p>
        </div>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Add Warehouse
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingWarehouse ? "Edit Warehouse" : "Add Warehouse"}</DialogTitle>
                <DialogDescription>
                  {editingWarehouse ? "Update warehouse details" : "Create a new warehouse location"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g. Main Warehouse"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="code">Code</Label>
                    <Input
                      id="code"
                      placeholder="e.g. WH-001"
                      value={formCode}
                      onChange={(e) => setFormCode(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="type">Type</Label>
                    <Select value={formType} onValueChange={setFormType}>
                      <SelectTrigger id="type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="central">Central</SelectItem>
                        <SelectItem value="branch">Branch</SelectItem>
                        <SelectItem value="regional">Regional</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="branch">Branch</Label>
                    <Select value={formBranchId} onValueChange={setFormBranchId}>
                      <SelectTrigger id="branch">
                        <SelectValue placeholder="Select branch" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No branch (Central)</SelectItem>
                        {branches.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name} ({b.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    placeholder="e.g. Industrial Area, Nairobi"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                  />
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
                  {editingWarehouse ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search warehouses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <p className="text-xs text-muted-foreground whitespace-nowrap">
              Showing {filteredWarehouses.length} of {warehouses.length} warehouses
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredWarehouses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <Warehouse className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-lg font-medium">
                {searchTerm ? "No warehouses found" : "No warehouses yet"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {searchTerm
                  ? "Try a different search term."
                  : "Add your first warehouse to start managing locations."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWarehouses.map((warehouse) => (
                  <TableRow key={warehouse.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className="font-medium">{warehouse.name}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="rounded bg-muted px-2 py-1 text-xs font-mono">{warehouse.code}</code>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={typeColors[warehouse.type] || ''}>
                        {typeLabels[warehouse.type] || warehouse.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {warehouse.branch_id ? (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          Assigned
                        </span>
                      ) : (
                        <span className="text-xs">Central</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {warehouse.location || (
                        <span className="text-xs italic">Not set</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={warehouse.status === 'active' ? 'secondary' : 'outline'}>
                        {warehouse.status === 'active' ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {canManage && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(warehouse)}
                              title="Edit warehouse"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleStatus(warehouse)}
                              title={warehouse.status === 'active' ? 'Deactivate' : 'Activate'}
                            >
                              {warehouse.status === 'active' ? (
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
          )}
        </CardContent>
      </Card>
    </div>
  )
}
