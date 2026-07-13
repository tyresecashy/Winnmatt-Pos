'use client'

import { useEffect } from 'react'

interface PaymentKeybinds {
  onCash: () => void
  onMpesa: () => void
  onCard: () => void
  onPay: () => void
  onCancel: () => void
  enabled?: boolean
}

/**
 * Adds keyboard shortcuts for the payment panel:
 * - F2  → Cash
 * - F3  → M-Pesa
 * - F4  → Card
 * - Enter → Pay
 * - Esc → Cancel
 */
export function usePaymentKeys({ onCash, onMpesa, onCard, onPay, onCancel, enabled = true }: PaymentKeybinds) {
  useEffect(() => {
    if (!enabled) return

    function handleKeyDown(e: KeyboardEvent) {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        if (e.key === 'Escape') {
          onCancel()
        }
        return
      }

      switch (e.key) {
        case 'F2':
          e.preventDefault()
          onCash()
          break
        case 'F3':
          e.preventDefault()
          onMpesa()
          break
        case 'F4':
          e.preventDefault()
          onCard()
          break
        case 'Enter':
          e.preventDefault()
          onPay()
          break
        case 'Escape':
          e.preventDefault()
          onCancel()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCash, onMpesa, onCard, onPay, onCancel, enabled])
}
