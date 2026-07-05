'use client'
import { logger } from '@/lib/logger'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useToast } from '@/components/ui/use-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  getPermissionDefinitions,
  getRolePermissions,
  setRolePermission,
  removeRolePermission,
  getUserPermissions,
  setUserPermission,
} from '@/lib/permission-actions'
import { getUsers } from '@/lib/user-management'
import {
  Shield,
  Search,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  MinusCircle,
  User,
  AlertTriangle,
  Building2,
  Percent,
  Calendar,
  Loader2,
  FileText,
} from 'lucide-react'

interface PermissionDef {
  code: string
  label: string
  category: string
  description: string
}

interface RolePermission {
  id: string
  role: string
  permission_code: string
  grant_type: 'allow' | 'deny'
  branch_id: string | null
  max_value: number | null
  expires_at: string | null
  requires_approval: boolean | null
  permission?: { code: string; label: string; category: string } | null
}

interface UserPermission {
  id: string
  user_id: string
  permission_code: string
  grant_type: 'allow' | 'deny'
  branch_id: string | null
  max_value: number | null
  expires_at: string | null
  requires_approval: boolean | null
  permission?: { code: string; label: string; category: string } | null
}

interface UserOption {
  id: string
  full_name: string
  email: string
  role: string
}

const ROLES = ['super_admin', 'admin', 'manager', 'cashier'] as const

const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Administrator',
  manager: 'Manager',
  cashier: 'Cashier',
}

const grantTypeIcons: Record<string, typeof CheckCircle2> = {
  allow: CheckCircle2,
  deny: XCircle,
}

const grantTypeColors: Record<string, string> = {
  allow: 'text-green-600 bg-green-50 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800',
  deny: 'text-red-600 bg-red-50 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800',
}

