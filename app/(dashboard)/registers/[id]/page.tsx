'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  ArrowLeft, Monitor, Clock, UserCheck, Wifi, Printer,
  Camera, Battery, Power, PowerOff, Wrench, DollarSign,
  History, Activity, CheckCircle, XCircle, AlertTriangle,
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { EmptyState } from '@/components/ui/empty-state'
import { getRegisterById, getCashDrawers, getCashEvents, updateRegister } from '@/lib/modules/cash'
import { formatKSh } from '@/lib/currency'

interface CashDrawer {
  id: string
  drawer_name: string
  register_id: string
  status: string
  current_balance: number
  expected_balance: number
  last_variance: number
  last_counted_at: string | null
}

interface CashEvent {
  id: string
  register_id: string
  event_type: string
  amount: number
  balance_before: number | null
  balance_after: number | null
  created_at: string
  reason: string
  performer?: { id: string; full_name: string } | null
}

interface Register {
  id: string
  register_name: string
  serial_number: string | null
  branch_id: string
  register_type: string
  status: string
  current_cashier_id: string | null
  current_drawer_id: string | null
  last_login: string | null
  printer_status: string
  scanner_status: string
  customer_display_status: string
  network_status: string
  battery_level: number | null
  app_version: string | null
  health_score: number | null
  created_at: string
  updated_at: string
  branch?: { id: string; name: string; code: string } | null
  current_cashier?: { id: string; full_name: string } | null
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  online: { label: 'Online', variant: 'default' },
  offline: { label: 'Offline', variant: 'secondary' },
  maintenance: { label: 'Maintenance', variant: 'outline' },
  disabled: { label: 'Disabled', variant: 'destructive' },
}

const hwStatusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  connected: { label: 'Connected', variant: 'default' },
  disconnected: { label: 'Disconnected', variant: 'destructive' },
  error: { label: 'Error', variant: 'outline' },
  unknown: { label: 'Unknown', variant: 'secondary' },
}

