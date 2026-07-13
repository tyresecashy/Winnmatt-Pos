'use client'

import { startTransition, useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useToast } from '@/components/ui/use-toast'
import { formatKSh } from '@/lib/currency'
import {
  ArrowLeft, Phone, Mail, Calendar, ShoppingBag, MapPin,
  CreditCard, Award, Clock, AlertTriangle, TrendingUp,
  RotateCcw, Users, Star, Activity,
  Loader2, Edit3, Percent,
} from 'lucide-react'
import {
  getCustomerCRMDetail,
  getCustomerActivity,
  getCustomerSalesHistory,
  type CustomerCRMDetail,
  type CustomerActivity,
  type CustomerSaleItem,
} from '@/lib/modules/crm'
import { EmptyState } from '@/components/ui/empty-state'
import { getLoyaltyHistory, type LoyaltyTransaction } from '@/lib/modules/customers'
import { EditCustomerDialog } from '@/components/customers/edit-customer-dialog'
import { AIInsightSection } from '@/components/ai/ai-insight-section'
import { analyzeCustomerDetailAI } from '@/lib/modules/ai'

const typeColors: Record<string, { bg: string; text: string }> = {
  retail: { bg: 'bg-blue-100', text: 'text-blue-700' },
  wholesale: { bg: 'bg-green-100', text: 'text-green-700' },
  business: { bg: 'bg-purple-100', text: 'text-purple-700' },
}

const tierColors: Record<string, string> = {
  bronze: 'bg-amber-100 text-amber-800',
  silver: 'bg-slate-100 text-slate-700',
  gold: 'bg-yellow-100 text-yellow-800',
  platinum: 'bg-teal-100 text-teal-800',
  vip: 'bg-purple-100 text-purple-800',
}

