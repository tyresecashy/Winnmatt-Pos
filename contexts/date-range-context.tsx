'use client'

import React, { createContext, useContext, useState, useMemo, useCallback } from 'react'
import { startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths } from 'date-fns'

export type PeriodPreset = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'custom'

export interface DateRange {
  from: Date
  to: Date
  preset: PeriodPreset
}

interface DateRangeContextType {
  range: DateRange
  setPreset: (preset: PeriodPreset) => void
  setCustomRange: (from: Date, to: Date) => void
  label: string
}

const DateRangeContext = createContext<DateRangeContextType | null>(null)

function getDefaultRange(): DateRange {
  const now = new Date()
  return {
    from: startOfDay(now),
    to: endOfDay(now),
    preset: 'today',
  }
}

function getRangeForPreset(preset: PeriodPreset): Omit<DateRange, 'preset'> {
  const now = new Date()
  switch (preset) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) }
    case 'yesterday':
      const yesterday = subDays(now, 1)
      return { from: startOfDay(yesterday), to: endOfDay(yesterday) }
    case 'this_week':
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) }
    case 'last_week':
      const lastWeek = subDays(startOfWeek(now, { weekStartsOn: 1 }), 1)
      return { from: startOfWeek(lastWeek, { weekStartsOn: 1 }), to: endOfWeek(lastWeek, { weekStartsOn: 1 }) }
    case 'this_month':
      return { from: startOfMonth(now), to: endOfMonth(now) }
    case 'last_month':
      const lastMonth = subMonths(now, 1)
      return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) }
    default:
      return { from: startOfDay(now), to: endOfDay(now) }
  }
}

const PRESET_LABELS: Record<PeriodPreset, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  this_week: 'This Week',
  last_week: 'Last Week',
  this_month: 'This Month',
  last_month: 'Last Month',
  custom: 'Custom',
}

export function DateRangeProvider({ children }: { children: React.ReactNode }) {
  const [range, setRange] = useState<DateRange>(getDefaultRange)

  const setPreset = useCallback((preset: PeriodPreset) => {
    const { from, to } = getRangeForPreset(preset)
    setRange({ from, to, preset })
  }, [])

  const setCustomRange = useCallback((from: Date, to: Date) => {
    setRange({ from: startOfDay(from), to: endOfDay(to), preset: 'custom' })
  }, [])

  const label = useMemo(() => {
    if (range.preset === 'custom') {
      return `${range.from.toLocaleDateString()} – ${range.to.toLocaleDateString()}`
    }
    return PRESET_LABELS[range.preset]
  }, [range])

  return (
    <DateRangeContext.Provider value={{ range, setPreset, setCustomRange, label }}>
      {children}
    </DateRangeContext.Provider>
  )
}

export function useDateRange(): DateRangeContextType {
  const ctx = useContext(DateRangeContext)
  if (!ctx) throw new Error('useDateRange must be used within a DateRangeProvider')
  return ctx
}
