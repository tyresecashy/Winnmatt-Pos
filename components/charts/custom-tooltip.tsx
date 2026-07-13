import { formatKSh } from '@/lib/currency'

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ name?: string; value?: number; color?: string; dataKey?: string }>
  label?: string
  /** If true, format values as currency (default). If false, format as plain number. */
  currency?: boolean
  /** Suffix to append after numeric values (e.g. "d", "x", "%") */
  suffix?: string
  /** Label formatter override */
  formatLabel?: (label: string) => string
}

export function CustomTooltip({ active, payload, label, currency = true, suffix, formatLabel }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  const fmt = (n: number) => {
    if (currency) return formatKSh(n)
    if (suffix) return `${new Intl.NumberFormat('en-KE').format(n)}${suffix}`
    return new Intl.NumberFormat('en-KE').format(n)
  }

  return (
    <div className="rounded-lg border bg-background/95 backdrop-blur-sm shadow-lg px-3 py-2 text-sm">
      {label && (
        <p className="font-medium text-foreground mb-1 border-b pb-1">
          {formatLabel ? formatLabel(label) : label}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              {entry.color && (
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: entry.color }}
                />
              )}
              <span className="text-muted-foreground">{entry.name || entry.dataKey}</span>
            </div>
            <span className="font-medium tabular-nums">
              {entry.value !== undefined && entry.value !== null
                ? fmt(entry.value)
                : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