export default function CustomerCRMDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const customerId = params.id as string

  const [customer, setCustomer] = useState<CustomerCRMDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [activity, setActivity] = useState<CustomerActivity[]>([])
  const [salesHistory, setSalesHistory] = useState<CustomerSaleItem[]>([])
  const [loyaltyHistory, setLoyaltyHistory] = useState<LoyaltyTransaction[]>([])
  const [activeTab, setActiveTab] = useState('overview')
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [cust, acts, sales, loyalty] = await Promise.all([
        getCustomerCRMDetail(customerId),
        getCustomerActivity(customerId),
        getCustomerSalesHistory(customerId),
        getLoyaltyHistory(customerId),
      ])
      if (cust) setCustomer(cust)
      setActivity(acts)
      setSalesHistory(sales)
      setLoyaltyHistory(loyalty)
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to load customer data', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [customerId, toast])

  useEffect(() => {
    startTransition(() => { void loadData() })
  }, [loadData])

  if (loading) return <LoadingSkeleton />
  if (!customer) return <NotFoundState onBack={() => router.push('/customers')} />

  const colorScheme = typeColors[customer.type] || typeColors.retail
  const tier = customer.tier || 'bronze'

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/customers')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Avatar className="h-12 w-12">
            <AvatarFallback className="bg-primary/10 text-primary">
              {customer.name.split(' ').map(n => n[0]).join('')}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{customer.name}</h1>
              <Badge className={`${colorScheme.bg} ${colorScheme.text}`}>{customer.type}</Badge>
              <Badge variant="outline" className={tierColors[tier]}>{tier.charAt(0).toUpperCase() + tier.slice(1)}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {customer.phone && <span className="mr-3">{customer.phone}</span>}
              {customer.email && <span>{customer.email}</span>}
              <span className="ml-3">Member since {new Date(customer.created_at).toLocaleDateString()}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push(`/customers`)}>
            <Users className="h-4 w-4 mr-2" />
            All Customers
          </Button>
          <Button variant="outline" onClick={() => setEditDialogOpen(true)}>
            <Edit3 className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button onClick={() => router.push(`/pos?customer=${customer.id}`)}>
            <ShoppingBag className="h-4 w-4 mr-2" />
            New Sale
          </Button>
        </div>
      </div>

      {/* AI Customer Health */}
      <AIInsightSection
        title="AI Customer Health"
        description="Churn risk analysis, spending insights, and next-best-action"
        analyzeFn={() => analyzeCustomerDetailAI({
          customer: {
            name: customer.name,
            type: customer.type || 'retail',
            tier: customer.tier || 'bronze',
            totalVisits: customer.total_visits || 0,
            totalSpent: (customer.total_spent_cents || 0) / 100,
            creditBalance: (customer.credit_balance || 0) / 100,
            averageOrderValue: customer.total_visits > 0
              ? ((customer.total_spent_cents || 0) / customer.total_visits) / 100
              : 0,
            lastPurchaseDate: customer.last_purchase_date
              ? new Date(customer.last_purchase_date).toISOString()
              : null,
          },
          recentActivity: (activity || []).slice(0, 10).map(a => ({
            description: a.description || 'Activity',
            date: a.created_at || new Date().toISOString(),
          })),
          salesHistory: (salesHistory || []).slice(0, 10).map(s => ({
            date: s.created_at || new Date().toISOString(),
            total: s.total_amount || 0,
            items: s.item_count || 0,
          })),
        })}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Total Spent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatKSh(customer.total_spent_cents)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <Activity className="h-3 w-3" /> Avg Basket
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatKSh(customer.average_basket_cents)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <Award className="h-3 w-3" /> Lifetime Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-success">{formatKSh(customer.lifetime_value_cents)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <RotateCcw className="h-3 w-3" /> Return Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${customer.return_rate > 15 ? 'text-destructive' : customer.return_rate > 5 ? 'text-warning' : 'text-success'}`}>
              {customer.return_rate}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="purchases">Purchase History</TabsTrigger>
          <TabsTrigger value="activity">Activity Timeline</TabsTrigger>
          <TabsTrigger value="loyalty">Loyalty & Credit</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{customer.phone || '—'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{customer.email || '—'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Member since {new Date(customer.created_at).toLocaleDateString()}</span>
                </div>
                {customer.birthday && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>Birthday: {new Date(customer.birthday).toLocaleDateString('en-KE', { month: 'long', day: 'numeric' })}</span>
                  </div>
                )}
                {customer.tags && customer.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-2">
                    {customer.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Segments</CardTitle>
              </CardHeader>
              <CardContent>
                {customer.segment_names.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {customer.segment_names.map(name => (
                      <Badge key={name} variant="outline" className="text-xs">
                        <Users className="h-3 w-3 mr-1" />
                        {name}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No segments assigned</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Purchase Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Purchases</span>
                  <span className="font-medium">{customer.purchase_count}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Visits</span>
                  <span className="font-medium">{customer.total_visits}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Avg Basket</span>
                  <span className="font-medium">{formatKSh(customer.average_basket_cents)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Lifetime Value</span>
                  <span className="font-medium text-success">{formatKSh(customer.lifetime_value_cents)}</span>
                </div>
                {customer.days_since_last_purchase !== null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Days Since Last Purchase</span>
                    <span className={`font-medium ${customer.days_since_last_purchase > 60 ? 'text-destructive' : customer.days_since_last_purchase > 30 ? 'text-warning' : 'text-success'}`}>
                      {customer.days_since_last_purchase}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Return Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Return Rate</span>
                  <span className={`font-medium ${customer.return_rate > 15 ? 'text-destructive' : ''}`}>{customer.return_rate}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Returned</span>
                  <span className="font-medium text-destructive">{formatKSh(customer.total_returned_cents)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Credit Balance</span>
                  <span className={`font-medium ${customer.credit_balance > 0 ? 'text-destructive' : 'text-success'}`}>
                    {formatKSh(Math.abs(customer.credit_balance))}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Credit Limit</span>
                  <span className="font-medium">{formatKSh(customer.credit_limit)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {customer.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{customer.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Contact Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Contact Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">SMS Notifications</p>
                  <p className="text-xs text-muted-foreground">Receive promotions and updates via SMS</p>
                </div>
                <Badge variant="outline" className="bg-success/10 text-success border-success/30">Active</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Email Notifications</p>
                  <p className="text-xs text-muted-foreground">Receive promotions and updates via email</p>
                </div>
                <Badge variant="outline" className="bg-success/10 text-success border-success/30">Active</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Purchase History Tab */}
        <TabsContent value="purchases">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Sales History</CardTitle>
              <CardDescription>Recent purchases and transactions</CardDescription>
            </CardHeader>
            <CardContent>
              {salesHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No purchases yet</p>
              ) : (
                <div className="space-y-2">
                  {salesHistory.map(sale => (
                    <div
                      key={sale.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => {
                        toast({ title: sale.receipt_number, description: `Total: ${formatKSh(sale.total_amount)} | ${new Date(sale.created_at).toLocaleDateString()}` })
                        router.push(`/sales-history?search=${encodeURIComponent(sale.receipt_number)}`)
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="rounded-full bg-primary/10 p-2">
                          <ShoppingBag className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{sale.receipt_number}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{new Date(sale.created_at).toLocaleDateString()}</span>
                            <span>&middot;</span>
                            <span>{sale.item_count} items</span>
                            <span>&middot;</span>
                            <Badge variant="outline" className="text-[10px]">{sale.payment_method}</Badge>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatKSh(sale.total_amount)}</p>
                        {sale.discount_amount > 0 && (
                          <p className="text-xs text-muted-foreground">-{formatKSh(sale.discount_amount)} disc</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Timeline Tab */}
        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Activity Timeline</CardTitle>
              <CardDescription>All customer interactions</CardDescription>
            </CardHeader>
            <CardContent>
              {activity.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No activity recorded</p>
              ) : (
                <div className="space-y-1">
                  {activity.map((act, idx) => (
                    <div key={act.id} className="flex items-start gap-3 py-2">
                      <div className="flex flex-col items-center">
                        <ActivityIcon type={act.type} />
                        {idx < activity.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm">{act.description}</p>
                          <span className={`text-xs font-medium ${act.amount_cents < 0 ? 'text-destructive' : 'text-success'}`}>
                            {act.amount_cents < 0 ? '-' : '+'}{formatKSh(Math.abs(act.amount_cents))}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(act.created_at).toLocaleString()}
                          {act.reference && <span> &middot; Ref: {act.reference}</span>}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Loyalty & Credit Tab */}
        <TabsContent value="loyalty">
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Award className="h-4 w-4 text-warning" />
                    Loyalty Points
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center py-4">
                    <p className="text-4xl font-bold text-warning">{customer.loyalty_points}</p>
                    <p className="text-sm text-muted-foreground mt-1">Available Points</p>
                  </div>
                  {customer.tier && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Current Tier</span>
                      <Badge variant="outline" className={tierColors[tier]}>{tier}</Badge>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Credit Account
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center py-4">
                    <p className={`text-4xl font-bold ${customer.credit_balance > 0 ? 'text-destructive' : 'text-success'}`}>
                      {formatKSh(Math.abs(customer.credit_balance))}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {customer.credit_balance > 0 ? 'Outstanding Balance' : 'No Balance'}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Credit Limit</span>
                      <span className="font-medium">{formatKSh(customer.credit_limit)}</span>
                    </div>
                    {customer.credit_limit > 0 && (
                      <div>
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>Utilization</span>
                          <span>{Math.round((customer.credit_balance / customer.credit_limit) * 100)}%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              (customer.credit_balance / customer.credit_limit) > 0.8
                                ? 'bg-destructive'
                                : (customer.credit_balance / customer.credit_limit) > 0.5
                                ? 'bg-warning'
                                : 'bg-success'
                            }`}
                            style={{ width: `${Math.min((customer.credit_balance / customer.credit_limit) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Loyalty Transaction History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loyaltyHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No loyalty transactions</p>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground">
                        <th className="text-left p-2 font-medium">Date</th>
                        <th className="text-left p-2 font-medium">Type</th>
                        <th className="text-right p-2 font-medium">Points</th>
                        <th className="text-right p-2 font-medium">Balance</th>
                        <th className="text-left p-2 font-medium">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loyaltyHistory.map((tx) => (
                        <tr key={tx.id} className="border-b last:border-0 hover:bg-muted/50">
                          <td className="p-2 text-sm">{new Date(tx.created_at).toLocaleDateString()}</td>
                          <td className="p-2">
                            <Badge variant={tx.type === 'earn' ? 'default' : tx.type === 'redeem' ? 'secondary' : 'outline'}>
                              {tx.type}
                            </Badge>
                          </td>
                          <td className={`p-2 text-right font-mono ${tx.points_delta >= 0 ? 'text-success' : 'text-destructive'}`}>
                            {tx.points_delta >= 0 ? '+' : ''}{tx.points_delta}
                          </td>
                          <td className="p-2 text-right font-mono">{tx.balance_after}</td>
                          <td className="p-2 text-sm text-muted-foreground max-w-[200px] truncate">{tx.reason || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Customer Dialog */}
      <EditCustomerDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        customer={customer ? {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
          type: customer.type,
          tier: customer.tier,
          credit_limit: customer.credit_limit,
          birthday: customer.birthday,
          notes: customer.notes,
          tags: customer.tags ?? [],
        } : null}
        onSuccess={() => { loadData() }}
      />
    </div>
  )
}

// ─── Activity Icon ────────────────────────────────────────────────────────────

function ActivityIcon({ type }: { type: CustomerActivity['type'] }) {
  const icons: Record<string, React.ReactNode> = {
    purchase: <div className="rounded-full bg-success/15 p-1.5"><ShoppingBag className="h-3 w-3 text-success" /></div>,
    return: <div className="rounded-full bg-destructive/15 p-1.5"><RotateCcw className="h-3 w-3 text-destructive" /></div>,
    loyalty_earn: <div className="rounded-full bg-warning/15 p-1.5"><Award className="h-3 w-3 text-warning" /></div>,
    loyalty_redeem: <div className="rounded-full bg-chart-3/15 p-1.5"><Star className="h-3 w-3 text-chart-3" /></div>,
    payment: <div className="rounded-full bg-primary/15 p-1.5"><CreditCard className="h-3 w-3 text-primary" /></div>,
  }
  return icons[type] || <div className="rounded-full bg-muted p-1.5"><Activity className="h-3 w-3 text-muted-foreground" /></div>
}

// ─── Loading & Error States ───────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}><CardContent className="pt-6"><Skeleton className="h-8 w-24" /></CardContent></Card>
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

function NotFoundState({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <EmptyState
        icon={AlertTriangle}
        title="Customer Not Found"
        description="The customer you are looking for does not exist or has been removed."
        actions={[{ label: 'Back to Customers', onClick: onBack, variant: 'outline', icon: ArrowLeft }]}
      />
    </div>
  )
}