export default function RegisterDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [register, setRegister] = useState<Register | null>(null)
  const [drawers, setDrawers] = useState<CashDrawer[]>([])
  const [events, setEvents] = useState<CashEvent[]>([])
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const reg = await getRegisterById(params.id as string)
        setRegister(reg as any)
        if (reg) {
          const [drs, evts] = await Promise.all([
            getCashDrawers((reg as unknown as Register).branch_id),
            getCashEvents((reg as unknown as Register).branch_id, { limit: 20 }),
          ])
          setDrawers((drs as CashDrawer[]).filter((d) => d.register_id === (reg as unknown as Register).id))
          setEvents((evts as CashEvent[]).filter((e) => e.register_id === (reg as unknown as Register).id))
        }
      } catch (err: unknown) {
        toast({ title: 'Error', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' })
      } finally {
        setLoading(false)
      }
    }
    if (params.id) load()
  }, [params.id, toast])

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (!register) {
    return (
      <div className="p-6">
        <EmptyState
          icon={AlertTriangle}
          title="Register not found"
          actions={[{ label: 'Back to Registers', onClick: () => router.push('/registers'), variant: 'outline', icon: ArrowLeft }]}
        />
      </div>
    )
  }

  const cfg = statusConfig[register.status] || { label: register.status, variant: 'secondary' as const }
  const healthColor = (register.health_score || 0) >= 80 ? 'text-green-500' :
    (register.health_score || 0) >= 50 ? 'text-yellow-500' : 'text-red-500'

  async function toggleStatus() {
    const newStatus = register!.status === 'online' ? 'offline' : 'online'
    const result = await updateRegister(register!.id, { status: newStatus })
    if (result.success) {
      setRegister({ ...register!, status: newStatus })
      toast({ title: `Register ${newStatus}` })
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' })
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/registers')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{register.register_name}</h1>
            <Badge variant={cfg.variant}>{cfg.label}</Badge>
          </div>
          <div className="flex items-center gap-3 mt-1 text-muted-foreground">
            {register.branch && <span className="text-sm">{register.branch.name}</span>}
            <Separator orientation="vertical" className="h-4" />
            <span className="text-sm capitalize">{register.register_type}</span>
            {register.serial_number && (
              <>
                <Separator orientation="vertical" className="h-4" />
                <span className="font-mono text-sm">S/N: {register.serial_number}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={toggleStatus}>
            {register.status === 'online' ? <PowerOff className="h-4 w-4 mr-2" /> : <Power className="h-4 w-4 mr-2" />}
            {register.status === 'online' ? 'Set Offline' : 'Set Online'}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Health Score</CardTitle></CardHeader>
          <CardContent>
            <p className={`text-xl font-bold ${healthColor}`}>{register.health_score || 0}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Battery</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{register.battery_level !== null ? `${register.battery_level}%` : 'N/A'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Cashiers</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{register.current_cashier?.full_name || 'No cashier'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">App Version</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{register.app_version || '-'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="overview"><Monitor className="h-4 w-4 mr-2" /> Overview</TabsTrigger>
          <TabsTrigger value="drawers"><DollarSign className="h-4 w-4 mr-2" /> Drawers ({drawers.length})</TabsTrigger>
          <TabsTrigger value="events"><History className="h-4 w-4 mr-2" /> Event History ({events.length})</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-lg">Hardware Status</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <Printer className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Printer</p>
                      <Badge variant={hwStatusConfig[register.printer_status]?.variant || 'secondary'}>
                        {register.printer_status}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Camera className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Scanner</p>
                      <Badge variant={hwStatusConfig[register.scanner_status]?.variant || 'secondary'}>
                        {register.scanner_status}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Wifi className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Network</p>
                      <Badge variant={hwStatusConfig[register.network_status]?.variant || 'secondary'}>
                        {register.network_status}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Battery className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Battery</p>
                      <p className="font-medium">{register.battery_level !== null ? `${register.battery_level}%` : 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Activity</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Last Login</p>
                    <p className="font-medium">
                      {register.last_login ? new Date(register.last_login).toLocaleString() : 'Never'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Current Cashier</p>
                    <p className="font-medium">{register.current_cashier?.full_name || 'None'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Customer Display</p>
                    <p className="font-medium capitalize">{register.customer_display_status || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Registered</p>
                    <p className="font-medium">{new Date(register.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Health Score Bar */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Health Score Trend</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        (register.health_score || 0) >= 80 ? 'bg-green-500' :
                        (register.health_score || 0) >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${register.health_score || 0}%` }}
                    />
                  </div>
                </div>
                <span className={`text-2xl font-bold ${
                  (register.health_score || 0) >= 80 ? 'text-green-500' :
                  (register.health_score || 0) >= 50 ? 'text-yellow-500' : 'text-red-500'
                }`}>
                  {register.health_score || 0}%
                </span>
              </div>
              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Drawers */}
        <TabsContent value="drawers" className="space-y-4 mt-4">
          {drawers.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-muted-foreground"><EmptyState title="No drawers assigned to this register" compact /></CardContent></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {drawers.map((d) => (
                <Card key={d.id}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-base">{d.drawer_name}</CardTitle>
                      <Badge variant={d.status === 'open' ? 'default' : 'secondary'}>{d.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Current Balance</p>
                        <p className="font-bold">{formatKSh(d.current_balance)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Expected Balance</p>
                        <p className="font-bold">{formatKSh(d.expected_balance)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Variance</p>
                        <p className={`font-bold ${d.last_variance > 0 ? 'text-green-600' : d.last_variance < 0 ? 'text-red-600' : ''}`}>
                          {d.last_variance !== 0 ? `${d.last_variance > 0 ? '+' : ''}${formatKSh(d.last_variance)}` : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Last Counted</p>
                        <p className="text-sm">{d.last_counted_at ? new Date(d.last_counted_at).toLocaleString() : 'Never'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Event History */}
        <TabsContent value="events" className="space-y-4 mt-4">
          {events.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-muted-foreground"><EmptyState title="No cash events for this register" compact /></CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="text-left p-3 font-medium">Date/Time</th>
                      <th className="text-left p-3 font-medium">Event Type</th>
                      <th className="text-right p-3 font-medium">Amount</th>
                      <th className="text-right p-3 font-medium">Balance Before</th>
                      <th className="text-right p-3 font-medium">Balance After</th>
                      <th className="text-left p-3 font-medium">Performer</th>
                      <th className="text-left p-3 font-medium">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((e) => (
                      <tr key={e.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="p-3 text-sm">{new Date(e.created_at).toLocaleString()}</td>
                        <td className="p-3"><Badge variant="outline">{e.event_type}</Badge></td>
                        <td className={`p-3 text-right font-mono ${e.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatKSh(Math.abs(e.amount))}
                        </td>
                        <td className="p-3 text-right font-mono">{formatKSh(e.balance_before || 0)}</td>
                        <td className="p-3 text-right font-mono">{formatKSh(e.balance_after || 0)}</td>
                        <td className="p-3 text-sm">{e.performer?.full_name || '-'}</td>
                        <td className="p-3 text-sm text-muted-foreground max-w-[200px] truncate">{e.reason || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
