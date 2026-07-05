'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { 
  Webhook, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Search,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ExternalLink,
  Copy,
  Eye,
  EyeOff,
} from 'lucide-react'
import { 
  createWebhookEndpoint, 
  getWebhookEndpoints, 
  deleteWebhookEndpoint,
  updateWebhookEndpoint,
  getWebhookDeliveries,
  retryWebhookDelivery,
  type WebhookEndpoint,
  type WebhookDelivery
} from '@/lib/webhook-service'

const AVAILABLE_EVENTS = [
  'sale.completed',
  'sale.voided',
  'sale.returned',
  'product.created',
  'product.updated',
  'stock.low',
  'stock.adjusted',
  'customer.created',
  'customer.updated',
  'expense.approved',
  'expense.rejected',
  'employee.clock_in',
  'employee.clock_out',
  'payroll.processed',
  'shift.opened',
  'shift.closed',
  'invoice.created',
  'invoice.paid',
  'payment.received',
  '*',
]

export default function WebhooksPage() {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [selectedEndpoint, setSelectedEndpoint] = useState<WebhookEndpoint | null>(null)
  const [showDeliveriesDialog, setShowDeliveriesDialog] = useState(false)
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([])
  const [loadingDeliveries, setLoadingDeliveries] = useState(false)
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({})
  
  // Create form state
  const [newName, setNewName] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newEvents, setNewEvents] = useState<string[]>(['sale.completed'])
  const [newRetryCount, setNewRetryCount] = useState(3)
  const [newTimeoutMs, setNewTimeoutMs] = useState(5000)

  useEffect(() => {
    loadEndpoints()
  }, [])

  async function loadEndpoints() {
    setLoading(true)
    try {
      const data = await getWebhookEndpoints()
      setEndpoints(data)
    } catch (error) {
      console.error('Failed to load endpoints:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    if (!newName || !newUrl) return

    const result = await createWebhookEndpoint(
      newName,
      newUrl,
      newEvents,
      {
        description: newDescription || undefined,
        retryCount: newRetryCount,
        timeoutMs: newTimeoutMs,
      }
    )

    if (result.success) {
      setShowCreateDialog(false)
      resetForm()
      await loadEndpoints()
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this webhook endpoint?')) return
    
    const result = await deleteWebhookEndpoint(id)
    if (result.success) {
      await loadEndpoints()
    }
  }

  async function handleToggleStatus(id: string, currentStatus: string) {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
    const result = await updateWebhookEndpoint(id, { status: newStatus })
    if (result.success) {
      await loadEndpoints()
    }
  }

  async function handleViewDeliveries(endpoint: WebhookEndpoint) {
    setSelectedEndpoint(endpoint)
    setShowDeliveriesDialog(true)
    setLoadingDeliveries(true)
    try {
      const data = await getWebhookDeliveries(endpoint.id)
      setDeliveries(data)
    } catch (error) {
      console.error('Failed to load deliveries:', error)
    } finally {
      setLoadingDeliveries(false)
    }
  }

  async function handleRetryDelivery(deliveryId: string) {
    const result = await retryWebhookDelivery(deliveryId)
    if (result.success) {
      // Refresh deliveries list
      if (selectedEndpoint) {
        const data = await getWebhookDeliveries(selectedEndpoint.id)
        setDeliveries(data)
      }
    }
  }

  function resetForm() {
    setNewName('')
    setNewUrl('')
    setNewDescription('')
    setNewEvents(['sale.completed'])
    setNewRetryCount(3)
    setNewTimeoutMs(5000)
  }

  function toggleEvent(event: string) {
    setNewEvents(prev => 
      prev.includes(event) 
        ? prev.filter(e => e !== event)
        : [...prev, event]
    )
  }

  function toggleSecretVisibility(id: string) {
    setShowSecret(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const filteredEndpoints = endpoints.filter(endpoint =>
    endpoint.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    endpoint.url.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const activeCount = endpoints.filter(e => e.status === 'active').length
  const errorCount = endpoints.filter(e => e.status === 'error').length

  function getStatusBadge(status: string) {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Active</Badge>
      case 'inactive':
        return <Badge variant="secondary">Inactive</Badge>
      case 'error':
        return <Badge variant="destructive">Error</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  function getDeliveryStatusBadge(status: string) {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Success</Badge>
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>
      case 'pending':
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pending</Badge>
      case 'retrying':
        return <Badge className="bg-yellow-100 text-yellow-800"><AlertTriangle className="h-3 w-3 mr-1" />Retrying</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Webhooks</h1>
          <p className="text-muted-foreground">
            Manage webhook endpoints and delivery tracking
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadEndpoints}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Endpoint
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Webhook Endpoint</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Name *</Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g., QuickBooks Sync"
                  />
                </div>
                <div>
                  <Label>URL *</Label>
                  <Input
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="https://api.example.com/webhook"
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="What does this webhook do?"
                  />
                </div>
                <div>
                  <Label>Events *</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {AVAILABLE_EVENTS.map(event => (
                      <Badge
                        key={event}
                        variant={newEvents.includes(event) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => toggleEvent(event)}
                      >
                        {event}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Retry Count</Label>
                    <Input
                      type="number"
                      value={newRetryCount}
                      onChange={(e) => setNewRetryCount(parseInt(e.target.value) || 3)}
                      min={0}
                      max={10}
                    />
                  </div>
                  <div>
                    <Label>Timeout (ms)</Label>
                    <Input
                      type="number"
                      value={newTimeoutMs}
                      onChange={(e) => setNewTimeoutMs(parseInt(e.target.value) || 5000)}
                      min={1000}
                      max={30000}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={!newName || !newUrl}>
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
              <Webhook className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{endpoints.length}</p>
                <p className="text-xs text-muted-foreground">Total Endpoints</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{activeCount}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{errorCount}</p>
                <p className="text-xs text-muted-foreground">Errors</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search endpoints..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Endpoints Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Events</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead>Last Triggered</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEndpoints.map((endpoint) => (
                <TableRow key={endpoint.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{endpoint.name}</div>
                      {endpoint.description && (
                        <div className="text-xs text-muted-foreground mt-1 max-w-[200px] truncate">
                          {endpoint.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-muted px-1 py-0.5 rounded max-w-[200px] truncate block">
                        {endpoint.url}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigator.clipboard.writeText(endpoint.url)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {endpoint.events.slice(0, 3).map(event => (
                        <Badge key={event} variant="secondary" className="text-xs">
                          {event}
                        </Badge>
                      ))}
                      {endpoint.events.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{endpoint.events.length - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {getStatusBadge(endpoint.status)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {endpoint.last_triggered_at 
                      ? new Date(endpoint.last_triggered_at).toLocaleString()
                      : 'Never'
                    }
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDeliveries(endpoint)}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleStatus(endpoint.id, endpoint.status)}
                      >
                        {endpoint.status === 'active' ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(endpoint.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Deliveries Dialog */}
      {selectedEndpoint && (
        <Dialog open={showDeliveriesDialog} onOpenChange={setShowDeliveriesDialog}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Deliveries for {selectedEndpoint.name}</DialogTitle>
            </DialogHeader>
            {loadingDeliveries ? (
              <div className="p-8 text-center">
                <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                Loading deliveries...
              </div>
            ) : deliveries.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Send className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No deliveries yet</p>
              </div>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Attempt</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deliveries.map((delivery) => (
                      <TableRow key={delivery.id}>
                        <TableCell>
                          <Badge variant="outline">{delivery.event}</Badge>
                        </TableCell>
                        <TableCell>
                          {getDeliveryStatusBadge(delivery.status)}
                        </TableCell>
                        <TableCell>
                          {delivery.attempt}/{delivery.max_attempts}
                        </TableCell>
                        <TableCell>
                          {delivery.duration_ms ? `${delivery.duration_ms}ms` : '-'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(delivery.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {delivery.status === 'failed' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRetryDelivery(delivery.id)}
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
