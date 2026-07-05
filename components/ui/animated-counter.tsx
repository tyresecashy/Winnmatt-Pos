'use client'

import { useEffect, useRef, useState } from 'react'

interface AnimatedCounterProps {
  /** Target value to animate to */
  value: number
  /** Duration in ms (default: 600) */
  duration?: number
  /** Optional CSS class */
  className?: string
  /** Formatter function (default: identity) */
  format?: (value: number) => string
  /** Prefix text */
  prefix?: string
  /** Suffix text */
  suffix?: string
  /** Auto-start animation (default: true). If false, use start() via ref's imperative handle */
  autoStart?: boolean
  /** Delay before starting (ms) */
  delay?: number
}

export function AnimatedCounter({
  value,
  duration = 600,
  className = '',
  format,
  prefix = '',
  suffix = '',
  autoStart = true,
  delay = 0,
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(autoStart ? 0 : value)
  const [isAnimating, setIsAnimating] = useState(false)
  const prevValueRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)

  const formatValue = format ?? ((v: number) => v.toLocaleString())

  useEffect(() => {
    if (!autoStart) return

    const startValue = prevValueRef.current
    const endValue = value
    if (startValue === endValue) {
      setDisplayValue(endValue)
      return
    }

    // Delay start if specified
    const delayTimeout = setTimeout(() => {
      setIsAnimating(true)
      startTimeRef.current = null

      const animate = (timestamp: number) => {
        if (startTimeRef.current === null) {
          startTimeRef.current = timestamp
        }

        const elapsed = timestamp - startTimeRef.current
        const progress = Math.min(elapsed / duration, 1)
        // ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3)
        const current = Math.round(startValue + (endValue - startValue) * eased)

        setDisplayValue(current)

        if (progress < 1) {
          rafRef.current = requestAnimationFrame(animate)
        } else {
          setDisplayValue(endValue)
          setIsAnimating(false)
          prevValueRef.current = endValue
        }
      }

      rafRef.current = requestAnimationFrame(animate)
    }, delay)

    return () => {
      clearTimeout(delayTimeout)
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [value, duration, autoStart, delay])

  return (
    <span className={className} data-animating={isAnimating ? 'true' : undefined}>
      {prefix}{formatValue(displayValue)}{suffix}
    </span>
  )
}
