"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Plus, Search, MoreHorizontal, Pencil, Shield, ShieldCheck, User, Key, MapPin, AlertCircle, Loader2, XCircle } from "lucide-react"
import { formatDate } from "@/lib/date-time"
import { getUsers, resetUserPassword, deactivateUser, reactivateUser } from "@/lib/user-management"
import { AddUserDialog } from "@/components/users/add-user-dialog"
import { EditUserDialog } from "@/components/users/edit-user-dialog"
import type { UserProfile } from "@/contexts/auth-context"

const roleColors: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700",
  manager: "bg-blue-100 text-blue-700",
  cashier: "bg-green-100 text-green-700",
}

const roleLabels: Record<string, string> = {
  admin: "Administrator",
  manager: "Manager",
  cashier: "Cashier",
}

const permissions = [
  { role: "admin", permissions: ["All access", "Manage users", "View reports", "Manage inventory", "Process sales", "Manage settings"] },
  { role: "manager", permissions: ["View branch reports", "Manage branch inventory", "Process sales", "View customers", "Approve transfers"] },
  { role: "cashier", permissions: ["Process sales", "View products", "Customer lookup", "Apply discounts (limited)"] },
]

export default function UsersPage() {
  const { profile } = useAuth()
  const { toast } = useToast()

  // State
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
  const [deactivatingUserId, setDeactivatingUserId] = useState<string | null>(null)
  const [resettingPasswordId, setResettingPasswordId] = useState<string | null>(null)
  const [passwordReset, setPasswordReset] = useState<{ email: string; password: string } | null>(null)

  // Check if current user is admin
  const isAdmin = profile?.role === 'admin'

  // Load users on mount
  useEffect(() => {
    const loadUsers = async () => {
      if (!isAdmin) {
        setLoading(false)
        return
      }

      try {
        const data = await getUsers(profile?.role || 'cashier')
        setUsers(data)
      } catch (error) {
        console.error('Failed to load users:', error)
        toast({
          title: 'Error',
          description: 'Failed to load users',
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    }

    loadUsers()
  }, [isAdmin, profile?.role, toast])

  // Filter users by search
  const filteredUsers = users.filter((user) => {
    return (
      user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })

  // Count users by role
  const adminCount = users.filter(u => u.role === "admin").length
  const managerCount = users.filter(u => u.role === "manager").length
  const cashierCount = users.filter(u => u.role === "cashier").length

  // Handle edit user
  const handleEditUser = (user: UserProfile) => {
    setSelectedUser(user)
    setEditDialogOpen(true)
  }

  // Handle user created
  const handleUserCreated = (user: UserProfile) => {
    setUsers([user, ...users])
    setAddDialogOpen(false)
    toast({
      title: 'Success',
      description: `${user.full_name} has been created successfully`,
    })
  }

  // Handle user updated
  const handleUserUpdated = (user: UserProfile) => {
    setUsers(users.map(u => u.id === user.id ? user : u))
    setEditDialogOpen(false)
    setSelectedUser(null)
    toast({
      title: 'Success',
      description: `${user.full_name} has been updated successfully`,
    })
  }

  // Handle deactivate user
  const handleDeactivateUser = async (userId: string) => {
    try {
      setDeactivatingUserId(userId)
      await deactivateUser(userId, profile?.role || 'cashier')
      const updatedUser = users.find(u => u.id === userId)
      if (updatedUser) {
        setUsers(users.map(u => u.id === userId ? { ...u, status: 'inactive' } : u))
        toast({
          title: 'Success',
          description: `${updatedUser.full_name} has been deactivated`,
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to deactivate user',
        variant: 'destructive',
      })
    } finally {
      setDeactivatingUserId(null)
    }
  }

  // Handle reactivate user
  const handleReactivateUser = async (userId: string) => {
    try {
      setDeactivatingUserId(userId)
      await reactivateUser(userId, profile?.role || 'cashier')
      const updatedUser = users.find(u => u.id === userId)
      if (updatedUser) {
        setUsers(users.map(u => u.id === userId ? { ...u, status: 'active' } : u))
        toast({
          title: 'Success',
          description: `${updatedUser.full_name} has been reactivated`,
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to reactivate user',
        variant: 'destructive',
      })
    } finally {
      setDeactivatingUserId(null)
    }
  }

  // Handle reset password
  const handleResetPassword = async (userId: string) => {
    try {
      setResettingPasswordId(userId)
      const result = await resetUserPassword(userId, profile?.role || 'cashier')
      setPasswordReset({
        email: result.email,
        password: result.tempPassword,
      })
      toast({
        title: 'Success',
        description: `Password reset for ${result.email}`,
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to reset password',
        variant: 'destructive',
      })
    } finally {
      setResettingPasswordId(null)
    }
  }

  // Access denied screen
  if (!isAdmin) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Users & Roles</h1>
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            Access denied. Only administrators can manage users.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // Loading state
  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Users & Roles</h1>
            <p className="text-muted-foreground">Manage user accounts and permissions</p>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users & Roles</h1>
          <p className="text-muted-foreground">Manage user accounts and permissions</p>
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Users</CardDescription>
            <CardTitle className="text-3xl">{users.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Shield className="h-3 w-3 text-purple-600" />
              Administrators
            </CardDescription>
            <CardTitle className="text-3xl">{adminCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-blue-600" />
              Managers
            </CardDescription>
            <CardTitle className="text-3xl">{managerCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <User className="h-3 w-3 text-green-600" />
              Cashiers
            </CardDescription>
            <CardTitle className="text-3xl">{cashierCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <User className="h-8 w-8 mb-2 opacity-50" />
                  <p>No users found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarFallback className="bg-primary/10 text-primary text-sm">
                                {user.full_name
                                  .split(' ')
                                  .map((n) => n[0])
                                  .join('')}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{user.full_name}</p>
                              <p className="text-xs text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={roleColors[user.role]}>
                            {roleLabels[user.role]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {user.branch?.name || '—'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline"
                            className={user.status === 'active' 
                              ? 'bg-green-100 text-green-700 border-green-300'
                              : 'bg-gray-100 text-gray-700 border-gray-300'
                            }
                          >
                            {user.status === 'active' ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(user.created_at)}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" disabled={deactivatingUserId === user.id}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditUser(user)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleResetPassword(user.id)}>
                                <Key className="mr-2 h-4 w-4" />
                                Reset Password
                              </DropdownMenuItem>
                              {user.status === 'active' && (
                                <DropdownMenuItem
                                  onClick={() => setDeactivatingUserId(user.id)}
                                  className="text-destructive"
                                >
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Deactivate
                                </DropdownMenuItem>
                              )}
                              {user.status === 'inactive' && (
                                <DropdownMenuItem
                                  onClick={() => handleReactivateUser(user.id)}
                                  className="text-green-600"
                                >
                                  <Shield className="mr-2 h-4 w-4" />
                                  Reactivate
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles">
          <div className="grid gap-6 md:grid-cols-3">
            {permissions.map((role) => (
              <Card key={role.role}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                        role.role === "admin"
                          ? "bg-purple-100"
                          : role.role === "manager"
                          ? "bg-blue-100"
                          : "bg-green-100"
                      }`}
                    >
                      {role.role === "admin" && <Shield className="h-5 w-5 text-purple-600" />}
                      {role.role === "manager" && <ShieldCheck className="h-5 w-5 text-blue-600" />}
                      {role.role === "cashier" && <User className="h-5 w-5 text-green-600" />}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{roleLabels[role.role]}</CardTitle>
                      <CardDescription>
                        {users.filter((u) => u.role === role.role).length} users
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {role.permissions.map((permission) => (
                      <div key={permission} className="flex items-center gap-2 text-sm">
                        <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        {permission}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <AddUserDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onUserCreated={handleUserCreated}
      />
      <EditUserDialog
        open={editDialogOpen}
        user={selectedUser}
        onOpenChange={setEditDialogOpen}
        onUserUpdated={handleUserUpdated}
      />

      {/* Deactivation Confirmation */}
      <AlertDialog open={!!deactivatingUserId} onOpenChange={(open) => !open && setDeactivatingUserId(null)}>
          <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate {filteredUsers.find(u => u.id === deactivatingUserId)?.full_name}?
              This user will not be able to access the system until reactivated. Their data will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deactivatingUserId && handleDeactivateUser(deactivatingUserId)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Deactivate
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Password Reset Display */}
      {passwordReset && (
        <AlertDialog open={!!passwordReset} onOpenChange={() => setPasswordReset(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Password Reset</AlertDialogTitle>
              <AlertDialogDescription>
                Share this temporary password with {passwordReset.email}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="rounded-lg bg-muted p-4 font-mono text-center text-lg font-bold break-words">
              {passwordReset.password}
            </div>
            <p className="text-xs text-muted-foreground">
              User must change password on first login.
            </p>
            <AlertDialogAction onClick={() => setPasswordReset(null)}>Close</AlertDialogAction>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
