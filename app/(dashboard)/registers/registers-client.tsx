'use client'

import { useState } from 'react'
import {
  Monitor, DollarSign, Wifi, Battery, Printer, Camera,
  Plus, Power, PowerOff, Wrench, UserCheck, Search,
  CheckCircle, XCircle, AlertTriangle, RefreshCw
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatKSh } from '@/lib/currency'
import { useToast } from '@/components/ui/use-toast'
import { EmptyState } from '@/components/ui/empty-state'
import { createRegister, updateRegister } from '@/lib/modules/cash'

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
  branch?: { id: string; name: string; code: string } | null
  current_cashier?: { id: string; full_name: string } | null
}

interface Drawer {
  id: string
  drawer_name: string
  register_id: string | null
  branch_id: string
  status: string
  current_balance: number
  expected_balance: number
  last_variance: number
  last_counted_at: string | null
  register?: { id: string; register_name: string; status: string } | null
}

interface Branch {
  id: string
  name: string
}

interface Cashier {
  id: string
  full_name: string
  role: string
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' }> = {
  online: { label: 'Online', variant: 'default' },
  offline: { label: 'Offline', variant: 'secondary' },
  maintenance: { label: 'Maintenance', variant: 'secondary' as const },
  disabled: { label: 'Disabled', variant: 'destructive' },
}

const hwStatusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' }> = {
  connected: { label: 'Connected', variant: 'default' },
  disconnected: { label: 'Disconnected', variant: 'destructive' },
  error: { label: 'Error', variant: 'secondary' as const },
  unknown: { label: 'Unknown', variant: 'secondary' },
}

