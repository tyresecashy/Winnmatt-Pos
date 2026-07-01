"use client"

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle } from 'lucide-react'
import { createUser, getBranches } from '@/lib/user-management'
import type { UserProfile } from '@/contexts/auth-context'

interface Branch {
  id: string
  name: string
  code: string
}

interface AddUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUserCreated: (user: UserProfile) => void
}

export function AddUserDialog({ open, onOpenChange, onUserCreated }: AddUserDialogProps) {
  const { profile } = useAuth()
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<'admin' | 'manager' | 'cashier'>('cashier')
  const [branchId, setBranchId] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [branches, setBranches] = useState<Branch[]>([])
  const [branchesLoading, setBranchesLoading] = useState(true)

  // Fetch real branches from database
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        setBranchesLoading(true)
        const data = await getBranches()
        setBranches(data)
        // Set default to first branch if available
        if (data.length > 0 && !branchId) {
          setBranchId(data[0].id)
        }
      } catch (err) {
        console.error('Failed to fetch branches:', err)
        setError('Failed to load branches')
      } finally {
        setBranchesLoading(false)
      }
    }

    if (open) {
      fetchBranches()
    }
  }, [open])

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setEmail('')
        setFullName('')
        setRole('cashier')
        setBranchId(branches.length > 0 ? branches[0].id : '')
        setPassword('')
        setConfirmPassword('')
        setError(null)
        setSuccess(false)
      }, 200)
    }
  }, [open, branches])

  const handleCreate = async () => {
    setError(null)
    setLoading(true)

    try {
      // Basic validation
      if (!email || !fullName || !role || !branchId || !password || !confirmPassword) {
        throw new Error('All fields are required')
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error('Invalid email address')
      }

      if (password.length < 8) {
        throw new Error('Password must be at least 8 characters')
      }

      if (password !== confirmPassword) {
        throw new Error('Passwords do not match')
      }

      if (!profile?.role) {
        throw new Error('User role not available')
      }

      // Call server function with current user's role for authorization
      const result = await createUser(
        profile.role,
        email,
        fullName,
        role,
        branchId, // Now using real UUID from database
        password
      )

      setSuccess(true)
      onUserCreated(result.user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (success) {
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
          <DialogDescription>
            Create a new user account with their chosen password.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          // Success State
          <div className="space-y-4">
            <Alert className="border-green-200 bg-green-50">
              <AlertCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                User created successfully!
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">User Details</Label>
              <div className="rounded-lg bg-muted p-3 space-y-1 text-sm">
                <div>
                  <span className="font-medium">Email:</span> {email}
                </div>
                <div>
                  <span className="font-medium">Name:</span> {fullName}
                </div>
                <div>
                  <span className="font-medium">Role:</span> {role}
                </div>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              The user can now login with their email and password.
            </p>

            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          </div>
        ) : (
          // Form State
          <div className="space-y-4">
            {error && (
              <Alert className="border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={role} onValueChange={(value) => setRole(value as any)} disabled={loading}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrator</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="cashier">Cashier</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="branch">Branch</Label>
              <Select 
                value={branchId} 
                onValueChange={setBranchId} 
                disabled={loading || branchesLoading}
              >
                <SelectTrigger id="branch">
                  <SelectValue placeholder={branchesLoading ? "Loading branches..." : "Select a branch"} />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {branchesLoading && (
                <p className="text-xs text-muted-foreground">Loading branches from database...</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password (min 8 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? 'Creating...' : 'Create User'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
