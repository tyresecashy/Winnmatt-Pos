'use client'

import { useEffect, useRef } from 'react'

const HEARTBEAT_INTERVAL_MS = 30000

export function useDeviceHeartbeat(deviceId: string | null) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!deviceId) return

    const sendHeartbeat = async () => {
      try {
        await fetch('/api/devices/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId }),
        })
      } catch {
        // Silently fail — network blips are expected
      }
    }

    sendHeartbeat()
    intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [deviceId])
}
