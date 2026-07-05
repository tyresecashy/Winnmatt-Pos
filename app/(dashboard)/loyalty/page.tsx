"use client"
import { logger } from '@/lib/logger';

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "@/components/ui/use-toast"
import { Gift, Star, Trophy, Percent, Plus, Edit2, Trash2, Loader2, Award, Gem, Medal, CheckCircle, XCircle, Clock, DollarSign, ShoppingBag, Users, TrendingUp, AlertCircle, Calendar } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"

type Tier = {
  id: string
  name: string
  minSpend: number
  multiplier: number
  color: string
  description: string
  benefits: string[]
}

type Campaign = {
  id: string
  name: string
  description: string
  startDate: string
  endDate: string
  multiplier: number
  categories: string[]
  tiers: string[]
  status: 'active' | 'scheduled' | 'draft'
}

type Activity = {
  id: string
  customer: string
  points: number
  type: 'Earned' | 'Redeemed' | 'Expired'
  date: string
  tier: string
}

const defaultPointsConfig = {
  pointsPerUnit: 10,
  currencyUnit: 1.00,
  minSpend: 0,
  expiryDays: 365,
  enableExpiry: true,
}

const defaultRedemptionConfig = {
  minPoints: 100,
  maxPointsPerTx: 5000,
  pointsToCurrencyRate: 100,
  allowPartial: true,
}

const defaultMultipliers = {
  weekday: 1.0,
  weekend: 1.5,
  holiday: 2.0,
  birthday: 3.0,
  happyHour: 2.0,
  happyHourStart: "14:00",
  happyHourEnd: "17:00",
}

const defaultTiers: Tier[] = [
  { id: "bronze", name: "Bronze", minSpend: 0, multiplier: 1, color: "amber", description: "Entry level tier for all members", benefits: ["Earn 1x points on all purchases", "Birthday bonus points", "Exclusive member offers", "Free digital membership"] },
  { id: "silver", name: "Silver", minSpend: 5000, multiplier: 1.25, color: "slate", description: "Silver tier for regular shoppers", benefits: ["Earn 1.25x points on all purchases", "All Bronze benefits", "Priority customer support", "Monthly promo access"] },
  { id: "gold", name: "Gold", minSpend: 15000, multiplier: 1.5, color: "yellow", description: "Gold tier for valuable members", benefits: ["Earn 1.5x points on all purchases", "All Silver benefits", "Free delivery on orders", "Early sale access"] },
  { id: "platinum", name: "Platinum", minSpend: 50000, multiplier: 2, color: "blue", description: "Platinum tier for premium members", benefits: ["Earn 2x points on all purchases", "All Gold benefits", "Dedicated account manager", "Exclusive platinum events"] },
  { id: "vip", name: "VIP", minSpend: 150000, multiplier: 3, color: "purple", description: "VIP tier for top spenders", benefits: ["Earn 3x points on all purchases", "All Platinum benefits", "Concierge shopping service", "Invite-only VIP experiences"] },
]

const defaultCampaigns: Campaign[] = [
  { id: "c1", name: "Weekend Bonanza", description: "Earn triple points every weekend", startDate: "2026-07-04", endDate: "2026-09-30", multiplier: 3, categories: ["All"], tiers: ["All"], status: "scheduled" },
  { id: "c2", name: "Grocery Rush", description: "Double points on all grocery purchases", startDate: "2026-06-01", endDate: "2026-08-31", multiplier: 2, categories: ["Groceries"], tiers: ["Silver", "Gold", "Platinum", "VIP"], status: "active" },
]

const defaultActivities: Activity[] = [
  { id: "a1", customer: "Jane Muthoni", points: 450, type: "Earned", date: "2026-07-03", tier: "Gold" },
  { id: "a2", customer: "Peter Kamau", points: 1200, type: "Redeemed", date: "2026-07-03", tier: "Platinum" },
  { id: "a3", customer: "Grace Akinyi", points: 85, type: "Earned", date: "2026-07-02", tier: "Bronze" },
  { id: "a4", customer: "Samuel Ochieng", points: 500, type: "Expired", date: "2026-07-02", tier: "Silver" },
  { id: "a5", customer: "Faith Wanjiku", points: 2300, type: "Earned", date: "2026-07-01", tier: "VIP" },
  { id: "a6", customer: "David Kimani", points: 750, type: "Redeemed", date: "2026-06-30", tier: "Gold" },
  { id: "a7", customer: "Mary Anyango", points: 160, type: "Earned", date: "2026-06-29", tier: "Silver" },
]