export function RegistersClient({
  initialRegisters,
  initialDrawers,
  summary,
  branches,
  cashiers,
  currentBranchId,
}: {
  initialRegisters: Register[]
  initialDrawers: Drawer[]
  summary: { totalCashIn: number; totalCashOut: number; netCash: number; openDrawers: number; totalDrawers: number; totalVariance: number; eventCount: number } | null
  branches: Branch[]
  cashiers: Cashier[]
  currentBranchId: string | null
}) {
  const { toast } = useToast()
  const [registers, setRegisters] = useState(initialRegisters)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Create form
  const [newName, setNewName] = useState('')
  const [newBranch, setNewBranch] = useState(currentBranchId || '')
  const [newSerial, setNewSerial] = useState('')
  const [newType, setNewType] = useState('stationary')

  // Edit form
  const [editStatus, setEditStatus] = useState('')
  const [editCashier, setEditCashier] = useState('')
  const [editPrinter, setEditPrinter] = useState('')
  const [editScanner, setEditScanner] = useState('')
  const [editNetwork, setEditNetwork] = useState('')

  const filtered = registers.filter(r =>
    r.register_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.serial_number && r.serial_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (r.branch?.name && r.branch.name.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName || !newBranch) return
    setSubmitting(true)
    try {
      const result = await createRegister({
        register_name: newName,
        branch_id: newBranch,
        serial_number: newSerial || undefined,
        register_type: newType,
      })
      if (result.error) toast({ title: 'Error', description: result.error, variant: 'destructive' })
      else {
        toast({ title: 'Success', description: 'Register created' })
        setShowCreateDialog(false)
        setNewName(''); setNewSerial('')
      }
    } finally { setSubmitting(false) }
  }

  async function handleEdit() {
    if (!showEditDialog) return
    setSubmitting(true)
    try {
      const updates: Record<string, unknown> = {}
      if (editStatus) updates.status = editStatus
      if (editCashier) updates.current_cashier_id = editCashier === '__none__' ? null : editCashier
      if (editPrinter) updates.printer_status = editPrinter
      if (editScanner) updates.scanner_status = editScanner
      if (editNetwork) updates.network_status = editNetwork

      const result = await updateRegister(showEditDialog, updates)
      if (result.error) toast({ title: 'Error', description: result.error, variant: 'destructive' })
      else {
        toast({ title: 'Success', description: 'Register updated' })
        setShowEditDialog(null)
      }
    } finally { setSubmitting(false) }
  }

  function openEdit(reg: Register) {
    setShowEditDialog(reg.id)
    setEditStatus(reg.status)
    setEditCashier(reg.current_cashier_id || '__none__')
    setEditPrinter(reg.printer_status)
    setEditScanner(reg.scanner_status)
    setEditNetwork(reg.network_status)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Registers Management</h1>
          <p className="text-muted-foreground">Manage POS registers, drawers, and hardware status</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Register
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Registers</CardTitle>
            <Monitor className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{registers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Online</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{registers.filter(r => r.status === 'online').length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Offline / Issues</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {registers.filter(r => r.status === 'offline' || r.status === 'maintenance').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Drawers Open</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {initialDrawers.filter(d => d.status === 'open').length} / {initialDrawers.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg. Health</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {registers.length > 0
                ? `${Math.round(registers.reduce((s, r) => s + (r.health_score || 0), 0) / registers.length)}%`
                : 'N/A'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Register Cards */}
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, serial, or branch..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.length === 0 ? (
          <Card className="col-span-full">
            <EmptyState title="No registers found" compact />
          </Card>
        ) : filtered.map((reg) => {
          const cfg = statusConfig[reg.status] || { label: reg.status, variant: 'secondary' as const }
          const healthColor = (reg.health_score || 0) >= 80 ? 'bg-green-500' :
            (reg.health_score || 0) >= 50 ? 'bg-yellow-500' : 'bg-red-500'
          const drawer = initialDrawers.find(d => d.register_id === reg.id)

          return (
            <Card key={reg.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Monitor className="h-4 w-4" />
                      {reg.register_name}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      {reg.branch?.name || 'No branch'} · {reg.register_type}
                    </p>
                    {reg.serial_number && (
                      <p className="text-xs text-muted-foreground">S/N: {reg.serial_number}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={cfg.variant as 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost'}>{cfg.label}</Badge>
                    <div className="flex items-center gap-1 text-xs">
                      <Battery className="h-3 w-3" />
                      {reg.battery_level !== null ? `${reg.battery_level}%` : 'N/A'}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pb-3 space-y-3">
                {/* Health bar */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Health</span>
                    <span>{reg.health_score || 0}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${healthColor}`} style={{ width: `${reg.health_score || 0}%` }} />
                  </div>
                </div>

                {/* Hardware status */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    <Printer className={`h-3 w-3 ${reg.printer_status === 'connected' ? 'text-green-500' : 'text-muted-foreground'}`} />
                    <span>Printer: {reg.printer_status}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Camera className={`h-3 w-3 ${reg.scanner_status === 'connected' ? 'text-green-500' : 'text-muted-foreground'}`} />
                    <span>Scanner: {reg.scanner_status}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Wifi className={`h-3 w-3 ${reg.network_status === 'connected' ? 'text-green-500' : 'text-muted-foreground'}`} />
                    <span>Network: {reg.network_status}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <UserCheck className="h-3 w-3 text-muted-foreground" />
                    <span>{reg.current_cashier?.full_name || 'No cashier'}</span>
                  </div>
                </div>

                {/* Drawer info */}
                {drawer && (
                  <div className="bg-muted/50 rounded p-2 text-xs">
                    <div className="flex justify-between">
                      <span>Drawer: {drawer.drawer_name}</span>
                      <Badge variant={drawer.status === 'open' ? 'default' : 'secondary'} className="text-[10px] px-1 py-0">
                        {drawer.status}
                      </Badge>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span>Balance: {formatKSh(drawer.current_balance)}</span>
                      {drawer.last_variance !== 0 && (
                        <span className={drawer.last_variance > 0 ? 'text-green-600' : 'text-red-600'}>
                          {drawer.last_variance > 0 ? '+' : ''}{formatKSh(drawer.last_variance)}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-1 pt-1">
                  <Button variant="outline" size="sm" onClick={() => {
                    updateRegister(reg.id, { status: reg.status === 'online' ? 'offline' : 'online' }).then(r => {
                      if (r.success) toast({ title: 'Status toggled' })
                    })
                  }}>
                    {reg.status === 'online' ? <PowerOff className="h-3 w-3" /> : <Power className="h-3 w-3" />}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openEdit(reg)}>
                    <Wrench className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Drawers table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cash Drawers</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Drawer Name</TableHead>
                <TableHead>Register</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Expected</TableHead>
                <TableHead className="text-right">Variance</TableHead>
                <TableHead>Last Counted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialDrawers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-6"><EmptyState title="No drawers configured" compact /></TableCell>
                </TableRow>
              ) : initialDrawers.map(d => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.drawer_name}</TableCell>
                  <TableCell>{d.register?.register_name || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={d.status === 'open' ? 'default' : 'secondary'}>{d.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatKSh(d.current_balance)}</TableCell>
                  <TableCell className="text-right font-mono">{formatKSh(d.expected_balance)}</TableCell>
                  <TableCell className={`text-right font-mono ${d.last_variance > 0 ? 'text-green-600' : d.last_variance < 0 ? 'text-red-600' : ''}`}>
                    {d.last_variance !== 0 ? `${d.last_variance > 0 ? '+' : ''}${formatKSh(d.last_variance)}` : '-'}
                  </TableCell>
                  <TableCell className="text-xs">
                    {d.last_counted_at ? new Date(d.last_counted_at).toLocaleString() : 'Never'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Register</DialogTitle>
            <DialogDescription>Create a new POS register</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Register Name</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Counter 1" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Branch</Label>
                <Select value={newBranch} onValueChange={setNewBranch}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {branches.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={newType} onValueChange={setNewType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stationary">Stationary</SelectItem>
                    <SelectItem value="mobile">Mobile</SelectItem>
                    <SelectItem value="self_service">Self Service</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Serial Number</Label>
              <Input value={newSerial} onChange={(e) => setNewSerial(e.target.value)} placeholder="Optional" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>Create Register</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!showEditDialog} onOpenChange={(o) => { if (!o) setShowEditDialog(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure Register</DialogTitle>
            <DialogDescription>Update register settings and hardware status</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cashier</Label>
              <Select value={editCashier} onValueChange={setEditCashier}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— No cashier —</SelectItem>
                  {cashiers.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.full_name} ({c.role})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Printer</Label>
                <Select value={editPrinter} onValueChange={setEditPrinter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="connected">Connected</SelectItem>
                    <SelectItem value="disconnected">Disconnected</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Scanner</Label>
                <Select value={editScanner} onValueChange={setEditScanner}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="connected">Connected</SelectItem>
                    <SelectItem value="disconnected">Disconnected</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Network</Label>
              <Select value={editNetwork} onValueChange={setEditNetwork}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="connected">Connected</SelectItem>
                  <SelectItem value="disconnected">Disconnected</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(null)}>Cancel</Button>
              <Button onClick={handleEdit} disabled={submitting}>Save Changes</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
