"use client"
import { logger } from '@/lib/logger';

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
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
import { EmptyState } from '@/components/ui/empty-state'
import { Gift, Star, Trophy, Percent, Plus, Edit2, Trash2, Loader2, Award, Gem, Medal, CheckCircle, XCircle, Clock, DollarSign, ShoppingBag, Users, TrendingUp, AlertCircle, Calendar, Settings } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"
import { getLoyaltySettings, getLoyaltyHistory, type LoyaltySettings } from '@/lib/modules/customers'
import { CustomerAnalyticsService } from "@/lib/analytics/customer-analytics"
import { formatKSh } from "@/lib/currency"

type Tier = {
  id: string
  name: string
  minSpend: number
  multiplier: number
  color: string
  description: string
  benefits: string[]
}

type ActivityEntry = {
  id: string
  customer_name: string
  points: number
  type: string
  date: string
  tier: string
}

const defaultTiers: Tier[] = [
  { id: "bronze", name: "Bronze", minSpend: 0, multiplier: 1, color: "amber", description: "Entry level tier for all members", benefits: ["Earn points on all purchases", "Birthday bonus points", "Exclusive member offers", "Free digital membership"] },
  { id: "silver", name: "Silver", minSpend: 5000, multiplier: 1.25, color: "slate", description: "Silver tier for regular shoppers", benefits: ["Earn 1.25x points on all purchases", "All Bronze benefits", "Priority customer support", "Monthly promo access"] },
  { id: "gold", name: "Gold", minSpend: 15000, multiplier: 1.5, color: "yellow", description: "Gold tier for valuable members", benefits: ["Earn 1.5x points on all purchases", "All Silver benefits", "Free delivery on orders", "Early sale access"] },
  { id: "platinum", name: "Platinum", minSpend: 50000, multiplier: 2, color: "blue", description: "Platinum tier for premium members", benefits: ["Earn 2x points on all purchases", "All Gold benefits", "Dedicated account manager", "Exclusive platinum events"] },
]

