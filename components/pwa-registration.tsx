'use client'

import { useEffect, useState } from 'react'
import { useToast } from '@/hooks/use-toast'

/**
 * PWA Registration Component
 * 
 * Registers the service worker and handles PWA lifecycle events.
 */
export function PWARegistration() {
  const { toast } = useToast()
  const [isOnline, setIsOnline] = useState(true)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[PWA] Service worker registered:', reg.scope)
          setRegistration(reg)

          // Check for updates
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  setUpdateAvailable(true)
                  toast({
                    title: 'Update Available',
                    description: 'A new version of WinnMatt POS is available.',
                    duration: 10000,
                  })
                }
              })
            }
          })
        })
        .catch((error) => {
          console.error('[PWA] Service worker registration failed:', error)
        })

      // Handle controller change (new service worker activated)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[PWA] New service worker activated')
        window.location.reload()
      })
    }

    // Handle online/offline status
    const handleOnline = () => {
      setIsOnline(true)
      toast({
        title: 'Back Online',
        description: 'Your connection has been restored.',
        duration: 3000,
      })
      // Trigger sync of pending sales
      syncPendingSales()
    }

    const handleOffline = () => {
      setIsOnline(false)
      toast({
        title: 'Offline Mode',
        description: 'You are now offline. Sales will be queued for sync.',
        duration: 5000,
      })
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Set initial state
    setIsOnline(navigator.onLine)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Handle messages from service worker
  useEffect(() => {
    if (!navigator.serviceWorker) return

    const handleMessage = (event: MessageEvent) => {
      const { type, data } = event.data

      switch (type) {
        case 'OFFLINE_QUEUED':
          console.log('[PWA] Request queued for sync:', data)
          break
        case 'SYNC_COMPLETE':
          console.log('[PWA] Sync complete')
          toast({
            title: 'Sync Complete',
            description: 'Offline sales have been synced.',
            duration: 3000,
          })
          break
        case 'NOTIFICATION_CLICK':
          // Handle notification click
          if (data.url) {
            window.location.href = data.url
          }
          break
      }
    }

    navigator.serviceWorker.addEventListener('message', handleMessage)
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage)
    }
  }, [])

  async function syncPendingSales() {
    if (!registration) return

    try {
      // Get pending sales from IndexedDB
      const { getPendingSales, updatePendingSaleStatus } = await import('@/lib/offline-storage')
      const pending = await getPendingSales()

      for (const sale of pending) {
        if (sale.status === 'pending') {
          try {
            // Attempt to sync via server action
            const response = await fetch('/api/sync/pending-sale', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(sale),
            })

            if (response.ok) {
              await updatePendingSaleStatus(sale.id, 'synced')
            } else {
              await updatePendingSaleStatus(sale.id, 'failed', 'Sync failed')
            }
          } catch (error) {
            await updatePendingSaleStatus(
              sale.id,
              'failed',
              error instanceof Error ? error.message : 'Unknown error'
            )
          }
        }
      }
    } catch (error) {
      console.error('[PWA] Sync failed:', error)
    }
  }

  async function handleUpdate() {
    if (!registration?.waiting) return

    // Tell the waiting service worker to skip waiting
    registration.waiting.postMessage({ type: 'SKIP_WAITING' })
    setUpdateAvailable(false)
  }

  // Don't render anything visible
  return null
}
