'use client'

import { useEffect, useState, startTransition } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useBranch, type Branch } from '@/contexts/branch-context'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MapPin, Store } from 'lucide-react'
import { getAllBranches } from '@/lib/modules/transfers'

export function BranchSwitcher() {
  const { profile } = useAuth()
  const { branchId, setBranchId, branches, setBranches, activeBranch } = useBranch()
  const [loading, setLoading] = useState(false)

  // Load all branches for super_admin; others just use their assigned branch
  useEffect(() => {
    startTransition(() => {
      if (!profile) return

      // For non-super_admin, just use their assigned branch
      if (profile.role !== 'super_admin') {
        if (profile.branch && branches.length === 0) {
          setBranches([{ id: profile.branch.id, name: profile.branch.name, code: profile.branch.code }])
        }
        return
      }

      // Super_admin — fetch all branches once
      if (branches.length > 1) return

      setLoading(true)
      getAllBranches()
        .then(data => {
          const branchList: Branch[] = (data || []).map(b => ({
            id: b.id,
            name: b.name,
            code: b.code || b.name.slice(0, 3).toUpperCase(),
          }))
          if (branchList.length > 0) {
            setBranches(branchList)
          }
        })
        .catch(() => {
          // Fallback: use profile branch only
          if (profile?.branch) {
            setBranches([{ id: profile.branch.id, name: profile.branch.name, code: profile.branch.code }])
          }
        })
        .finally(() => setLoading(false))
    })
  }, [profile, branches.length, setBranches])

  // Don't render if no branches
  if (branches.length === 0 && !profile?.branch) return null

  const displayBranches = branches.length > 0 ? branches : (profile?.branch ? [profile.branch] : [])

  // Single branch — show static badge (no switcher needed)
  if (displayBranches.length <= 1) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Store className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{activeBranch?.name || profile?.branch?.name || 'Branch'}</span>
        {activeBranch?.code && (
          <span className="text-xs text-muted-foreground font-mono">({activeBranch.code})</span>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
      <Select value={branchId || undefined} onValueChange={setBranchId} disabled={loading}>
        <SelectTrigger className="w-[200px] h-8 text-sm">
          <SelectValue placeholder={loading ? 'Loading...' : 'Select branch'} />
        </SelectTrigger>
        <SelectContent>
          {displayBranches.map(b => (
            <SelectItem key={b.id} value={b.id}>
              <div className="flex items-center gap-2">
                <span>{b.name}</span>
                {b.code && <span className="text-xs text-muted-foreground font-mono">({b.code})</span>}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