const tierIcons: Record<string, React.ReactNode> = {
  bronze: <Medal className="h-5 w-5" />,
  silver: <Award className="h-5 w-5" />,
  gold: <Gem className="h-5 w-5" />,
  platinum: <Star className="h-5 w-5" />,
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

export default function LoyaltyPage() {
  const { profile } = useAuth()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState("overview")
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<LoyaltySettings | null>(null)
  const [activities, setActivities] = useState<ActivityEntry[]>([])
  const [totalMembers, setTotalMembers] = useState(0)
  const [newMembers, setNewMembers] = useState(0)
  const [totalPointsIssued, setTotalPointsIssued] = useState(0)
  const [totalPointsRedeemed, setTotalPointsRedeemed] = useState(0)

  const [tierDialogOpen, setTierDialogOpen] = useState(false)
  const [editingTier, setEditingTier] = useState<Tier | null>(null)
  const [tierForm, setTierForm] = useState<Tier>(defaultTiers[0])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [loyaltySettings, history] = await Promise.all([
          getLoyaltySettings(),
          getLoyaltyHistory('').catch(() => []),
        ])
        setSettings(loyaltySettings)
        setActivities(history.map((h) => ({
          id: h.id,
          customer_name: h.customer_id || 'Customer',
          points: h.points_delta || 0,
          type: h.type?.startsWith('earn') ? 'Earned' : h.type?.startsWith('redeem') ? 'Redeemed' : 'Expired',
          date: h.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
          tier: 'Bronze',
        })))

        const analytics = new CustomerAnalyticsService()
        const startDate = new Date()
        startDate.setDate(1)
        const endDate = new Date().toISOString()
        const metrics = await analytics.getCustomerMetrics(startDate.toISOString(), endDate)
        setTotalMembers(metrics.totalCustomers)
        setNewMembers(metrics.newCustomers)
      } catch (err: unknown) {
        logger.error('Failed to load loyalty data:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const tiers: Tier[] = settings ? [
    { id: "bronze", name: "Bronze", minSpend: 0, multiplier: settings.tier_bronze_multiplier || 1, color: "amber", description: "Entry level tier", benefits: ["Earn points on all purchases", "Birthday bonus points", "Exclusive member offers"] },
    { id: "silver", name: "Silver", minSpend: 0, multiplier: settings.tier_silver_multiplier || 1.25, color: "slate", description: "Silver tier", benefits: ["Earn 1.25x points", "All Bronze benefits", "Priority support"] },
    { id: "gold", name: "Gold", minSpend: 0, multiplier: settings.tier_gold_multiplier || 1.5, color: "yellow", description: "Gold tier", benefits: ["Earn 1.5x points", "All Silver benefits", "Free delivery"] },
    { id: "platinum", name: "Platinum", minSpend: 0, multiplier: settings.tier_platinum_multiplier || 2, color: "blue", description: "Platinum tier", benefits: ["Earn 2x points", "All Gold benefits", "Dedicated account manager"] },
  ] : defaultTiers

  const activePointsIssued = activities.filter(a => a.type === 'Earned').reduce((s, a) => s + Math.abs(a.points), 0)
  const activePointsRedeemed = activities.filter(a => a.type === 'Redeemed').reduce((s, a) => s + Math.abs(a.points), 0)

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
      toast({ title: "Tier Updated", description: `${tierForm.name} has been updated` })
    } else {
      toast({ title: "Tier Created", description: `${tierForm.name} has been added` })
    }
    setTierDialogOpen(false)
  }

  const deleteTier = (id: string) => {
    toast({ title: "Tier Deleted", variant: "destructive" })
  }

  return (
    <div className="p-6 space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Loyalty Management</h1>
          <p className="text-muted-foreground">View loyalty analytics, tiers, and recent activity</p>
        </div>
        <Button variant="outline" onClick={() => router.push('/settings?tab=loyalty')}>
          <Settings className="mr-2 h-4 w-4" /> Configure Rules
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardDescription>Total Members</CardDescription>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <CardTitle className="text-3xl">{totalMembers.toLocaleString()}</CardTitle>
                <p className="text-xs text-emerald-600 mt-1">+{newMembers} this month</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardDescription>Points Issued (Recent)</CardDescription>
                <Gift className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <CardTitle className="text-3xl">{activePointsIssued.toLocaleString()}</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">From recent transactions</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardDescription>Points Redeemed (Recent)</CardDescription>
                <DollarSign className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <CardTitle className="text-3xl">{activePointsRedeemed.toLocaleString()}</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">From recent transactions</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardDescription>Earning Enabled</CardDescription>
                {settings?.earn_enabled ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
              </CardHeader>
              <CardContent>
                <CardTitle className="text-3xl">{settings?.earn_enabled ? 'Active' : 'Paused'}</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">{settings?.redeem_enabled ? 'Redemption on' : 'Redemption off'}</p>
              </CardContent>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="overview"><TrendingUp className="mr-2 h-4 w-4" />Overview</TabsTrigger>
              <TabsTrigger value="tiers"><Medal className="mr-2 h-4 w-4" />Tiers</TabsTrigger>
              <TabsTrigger value="activity"><Clock className="mr-2 h-4 w-4" />Recent Activity</TabsTrigger>
              <TabsTrigger value="settings"><Settings className="mr-2 h-4 w-4" />Settings</TabsTrigger>
            </TabsList>

            {/* Overview */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="md:col-span-1">
                  <CardHeader>
                    <CardTitle>Tier Multipliers</CardTitle>
                    <CardDescription>Current point multipliers per tier</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {tiers.map((tier) => {
                      const IconComponent = tierIcons[tier.id] || tierIcons.bronze
                      return (
                        <div key={tier.id} className={`rounded-lg border p-3 ${tierColorClasses[tier.color] || tierColorClasses.amber}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`flex h-8 w-8 items-center justify-center rounded-full ${tierIconBg[tier.color] || tierIconBg.amber}`}>
                                {IconComponent}
                              </div>
                              <span className="font-medium">{tier.name}</span>
                            </div>
                            <span className="text-lg font-bold">{tier.multiplier}x</span>
                          </div>
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>

                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle>Points Configuration</CardTitle>
                    <CardDescription>Current loyalty earning and redemption rules</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Spend per Point</p>
                        <p className="font-semibold">KSh {((settings?.earn_threshold_cents ?? 15000) / 100).toFixed(0)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Min Basket to Earn</p>
                        <p className="font-semibold">KSh {((settings?.earn_minimum_basket_cents ?? 0) / 100).toFixed(0)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Point Value</p>
                        <p className="font-semibold">{(settings?.point_value_cents ?? 50) / 100} KSh</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Min Points to Redeem</p>
                        <p className="font-semibold">{settings?.redeem_minimum_points ?? 25}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Max % per Sale</p>
                        <p className="font-semibold">{settings?.redeem_max_percent_per_sale ?? 100}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Expiry</p>
                        <p className="font-semibold">{settings?.expiry_enabled ? `${settings.expiry_days} days` : 'No expiry'}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      {settings?.enable_weekend_bonus && <Badge variant="secondary">Weekend {settings.weekend_multiplier}x</Badge>}
                      {settings?.enable_holiday_bonus && <Badge variant="secondary">Holiday {settings.holiday_multiplier}x</Badge>}
                      {settings?.enable_birthday_bonus && <Badge variant="secondary">Birthday {settings.birthday_multiplier}x</Badge>}
                      {settings?.enable_tiers && <Badge variant="secondary">Tier multipliers active</Badge>}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Tiers */}
            <TabsContent value="tiers" className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{tiers.length} tiers configured</p>
                <Button onClick={() => router.push('/settings?tab=loyalty')}>
                  <Settings className="mr-2 h-4 w-4" /> Manage in Settings
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {tiers.length === 0 ? (
                  <Card className="col-span-full"><CardContent className="p-12 text-center text-muted-foreground"><EmptyState title="No tiers configured" compact /></CardContent></Card>
                ) : tiers.map((tier) => {
                  const IconComponent = tierIcons[tier.id] || tierIcons.bronze
                  return (
                    <Card key={tier.id} className={`border-2 ${tierColorClasses[tier.color] || tierColorClasses.amber}`}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${tierIconBg[tier.color] || tierIconBg.amber}`}>
                            {IconComponent}
                          </div>
                          <div>
                            <CardTitle className="text-lg">{tier.name}</CardTitle>
                            <CardDescription>{tier.description}</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
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
            </TabsContent>

            {/* Activity */}
            <TabsContent value="activity" className="space-y-4">
              {activities.length === 0 ? (
                <Card><CardContent className="p-12 text-center text-muted-foreground"><EmptyState title="No loyalty transactions yet" compact /></CardContent></Card>
              ) : (
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Customer</TableHead>
                          <TableHead>Points</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activities.slice(0, 50).map((a) => (
                          <TableRow key={a.id}>
                            <TableCell className="font-medium">{a.customer_name}</TableCell>
                            <TableCell className={a.type === "Redeemed" ? "text-red-600 font-semibold" : "text-emerald-600 font-semibold"}>
                              {a.type === "Redeemed" ? "-" : "+"}{Math.abs(a.points).toLocaleString()}
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
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Settings Link */}
            <TabsContent value="settings" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Loyalty Configuration</CardTitle>
                  <CardDescription>Manage all loyalty settings including points, tiers, and multipliers</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Points settings, redemption rules, tier multipliers, and campaign configuration are managed from the main Settings page.
                  </p>
                  <Button onClick={() => router.push('/settings?tab=loyalty')}>
                    <Settings className="mr-2 h-4 w-4" /> Open Loyalty Settings
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}
