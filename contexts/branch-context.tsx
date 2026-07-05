'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'
import { useAuth } from '@/contexts/auth-context'

interface BranchContextType {
  branchId: string | null
  setBranchId: (id: string | null) => void
}

const BranchContext = createContext<BranchContextType | undefined>(undefined)

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth()
  const [branchId, setBranchIdState] = useState<string | null>(profile?.branch_id || null)

  const setBranchId = useCallback((id: string | null) => {
    setBranchIdState(id)
  }, [])

  return (
    <BranchContext.Provider value={{ branchId, setBranchId }}>
      {children}
    </BranchContext.Provider>
  )
}

export function useBranch() {
  const context = useContext(BranchContext)
  if (!context) {
    // Return defaults when outside provider
    return { branchId: null, setBranchId: () => {} }
  }
  return context
}
