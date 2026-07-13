'use client'

import React, { useState } from 'react'
import { useDateRange, type PeriodPreset } from '@/contexts/date-range-context'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { CalendarIcon, ChevronDown } from 'lucide-react'
import { format } from 'date-fns'

const PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This Week' },
  { value: 'last_week', label: 'Last Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
]

export function PeriodSelector() {
  const { range, setPreset, setCustomRange, label } = useDateRange()
  const [open, setOpen] = useState(false)
  const [customOpen, setCustomOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 min-w-[140px] justify-start"
        >
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          <span>{label}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground ml-auto opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-2" align="start">
        <div className="flex flex-col gap-1">
          {PRESETS.map((preset) => (
            <Button
              key={preset.value}
              variant={range.preset === preset.value ? 'secondary' : 'ghost'}
              size="sm"
              className="justify-start font-normal"
              onClick={() => {
                setPreset(preset.value)
                setCustomOpen(false)
                setOpen(false)
              }}
            >
              {preset.label}
            </Button>
          ))}

          <div className="border-t my-1" />

          <Popover open={customOpen} onOpenChange={setCustomOpen}>
            <PopoverTrigger asChild>
              <Button
                variant={range.preset === 'custom' ? 'secondary' : 'ghost'}
                size="sm"
                className="justify-start font-normal"
              >
                <CalendarIcon className="h-4 w-4 mr-2" />
                Custom Range
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start" side="right">
              <Calendar
                mode="range"
                selected={{
                  from: range.from,
                  to: range.to,
                }}
                onSelect={(range) => {
                  if (range?.from && range?.to) {
                    setCustomRange(range.from, range.to)
                    setCustomOpen(false)
                    setOpen(false)
                  }
                }}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        </div>
      </PopoverContent>
    </Popover>
  )
}
