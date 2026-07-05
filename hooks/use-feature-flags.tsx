'use client'

import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { isFeatureEnabled, type FeatureFlagContext } from '@/lib/feature-flags'
import { useAuth } from '@/contexts/auth-context'
import { useBranch } from '@/contexts/branch-context'

// ─── Context ────────────────────────────────────────────────────────────────

interface FeatureFlagContextValue {
  flags: Map<string, boolean>
  isEnabled: (key: string) => boolean
  refreshFlags: () => Promise<void>
  loading: boolean
}

const FeatureFlagContext = createContext<FeatureFlagContextValue | null>(null)

// ─── Provider ───────────────────────────────────────────────────────────────

export function FeatureFlagProvider({ children }: { children: React.ReactNode }) {
  const [flags, setFlags] = useState<Map<string, boolean>>(new Map())
  const [loading, setLoading] = useState(true)
  const { profile } = useAuth()
  const { branchId } = useBranch()

  const context: FeatureFlagContext = {
    branchId: branchId || undefined,
    role: profile?.role || undefined,
    userId: profile?.id || undefined,
  }

  const refreshFlags = useCallback(async () => {
    setLoading(true)
    try {
      // Import common flags to check
      const commonKeys = [
        'pos.offline_mode',
        'pos.receipt_printing',
        'inventory.low_stock_alerts',
        'inventory.batch_tracking',
        'finance.advanced_reporting',
        'finance.multi_currency',
        'customers.loyalty_program',
        'workforce.biometric_attendance',
        'notifications.sms_alerts',
        'notifications.email_alerts',
        'automation.scheduler',
        'integrations.mpesa',
        'integrations.quickbooks',
        'integrations.kra_etims',
      ]

      const results = new Map<string, boolean>()
      for (const key of commonKeys) {
        results.set(key, await isFeatureEnabled(key, context))
      }
      setFlags(results)
    } catch (error) {
      console.error('[FeatureFlagProvider] Failed to load flags:', error)
    } finally {
      setLoading(false)
    }
  }, [context.branchId, context.role, context.userId])

  useEffect(() => {
    refreshFlags()
  }, [refreshFlags])

  const isEnabled = useCallback((key: string): boolean => {
    return flags.get(key) || false
  }, [flags])

  return (
    <FeatureFlagContext.Provider value={{ flags, isEnabled, refreshFlags, loading }}>
      {children}
    </FeatureFlagContext.Provider>
  )
}

// ─── Hook ───────────────────────────────────────────────────────────────────

/**
 * Hook to check if a feature flag is enabled.
 * 
 * Usage:
 * ```tsx
 * const { isEnabled } = useFeatureFlags()
 * if (isEnabled('pos.offline_mode')) {
 *   // Show offline UI
 * }
 * ```
 */
export function useFeatureFlags() {
  const context = useContext(FeatureFlagContext)
  if (!context) {
    throw new Error('useFeatureFlags must be used within a FeatureFlagProvider')
  }
  return context
}

/**
 * Hook to check a single feature flag (simpler API).
 * 
 * Usage:
 * ```tsx
 * const isOfflineModeEnabled = useFeatureFlag('pos.offline_mode')
 * ```
 */
export function useFeatureFlag(key: string): boolean {
  const { isEnabled, loading } = useFeatureFlags()
  
  if (loading) {
    return false // Fail closed while loading
  }
  
  return isEnabled(key)
}
