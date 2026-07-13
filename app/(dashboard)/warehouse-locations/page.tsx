'use client'
import { logger } from '@/lib/logger';

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  MapPin,
  Plus,
  Search,
  Loader2,
  Edit2,
  Trash2,
  Warehouse,
  Layers,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/contexts/auth-context'
import {
  getWarehouses,
  getLocations,
  createLocation,
  updateLocation,
  deleteLocation,
} from '@/lib/modules/warehouse'
import { useToast } from '@/hooks/use-toast'
import type { Database } from '@/lib/supabase-server'

type LocationRow = Database['public']['Tables']['warehouse_locations']['Row']
type WarehouseRow = Database['public']['Tables']['warehouses']['Row']

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200',
  inactive: 'bg-muted text-muted-foreground border',
  full: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200',
  maintenance: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200',
}

export default function WarehouseLocationsPage() {
  const { profile, authState } = useAuth()
  const { toast } = useToast()
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([])
  const [locations, setLocations] = useState<LocationRow[]>([])
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('')
  const [isLoadingWarehouses, setIsLoadingWarehouses] = useState(true)
  const [isLoadingLocations, setIsLoadingLocations] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // Form state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingLocation, setEditingLocation] = useState<LocationRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [formZone, setFormZone] = useState('')
  const [formAisle, setFormAisle] = useState('')
  const [formRow, setFormRow] = useState('')
  const [formShelf, setFormShelf] = useState('')
  const [formBin, setFormBin] = useState('')
  const [formBarcode, setFormBarcode] = useState('')
  const [formCapacity, setFormCapacity] = useState('0')
  const [formIsPickable, setFormIsPickable] = useState(true)
  const [formError, setFormError] = useState<string | null>(null)

  const canManage = ['super_admin', 'admin', 'manager'].includes(profile?.role || '')

  const loadWarehouses = useCallback(async () => {
    setIsLoadingWarehouses(true)
    try {
      const data = await getWarehouses()
      setWarehouses(data || [])
    } catch (error) {
      logger.error('Failed to load warehouses:', error)
    } finally {
      setIsLoadingWarehouses(false)
    }
  }, [])

  const loadLocations = useCallback(async (warehouseId: string) => {
    if (!warehouseId) return
    setIsLoadingLocations(true)
    try {
      const data = await getLocations(warehouseId)
      setLocations(data || [])
    } catch (error) {
      logger.error('Failed to load locations:', error)
    } finally {
      setIsLoadingLocations(false)
    }
  }, [])

  useEffect(() => {
    startTransition(() => { void loadWarehouses() })
  }, [loadWarehouses])

  useEffect(() => {
    startTransition(() => {
      if (selectedWarehouseId) {
        void loadLocations(selectedWarehouseId)
      } else {
        setLocations([])
      }
    })
  }, [selectedWarehouseId, loadLocations])

  // Auto-select first warehouse
  useEffect(() => {
    startTransition(() => {
      if (!selectedWarehouseId && warehouses.length > 0) {
        setSelectedWarehouseId(warehouses[0].id)
      }
    })
  }, [warehouses, selectedWarehouseId])

  const openCreateDialog = () => {
    setEditingLocation(null)
    setFormZone('')
    setFormAisle('')
    setFormRow('')
    setFormShelf('')
    setFormBin('')
    setFormBarcode('')
    setFormCapacity('0')
    setFormIsPickable(true)
    setFormError(null)
    setDialogOpen(true)
  }

  const openEditDialog = (loc: LocationRow) => {
    setEditingLocation(loc)
    setFormZone(loc.zone)
    setFormAisle(loc.aisle || '')
    setFormRow(loc.row || '')
    setFormShelf(loc.shelf || '')
    setFormBin(loc.bin || '')
    setFormBarcode(loc.barcode || '')
    setFormCapacity(String(loc.capacity))
    setFormIsPickable(loc.is_pickable)
    setFormError(null)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    setFormError(null)

    if (!formZone.trim()) {
      setFormError('Zone is required')
      return
    }
    if (!selectedWarehouseId) {
      setFormError('No warehouse selected')
      return
    }

    setSaving(true)
    try {
      const payload = {
        warehouse_id: selectedWarehouseId,
        zone: formZone.trim(),
        aisle: formAisle.trim() || null,
        row: formRow.trim() || null,
        shelf: formShelf.trim() || null,
        bin: formBin.trim() || null,
        barcode: formBarcode.trim() || null,
        capacity: parseInt(formCapacity) || 0,
        is_pickable: formIsPickable,
      }

      if (editingLocation) {
        const result = await updateLocation(editingLocation.id, payload as Record<string, unknown>)
        if (result) {
          toast({ title: 'Success', description: 'Location updated' })
          setDialogOpen(false)
          void loadLocations(selectedWarehouseId)
        } else {
          setFormError('Failed to update location')
        }
      } else {
        const result = await createLocation(payload)
        if (result) {
          toast({ title: 'Success', description: 'Location created' })
          setDialogOpen(false)
          void loadLocations(selectedWarehouseId)
        } else {
          setFormError('Failed to create location')
        }
      }
    } catch (error) {
      logger.error('Error saving location:', error)
      setFormError('An unexpected error occurred')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this location?')) return
    try {
      const result = await deleteLocation(id)
      if (result.success) {
        toast({ title: 'Deleted', description: 'Location deleted' })
        void loadLocations(selectedWarehouseId)
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to delete', variant: 'destructive' })
      }
    } catch (error) {
      logger.error('Error deleting location:', error)
    }
  }

  const filteredLocations = useMemo(() => {
    const ns = searchTerm.trim().toLowerCase()
    if (!ns) return locations
    return locations.filter(
      (l) =>
        l.zone.toLowerCase().includes(ns) ||
        (l.aisle || '').toLowerCase().includes(ns) ||
        (l.row || '').toLowerCase().includes(ns) ||
        (l.barcode || '').toLowerCase().includes(ns) ||
        (l.bin || '').toLowerCase().includes(ns)
    )
  }, [searchTerm, locations])

  const selectedWarehouse = warehouses.find((w) => w.id === selectedWarehouseId)

  if (authState === 'loading') {
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
            Please sign in to manage warehouse locations.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Warehouse Locations</h1>
          <p className="text-muted-foreground">Manage bin locations, zones, and storage areas</p>
        </div>
        {canManage && selectedWarehouseId && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Add Location
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingLocation ? 'Edit Location' : 'Add Location'}</DialogTitle>
                <DialogDescription>
                  {editingLocation
                    ? 'Update storage location details'
                    : `Create a new storage location in ${selectedWarehouse?.name || 'warehouse'}`}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="zone">Zone *</Label>
                    <Input
                      id="zone"
                      placeholder="e.g. A, B, Cold Storage"
                      value={formZone}
                      onChange={(e) => setFormZone(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="aisle">Aisle</Label>
                    <Input
                      id="aisle"
                      placeholder="e.g. A1"
                      value={formAisle}
                      onChange={(e) => setFormAisle(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="row">Row</Label>
                    <Input
                      id="row"
                      placeholder="e.g. 01"
                      value={formRow}
                      onChange={(e) => setFormRow(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shelf">Shelf</Label>
                    <Input
                      id="shelf"
                      placeholder="e.g. 1"
                      value={formShelf}
                      onChange={(e) => setFormShelf(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bin">Bin</Label>
                    <Input
                      id="bin"
                      placeholder="e.g. 01A"
                      value={formBin}
                      onChange={(e) => setFormBin(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="barcode">Barcode</Label>
                    <Input
                      id="barcode"
                      placeholder="Location barcode"
                      value={formBarcode}
                      onChange={(e) => setFormBarcode(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="capacity">Capacity (units)</Label>
                    <Input
                      id="capacity"
                      type="number"
                      placeholder="0"
                      value={formCapacity}
                      onChange={(e) => setFormCapacity(e.target.value)}
                      min="0"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="is_pickable"
                    checked={formIsPickable}
                    onCheckedChange={(checked) => setFormIsPickable(checked === true)}
                  />
                  <Label htmlFor="is_pickable" className="cursor-pointer">
                    Pickable location (can be used for order picking)
                  </Label>
                </div>
                {formError && <p className="text-sm text-destructive">{formError}</p>}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingLocation ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Warehouse selector */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Warehouse className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Warehouse</span>
              </div>
              <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder="Select a warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.length === 0 ? (
                    <SelectItem value="__none__" disabled>No warehouses available</SelectItem>
                  ) : warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="relative max-w-sm flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search locations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingWarehouses ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !selectedWarehouseId ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <MapPin className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-lg font-medium">Select a warehouse</p>
              <p className="text-sm text-muted-foreground mt-1">
                Choose a warehouse from the dropdown to view its storage locations.
              </p>
            </div>
          ) : isLoadingLocations ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredLocations.length === 0 ? (
            <EmptyState
              icon={Layers}
              title={searchTerm ? 'No locations found' : 'No locations yet'}
              description={searchTerm ? 'Try a different search term.' : `Add your first storage location to ${selectedWarehouse?.name || 'this warehouse'}.`}
              compact
            />
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-4">
                Showing {filteredLocations.length} of {locations.length} locations
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zone</TableHead>
                    <TableHead>Aisle</TableHead>
                    <TableHead>Row</TableHead>
                    <TableHead>Shelf</TableHead>
                    <TableHead>Bin</TableHead>
                    <TableHead>Barcode</TableHead>
                    <TableHead>Capacity</TableHead>
                    <TableHead>Pickable</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLocations.map((loc) => (
                    <TableRow key={loc.id}>
                      <TableCell className="font-medium">{loc.zone}</TableCell>
                      <TableCell className="text-muted-foreground">{loc.aisle || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">{loc.row || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">{loc.shelf || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">{loc.bin || '-'}</TableCell>
                      <TableCell>
                        {loc.barcode ? (
                          <code className="rounded bg-muted px-2 py-1 text-xs font-mono">{loc.barcode}</code>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">None</span>
                        )}
                      </TableCell>
                      <TableCell>{loc.capacity > 0 ? loc.capacity : '-'}</TableCell>
                      <TableCell>
                        <Badge variant={loc.is_pickable ? 'secondary' : 'outline'} className="text-xs">
                          {loc.is_pickable ? 'Yes' : 'No'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusColors[loc.status] || ''}>
                          {loc.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {canManage && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditDialog(loc)}
                                title="Edit location"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(loc.id)}
                                title="Delete location"
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
