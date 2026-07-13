'use client'

import { useCallback, useEffect, useMemo, useState, startTransition } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/components/ui/use-toast'
import { formatKSh } from '@/lib/currency'
import {
  getTaxRates, createTaxRate, updateTaxRate, deleteTaxRate,
  getTaxGroups, createTaxGroup, updateTaxGroup, deleteTaxGroup,
  getCategoryTaxAssignments, assignTaxToCategory, removeCategoryTaxAssignment,
  getProductCategories,
} from '@/lib/modules/tax'
import type { TaxRate, TaxGroupCombined, CategoryTaxAssignment, ProductCategory } from '@/lib/tax-utils'
import {
  BadgePercent, Plus, MoreHorizontal, Search, Percent, Layers,
  Tags, Check, X, Loader2, Edit3, Trash2, Star, ToggleLeft, ToggleRight,
  ReceiptText, DollarSign,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

const TAX_TYPE_LABELS: Record<string, string> = {
  vat: 'VAT',
  excise: 'Excise Duty',
  service: 'Service Charge',
  other: 'Other',
}

const TAX_TYPE_COLORS: Record<string, string> = {
  vat: 'bg-blue-100 text-blue-700 border-blue-200',
  excise: 'bg-amber-100 text-amber-700 border-amber-200',
  service: 'bg-purple-100 text-purple-700 border-purple-200',
  other: 'bg-slate-100 text-slate-700 border-slate-200',
}

export default function TaxConfigPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'admin'

  // ── Data ──
  const [rates, setRates] = useState<TaxRate[]>([])
  const [groups, setGroups] = useState<TaxGroupCombined[]>([])
  const [assignments, setAssignments] = useState<CategoryTaxAssignment[]>([])
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('rates')

  // ── Rate Form ──
  const [showRateDialog, setShowRateDialog] = useState(false)
  const [editingRate, setEditingRate] = useState<TaxRate | null>(null)
  const [rateForm, setRateForm] = useState({
    name: '',
    percentage: '',
    tax_type: 'vat',
    description: '',
    is_active: true,
    is_default: false,
    effective_from: '',
    effective_to: '',
  })
  const [rateSaving, setRateSaving] = useState(false)

  // ── Group Form ──
  const [showGroupDialog, setShowGroupDialog] = useState(false)
  const [editingGroup, setEditingGroup] = useState<TaxGroupCombined | null>(null)
  const [groupForm, setGroupForm] = useState({ name: '', description: '', rate_ids: [] as string[] })
  const [groupSaving, setGroupSaving] = useState(false)

  // ── Assignment Form ──
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [assignForm, setAssignForm] = useState({ category_id: '', tax_group_id: '', is_tax_inclusive: true, effective_from: '', effective_to: '' })
  const [assignSaving, setAssignSaving] = useState(false)

  // ── Search ──
  const [rateSearch, setRateSearch] = useState('')
  const [groupSearch, setGroupSearch] = useState('')

  // ── Data Loading ──
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [r, g, a, c] = await Promise.all([
        getTaxRates(true),
        getTaxGroups(),
        getCategoryTaxAssignments(),
        getProductCategories(),
      ])
      setRates(r)
      setGroups(g)
      setAssignments(a)
      setCategories(c)
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to load tax configuration', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { startTransition(() => { void loadData() }) }, [loadData])

  // ── Filters ──
  const filteredRates = useMemo(() => {
    if (!rateSearch) return rates
    const q = rateSearch.toLowerCase()
    return rates.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.tax_type.toLowerCase().includes(q) ||
      (r.description || '').toLowerCase().includes(q)
    )
  }, [rates, rateSearch])

  const filteredGroups = useMemo(() => {
    if (!groupSearch) return groups
    const q = groupSearch.toLowerCase()
    return groups.filter(g =>
      g.group_name.toLowerCase().includes(q) ||
      (g.description || '').toLowerCase().includes(q)
    )
  }, [groups, groupSearch])

  // ── KPIs ──
  const activeRates = rates.filter(r => r.is_active).length
  const activeGroups = groups.filter(g => g.is_active).length
  const rateNames = rates.filter(r => r.is_active).map(r => r.name)

  // ── Handlers: Rate ──
  const openCreateRate = () => {
    setEditingRate(null)
    setRateForm({ name: '', percentage: '', tax_type: 'vat', description: '', is_active: true, is_default: false, effective_from: '', effective_to: '' })
    setShowRateDialog(true)
  }

  const openEditRate = (rate: TaxRate) => {
    setEditingRate(rate)
    setRateForm({
      name: rate.name,
      percentage: String(rate.percentage),
      tax_type: rate.tax_type,
      description: rate.description || '',
      is_active: rate.is_active,
      is_default: rate.is_default,
      effective_from: rate.effective_from?.split('T')[0] || '',
      effective_to: rate.effective_to?.split('T')[0] || '',
    })
    setShowRateDialog(true)
  }

  const handleSaveRate = async () => {
    if (!rateForm.name || !rateForm.percentage) {
      toast({ title: 'Validation', description: 'Name and percentage are required', variant: 'destructive' })
      return
    }
    const pct = parseFloat(rateForm.percentage)
    if (isNaN(pct) || pct < 0 || pct > 100) {
      toast({ title: 'Validation', description: 'Percentage must be between 0 and 100', variant: 'destructive' })
      return
    }

    setRateSaving(true)
    try {
      const payload = {
        name: rateForm.name,
        percentage: pct,
        tax_type: rateForm.tax_type as TaxRate['tax_type'],
        description: rateForm.description || null,
        is_active: rateForm.is_active,
        is_default: rateForm.is_default,
        effective_from: rateForm.effective_from || null,
        effective_to: rateForm.effective_to || null,
      }

      let result
      if (editingRate) {
        result = await updateTaxRate(editingRate.id, payload)
      } else {
        result = await createTaxRate(payload)
      }

      if (!result.success) throw new Error(result.error)
      toast({ title: editingRate ? 'Updated' : 'Created', description: `Tax rate ${editingRate ? 'updated' : 'created'}` })
      setShowRateDialog(false)
      void loadData()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to save', variant: 'destructive' })
    } finally {
      setRateSaving(false)
    }
  }

  const handleDeleteRate = async (rate: TaxRate) => {
    const result = await deleteTaxRate(rate.id)
    if (result.success) {
      toast({ title: 'Deleted', description: 'Tax rate deleted' })
      void loadData()
    } else {
      toast({ title: 'Error', description: result.error || 'Failed to delete', variant: 'destructive' })
    }
  }

  const handleToggleRate = async (rate: TaxRate) => {
    const result = await updateTaxRate(rate.id, { is_active: !rate.is_active })
    if (result.success) {
      void loadData()
    } else {
      toast({ title: 'Error', description: result.error || 'Failed to toggle', variant: 'destructive' })
    }
  }

  // ── Handlers: Group ──
  const openCreateGroup = () => {
    setEditingGroup(null)
    setGroupForm({ name: '', description: '', rate_ids: [] })
    setShowGroupDialog(true)
  }

  const openEditGroup = (group: TaxGroupCombined) => {
    setEditingGroup(group)
    setGroupForm({
      name: group.group_name,
      description: group.description || '',
      rate_ids: group.rates?.map(r => r.rate_id) || [],
    })
    setShowGroupDialog(true)
  }

  const handleSaveGroup = async () => {
    if (!groupForm.name) {
      toast({ title: 'Validation', description: 'Group name is required', variant: 'destructive' })
      return
    }

    setGroupSaving(true)
    try {
      const payload = {
        name: groupForm.name,
        description: groupForm.description || undefined,
        rate_ids: groupForm.rate_ids,
      }

      let result
      if (editingGroup) {
        result = await updateTaxGroup(editingGroup.group_id, payload)
      } else {
        result = await createTaxGroup(payload)
      }

      if (!result.success) throw new Error(result.error)
      toast({ title: editingGroup ? 'Updated' : 'Created', description: `Tax group ${editingGroup ? 'updated' : 'created'}` })
      setShowGroupDialog(false)
      void loadData()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to save', variant: 'destructive' })
    } finally {
      setGroupSaving(false)
    }
  }

  const handleDeleteGroup = async (group: TaxGroupCombined) => {
    const result = await deleteTaxGroup(group.group_id)
    if (result.success) {
      toast({ title: 'Deleted', description: 'Tax group deleted' })
      void loadData()
    } else {
      toast({ title: 'Error', description: result.error || 'Failed to delete', variant: 'destructive' })
    }
  }

  const handleToggleGroup = async (group: TaxGroupCombined) => {
    const result = await updateTaxGroup(group.group_id, { is_active: !group.is_active })
    if (result.success) {
      void loadData()
    } else {
      toast({ title: 'Error', description: result.error || 'Failed to toggle', variant: 'destructive' })
    }
  }

  // ── Handlers: Assignment ──
  const openAssignDialog = () => {
    setAssignForm({ category_id: '', tax_group_id: '', is_tax_inclusive: true, effective_from: '', effective_to: '' })
    setShowAssignDialog(true)
  }

  const handleSaveAssignment = async () => {
    if (!assignForm.category_id || !assignForm.tax_group_id) {
      toast({ title: 'Validation', description: 'Category and tax group are required', variant: 'destructive' })
      return
    }

    setAssignSaving(true)
    try {
      const result = await assignTaxToCategory(assignForm.category_id, assignForm.tax_group_id)

      if (!result.success) throw new Error(result.error)
      toast({ title: 'Assigned', description: 'Tax group assigned to category' })
      setShowAssignDialog(false)
      void loadData()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to assign', variant: 'destructive' })
    } finally {
      setAssignSaving(false)
    }
  }

  const handleRemoveAssignment = async (assignment: CategoryTaxAssignment) => {
    const result = await removeCategoryTaxAssignment(assignment.category_id, assignment.tax_group_id)
    if (result.success) {
      toast({ title: 'Removed', description: 'Tax assignment removed' })
      void loadData()
    } else {
      toast({ title: 'Error', description: result.error || 'Failed to remove', variant: 'destructive' })
    }
  }

  const assignedCategoryIds = assignments.map(a => a.category_id)

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <EmptyState icon={BadgePercent} title="Access Restricted" description="Only administrators can configure tax settings." />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tax Configuration</h1>
          <p className="text-sm text-muted-foreground">Manage tax rates, groups, and category assignments</p>
        </div>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Card key={i}><CardContent className="pt-6"><Skeleton className="h-8 w-24" /></CardContent></Card>)}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
                <Percent className="h-3 w-3" /> Active Tax Rates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{activeRates}</p>
              <p className="text-xs text-muted-foreground">of {rates.length} total rates</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
                <Layers className="h-3 w-3" /> Tax Groups
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{activeGroups}</p>
              <p className="text-xs text-muted-foreground">active groups</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
                <Tags className="h-3 w-3" /> Categories Assigned
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{assignments.length}</p>
              <p className="text-xs text-muted-foreground">of {categories.length} categories</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
                <Star className="h-3 w-3" /> Default Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {rates.find(r => r.is_default)?.percentage || 0}%
              </p>
              <p className="text-xs text-muted-foreground">{rates.find(r => r.is_default)?.name || 'None set'}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="rates">Tax Rates</TabsTrigger>
          <TabsTrigger value="groups">Tax Groups</TabsTrigger>
          <TabsTrigger value="assignments">Category Assignments</TabsTrigger>
        </TabsList>

        {/* ─── TAX RATES ─── */}
        <TabsContent value="rates" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search rates..."
                className="pl-9"
                value={rateSearch}
                onChange={(e) => setRateSearch(e.target.value)}
              />
            </div>
            <Button onClick={openCreateRate}>
              <Plus className="h-4 w-4 mr-2" /> Add Tax Rate
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="space-y-3 p-4">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : filteredRates.length === 0 ? (
                <EmptyState icon={Percent} title="No tax rates found" actions={[{ label: 'Add First Rate', onClick: openCreateRate, variant: 'outline', icon: Plus }]} compact />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Default</TableHead>
                      <TableHead>Effective</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRates.map(rate => (
                      <TableRow key={rate.id} className={!rate.is_active ? 'opacity-60' : ''}>
                        <TableCell className="font-medium">{rate.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-sm">
                            {rate.percentage}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${TAX_TYPE_COLORS[rate.tax_type] || ''}`}>
                            {TAX_TYPE_LABELS[rate.tax_type] || rate.tax_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={rate.is_active ? 'default' : 'secondary'} className="text-xs">
                            {rate.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {rate.is_default ? (
                            <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
                              <Star className="h-3 w-3 mr-1" /> Default
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {rate.effective_from ? `From ${rate.effective_from}` : 'Always'}
                          {rate.effective_to ? ` to ${rate.effective_to}` : ''}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onClick={() => openEditRate(rate)}>
                                <Edit3 className="h-4 w-4 mr-2" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggleRate(rate)}>
                                {rate.is_active ? <ToggleRight className="h-4 w-4 mr-2" /> : <ToggleLeft className="h-4 w-4 mr-2" />}
                                {rate.is_active ? 'Deactivate' : 'Activate'}
                              </DropdownMenuItem>
                              {!rate.is_default && (
                                <DropdownMenuItem onClick={async () => {
                                  const r = await updateTaxRate(rate.id, { is_default: true })
                                  if (r.success) void loadData()
                                }}>
                                  <Star className="h-4 w-4 mr-2" /> Set as Default
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteRate(rate)}>
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── TAX GROUPS ─── */}
        <TabsContent value="groups" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search groups..."
                className="pl-9"
                value={groupSearch}
                onChange={(e) => setGroupSearch(e.target.value)}
              />
            </div>
            <Button onClick={openCreateGroup}>
              <Plus className="h-4 w-4 mr-2" /> Create Group
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {loading ? (
              [1,2].map(i => <Card key={i}><CardContent className="pt-6"><Skeleton className="h-24 w-full" /></CardContent></Card>)
            ) : filteredGroups.length === 0 ? (
              <Card className="col-span-2">
                <CardContent className="text-center py-12">
                  <EmptyState icon={Layers} title="No tax groups created yet" compact />
                </CardContent>
              </Card>
            ) : (
              filteredGroups.map(group => (
                <Card key={group.group_id} className={!group.is_active ? 'opacity-60' : ''}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-sm flex items-center gap-2">
                          {group.group_name}
                          {!group.is_active && (
                            <Badge variant="secondary" className="text-[10px]">Inactive</Badge>
                          )}
                        </CardTitle>
                        {group.description && (
                          <CardDescription className="text-xs">{group.description}</CardDescription>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => openEditGroup(group)}>
                            <Edit3 className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleGroup(group)}>
                            {group.is_active ? <ToggleRight className="h-4 w-4 mr-2" /> : <ToggleLeft className="h-4 w-4 mr-2" />}
                            {group.is_active ? 'Deactivate' : 'Activate'}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteGroup(group)}>
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="text-sm font-mono bg-primary/10 text-primary border-primary/20">
                        {group.combined_percentage}% combined
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {group.rate_count} rate{group.rate_count !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    {group.rates && group.rates.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {group.rates.map((r) => (
                          <Badge key={r.rate_id} variant="outline" className="text-[10px]">
                            {r.rate_name} ({r.percentage}%)
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* ─── CATEGORY ASSIGNMENTS ─── */}
        <TabsContent value="assignments" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Assign tax groups to product categories
            </p>
            <Button onClick={openAssignDialog} disabled={categories.length === 0}>
              <Plus className="h-4 w-4 mr-2" /> Assign Tax
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="space-y-3 p-4">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : assignments.length === 0 ? (
                <EmptyState icon={Tags} title="No categories have tax assignments yet" actions={[{ label: 'Assign Tax to Category', onClick: openAssignDialog, variant: 'outline', icon: Plus }]} compact />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Tax Group</TableHead>
                      <TableHead>Combined Rate</TableHead>
                      <TableHead>Tax Inclusive</TableHead>
                      <TableHead>Effective Dates</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignments.map(assn => (
                      <TableRow key={`${assn.category_id}-${assn.tax_group_id}`}>
                        <TableCell className="font-medium">{assn.category_name || assn.category_id}</TableCell>
                        <TableCell>{assn.group_name || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">
                            {Array.isArray(assn.tax_rates)
                              ? `${assn.tax_rates.reduce((s: number, r) => s + r.percentage, 0)}%`
                              : '—'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={assn.is_tax_inclusive ? 'default' : 'secondary'} className="text-xs">
                            {assn.is_tax_inclusive ? 'Inclusive' : 'Exclusive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {assn.effective_from || 'Always'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive"
                            onClick={() => handleRemoveAssignment(assn)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Unassigned categories warning */}
          {!loading && categories.length > assignments.length && (
            <Card className="border-amber-200 bg-amber-50/30">
              <CardContent className="py-3">
                <p className="text-sm text-amber-700 flex items-center gap-2">
                  <BadgePercent className="h-4 w-4" />
                  {categories.length - assignments.length} categor{categories.length - assignments.length === 1 ? 'y' : 'ies'} ha{categories.length - assignments.length === 1 ? 's' : 've'} no tax assignment yet.
                  They will use the default tax rate.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ════════════════════════════════════════════════ */}
      {/* TAX RATE DIALOG */}
      {/* ════════════════════════════════════════════════ */}
      <Dialog open={showRateDialog} onOpenChange={(open) => { if (!open) setShowRateDialog(false) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRate ? 'Edit Tax Rate' : 'Add Tax Rate'}</DialogTitle>
            <DialogDescription>
              {editingRate ? 'Update the tax rate details' : 'Define a new tax rate'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-2 col-span-2">
              <Label>Rate Name *</Label>
              <Input
                placeholder="e.g. VAT 16%"
                value={rateForm.name}
                onChange={(e) => setRateForm(p => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Percentage *</Label>
              <Input
                type="number" step="0.01" min="0" max="100"
                placeholder="16"
                value={rateForm.percentage}
                onChange={(e) => setRateForm(p => ({ ...p, percentage: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Tax Type</Label>
              <Select value={rateForm.tax_type} onValueChange={(v) => setRateForm(p => ({ ...p, tax_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vat">VAT</SelectItem>
                  <SelectItem value="excise">Excise Duty</SelectItem>
                  <SelectItem value="service">Service Charge</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Optional description..."
                value={rateForm.description}
                onChange={(e) => setRateForm(p => ({ ...p, description: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Effective From</Label>
              <Input
                type="date"
                value={rateForm.effective_from}
                onChange={(e) => setRateForm(p => ({ ...p, effective_from: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Effective To</Label>
              <Input
                type="date"
                value={rateForm.effective_to}
                onChange={(e) => setRateForm(p => ({ ...p, effective_to: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={rateForm.is_active}
                  onCheckedChange={(v) => setRateForm(p => ({ ...p, is_active: v }))}
                />
                <Label className="text-sm">Active</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={rateForm.is_default}
                  onCheckedChange={(v) => setRateForm(p => ({ ...p, is_default: v }))}
                />
                <Label className="text-sm">Set as Default</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRateDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveRate} disabled={rateSaving}>
              {rateSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : (editingRate ? 'Update' : 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════ */}
      {/* TAX GROUP DIALOG */}
      {/* ════════════════════════════════════════════════ */}
      <Dialog open={showGroupDialog} onOpenChange={(open) => { if (!open) setShowGroupDialog(false) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingGroup ? 'Edit Tax Group' : 'Create Tax Group'}</DialogTitle>
            <DialogDescription>
              Combine one or more tax rates into a group
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Group Name *</Label>
              <Input
                placeholder="e.g. Standard VAT"
                value={groupForm.name}
                onChange={(e) => setGroupForm(p => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Optional description..."
                value={groupForm.description}
                onChange={(e) => setGroupForm(p => ({ ...p, description: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Tax Rates *</Label>
              <div className="border rounded-lg p-3 space-y-2 max-h-[200px] overflow-y-auto">
                {rates.filter(r => r.is_active).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active tax rates available. Create one first.</p>
                ) : (
                  rates.filter(r => r.is_active).map(rate => (
                    <label key={rate.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border"
                        checked={groupForm.rate_ids.includes(rate.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setGroupForm(p => ({ ...p, rate_ids: [...p.rate_ids, rate.id] }))
                          } else {
                            setGroupForm(p => ({ ...p, rate_ids: p.rate_ids.filter(id => id !== rate.id) }))
                          }
                        }}
                      />
                      <div className="flex items-center justify-between flex-1">
                        <span className="text-sm">{rate.name}</span>
                        <span className="text-sm font-mono text-muted-foreground">{rate.percentage}%</span>
                      </div>
                    </label>
                  ))
                )}
              </div>
              {groupForm.rate_ids.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Combined rate: <strong>{rates.filter(r => groupForm.rate_ids.includes(r.id)).reduce((s, r) => s + r.percentage, 0)}%</strong>
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGroupDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveGroup} disabled={groupSaving || groupForm.rate_ids.length === 0}>
              {groupSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : (editingGroup ? 'Update' : 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════ */}
      {/* ASSIGN TAX DIALOG */}
      {/* ════════════════════════════════════════════════ */}
      <Dialog open={showAssignDialog} onOpenChange={(open) => { if (!open) setShowAssignDialog(false) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Assign Tax to Category</DialogTitle>
            <DialogDescription>Select a product category and tax group</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Product Category *</Label>
              <Select value={assignForm.category_id} onValueChange={(v) => setAssignForm(p => ({ ...p, category_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.length === 0 ? (
                    <SelectItem value="__none__" disabled>No categories found</SelectItem>
                  ) : categories.map(cat => (
                    <SelectItem
                      key={cat.id}
                      value={cat.id}
                      disabled={assignedCategoryIds.includes(cat.id)}
                    >
                      {cat.name} {assignedCategoryIds.includes(cat.id) ? '(already assigned)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tax Group *</Label>
              <Select value={assignForm.tax_group_id} onValueChange={(v) => setAssignForm(p => ({ ...p, tax_group_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select tax group" /></SelectTrigger>
                <SelectContent>
                  {groups.filter(g => g.is_active).length === 0 ? (
                    <SelectItem value="__none__" disabled>No active tax groups</SelectItem>
                  ) : groups.filter(g => g.is_active).map(group => (
                    <SelectItem key={group.group_id} value={group.group_id}>
                      {group.group_name} ({group.combined_percentage}%)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={assignForm.is_tax_inclusive}
                onCheckedChange={(v) => setAssignForm(p => ({ ...p, is_tax_inclusive: v }))}
              />
              <Label className="text-sm">Prices include tax (inclusive pricing)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveAssignment} disabled={assignSaving || !assignForm.category_id || !assignForm.tax_group_id}>
              {assignSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : 'Assign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
