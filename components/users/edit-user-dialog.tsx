"use client"
import { logger } from '@/lib/logger';

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
import { updateUser, getBranches } from '@/lib/user-management'
import type { UserProfile } from '@/contexts/auth-context'

interface Branch {
  id: string
  name: string
  code: string
}

interface EditUserDialogProps {
  open: boolean
  user: UserProfile | null
  onOpenChange: (open: boolean) => void
  onUserUpdated: (user: UserProfile) => void
}

export function EditUserDialog({ open, user, onOpenChange, onUserUpdated }: EditUserDialogProps) {
  const { profile } = useAuth()
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<'admin' | 'manager' | 'cashier'>('cashier')
  const [branchId, setBranchId] = useState('')
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
      } catch (err) {
        logger.error('Failed to fetch branches:', err)
      } finally {
        setBranchesLoading(false)
      }
    }

    if (open) {
      fetchBranches()
    }
  }, [open])

  // Update form when user changes
  useEffect(() => {
    if (user) {
      const timer = setTimeout(() => {
        setFullName(user.full_name)
        setRole(user.role as 'admin' | 'manager' | 'cashier')
        setBranchId(user.branch_id || '')
        setError(null)
        setSuccess(false)
      })
      return () => clearTimeout(timer)
    }
  }, [user, open])

  const handleUpdate = async () => {
    if (!user) return

    setError(null)
    setLoading(true)

    try {
      if (!fullName || !role || !branchId) {
        throw new Error('All fields are required')
      }

      if (!profile?.role) {
        throw new Error('User role not available')
      }

      await updateUser(user.id, profile.role, {
        full_name: fullName,
        role,
        branch_id: branchId,
      })

      setSuccess(true)
      onUserUpdated({
        ...user,
        full_name: fullName,
        role,
        branch_id: branchId,
      })

      setTimeout(() => {
        onOpenChange(false)
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user')
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update user details. Email cannot be changed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-200 bg-green-50">
              <AlertCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">User updated successfully</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email Address (read-only)</Label>
            <Input id="email" type="email" value={user.email} readOnly className="bg-muted" />
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

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? 'Updating...' : 'Update User'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
