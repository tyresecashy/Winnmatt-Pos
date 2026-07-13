'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

export type DashboardQueryResult<T> = {
  data: T
  loading: boolean
  error: string | null
  retry: () => void
  refreshKey: number
}

type DashboardFetcher<T> = () => Promise<T>

interface UseDashboardQueryOptions {
  /** Polling interval in ms (default: 60000, set to 0 to disable) */
  pollIntervalMs?: number
  /** Minimum interval between forced refetches (default: 30000) */
  minIntervalMs?: number
  /** Show loading state on initial fetch only (default: true) */
  showInitialLoading?: boolean
  /** Dependencies that trigger a refetch */
  deps?: unknown[]
}

/**
 * A generic hook that eliminates the ~50 lines of boilerplate
 * copied into every dashboard component.
 *
 * Features:
 * - Auto-fetches on mount
 * - Optional polling with dedup guards
 * - Window focus refetch
 * - Loading, error, and retry states
 * - Cancellation-safe
 */
export function useDashboardQuery<T>(
  fetcher: DashboardFetcher<T>,
  fallbackData: T,
  options: UseDashboardQueryOptions = {}
): DashboardQueryResult<T> {
  const {
    pollIntervalMs = 60000,
    minIntervalMs = 30000,
    showInitialLoading = true,
    deps = [],
  } = options

  const [data, setData] = useState<T>(fallbackData)
  const [loading, setLoading] = useState(showInitialLoading)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const fetchPromiseRef = useRef<Promise<void> | null>(null)
  const lastFetchAtRef = useRef(0)
  const hasLoadedRef = useRef(false)
  const mountedRef = useRef(true)

  const load = useCallback(async (options?: { force?: boolean; minIntervalMs?: number }) => {
    const shouldShowLoading = showInitialLoading && !hasLoadedRef.current
    if (shouldShowLoading) {
      setLoading(true)
    }

    const now = Date.now()
    if (!options?.force && fetchPromiseRef.current) {
      return fetchPromiseRef.current
    }

    if (!options?.force && now - lastFetchAtRef.current < (options?.minIntervalMs ?? 0)) {
      return
    }

    const fetchPromise = (async () => {
      try {
        const result = await fetcher()
        if (mountedRef.current) {
          setData(result)
          setError(null)
          hasLoadedRef.current = true
          lastFetchAtRef.current = Date.now()
        }
      } catch (err) {
        if (mountedRef.current) {
          const message = err instanceof Error ? err.message : 'An unexpected error occurred'
          setError(message)
        }
      } finally {
        if (mountedRef.current && shouldShowLoading) {
          setLoading(false)
        }
      }
    })()

    fetchPromiseRef.current = fetchPromise
    try {
      await fetchPromise
    } finally {
      if (fetchPromiseRef.current === fetchPromise) {
        fetchPromiseRef.current = null
      }
    }
  }, [fetcher, showInitialLoading])

  const retry = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  // Fetch on mount and when deps/retryKey change
  useEffect(() => {
    mountedRef.current = true
    void load({ force: true })

    return () => {
      mountedRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, ...deps])

  // Polling
  useEffect(() => {
    if (pollIntervalMs <= 0) return

    const intervalId = window.setInterval(() => {
      void load({ minIntervalMs })
    }, pollIntervalMs)

    const handleFocus = () => {
      void load({ minIntervalMs: Math.min(minIntervalMs, 15000) })
    }

    window.addEventListener('focus', handleFocus)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', handleFocus)
    }
  }, [pollIntervalMs, minIntervalMs, load])

  return { data, loading, error, retry, refreshKey }
}