export default function PermissionsPage() {
  const { profile } = useAuth()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState('roles')

  const [definitions, setDefinitions] = useState<PermissionDef[]>([])
  const [defsLoading, setDefsLoading] = useState(true)

  const [selectedRole, setSelectedRole] = useState<string>('cashier')
  const [rolePerms, setRolePerms] = useState<RolePermission[]>([])
  const [rolePermsLoading, setRolePermsLoading] = useState(false)
  const [savingRolePerm, setSavingRolePerm] = useState<string | null>(null)

  const [users, setUsers] = useState<UserOption[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [userPerms, setUserPerms] = useState<UserPermission[]>([])
  const [userPermsLoading, setUserPermsLoading] = useState(false)
  const [savingUserPerm, setSavingUserPerm] = useState<string | null>(null)

  const [catalogSearch, setCatalogSearch] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})

  const definitionsByCategory: Record<string, PermissionDef[]> = {}
  for (const def of definitions) {
    if (!definitionsByCategory[def.category]) definitionsByCategory[def.category] = []
    definitionsByCategory[def.category].push(def)
  }

  const loadDefinitions = useCallback(async () => {
    setDefsLoading(true)
    try {
      const data = await getPermissionDefinitions()
      setDefinitions(data)
      const cats: Record<string, boolean> = {}
      for (const d of data) cats[d.category] = true
      setExpandedCategories(cats)
    } catch (error) {
      logger.error('Failed to load permission definitions:', error)
      toast({ title: 'Error', description: 'Failed to load permission definitions', variant: 'destructive' })
    } finally {
      setDefsLoading(false)
    }
  }, [toast])

  const loadRolePerms = useCallback(async (role: string) => {
    setRolePermsLoading(true)
    try {
      const data = await getRolePermissions(role)
      setRolePerms(data)
    } catch (error) {
      logger.error('Failed to load role permissions:', error)
    } finally {
      setRolePermsLoading(false)
    }
  }, [])

  const loadUsers = useCallback(async () => {
    if (!profile?.role) return
    setUsersLoading(true)
    try {
      const data = await getUsers(profile.role)
      setUsers(data as unknown as UserOption[])
    } catch (error) {
      logger.error('Failed to load users:', error)
    } finally {
      setUsersLoading(false)
    }
  }, [profile?.role])

  const loadUserPerms = useCallback(async (userId: string) => {
    setUserPermsLoading(true)
    try {
      const data = await getUserPermissions(userId)
      setUserPerms(data)
    } catch (error) {
      logger.error('Failed to load user permissions:', error)
    } finally {
      setUserPermsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDefinitions()
  }, [loadDefinitions])

  useEffect(() => {
    if (activeTab === 'roles') void loadRolePerms(selectedRole)
  }, [activeTab, selectedRole, loadRolePerms])

  useEffect(() => {
    if (activeTab === 'users') void loadUsers()
  }, [activeTab, loadUsers])

  useEffect(() => {
    if (selectedUserId) void loadUserPerms(selectedUserId)
  }, [selectedUserId, loadUserPerms])

  const getRolePerm = (code: string): RolePermission | undefined =>
    rolePerms.find((p) => p.permission_code === code && !p.branch_id)

  const getUserPerm = (code: string): UserPermission | undefined =>
    userPerms.find((p) => p.permission_code === code && !p.branch_id)

  const getEffectiveGrantType = (code: string): 'allow' | 'deny' | 'none' => {
    const up = getUserPerm(code)
    if (up) return up.grant_type
    const rp = getRolePerm(code)
    if (rp) return rp.grant_type
    return 'none'
  }

  const handleRoleToggle = async (code: string, current: string | null) => {
    setSavingRolePerm(code)
    try {
      const nextGrant = current === 'allow' ? 'deny' : 'allow'
      const result = await setRolePermission({
        role: selectedRole,
        permission_code: code,
        grant_type: nextGrant,
      })
      if (result.success) {
        toast({ title: 'Updated', description: `Permission ${nextGrant === 'allow' ? 'allowed' : 'denied'} for ${roleLabels[selectedRole]}` })
        void loadRolePerms(selectedRole)
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to update', variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Error', description: 'An unexpected error occurred', variant: 'destructive' })
    } finally {
      setSavingRolePerm(null)
    }
  }

  const handleRemoveRolePerm = async (id: string, code: string) => {
    setSavingRolePerm(code)
    try {
      const result = await removeRolePermission(id)
      if (result.success) {
        toast({ title: 'Removed', description: 'Permission override removed' })
        void loadRolePerms(selectedRole)
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to remove', variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Error', description: 'An unexpected error occurred', variant: 'destructive' })
    } finally {
      setSavingRolePerm(null)
    }
  }

  const handleUserToggle = async (code: string, current: string | null) => {
    if (!selectedUserId) return
    setSavingUserPerm(code)
    try {
      const nextGrant = current === 'allow' ? 'deny' : 'allow'
      const result = await setUserPermission({
        user_id: selectedUserId,
        permission_code: code,
        grant_type: nextGrant,
      })
      if (result.success) {
        toast({ title: 'Updated', description: `User override ${nextGrant === 'allow' ? 'allowed' : 'denied'}` })
        void loadUserPerms(selectedUserId)
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to update', variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Error', description: 'An unexpected error occurred', variant: 'destructive' })
    } finally {
      setSavingUserPerm(null)
    }
  }

  const filteredCatalog = catalogSearch
    ? definitions.filter(
        (d) =>
          d.code.toLowerCase().includes(catalogSearch.toLowerCase()) ||
          d.label.toLowerCase().includes(catalogSearch.toLowerCase()) ||
          d.category.toLowerCase().includes(catalogSearch.toLowerCase()) ||
          d.description.toLowerCase().includes(catalogSearch.toLowerCase())
      )
    : definitions

  const GrantBadge = ({ grantType }: { grantType: string }) => {
    if (grantType === 'allow') return <Badge className="gap-1 border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400"><CheckCircle2 className="h-3 w-3" />Allow</Badge>
    if (grantType === 'deny') return <Badge className="gap-1 border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400"><XCircle className="h-3 w-3" />Deny</Badge>
    return <Badge variant="outline" className="gap-1 text-muted-foreground"><MinusCircle className="h-3 w-3" />None</Badge>
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Permission System 2.0</h1>
          <p className="text-sm text-muted-foreground">
            Manage role-based and user-specific access permissions across the system
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="roles" className="gap-2"><Shield className="h-4 w-4" />Role Permissions</TabsTrigger>
          <TabsTrigger value="users" className="gap-2"><User className="h-4 w-4" />User Overrides</TabsTrigger>
          <TabsTrigger value="catalog" className="gap-2"><FileText className="h-4 w-4" />Permission Catalog</TabsTrigger>
        </TabsList>

        {/* ROLE PERMISSIONS TAB */}
        <TabsContent value="roles" className="mt-6 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Role-Based Permissions</CardTitle>
                  <CardDescription>Configure default permissions for each system role</CardDescription>
                </div>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {roleLabels[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
          </Card>

          {defsLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
                  <CardContent><Skeleton className="h-32 w-full" /></CardContent>
                </Card>
              ))}
            </div>
          ) : (
            Object.entries(definitionsByCategory).map(([category, perms]) => {
              const isExpanded = expandedCategories[category] ?? true
              return (
                <Collapsible
                  key={category}
                  open={isExpanded}
                  onOpenChange={(open) => setExpandedCategories((prev) => ({ ...prev, [category]: open }))}
                >
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                            <CardTitle className="text-base capitalize">{category.replace(/_/g, ' ')}</CardTitle>
                            <Badge variant="secondary" className="ml-2">{perms.length}</Badge>
                          </div>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent>
                        {rolePermsLoading ? (
                          <div className="space-y-3">
                            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {perms.map((def) => {
                              const rp = getRolePerm(def.code)
                              const saving = savingRolePerm === def.code
                              return (
                                <div
                                  key={def.code}
                                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                                >
                                  <div className="flex-1 min-w-0 mr-4">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium">{def.label}</span>
                                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground font-mono">{def.code}</code>
                                    </div>
                                    <p className="mt-0.5 text-xs text-muted-foreground">{def.description}</p>
                                    {rp && (
                                      <div className="mt-1 flex flex-wrap gap-2">
                                        <GrantBadge grantType={rp.grant_type} />
                                        {rp.max_value != null && (
                                          <Badge variant="outline" className="gap-1 text-xs">
                                            <Percent className="h-3 w-3" />
                                            Max: {rp.max_value}
                                          </Badge>
                                        )}
                                        {rp.expires_at && (
                                          <Badge variant="outline" className="gap-1 text-xs">
                                            <Calendar className="h-3 w-3" />
                                            Exp: {new Date(rp.expires_at).toLocaleDateString()}
                                          </Badge>
                                        )}
                                        {rp.branch_id && (
                                          <Badge variant="outline" className="gap-1 text-xs">
                                            <Building2 className="h-3 w-3" />
                                            Branch-specific
                                          </Badge>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 shrink-0">
                                    <Switch
                                      checked={rp?.grant_type === 'allow'}
                                      disabled={saving}
                                      onCheckedChange={() => handleRoleToggle(def.code, rp?.grant_type ?? null)}
                                    />
                                    {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                                    {rp && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                        disabled={saving}
                                        onClick={() => handleRemoveRolePerm(rp.id, def.code)}
                                      >
                                        <XCircle className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              )
            })
          )}
        </TabsContent>

        {/* USER OVERRIDES TAB */}
        <TabsContent value="users" className="mt-6 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">User Permission Overrides</CardTitle>
              <CardDescription>Grant or restrict specific permissions for individual users</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label htmlFor="user-select">Select User</Label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId} disabled={usersLoading}>
                    <SelectTrigger id="user-select" className="mt-1.5">
                      <SelectValue placeholder={usersLoading ? 'Loading users...' : 'Choose a user...'} />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.full_name}{' '}
                          <span className="text-muted-foreground">
                            ({u.email}) - {roleLabels[u.role] || u.role}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {usersLoading && <Loader2 className="mt-6 h-5 w-5 animate-spin text-muted-foreground" />}
              </div>
            </CardContent>
          </Card>

          {!selectedUserId ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <User className="mb-3 h-12 w-12 opacity-20" />
                <p className="text-sm">Select a user to view and manage their permission overrides</p>
              </CardContent>
            </Card>
          ) : defsLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}><CardContent className="pt-6"><Skeleton className="h-24 w-full" /></CardContent></Card>
              ))}
            </div>
          ) : (
            Object.entries(definitionsByCategory).map(([category, perms]) => {
              const isExpanded = expandedCategories[category] ?? true
              const hasOverrides = perms.some((d) => getUserPerm(d.code) != null)
              return (
                <Collapsible
                  key={category}
                  open={isExpanded}
                  onOpenChange={(open) => setExpandedCategories((prev) => ({ ...prev, [category]: open }))}
                >
                  <Card className={hasOverrides ? 'border-amber-200 dark:border-amber-800' : ''}>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                            <CardTitle className="text-base capitalize">{category.replace(/_/g, ' ')}</CardTitle>
                            <Badge variant="secondary" className="ml-2">{perms.length}</Badge>
                            {hasOverrides && (
                              <Badge variant="outline" className="border-amber-200 text-amber-700 dark:border-amber-800 dark:text-amber-400">
                                <AlertTriangle className="mr-1 h-3 w-3" />Has overrides
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent>
                        {userPermsLoading ? (
                          <div className="space-y-3">
                            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {perms.map((def) => {
                              const up = getUserPerm(def.code)
                              const rp = getRolePerm(def.code)
                              const effective = getEffectiveGrantType(def.code)
                              const saving = savingUserPerm === def.code
                              return (
                                <div
                                  key={def.code}
                                  className={`flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50 ${
                                    up ? 'border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30' : ''
                                  }`}
                                >
                                  <div className="flex-1 min-w-0 mr-4">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium">{def.label}</span>
                                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground font-mono">{def.code}</code>
                                    </div>
                                    <p className="mt-0.5 text-xs text-muted-foreground">{def.description}</p>
                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                      <span className="text-xs text-muted-foreground">Effective:</span>
                                      <GrantBadge grantType={effective} />
                                      {rp && !up && (
                                        <span className="text-xs text-muted-foreground">
                                          (from role: {roleLabels[selectedRole] || selectedRole})
                                        </span>
                                      )}
                                      {up && (
                                        <Badge variant="outline" className="gap-1 border-amber-200 text-amber-700 dark:border-amber-800 dark:text-amber-400">
                                          <User className="h-3 w-3" />User override
                                        </Badge>
                                      )}
                                      {up?.max_value != null && (
                                        <Badge variant="outline" className="gap-1 text-xs">
                                          <Percent className="h-3 w-3" />Max: {up.max_value}
                                        </Badge>
                                      )}
                                      {up?.expires_at && (
                                        <Badge variant="outline" className="gap-1 text-xs">
                                          <Calendar className="h-3 w-3" />Exp: {new Date(up.expires_at).toLocaleDateString()}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3 shrink-0">
                                    <div className="flex flex-col items-center gap-1">
                                      <Switch
                                        checked={up?.grant_type === 'allow' || (!up && rp?.grant_type === 'allow')}
                                        disabled={saving || !selectedUserId}
                                        onCheckedChange={() => handleUserToggle(def.code, up?.grant_type ?? null)}
                                      />
                                      <span className="text-[10px] text-muted-foreground">
                                        {up ? 'Override' : 'Inherit'}
                                      </span>
                                    </div>
                                    {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              )
            })
          )}
        </TabsContent>

        {/* PERMISSION CATALOG TAB */}
        <TabsContent value="catalog" className="mt-6 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Permission Catalog</CardTitle>
                  <CardDescription>Complete list of all {definitions.length} permission definitions in the system</CardDescription>
                </div>
                <div className="relative w-72">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search permissions..."
                    className="pl-9"
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {defsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : (
                <ScrollArea className="h-[600px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-48">Code</TableHead>
                        <TableHead className="w-52">Label</TableHead>
                        <TableHead className="w-36">Category</TableHead>
                        <TableHead>Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCatalog.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                            No permissions match your search
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredCatalog.map((def) => (
                          <TableRow key={def.code}>
                            <TableCell>
                              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{def.code}</code>
                            </TableCell>
                            <TableCell className="font-medium">{def.label}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs capitalize">
                                {def.category.replace(/_/g, ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{def.description}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
