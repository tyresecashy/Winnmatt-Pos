'use client'

import { useState, useEffect, useCallback, useRef, startTransition } from 'react'
import { getActiveShift, openShift, closeShift } from '@/lib/modules/cash'

interface UseShiftGuardOptions {
  branchId: string | null
  cashierId: string
  pollInterval?: number // default 30s
}

interface UseShiftGuardReturn {
  /** The active shift, or null if none */
  activeShift: any
  /** True while initial load or polling */
  isLoading: boolean
  /** True when cashier has an open shift */
  hasActiveShift: boolean
  /** Open a new shift with the given float and optional register. Returns the shift or null on failure. */
  openNewShift: (openingFloat: number, registerId?: string) => Promise<Record<string, unknown> | null>
  /** Close the active shift. Returns the result. */
  closeActiveShift: (countedCash: number, closingNotes?: string) => Promise<{ success: boolean; overShort?: number }>
  /** Manually trigger a refresh */
  refresh: () => Promise<void>
}

export function useShiftGuard({
  branchId,
  cashierId,
  pollInterval = 30000,
}: UseShiftGuardOptions): UseShiftGuardReturn {
  const [activeShift, setActiveShift] = useState<Record<string, unknown> | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchActiveShift = useCallback(async () => {
    if (!branchId) {
      setActiveShift(null)
      setIsLoading(false)
      return
    }

    try {
      const shift = await getActiveShift(branchId, cashierId)
      setActiveShift(shift)
    } catch {
      setActiveShift(null)
    } finally {
      setIsLoading(false)
    }
  }, [branchId, cashierId])

  // Initial fetch + polling
  useEffect(() => {
    startTransition(() => { void fetchActiveShift() })

    pollRef.current = setInterval(() => {
      startTransition(() => { void fetchActiveShift() })
    }, pollInterval)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [fetchActiveShift, pollInterval])

  const openNewShift = useCallback(async (openingFloat: number, registerId?: string): Promise<any> => {
    if (!branchId) return null
    try {
      const result = await openShift(branchId, cashierId, openingFloat, registerId)
      if (result?.success) {
        await fetchActiveShift()
      }
      return result
    } catch {
      return null
    }
  }, [branchId, cashierId, fetchActiveShift])

  const closeActiveShift = useCallback(async (
    countedCash: number,
    closingNotes?: string,
  ): Promise<{ success: boolean; overShort?: number }> => {
    if (!activeShift) return { success: false }

    try {
      const result = await closeShift(activeShift.id as string, countedCash, closingNotes || '', cashierId)
      if (result.success) {
        setActiveShift(null)
        void fetchActiveShift()
      }
      return { success: result.success, overShort: 0 }
    } catch {
      return { success: false }
    }
  }, [activeShift, cashierId, fetchActiveShift])

  return {
    activeShift,
    isLoading,
    hasActiveShift: activeShift !== null,
    openNewShift,
    closeActiveShift,
    refresh: fetchActiveShift,
  }
}
