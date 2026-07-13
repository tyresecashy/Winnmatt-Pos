"use client"

import { useCallback, useEffect, useState, startTransition } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
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
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/use-toast"
import { Plus, Percent, Coins, Tags, Loader2, Trash2, BadgePercent } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
import {
  getPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
  getCouponsForPromotion,
  createCoupon,
  deleteCoupon,
} from "@/lib/modules/promotions"
import type { Promotion, PromotionCoupon, PromotionType, PromotionScope } from "@/lib/modules/promotions"
import { formatKSh } from "@/lib/currency"

const typeLabels: Record<PromotionType, string> = {
  fixed_amount: "Fixed Amount (KSh)",
  percentage: "Percentage (%)",
  bonus_points: "Bonus Points",
}

const typeIcons: Record<PromotionType, React.ReactNode> = {
  fixed_amount: <Coins className="h-4 w-4" />,
  percentage: <Percent className="h-4 w-4" />,
  bonus_points: <BadgePercent className="h-4 w-4" />,
}

const scopeLabels: Record<PromotionScope, string> = {
  cart: "Entire Cart",
  product: "Specific Products",
  category: "Specific Categories",
}

function getPromoSummary(p: Promotion): string {
  if (p.type === 'percentage') return `${p.value}% off`
  if (p.type === 'fixed_amount') return `KSh ${p.value} off`
  if (p.type === 'bonus_points') return `${p.bonus_multiplier}x points`
  return ''
}

function getPromoStatus(p: Promotion): { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' } {
  if (!p.is_active) return { label: 'Inactive', variant: 'secondary' }
  const now = new Date()
  if (p.start_date && new Date(p.start_date) > now) return { label: 'Scheduled', variant: 'outline' }
  if (p.end_date && new Date(p.end_date) < now) return { label: 'Expired', variant: 'destructive' }
  return { label: 'Active', variant: 'default' }
}

// ─── Default form state ─────────────────────────────────────────────────────