const categoryOptions = ["All", "Groceries", "Electronics", "Clothing", "Household", "Beverages", "Snacks", "Personal Care"]
const tierOptions = ["All", "Bronze", "Silver", "Gold", "Platinum", "VIP"]

const tierIcons: Record<string, React.ReactNode> = {
  bronze: <Medal className="h-5 w-5" />,
  silver: <Award className="h-5 w-5" />,
  gold: <Gem className="h-5 w-5" />,
  platinum: <Star className="h-5 w-5" />,
  vip: <Trophy className="h-5 w-5" />,
}

const tierColorClasses: Record<string, string> = {
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  slate: "border-slate-200 bg-slate-50 text-slate-700",
  yellow: "border-yellow-200 bg-yellow-50 text-yellow-700",
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  purple: "border-purple-200 bg-purple-50 text-purple-700",
}

const tierIconBg: Record<string, string> = {
  amber: "bg-amber-100 text-amber-600",
  slate: "bg-slate-100 text-slate-600",
  yellow: "bg-yellow-100 text-yellow-600",
  blue: "bg-blue-100 text-blue-600",
  purple: "bg-purple-100 text-purple-600",
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline"; color: string }> = {
  active: { label: "Active", variant: "default", color: "bg-emerald-500" },
  scheduled: { label: "Scheduled", variant: "outline", color: "bg-amber-500" },
  draft: { label: "Draft", variant: "secondary", color: "bg-slate-400" },
}

