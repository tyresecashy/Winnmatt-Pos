'use client'

import { useEffect, useState } from 'react'
import { getMergedReceiptSettings } from '@/lib/receipt-settings'
import type { MergedReceiptSettings } from '@/lib/receipt-settings'

/**
 * React hook to fetch and cache merged receipt settings
 * (global business settings + branch overrides)
 *
 * @param branchId - Optional branch ID. If provided, includes branch overrides.
 * @returns { settings, loading, error }
 *
 * Usage in components:
 * const { settings, loading } = useReceiptSettings(branchId)
 * if (loading) return <div>Loading...</div>
 * if (!settings) return <div>Error loading settings</div>
 * return <div>{settings.business_name}</div>
 */
export function useReceiptSettings(branchId?: string) {
  const [settings, setSettings] = useState<MergedReceiptSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false

    const fetchSettings = async () => {
      try {
        setLoading(true)
        setError(null)
        const merged = await getMergedReceiptSettings(branchId)

        if (!cancelled) {
          setSettings(merged)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Failed to fetch receipt settings'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchSettings()

    return () => {
      cancelled = true
    }
  }, [branchId])

  return { settings, loading, error }
}
