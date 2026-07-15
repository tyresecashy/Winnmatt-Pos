'use client'

import { useState, useEffect, startTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from '@/components/ui/use-toast'
import { Plus, Megaphone, Search, Calendar, RefreshCw, Edit3, Trash2, CheckCircle, XCircle } from 'lucide-react'
import { getCampaigns, createCampaign, updateCampaign, deleteCampaign, type Campaign } from '@/lib/modules/system'

const statusColors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  scheduled: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  ended: 'bg-muted text-muted-foreground',
  cancelled: 'bg-red-100 text-red-700',
}

const emptyForm = {
  name: '',
  description: '',
  multiplier: 1,
  start_date: '',
  end_date: '',
  category_filters: [] as string[],
  tier_filters: [] as string[],
  product_ids: [] as string[],
  branch_ids: [] as string[],
  status: 'draft',
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const loadCampaigns = async () => {
    setLoading(true)
    const data = await getCampaigns()
    setCampaigns(data)
    setLoading(false)
  }

  useEffect(() => { startTransition(() => { loadCampaigns() }) }, [])

  const openCreate = () => {
    setEditingCampaign(null)
    setForm({ ...emptyForm, start_date: new Date().toISOString().split('T')[0], end_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0] })
    setDialogOpen(true)
  }

  const openEdit = (c: Campaign) => {
    setEditingCampaign(c)
    setForm({
      name: c.name,
      description: c.description || '',
      multiplier: c.multiplier,
      start_date: c.start_date.split('T')[0],
      end_date: c.end_date.split('T')[0],
      category_filters: c.category_filters || [],
      tier_filters: c.tier_filters || [],
      product_ids: c.product_ids || [],
      branch_ids: c.branch_ids || [],
      status: c.status,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name || !form.start_date || !form.end_date) {
      toast({ title: 'Validation', description: 'Name, start date, and end date are required', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      if (editingCampaign) {
        await updateCampaign(editingCampaign.id, {
          name: form.name,
          description: form.description || null,
          multiplier: form.multiplier,
          start_date: new Date(form.start_date).toISOString(),
          end_date: new Date(form.end_date).toISOString(),
          category_filters: form.category_filters,
          tier_filters: form.tier_filters,
          product_ids: form.product_ids,
          branch_ids: form.branch_ids,
          status: form.status as Campaign['status'],
        })
        toast({ title: 'Campaign updated' })
      } else {
        await createCampaign({
          ...form,
          description: form.description || undefined,
          start_date: new Date(form.start_date).toISOString(),
          end_date: new Date(form.end_date).toISOString(),
        })
        toast({ title: 'Campaign created' })
      }
      setDialogOpen(false)
      await loadCampaigns()
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' })
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this campaign?')) return
    const result = await deleteCampaign(id)
    if (result.success) {
      toast({ title: 'Campaign deleted' })
      await loadCampaigns()
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' })
    }
  }

  const filtered = campaigns.filter(c =>
    !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const activeCampaigns = filtered.filter(c => c.status === 'active')
  const scheduledCampaigns = filtered.filter(c => c.status === 'scheduled')
  const draftCampaigns = filtered.filter(c => c.status === 'draft')
  const endedCampaigns = filtered.filter(c => c.status === 'ended' || c.status === 'cancelled')

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Campaigns</h1>
          <p className="text-muted-foreground">Loyalty point multiplier campaigns</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> New Campaign</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search campaigns..." className="pl-9" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active ({activeCampaigns.length})</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled ({scheduledCampaigns.length})</TabsTrigger>
          <TabsTrigger value="draft">Drafts ({draftCampaigns.length})</TabsTrigger>
          <TabsTrigger value="ended">Ended ({endedCampaigns.length})</TabsTrigger>
        </TabsList>

        {(['active', 'scheduled', 'draft', 'ended'] as const).map(tab => (
          <TabsContent key={tab} value={tab} className="mt-4">
            {filtered.length === 0 || (tab === 'active' && activeCampaigns.length === 0) ||
              (tab === 'scheduled' && scheduledCampaigns.length === 0) ||
              (tab === 'draft' && draftCampaigns.length === 0) ||
              (tab === 'ended' && endedCampaigns.length === 0) ? (
              <Card><CardContent className="p-12 text-center text-muted-foreground">
                <Megaphone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <EmptyState title={`No ${tab} campaigns`} compact />
              </CardContent></Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {(tab === 'active' ? activeCampaigns : tab === 'scheduled' ? scheduledCampaigns : tab === 'draft' ? draftCampaigns : endedCampaigns).map(campaign => (
                  <Card key={campaign.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base">{campaign.name}</CardTitle>
                          <CardDescription className="text-xs mt-1">
                            {new Date(campaign.start_date).toLocaleDateString()} — {new Date(campaign.end_date).toLocaleDateString()}
                          </CardDescription>
                        </div>
                        <Badge className={statusColors[campaign.status]}>{campaign.status}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Multiplier</span>
                          <span className="font-semibold text-lg">{(campaign as unknown as { multiplier?: number }).multiplier}x</span>
                        </div>
                        {campaign.description && (
                          <p className="text-muted-foreground text-xs">{campaign.description}</p>
                        )}
                        <div className="flex flex-wrap gap-1 pt-1">
                          {campaign.category_filters?.map(f => <Badge key={f} variant="secondary" className="text-[10px]">{f}</Badge>)}
                          {campaign.tier_filters?.map(f => <Badge key={f} variant="outline" className="text-[10px]">{f}</Badge>)}
                        </div>
                      </div>
                      <div className="flex gap-2 mt-4">
                        <Button variant="outline" size="sm" onClick={() => openEdit(campaign)}>
                          <Edit3 className="h-3 w-3 mr-1" /> Edit
                        </Button>
                        <Button variant="outline" size="sm" className="text-red-600" onClick={() => handleDelete(campaign.id)}>
                          <Trash2 className="h-3 w-3 mr-1" /> Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCampaign ? 'Edit Campaign' : 'New Campaign'}</DialogTitle>
            <DialogDescription>Configure loyalty point multiplier campaign</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Campaign Name</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Holiday Bonanza" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Optional description" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date</Label>
                <Input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} />
              </div>
              <div>
                <Label>End Date</Label>
                <Input type="date" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Multiplier</Label>
              <Input type="number" min="1" max="10" step="0.5" value={form.multiplier}
                onChange={e => setForm(p => ({ ...p, multiplier: parseFloat(e.target.value) || 1 }))} />
              <p className="text-xs text-muted-foreground mt-1">Points will be multiplied by this value (e.g., 2x = double points)</p>
            </div>
            <div>
              <Label>Category Filters (optional)</Label>
              <Input value={form.category_filters.join(', ')} onChange={e => setForm(p => ({ ...p, category_filters: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))} placeholder="Comma-separated categories" />
            </div>
            <div>
              <Label>Tier Filters (optional)</Label>
              <Input value={form.tier_filters.join(', ')} onChange={e => setForm(p => ({ ...p, tier_filters: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))} placeholder="e.g. gold, platinum" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : editingCampaign ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
