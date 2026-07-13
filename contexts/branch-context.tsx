'use client'

import React, { createContext, useContext, useState, useCallback, useEffect, startTransition } from 'react'
import { useAuth } from '@/contexts/auth-context'

export interface Branch {
  id: string
  name: string
  code: string
}

interface BranchContextType {
  branchId: string | null
  setBranchId: (id: string | null) => void
  branches: Branch[]
  setBranches: (branches: Branch[]) => void
  activeBranch: Branch | null
}

const BranchContext = createContext<BranchContextType | undefined>(undefined)

const STORAGE_KEY = 'active_branch_id'

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth()
  const [branchId, setBranchIdState] = useState<string | null>(() => {
    // Prefer localStorage, fall back to profile branch
    const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    return stored || profile?.branch_id || null
  })
  const [branches, setBranchesState] = useState<Branch[]>(() => {
    // Initialize from profile if available
    if (profile?.branch) {
      return [{ id: profile.branch.id, name: profile.branch.name, code: profile.branch.code }]
    }
    return []
  })

  const setBranchId = useCallback((id: string | null) => {
    setBranchIdState(id)
    if (id) {
      localStorage.setItem(STORAGE_KEY, id)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  const setBranches = useCallback((newBranches: Branch[]) => {
    setBranchesState(newBranches)
    // Auto-set branchId to first branch if none selected
    if (!branchId && newBranches.length > 0) {
      setBranchId(newBranches[0].id)
    }
  }, [branchId, setBranchId])

  // Sync profile branch into branches if not already present
  useEffect(() => {
    startTransition(() => {
      const branch = profile?.branch
      if (branch && !branches.some(b => b.id === branch.id)) {
        setBranchesState(prev => [...prev, { id: branch.id, name: branch.name, code: branch.code }])
      }
    })
  }, [profile, branches])

  const activeBranch = branches.find(b => b.id === branchId) || profile?.branch || null

  return (
    <BranchContext.Provider value={{ branchId, setBranchId, branches, setBranches, activeBranch }}>
      {children}
    </BranchContext.Provider>
  )
}

export function useBranch() {
  const context = useContext(BranchContext)
  if (!context) {
    // Return defaults when outside provider
    return { branchId: null, setBranchId: () => {}, branches: [], setBranches: () => {}, activeBranch: null }
  }
  return context
}
