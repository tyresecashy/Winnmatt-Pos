'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Flag, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Search,
  Shield,
  MapPin,
  Users,
  Percent
} from 'lucide-react'
import { 
  getAllFeatureFlags, 
  createFeatureFlag, 
  toggleFeatureFlag, 
  deleteFeatureFlag,
  refreshFeatureFlagCache,
  type FeatureFlag 
} from '@/lib/feature-flags'

const AVAILABLE_ROLES = ['admin', 'super_admin', 'manager', 'cashier', 'inventory_control', 'finance']

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  
  // Create form state
  const [newKey, setNewKey] = useState('')
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newEnabled, setNewEnabled] = useState(false)
  const [newRolloutPercentage, setNewRolloutPercentage] = useState(100)
  const [newTargetRoles, setNewTargetRoles] = useState<string[]>([])

  useEffect(() => {
    loadFlags()
  }, [])

  async function loadFlags() {
    setLoading(true)
    try {
      const data = await getAllFeatureFlags()
      setFlags(data)
    } catch (error) {
      console.error('Failed to load feature flags:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleToggle(id: string) {
    const result = await toggleFeatureFlag(id)
    if (result.success) {
      await loadFlags()
      await refreshFeatureFlagCache()
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this feature flag?')) return
    
    const result = await deleteFeatureFlag(id)
    if (result.success) {
      await loadFlags()
      await refreshFeatureFlagCache()
    }
  }

  async function handleCreate() {
    if (!newKey || !newName) return

    const result = await createFeatureFlag(
      newKey,
      newName,
      newDescription || null,
      newEnabled,
      newRolloutPercentage,
      null,
      newTargetRoles.length > 0 ? newTargetRoles : null
    )

    if (result.success) {
      setShowCreateDialog(false)
      resetForm()
      await loadFlags()
      await refreshFeatureFlagCache()
    }
  }

  function resetForm() {
    setNewKey('')
    setNewName('')
    setNewDescription('')
    setNewEnabled(false)
    setNewRolloutPercentage(100)
    setNewTargetRoles([])
  }

  function toggleRole(role: string) {
    setNewTargetRoles(prev => 
      prev.includes(role) 
        ? prev.filter(r => r !== role)
        : [...prev, role]
    )
  }

  const filteredFlags = flags.filter(flag =>
    flag.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
    flag.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (flag.description && flag.description.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const enabledCount = flags.filter(f => f.enabled).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Feature Flags</h1>
          <p className="text-muted-foreground">
            Control feature rollout and enable/disable functionality
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadFlags}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Flag
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Feature Flag</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Key *</Label>
                  <Input
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    placeholder="e.g., pos.offline_mode"
                  />
                </div>
                <div>
                  <Label>Name *</Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g., Offline Mode"
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="What does this flag control?"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enabled by Default</Label>
                  <Switch
                    checked={newEnabled}
                    onCheckedChange={setNewEnabled}
                  />
                </div>
                <div>
                  <Label>Rollout Percentage: {newRolloutPercentage}%</Label>
                  <Slider
                    value={[newRolloutPercentage]}
                    onValueChange={(value) => setNewRolloutPercentage(value[0])}
                    min={0}
                    max={100}
                    step={1}
                  />
                </div>
                <div>
                  <Label>Target Roles (empty = all roles)</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {AVAILABLE_ROLES.map(role => (
                      <Badge
                        key={role}
                        variant={newTargetRoles.includes(role) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => toggleRole(role)}
                      >
                        {role}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={!newKey || !newName}>
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Flag className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{flags.length}</p>
                <p className="text-xs text-muted-foreground">Total Flags</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-full bg-green-500" />
              <div>
                <p className="text-2xl font-bold">{enabledCount}</p>
                <p className="text-xs text-muted-foreground">Enabled</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-full bg-gray-300" />
              <div>
                <p className="text-2xl font-bold">{flags.length - enabledCount}</p>
                <p className="text-xs text-muted-foreground">Disabled</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search flags..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Flags Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Rollout</TableHead>
                <TableHead>Target Roles</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFlags.map((flag) => (
                <TableRow key={flag.id}>
                  <TableCell className="font-mono text-sm">{flag.key}</TableCell>
                  <TableCell className="font-medium">{flag.name}</TableCell>
                  <TableCell className="text-muted-foreground max-w-[200px] truncate">
                    {flag.description || '-'}
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={flag.enabled}
                      onCheckedChange={() => handleToggle(flag.id)}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Percent className="h-3 w-3" />
                      <span className="text-sm">{flag.rollout_percentage}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {flag.target_roles && flag.target_roles.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {flag.target_roles.map(role => (
                          <Badge key={role} variant="secondary" className="text-xs">
                            {role}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">All roles</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(flag.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
