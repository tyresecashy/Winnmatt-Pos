export const NAIROBI_TIME_ZONE = 'Africa/Nairobi'

const NAIROBI_OFFSET_MS = 3 * 60 * 60 * 1000

export function getNairobiDayRange(referenceDate: Date = new Date()) {
  const shifted = new Date(referenceDate.getTime() + NAIROBI_OFFSET_MS)
  shifted.setUTCHours(0, 0, 0, 0)

  const start = new Date(shifted.getTime() - NAIROBI_OFFSET_MS)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)

  return { start, end }
}

export function getNairobiDateKey(date: Date | string) {
  return new Date(date).toLocaleDateString('en-CA', {
    timeZone: NAIROBI_TIME_ZONE,
  })
}

export function getNairobiWeekdayLabel(date: Date | string) {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'short',
    timeZone: NAIROBI_TIME_ZONE,
  })
}

/**
 * Format a date string in Kenyan locale
 * e.g., "15 Mar 2026"
 */
export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-KE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Africa/Nairobi',
  })
}

/**
 * Format a date string as time in Kenyan locale
 * e.g., "14:30"
 */
export const formatTime = (dateString: string): string => {
  return new Date(dateString).toLocaleTimeString('en-KE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Nairobi',
  })
}