const defaultForm: Omit<Promotion, 'id' | 'current_usage' | 'created_at' | 'updated_at'> = {
  name: '',
  description: '',
  type: 'percentage',
  value: 10,
  scope: 'cart',
  applicable_product_ids: [],
  applicable_category_ids: [],
  min_purchase_cents: 0,
  max_discount_cents: 0,
  start_date: null,
  end_date: null,
  is_active: true,
  auto_apply: false,
  stackable: false,
  requires_coupon: false,
  bonus_multiplier: 1.0,
  usage_limit: 0,
}

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Promotion | null>(null)
  const [form, setForm] = useState(defaultForm)
  const [saving, setSaving] = useState(false)

  // Coupon state per promotion
  const [couponDialogOpen, setCouponDialogOpen] = useState(false)
  const [couponPromotion, setCouponPromotion] = useState<Promotion | null>(null)
  const [coupons, setCoupons] = useState<PromotionCoupon[]>([])
  const [newCouponCode, setNewCouponCode] = useState('')
  const [newCouponLimit, setNewCouponLimit] = useState('0')

  // ─── Load promotions ────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setIsLoading(true)
    const data = await getPromotions()
    setPromotions(data)
    setIsLoading(false)
  }, [])

  useEffect(() => { startTransition(() => { void load() }) }, [load])

  // ─── Open dialogs ───────────────────────────────────────────────────────

  const openCreate = () => {
    setEditing(null)
    setForm({ ...defaultForm })
    setDialogOpen(true)
  }

  const openEdit = (p: Promotion) => {
    setEditing(p)
    setForm({
      name: p.name,
      description: p.description,
      type: p.type,
      value: p.value,
      scope: p.scope,
      applicable_product_ids: p.applicable_product_ids,
      applicable_category_ids: p.applicable_category_ids,
      min_purchase_cents: p.min_purchase_cents,
      max_discount_cents: p.max_discount_cents,
      start_date: p.start_date,
      end_date: p.end_date,
      is_active: p.is_active,
      auto_apply: p.auto_apply,
      stackable: p.stackable,
      requires_coupon: p.requires_coupon,
      bonus_multiplier: p.bonus_multiplier,
      usage_limit: p.usage_limit,
    })
    setDialogOpen(true)
  }

  const openCoupons = async (p: Promotion) => {
    setCouponPromotion(p)
    const cps = await getCouponsForPromotion(p.id)
    setCoupons(cps)
    setNewCouponCode('')
    setNewCouponLimit('0')
    setCouponDialogOpen(true)
  }

  // ─── Save ───────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Validation Error', description: 'Promotion name is required', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      const payload = { ...form, name: form.name.trim() }
      let result: Promotion | null

      if (editing) {
        result = await updatePromotion(editing.id, payload) as any
      } else {
        result = await createPromotion(payload) as any
      }

      if (!result) throw new Error('Failed to save promotion')

      toast({ title: 'Success', description: `Promotion ${editing ? 'updated' : 'created'}` })
      setDialogOpen(false)
      void load()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Save failed', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // ─── Toggle active ──────────────────────────────────────────────────────

  const toggleActive = async (p: Promotion) => {
    const result = await updatePromotion(p.id, { is_active: !p.is_active })
    if (result) {
      setPromotions((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_active: !p.is_active } : x)))
    }
  }

  // ─── Delete ─────────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this promotion? This cannot be undone.')) return
    const ok = await deletePromotion(id)
    if (ok) {
      toast({ title: 'Deleted' })
      void load()
    }
  }

  // ─── Add coupon ─────────────────────────────────────────────────────────

  const handleAddCoupon = async () => {
    if (!newCouponCode.trim() || !couponPromotion) return
    const limit = parseInt(newCouponLimit) || 0
    const result = await createCoupon(couponPromotion.id, newCouponCode.trim(), limit)
    if (result) {
      setCoupons((prev) => [...prev, result as any])
      setNewCouponCode('')
      setNewCouponLimit('0')
      toast({ title: 'Coupon added' })
    }
  }

  const handleDeleteCoupon = async (id: string) => {
    const ok = await deleteCoupon(id)
    if (ok) {
      setCoupons((prev) => prev.filter((c) => c.id !== id))
    }
  }

  // ─── Stats ──────────────────────────────────────────────────────────────

  const activeCount = promotions.filter((p) => p.is_active).length
  const autoApplyCount = promotions.filter((p) => p.is_active && p.auto_apply).length
  const usageCount = promotions.reduce((sum, p) => sum + p.current_usage, 0)

  return (
    <div className="p-6 space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Promotions</h1>
          <p className="text-muted-foreground">Manage discounts, coupons, and bonus point campaigns</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New Promotion
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardDescription>Total Promotions</CardDescription><CardTitle className="text-3xl">{promotions.length}</CardTitle></CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Active</CardDescription><CardTitle className="text-3xl text-emerald-600">{activeCount}</CardTitle></CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Auto-Apply</CardDescription><CardTitle className="text-3xl text-blue-600">{autoApplyCount}</CardTitle></CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Total Uses</CardDescription><CardTitle className="text-3xl">{usageCount}</CardTitle></CardHeader>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3"><CardTitle>All Promotions</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3 py-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : promotions.length === 0 ? (
            <EmptyState icon={BadgePercent} title="No promotions yet" description="Create your first promotion to start offering discounts." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Promotion</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Uses</TableHead>
                  <TableHead className="text-center">Auto</TableHead>
                  <TableHead className="text-center">Coupons</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promotions.map((p) => {
                  const status = getPromoStatus(p)
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                            {typeIcons[p.type]}
                          </div>
                          <div>
                            <p className="font-medium">{p.name}</p>
                            {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><span className="text-sm text-muted-foreground">{typeLabels[p.type]}</span></TableCell>
                      <TableCell><span className="font-semibold">{getPromoSummary(p)}</span></TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {p.usage_limit > 0 ? `${p.current_usage} / ${p.usage_limit}` : p.current_usage}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch checked={p.auto_apply} onCheckedChange={() => {
                          updatePromotion(p.id, { auto_apply: !p.auto_apply })
                          setPromotions((prev) => prev.map((x) => x.id === p.id ? { ...x, auto_apply: !p.auto_apply } : x))
                        }} />
                      </TableCell>
                      <TableCell className="text-center">
                        <Button variant="ghost" size="sm" onClick={() => openCoupons(p)}>
                          <Tags className="h-4 w-4 mr-1" />
                          Manage
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Switch checked={p.is_active} onCheckedChange={() => toggleActive(p)} />
                          <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>Edit</Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Promotion Form Dialog ─────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Promotion' : 'New Promotion'}</DialogTitle>
            <DialogDescription>Configure the promotion rules and discounts.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label>Promotion Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Weekend Special" />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Internal notes about this promotion" rows={2} />
            </div>

            {/* Type + Value */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v: PromotionType) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed_amount">Fixed Amount (KSh)</SelectItem>
                    <SelectItem value="bonus_points">Bonus Points</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{form.type === 'percentage' ? 'Percentage' : form.type === 'fixed_amount' ? 'Amount (KSh)' : 'Multiplier'}</Label>
                <Input
                  type="number"
                  min="0"
                  step={form.type === 'percentage' ? '1' : '0.1'}
                  value={form.type === 'bonus_points' ? form.bonus_multiplier : form.value}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0
                    if (form.type === 'bonus_points') {
                      setForm({ ...form, bonus_multiplier: val })
                    } else {
                      setForm({ ...form, value: val })
                    }
                  }}
                />
              </div>
            </div>

            {/* Scope */}
            <div className="space-y-2">
              <Label>Apply To</Label>
              <Select value={form.scope} onValueChange={(v: PromotionScope) => setForm({ ...form, scope: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cart">Entire Cart</SelectItem>
                  <SelectItem value="product">Specific Products</SelectItem>
                  <SelectItem value="category">Specific Categories</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Thresholds */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Min. Purchase (KSh)</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.min_purchase_cents}
                  onChange={(e) => setForm({ ...form, min_purchase_cents: parseFloat(e.target.value) || 0 })}
                  placeholder="0 = no minimum"
                />
              </div>
              <div className="space-y-2">
                <Label>Max Discount (KSh)</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.max_discount_cents}
                  onChange={(e) => setForm({ ...form, max_discount_cents: parseFloat(e.target.value) || 0 })}
                  placeholder="0 = unlimited"
                />
              </div>
            </div>

            {/* Schedule */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="datetime-local"
                  value={form.start_date ? form.start_date.slice(0, 16) : ''}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value ? new Date(e.target.value).toISOString() : null })}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="datetime-local"
                  value={form.end_date ? form.end_date.slice(0, 16) : ''}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value ? new Date(e.target.value).toISOString() : null })}
                />
              </div>
            </div>

            {/* Usage limit */}
            <div className="space-y-2">
              <Label>Usage Limit</Label>
              <Input type="number" min="0" value={form.usage_limit} onChange={(e) => setForm({ ...form, usage_limit: parseInt(e.target.value) || 0 })} placeholder="0 = unlimited" />
            </div>

            {/* Toggles */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <Label className="cursor-pointer">Requires Coupon Code</Label>
                <Switch checked={form.requires_coupon} onCheckedChange={(v) => setForm({ ...form, requires_coupon: v })} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="cursor-pointer">Auto-Apply to Cart</Label>
                <Switch checked={form.auto_apply} onCheckedChange={(v) => setForm({ ...form, auto_apply: v })} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="cursor-pointer">Stackable with Others</Label>
                <Switch checked={form.stackable} onCheckedChange={(v) => setForm({ ...form, stackable: v })} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : editing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Coupon Management Dialog ──────────────────────────────────────── */}
      <Dialog open={couponDialogOpen} onOpenChange={setCouponDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Coupons — {couponPromotion?.name}</DialogTitle>
            <DialogDescription>Create and manage coupon codes for this promotion.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Existing coupons */}
            {coupons.length === 0 ? (
              <EmptyState title="No coupon codes yet." compact />
            ) : (
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {coupons.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div>
                      <code className="text-sm font-mono font-bold">{c.code}</code>
                      {(c.usage_limit ?? 0) > 0 && (
                        <span className="text-xs text-muted-foreground ml-2">{c.current_usage}/{c.usage_limit}</span>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteCoupon(c.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new coupon */}
            <div className="border-t pt-4 space-y-3">
              <Label>Add Coupon Code</Label>
              <div className="flex gap-2">
                <Input
                  value={newCouponCode}
                  onChange={(e) => setNewCouponCode(e.target.value.toUpperCase())}
                  placeholder="e.g., SAVE20"
                  className="font-mono uppercase"
                />
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  value={newCouponLimit}
                  onChange={(e) => setNewCouponLimit(e.target.value)}
                  placeholder="Usage limit (0 = unlimited)"
                  className="flex-1"
                />
                <Button onClick={handleAddCoupon} disabled={!newCouponCode.trim()} size="sm">
                  Add
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