export default function LoyaltyPage() {
  const { profile } = useAuth()

  const [activeTab, setActiveTab] = useState("points")

  const [pointsConfig, setPointsConfig] = useState(defaultPointsConfig)
  const [redemptionConfig, setRedemptionConfig] = useState(defaultRedemptionConfig)
  const [multipliers, setMultipliers] = useState(defaultMultipliers)

  const [tiers, setTiers] = useState<Tier[]>(defaultTiers)
  const [tierDialogOpen, setTierDialogOpen] = useState(false)
  const [editingTier, setEditingTier] = useState<Tier | null>(null)
  const [tierForm, setTierForm] = useState<Tier>(defaultTiers[0])

  const [campaigns, setCampaigns] = useState<Campaign[]>(defaultCampaigns)
  const [campDialogOpen, setCampDialogOpen] = useState(false)
  const [editingCamp, setEditingCamp] = useState<Campaign | null>(null)
  const [campForm, setCampForm] = useState<Omit<Campaign, 'id'>>({
    name: '', description: '', startDate: '', endDate: '', multiplier: 2, categories: [], tiers: [], status: 'draft',
  })

  const [activities] = useState<Activity[]>(defaultActivities)
  const [saving, setSaving] = useState(false)

  const openTierDialog = (tier?: Tier) => {
    if (tier) {
      setEditingTier(tier)
      setTierForm({ ...tier })
    } else {
      setEditingTier(null)
      setTierForm({ id: "", name: "", minSpend: 0, multiplier: 1, color: "amber", description: "", benefits: [""] })
    }
    setTierDialogOpen(true)
  }

  const saveTier = () => {
    if (!tierForm.name.trim()) {
      toast({ title: "Validation Error", description: "Tier name is required", variant: "destructive" })
      return
    }
    if (editingTier) {
      setTiers((prev) => prev.map((t) => (t.id === editingTier.id ? { ...tierForm, id: t.id } : t)))
      toast({ title: "Tier Updated", description: `${tierForm.name} has been updated` })
    } else {
      const newTier: Tier = { ...tierForm, id: `tier_${Date.now()}` }
      setTiers((prev) => [...prev, newTier])
      toast({ title: "Tier Created", description: `${tierForm.name} has been added` })
    }
    setTierDialogOpen(false)
  }

  const deleteTier = (id: string) => {
    setTiers((prev) => prev.filter((t) => t.id !== id))
    toast({ title: "Tier Deleted", variant: "destructive" })
  }

  const openCampDialog = (camp?: Campaign) => {
    if (camp) {
      setEditingCamp(camp)
      setCampForm({
        name: camp.name, description: camp.description, startDate: camp.startDate, endDate: camp.endDate,
        multiplier: camp.multiplier, categories: camp.categories, tiers: camp.tiers, status: camp.status,
      })
    } else {
      setEditingCamp(null)
      setCampForm({ name: "", description: "", startDate: "", endDate: "", multiplier: 2, categories: [], tiers: [], status: "draft" })
    }
    setCampDialogOpen(true)
  }

  const saveCamp = () => {
    if (!campForm.name.trim()) {
      toast({ title: "Validation Error", description: "Campaign name is required", variant: "destructive" })
      return
    }
    if (editingCamp) {
      setCampaigns((prev) => prev.map((c) => (c.id === editingCamp.id ? { ...campForm, id: c.id } : c)))
      toast({ title: "Campaign Updated", description: `${campForm.name} has been updated` })
    } else {
      const newCamp: Campaign = { ...campForm, id: `camp_${Date.now()}` }
      setCampaigns((prev) => [...prev, newCamp])
      toast({ title: "Campaign Created", description: `${campForm.name} has been added` })
    }
    setCampDialogOpen(false)
  }

  const deleteCamp = (id: string) => {
    setCampaigns((prev) => prev.filter((c) => c.id !== id))
    toast({ title: "Campaign Deleted", variant: "destructive" })
  }

  const handleSavePoints = () => {
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
      toast({ title: "Points Settings Saved", description: "Your points configuration has been updated" })
    }, 500)
  }

  const handleSaveRedemption = () => {
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
      toast({ title: "Redemption Settings Saved", description: "Your redemption configuration has been updated" })
    }, 500)
  }

  const handleSaveMultipliers = () => {
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
      toast({ title: "Multipliers Saved", description: "Default multipliers have been updated" })
    }, 500)
  }

  const toggleCategory = (cat: string) => {
    setCampForm((prev) => {
      const cats = prev.categories.includes(cat)
        ? prev.categories.filter((c) => c !== cat)
        : [...prev.categories, cat]
      return { ...prev, categories: cats }
    })
  }

  const toggleTier = (t: string) => {
    setCampForm((prev) => {
      const tiers = prev.tiers.includes(t)
        ? prev.tiers.filter((x) => x !== t)
        : [...prev.tiers, t]
      return { ...prev, tiers }
    })
  }

  const activeCampCount = campaigns.filter((c) => c.status === "active").length

  return (
    <div className="p-6 space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Loyalty Management</h1>
          <p className="text-muted-foreground">Configure points, tiers, campaigns, and view loyalty analytics</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="points"><Percent className="mr-2 h-4 w-4" />Points</TabsTrigger>
          <TabsTrigger value="tiers"><Medal className="mr-2 h-4 w-4" />Tiers</TabsTrigger>
          <TabsTrigger value="campaigns"><Gift className="mr-2 h-4 w-4" />Campaigns</TabsTrigger>
          <TabsTrigger value="analytics"><TrendingUp className="mr-2 h-4 w-4" />Analytics</TabsTrigger>
        </TabsList>

        {/* ════════════════════════════════════════════════════════════════ Tab 1: Points ═══ */}
        <TabsContent value="points" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Points Settings</CardTitle>
              <CardDescription>Configure how loyalty points are earned</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Points per currency unit</Label>
                  <Input type="number" min="0" value={pointsConfig.pointsPerUnit} onChange={(e) => setPointsConfig({ ...pointsConfig, pointsPerUnit: parseInt(e.target.value) || 0 })} />
                  <p className="text-xs text-muted-foreground">e.g. 10 points per KSh 1.00</p>
                </div>
                <div className="space-y-2">
                  <Label>Currency unit (KES)</Label>
                  <Input type="number" min="0" step="0.01" value={pointsConfig.currencyUnit} onChange={(e) => setPointsConfig({ ...pointsConfig, currencyUnit: parseFloat(e.target.value) || 0 })} />
                  <p className="text-xs text-muted-foreground">Default currency unit in KES</p>
                </div>
                <div className="space-y-2">
                  <Label>Minimum spend for points</Label>
                  <Input type="number" min="0" value={pointsConfig.minSpend} onChange={(e) => setPointsConfig({ ...pointsConfig, minSpend: parseInt(e.target.value) || 0 })} />
                  <p className="text-xs text-muted-foreground">Minimum transaction amount to earn points</p>
                </div>
                <div className="space-y-2">
                  <Label>Points expiry (days)</Label>
                  <Input type="number" min="0" value={pointsConfig.expiryDays} onChange={(e) => setPointsConfig({ ...pointsConfig, expiryDays: parseInt(e.target.value) || 0 })} />
                  <p className="text-xs text-muted-foreground">Number of days before points expire</p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2">
                <div className="space-y-0.5">
                  <Label className="cursor-pointer">Enable points expiry</Label>
                  <p className="text-xs text-muted-foreground">Points will expire after the configured period</p>
                </div>
                <Switch checked={pointsConfig.enableExpiry} onCheckedChange={(v) => setPointsConfig({ ...pointsConfig, enableExpiry: v })} />
              </div>
              <Button onClick={handleSavePoints} disabled={saving}>
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : "Save Points Settings"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Redemption Settings</CardTitle>
              <CardDescription>Configure how customers redeem their points</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Minimum points to redeem</Label>
                  <Input type="number" min="0" value={redemptionConfig.minPoints} onChange={(e) => setRedemptionConfig({ ...redemptionConfig, minPoints: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label>Maximum points per transaction</Label>
                  <Input type="number" min="0" value={redemptionConfig.maxPointsPerTx} onChange={(e) => setRedemptionConfig({ ...redemptionConfig, maxPointsPerTx: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label>Points to currency rate</Label>
                  <Input type="number" min="0" value={redemptionConfig.pointsToCurrencyRate} onChange={(e) => setRedemptionConfig({ ...redemptionConfig, pointsToCurrencyRate: parseInt(e.target.value) || 0 })} />
                  <p className="text-xs text-muted-foreground">e.g. 100 points = KSh 1.00</p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2">
                <div className="space-y-0.5">
                  <Label className="cursor-pointer">Allow partial redemption</Label>
                  <p className="text-xs text-muted-foreground">Customers can redeem a portion of their points per transaction</p>
                </div>
                <Switch checked={redemptionConfig.allowPartial} onCheckedChange={(v) => setRedemptionConfig({ ...redemptionConfig, allowPartial: v })} />
              </div>
              <Button onClick={handleSaveRedemption} disabled={saving}>
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : "Save Redemption Settings"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Default Multipliers</CardTitle>
              <CardDescription>Set bonus point multipliers for special periods</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Weekday multiplier</Label>
                  <Input type="number" min="0" step="0.1" value={multipliers.weekday} onChange={(e) => setMultipliers({ ...multipliers, weekday: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label>Weekend multiplier</Label>
                  <Input type="number" min="0" step="0.1" value={multipliers.weekend} onChange={(e) => setMultipliers({ ...multipliers, weekend: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label>Holiday multiplier</Label>
                  <Input type="number" min="0" step="0.1" value={multipliers.holiday} onChange={(e) => setMultipliers({ ...multipliers, holiday: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label>Birthday multiplier</Label>
                  <Input type="number" min="0" step="0.1" value={multipliers.birthday} onChange={(e) => setMultipliers({ ...multipliers, birthday: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label>Happy hour multiplier</Label>
                  <Input type="number" min="0" step="0.1" value={multipliers.happyHour} onChange={(e) => setMultipliers({ ...multipliers, happyHour: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Happy hour start</Label>
                  <Input type="time" value={multipliers.happyHourStart} onChange={(e) => setMultipliers({ ...multipliers, happyHourStart: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Happy hour end</Label>
                  <Input type="time" value={multipliers.happyHourEnd} onChange={(e) => setMultipliers({ ...multipliers, happyHourEnd: e.target.value })} />
                </div>
              </div>
              <Button onClick={handleSaveMultipliers} disabled={saving}>
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : "Save Multipliers"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════════════════════════════════════════════════════════════ Tab 2: Tiers ════ */}
        <TabsContent value="tiers" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{tiers.length} tiers configured</p>
            </div>
            <Button onClick={() => openTierDialog()}>
              <Plus className="mr-2 h-4 w-4" />Add Custom Tier
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tiers.map((tier) => {
              const IconComponent = tierIcons[tier.id] || tierIcons.bronze
              return (
                <Card key={tier.id} className={`border-2 ${tierColorClasses[tier.color] || tierColorClasses.amber}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${tierIconBg[tier.color] || tierIconBg.amber}`}>
                        {IconComponent}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openTierDialog(tier)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteTier(tier.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <CardTitle className="mt-3">{tier.name}</CardTitle>
                    <CardDescription>{tier.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Min. Spend</span>
                      <span className="font-semibold">KSh {tier.minSpend.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Points Multiplier</span>
                      <span className="font-semibold">{tier.multiplier}x</span>
                    </div>
                    <Separator />
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">Benefits</p>
                      <ul className="space-y-1">
                        {tier.benefits.map((b, i) => (
                          <li key={i} className="flex items-center gap-1.5 text-xs">
                            <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0" />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Tier Dialog */}
          <Dialog open={tierDialogOpen} onOpenChange={setTierDialogOpen}>
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle>{editingTier ? "Edit Tier" : "Add Custom Tier"}</DialogTitle>
                <DialogDescription>Configure the tier name, requirements, and benefits.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Tier Name *</Label>
                  <Input value={tierForm.name} onChange={(e) => setTierForm({ ...tierForm, name: e.target.value })} placeholder="e.g., Diamond" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Minimum Spend (KSh)</Label>
                    <Input type="number" min="0" value={tierForm.minSpend} onChange={(e) => setTierForm({ ...tierForm, minSpend: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Points Multiplier</Label>
                    <Input type="number" min="0" step="0.25" value={tierForm.multiplier} onChange={(e) => setTierForm({ ...tierForm, multiplier: parseFloat(e.target.value) || 0 })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={tierForm.description} onChange={(e) => setTierForm({ ...tierForm, description: e.target.value })} placeholder="Describe this tier" rows={2} />
                </div>
                <div className="space-y-2">
                  <Label>Color Accent</Label>
                  <Select value={tierForm.color} onValueChange={(v: string) => setTierForm({ ...tierForm, color: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="amber">Amber</SelectItem>
                      <SelectItem value="slate">Slate</SelectItem>
                      <SelectItem value="yellow">Yellow</SelectItem>
                      <SelectItem value="blue">Blue</SelectItem>
                      <SelectItem value="purple">Purple</SelectItem>
                      <SelectItem value="emerald">Emerald</SelectItem>
                      <SelectItem value="rose">Rose</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Benefits (one per line)</Label>
                  <Textarea
                    value={tierForm.benefits.join("\n")}
                    onChange={(e) => setTierForm({ ...tierForm, benefits: e.target.value.split("\n").filter((b) => b.trim()) })}
                    placeholder="Enter each benefit on a new line"
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setTierDialogOpen(false)}>Cancel</Button>
                <Button onClick={saveTier} disabled={!tierForm.name.trim()}>
                  {editingTier ? "Update Tier" : "Create Tier"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ════════════════════════════════════════════════════════════════ Tab 3: Campaigns ══ */}
        <TabsContent value="campaigns" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{campaigns.length} campaigns</p>
            </div>
            <Dialog open={campDialogOpen} onOpenChange={setCampDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => openCampDialog()}>
                  <Plus className="mr-2 h-4 w-4" />Create Campaign
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingCamp ? "Edit Campaign" : "Create Campaign"}</DialogTitle>
                  <DialogDescription>Set up a new multiplier campaign.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Campaign Name *</Label>
                    <Input value={campForm.name} onChange={(e) => setCampForm({ ...campForm, name: e.target.value })} placeholder="e.g., Holiday Special" />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea value={campForm.description} onChange={(e) => setCampForm({ ...campForm, description: e.target.value })} placeholder="Describe this campaign" rows={2} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Input type="date" value={campForm.startDate} onChange={(e) => setCampForm({ ...campForm, startDate: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>End Date</Label>
                      <Input type="date" value={campForm.endDate} onChange={(e) => setCampForm({ ...campForm, endDate: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Multiplier Override</Label>
                    <Input type="number" min="0" step="0.5" value={campForm.multiplier} onChange={(e) => setCampForm({ ...campForm, multiplier: parseFloat(e.target.value) || 0 })} />
                    <p className="text-xs text-muted-foreground">Points multiplier during this campaign (e.g. 3x)</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Applicable Categories</Label>
                    <div className="flex flex-wrap gap-2">
                      {categoryOptions.map((cat) => (
                        <Badge
                          key={cat}
                          variant={campForm.categories.includes(cat) ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => toggleCategory(cat)}
                        >
                          {cat}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Applicable Tiers</Label>
                    <div className="flex flex-wrap gap-2">
                      {tierOptions.map((t) => (
                        <Badge
                          key={t}
                          variant={campForm.tiers.includes(t) ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => toggleTier(t)}
                        >
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={campForm.status} onValueChange={(v: 'active' | 'scheduled' | 'draft') => setCampForm({ ...campForm, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCampDialogOpen(false)}>Cancel</Button>
                  <Button onClick={saveCamp} disabled={!campForm.name.trim()}>
                    {editingCamp ? "Update Campaign" : "Create Campaign"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {campaigns.length === 0 ? (
              <div className="col-span-full flex flex-col items-center py-16 text-center">
                <Gift className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No campaigns yet</p>
                <p className="text-sm text-muted-foreground mt-1">Create your first campaign to boost loyalty engagement.</p>
              </div>
            ) : (
              campaigns.map((camp) => {
                const status = statusConfig[camp.status]
                return (
                  <Card key={camp.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{camp.name}</CardTitle>
                          <CardDescription className="mt-1">{camp.description}</CardDescription>
                        </div>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span>{camp.startDate} → {camp.endDate}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Percent className="h-4 w-4" />
                          <span className="font-semibold text-foreground">{camp.multiplier}x points</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {camp.categories.map((cat) => (
                          <Badge key={cat} variant="secondary" className="text-xs">{cat}</Badge>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {camp.tiers.map((t) => (
                          <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                        ))}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button variant="outline" size="sm" onClick={() => openCampDialog(camp)}>
                          <Edit2 className="mr-1.5 h-3.5 w-3.5" />Edit
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => deleteCamp(camp.id)}>
                          <Trash2 className="mr-1.5 h-3.5 w-3.5 text-destructive" />Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </TabsContent>

        {/* ════════════════════════════════════════════════════════════════ Tab 4: Analytics ══ */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardDescription>Total Members</CardDescription>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <CardTitle className="text-3xl">1,247</CardTitle>
                <p className="text-xs text-emerald-600 mt-1">+12% this month</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardDescription>Points Issued Today</CardDescription>
                <Gift className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <CardTitle className="text-3xl">45,230</CardTitle>
                <p className="text-xs text-emerald-600 mt-1">+8% vs yesterday</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardDescription>Points Redeemed Today</CardDescription>
                <DollarSign className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <CardTitle className="text-3xl">12,500</CardTitle>
                <p className="text-xs text-amber-600 mt-1">-3% vs yesterday</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardDescription>Active Campaigns</CardDescription>
                <TrendingUp className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <CardTitle className="text-3xl">{activeCampCount}</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">{campaigns.length} total campaigns</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="md:col-span-1">
              <CardHeader>
                <CardTitle>Tier Distribution</CardTitle>
                <CardDescription>Member breakdown by loyalty tier</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: "Bronze", pct: 45, color: "bg-amber-500" },
                  { label: "Silver", pct: 30, color: "bg-slate-400" },
                  { label: "Gold", pct: 15, color: "bg-yellow-500" },
                  { label: "Platinum", pct: 8, color: "bg-blue-500" },
                  { label: "VIP", pct: 2, color: "bg-purple-500" },
                ].map((item) => (
                  <div key={item.label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{item.label}</span>
                      <span className="text-muted-foreground">{item.pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full ${item.color} transition-all`} style={{ width: `${item.pct}%` }} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest loyalty point transactions</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Points</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Tier</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activities.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.customer}</TableCell>
                        <TableCell className={a.type === "Redeemed" ? "text-red-600 font-semibold" : "text-emerald-600 font-semibold"}>
                          {a.type === "Redeemed" ? "-" : "+"}{a.points.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {a.type === "Earned" ? <ShoppingBag className="h-3.5 w-3.5 text-emerald-500" /> :
                             a.type === "Redeemed" ? <DollarSign className="h-3.5 w-3.5 text-red-500" /> :
                             <Clock className="h-3.5 w-3.5 text-slate-400" />}
                            <span>{a.type}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{a.date}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs font-medium">{a.tier}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
