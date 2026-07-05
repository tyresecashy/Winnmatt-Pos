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
  Puzzle, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Search,
  Settings,
  Power,
  PowerOff,
  ExternalLink,
  Package,
  Activity,
  FileText,
} from 'lucide-react'
import { PluginLoader, type InstalledPlugin } from '@/lib/plugin-system/loader'

export default function PluginsPage() {
  const [plugins, setPlugins] = useState<InstalledPlugin[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showInstallDialog, setShowInstallDialog] = useState(false)
  const [selectedPlugin, setSelectedPlugin] = useState<InstalledPlugin | null>(null)
  const [showConfigDialog, setShowConfigDialog] = useState(false)
  
  // Install form state
  const [installId, setInstallId] = useState('')
  const [installName, setInstallName] = useState('')
  const [installDescription, setInstallDescription] = useState('')
  const [installVersion, setInstallVersion] = useState('1.0.0')
  const [installAuthor, setInstallAuthor] = useState('')

  useEffect(() => {
    loadPlugins()
  }, [])

  async function loadPlugins() {
    setLoading(true)
    try {
      const data = await PluginLoader.getInstalledPlugins()
      setPlugins(data)
    } catch (error) {
      console.error('Failed to load plugins:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleInstall() {
    if (!installId || !installName) return

    try {
      await PluginLoader.installPlugin({
        id: installId,
        name: installName,
        description: installDescription,
        version: installVersion,
        author: installAuthor,
      })
      setShowInstallDialog(false)
      resetForm()
      await loadPlugins()
    } catch (error) {
      console.error('Failed to install plugin:', error)
    }
  }

  async function handleToggle(pluginId: string, currentStatus: string) {
    try {
      if (currentStatus === 'active') {
        await PluginLoader.deactivatePlugin(pluginId)
      } else {
        await PluginLoader.activatePlugin(pluginId)
      }
      await loadPlugins()
    } catch (error) {
      console.error('Failed to toggle plugin:', error)
    }
  }

  async function handleUninstall(pluginId: string) {
    if (!confirm('Are you sure you want to uninstall this plugin? This action cannot be undone.')) return
    
    try {
      await PluginLoader.uninstallPlugin(pluginId)
      await loadPlugins()
    } catch (error) {
      console.error('Failed to uninstall plugin:', error)
    }
  }

  async function handleOpenConfig(plugin: InstalledPlugin) {
    setSelectedPlugin(plugin)
    setShowConfigDialog(true)
  }

  function resetForm() {
    setInstallId('')
    setInstallName('')
    setInstallDescription('')
    setInstallVersion('1.0.0')
    setInstallAuthor('')
  }

  const filteredPlugins = plugins.filter(plugin =>
    plugin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    plugin.plugin_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (plugin.description && plugin.description.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const activeCount = plugins.filter(p => p.status === 'active').length
  const inactiveCount = plugins.filter(p => p.status === 'inactive').length
  const errorCount = plugins.filter(p => p.status === 'error').length

  function getStatusBadge(status: string) {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Active</Badge>
      case 'inactive':
        return <Badge variant="secondary">Inactive</Badge>
      case 'error':
        return <Badge variant="destructive">Error</Badge>
      case 'uninstalled':
        return <Badge variant="outline">Uninstalled</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Plugins</h1>
          <p className="text-muted-foreground">
            Extend WINNMATT with additional functionality
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadPlugins}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={showInstallDialog} onOpenChange={setShowInstallDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Install Plugin
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Install New Plugin</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Plugin ID *</Label>
                  <Input
                    value={installId}
                    onChange={(e) => setInstallId(e.target.value)}
                    placeholder="e.g., @winnmatt/plugin-mpesa"
                  />
                </div>
                <div>
                  <Label>Name *</Label>
                  <Input
                    value={installName}
                    onChange={(e) => setInstallName(e.target.value)}
                    placeholder="e.g., M-Pesa Integration"
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={installDescription}
                    onChange={(e) => setInstallDescription(e.target.value)}
                    placeholder="What does this plugin do?"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Version</Label>
                    <Input
                      value={installVersion}
                      onChange={(e) => setInstallVersion(e.target.value)}
                      placeholder="1.0.0"
                    />
                  </div>
                  <div>
                    <Label>Author</Label>
                    <Input
                      value={installAuthor}
                      onChange={(e) => setInstallAuthor(e.target.value)}
                      placeholder="WinnMatt"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowInstallDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleInstall} disabled={!installId || !installName}>
                  Install
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Puzzle className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{plugins.length}</p>
                <p className="text-xs text-muted-foreground">Total Plugins</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Power className="h-4 w-4 text-green-500" />
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
              <PowerOff className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-2xl font-bold">{inactiveCount}</p>
                <p className="text-xs text-muted-foreground">Inactive</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{errorCount}</p>
                <p className="text-xs text-muted-foreground">Error</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search plugins..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Plugins Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plugin</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Author</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead>Installed</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPlugins.map((plugin) => (
                <TableRow key={plugin.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{plugin.name}</div>
                      <div className="text-sm text-muted-foreground font-mono">
                        {plugin.plugin_id}
                      </div>
                      {plugin.description && (
                        <div className="text-xs text-muted-foreground mt-1 max-w-[300px] truncate">
                          {plugin.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{plugin.version}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {plugin.author || '-'}
                  </TableCell>
                  <TableCell className="text-center">
                    {getStatusBadge(plugin.status)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(plugin.installed_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggle(plugin.plugin_id, plugin.status)}
                        disabled={plugin.status === 'error'}
                      >
                        {plugin.status === 'active' ? (
                          <PowerOff className="h-4 w-4" />
                        ) : (
                          <Power className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenConfig(plugin)}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleUninstall(plugin.plugin_id)}
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

      {/* Plugin Marketplace (Placeholder) */}
      <Card>
        <CardHeader>
          <CardTitle>Plugin Marketplace</CardTitle>
          <CardDescription>
            Browse and install official WINNMATT plugins
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                id: '@winnmatt/plugin-mpesa',
                name: 'M-Pesa Integration',
                description: 'Accept M-Pesa payments directly from your POS',
                version: '2.1.0',
                installed: plugins.some(p => p.plugin_id === '@winnmatt/plugin-mpesa'),
              },
              {
                id: '@winnmatt/plugin-sms',
                name: 'SMS Notifications',
                description: 'Send SMS alerts for sales, stock, and more',
                version: '1.0.0',
                installed: plugins.some(p => p.plugin_id === '@winnmatt/plugin-sms'),
              },
              {
                id: '@winnmatt/plugin-email',
                name: 'Email Integration',
                description: 'Send email receipts and notifications',
                version: '1.0.0',
                installed: plugins.some(p => p.plugin_id === '@winnmatt/plugin-email'),
              },
              {
                id: '@winnmatt/plugin-quickbooks',
                name: 'QuickBooks Sync',
                description: 'Sync transactions with QuickBooks accounting',
                version: '1.2.0',
                installed: plugins.some(p => p.plugin_id === '@winnmatt/plugin-quickbooks'),
              },
              {
                id: '@winnmatt/plugin-kra',
                name: 'KRA eTIMS',
                description: 'KRA eTIMS compliance integration',
                version: '1.0.0',
                installed: plugins.some(p => p.plugin_id === '@winnmatt/plugin-kra'),
              },
              {
                id: '@winnmatt/plugin-receipt',
                name: 'Receipt Designer',
                description: 'Customize receipt templates and designs',
                version: '1.1.0',
                installed: plugins.some(p => p.plugin_id === '@winnmatt/plugin-receipt'),
              },
            ].map((marketplacePlugin) => (
              <Card key={marketplacePlugin.id} className="relative">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium">{marketplacePlugin.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {marketplacePlugin.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2 font-mono">
                        {marketplacePlugin.id}
                      </p>
                    </div>
                    <Badge variant="outline">{marketplacePlugin.version}</Badge>
                  </div>
                  <div className="mt-4">
                    {marketplacePlugin.installed ? (
                      <Badge className="bg-green-100 text-green-800">Installed</Badge>
                    ) : (
                      <Button size="sm" className="w-full">
                        <Plus className="h-4 w-4 mr-2" />
                        Install
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Config Dialog */}
      {selectedPlugin && (
        <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Configure {selectedPlugin.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Plugin configuration will be available once the plugin is fully implemented.
              </p>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-mono">{selectedPlugin.plugin_id}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Version {selectedPlugin.version}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowConfigDialog(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
