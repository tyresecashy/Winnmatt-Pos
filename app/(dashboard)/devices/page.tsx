'use client'
import { logger } from '@/lib/logger';

import { startTransition, useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Monitor, Smartphone, Tablet, Wifi, WifiOff, AlertTriangle, Laptop, MonitorIcon } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { getDevices, type Device } from '@/lib/modules/devices'

const DEVICE_ICONS: Record<string, React.ReactNode> = {
  pos_terminal: <Monitor className="h-4 w-4" />,
  tablet: <Tablet className="h-4 w-4" />,
  mobile: <Smartphone className="h-4 w-4" />,
  kiosk: <Laptop className="h-4 w-4" />,
  other: <Monitor className="h-4 w-4" />,
}

const STATUS_VARIANTS: Record<string, string> = {
  online: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200',
  offline: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200',
  idle: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200',
}

const formatTimeAgo = (dateStr: string | null) => {
  if (!dateStr) return 'Never'
  const ms = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString()
}

export default function DevicesPage() {
  const { profile, authState } = useAuth()
  const [devices, setDevices] = useState<Device[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const loadDevices = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await getDevices(profile?.branch_id ?? undefined)
      setDevices(data || [])
    } catch (err) {
      logger.error('Failed to load devices:', err)
      setError('Failed to load devices. The server may be unavailable.')
      setDevices([])
    } finally {
      setIsLoading(false)
    }
  }, [profile])

  useEffect(() => {
    startTransition(() => { if (authState === 'authenticated') void loadDevices() })
  }, [authState, loadDevices])

  // Pre-filter by status before passing to DataTable
  const filteredDevices = useMemo(() => {
    if (statusFilter === 'all') return devices
    return devices.filter((d) => d.status === statusFilter)
  }, [devices, statusFilter])

  const statusCounts = useMemo(() => ({
    all: devices.length,
    online: devices.filter((d) => d.status === 'online').length,
    idle: devices.filter((d) => d.status === 'idle').length,
    offline: devices.filter((d) => d.status === 'offline').length,
  }), [devices])

  const columns: Column<Device>[] = useMemo(() => [
    {
      key: 'name',
      header: 'Device',
      searchValue: (d) => d.name,
      sortFn: (a, b, dir) => {
        const cmp = a.name.localeCompare(b.name)
        return dir === 'asc' ? cmp : -cmp
      },
      cell: (d) => (
        <div className="flex items-center gap-2 font-medium">
          <span className="text-muted-foreground">{DEVICE_ICONS[d.device_type] || DEVICE_ICONS.other}</span>
          {d.name}
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      searchValue: (d) => d.device_type,
      cell: (d) => (
        <span className="text-muted-foreground capitalize">
          {d.device_type.replace(/_/g, ' ')}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: 'status',
      header: 'Status',
      sortFn: (a, b, dir) => {
        const order = ['online', 'idle', 'offline']
        const cmp = order.indexOf(a.status) - order.indexOf(b.status)
        return dir === 'asc' ? cmp : -cmp
      },
      cell: (d) => (
        <Badge variant="outline" className={STATUS_VARIANTS[d.status] || ''}>
          {d.status}
        </Badge>
      ),
    },
    {
      key: 'app_version',
      header: 'App Version',
      searchValue: (d) => d.app_version || '',
      cell: (d) => (
        <span className="text-xs font-mono text-muted-foreground">
          {d.app_version || '—'}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: 'ip_address',
      header: 'IP Address',
      searchValue: (d) => d.ip_address || '',
      cell: (d) => (
        <span className="text-xs font-mono text-muted-foreground">
          {d.ip_address || '—'}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: 'last_seen_at',
      header: 'Last Seen',
      sortFn: (a, b, dir) => {
        const aTime = a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0
        const bTime = b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0
        return dir === 'asc' ? aTime - bTime : bTime - aTime
      },
      cell: (d) => (
        <span className="text-sm text-muted-foreground">
          {formatTimeAgo(d.last_seen_at)}
        </span>
      ),
    },
    {
      key: 'first_seen_at',
      header: 'First Seen',
      sortFn: (a, b, dir) => {
        const aTime = a.first_seen_at ? new Date(a.first_seen_at).getTime() : 0
        const bTime = b.first_seen_at ? new Date(b.first_seen_at).getTime() : 0
        return dir === 'asc' ? aTime - bTime : bTime - aTime
      },
      cell: (d) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(d.first_seen_at)}
        </span>
      ),
      hideOnMobile: true,
    },
  ], [])

  // Auth loading state
  if (authState === 'loading') {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex min-h-[220px] items-center justify-center text-muted-foreground">
            Loading...
          </CardContent>
        </Card>
      </div>
    )
  }

  // Not authenticated
  if (!profile) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex min-h-[220px] items-center justify-center text-muted-foreground">
            Please sign in to view devices.
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
          <h1 className="text-2xl font-bold tracking-tight">Devices</h1>
          <p className="text-muted-foreground">Monitor POS terminals and connected devices</p>
        </div>
      </div>

      {/* Status KPI cards */}
      <div className="grid gap-4 grid-cols-3">
        <Card className="bg-green-50/50 dark:bg-green-950/10 border-green-200 dark:border-green-900/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <p className="text-sm font-medium text-green-700 dark:text-green-400">Online</p>
            <Wifi className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-bold text-green-800 dark:text-green-300">{statusCounts.online}</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-50/50 dark:bg-amber-950/10 border-amber-200 dark:border-amber-900/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Idle</p>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-bold text-amber-800 dark:text-amber-300">{statusCounts.idle}</p>
          </CardContent>
        </Card>
        <Card className="bg-red-50/50 dark:bg-red-950/10 border-red-200 dark:border-red-900/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <p className="text-sm font-medium text-red-700 dark:text-red-400">Offline</p>
            <WifiOff className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-bold text-red-800 dark:text-red-300">{statusCounts.offline}</p>
          </CardContent>
        </Card>
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-2">
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList>
            <TabsTrigger value="all">All ({statusCounts.all})</TabsTrigger>
            <TabsTrigger value="online">Online ({statusCounts.online})</TabsTrigger>
            <TabsTrigger value="idle">Idle ({statusCounts.idle})</TabsTrigger>
            <TabsTrigger value="offline">Offline ({statusCounts.offline})</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Data table with search, sort, pagination */}
      <DataTable<Device>
        data={filteredDevices}
        columns={columns}
        keyExtractor={(d) => d.id}
        loading={isLoading}
        error={error}
        searchable
        searchPlaceholder="Search by name, type, IP or version..."
        paginated
        pageSize={10}
        selectable
        onRefresh={loadDevices}
        empty={{
          title: statusFilter !== 'all' ? 'No devices with this status' : 'No devices found',
          description:
            statusFilter !== 'all'
              ? 'Try a different status filter.'
              : 'Devices will appear here when POS terminals connect and register.',
          icon: MonitorIcon,
        }}
        rowClassName="cursor-default"
      />
    </div>
  )
}
