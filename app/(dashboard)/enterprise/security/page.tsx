'use client'

import { startTransition, useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/ui/empty-state'
import {
  ShieldCheck,
  RefreshCw,
  User,
  Users,
  Shield,
  ShieldAlert,
  ShieldOff,
  Clock,
  Search,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { getSecurityOverview, type SecurityUser } from '@/lib/modules/enterprise'
import { formatDistanceToNow } from 'date-fns'

const ROLE_BADGES: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof Shield }> = {
  super_admin: { variant: 'destructive', icon: ShieldAlert },
  admin: { variant: 'default', icon: Shield },
  staff: { variant: 'secondary', icon: User },
  manager: { variant: 'default', icon: Shield },
  cashier: { variant: 'outline', icon: User },
  inventory_control: { variant: 'outline', icon: Shield },
  finance: { variant: 'secondary', icon: Shield },
}

export default function SecurityPage() {
  const [users, setUsers] = useState<SecurityUser[]>([])
  const [stats, setStats] = useState<{
    total: number
    active: number
    superAdmins: number
    admins: number
    staff: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getSecurityOverview()
      if (result) {
        setUsers(result.users)
        setStats(result.stats)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { startTransition(() => { load() }) }, [load])

  const filteredUsers = users.filter(u =>
    !searchQuery ||
    u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-7 w-7" />
            Security
          </h1>
          <p className="text-muted-foreground mt-1">User roles, access control, and security overview</p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      {(loading && !stats) ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-4 pb-3"><Skeleton className="h-10 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <Users className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Users</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <div className="h-4 w-4 rounded-full bg-success shrink-0" />
              <div>
                <p className="text-2xl font-bold">{stats.active}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <ShieldAlert className="h-4 w-4 text-destructive shrink-0" />
              <div>
                <p className="text-2xl font-bold">{stats.superAdmins}</p>
                <p className="text-xs text-muted-foreground">Super Admins</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <Shield className="h-4 w-4 text-primary shrink-0" />
              <div>
                <p className="text-2xl font-bold">{stats.admins}</p>
                <p className="text-xs text-muted-foreground">Admins</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-2xl font-bold">{stats.staff}</p>
                <p className="text-xs text-muted-foreground">Staff</p>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search users by name, email, or role..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>User Accounts</CardTitle>
          <CardDescription>{filteredUsers.length} of {stats?.total || 0} users</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[160px]">Last Login</TableHead>
                <TableHead className="w-[140px]">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                  ))}
                </TableRow>
              )) : filteredUsers.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12"><EmptyState title="No users found" compact /></TableCell></TableRow>
              ) : (
                filteredUsers.map((u) => {
                  const roleConfig = ROLE_BADGES[u.role || ''] || ROLE_BADGES.staff
                  const RoleIcon = roleConfig.icon
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          {u.full_name || <span className="text-muted-foreground italic">Unnamed</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u.email || <span className="italic">—</span>}</TableCell>
                      <TableCell>
                        <Badge variant={roleConfig.variant} className="gap-1">
                          <RoleIcon className="h-3 w-3" />
                          {u.role?.replace(/_/g, ' ') || 'unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {u.is_active ? (
                          <Badge variant="default" className="bg-success/10 text-success border-success/20 gap-1">
                            <div className="h-1.5 w-1.5 rounded-full bg-success" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground gap-1">
                            <ShieldOff className="h-3 w-3" />
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {u.last_login ? (
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(u.last_login), { addSuffix: true })}
                          </div>
                        ) : (
                          <span className="italic">Never</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
