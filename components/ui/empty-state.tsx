'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { LucideIcon } from 'lucide-react'

export interface EmptyStateAction {
  label: string
  onClick?: () => void
  href?: string
  variant?: 'default' | 'outline' | 'secondary'
  icon?: LucideIcon
}

export interface EmptyStateProps {
  /** Icon component (Lucide icon) */
  icon?: LucideIcon
  /** Custom illustration/emoji */
  graphic?: React.ReactNode
  /** Main title */
  title: string
  /** Supporting description */
  description?: string
  /** Call-to-action buttons */
  actions?: EmptyStateAction[]
  /** Additional className */
  className?: string
  /** Compact variant for inline use */
  compact?: boolean
}

/**
 * Reusable empty state component for consistent empty/error/no-results
 * display across all pages. Uses the brand design system.
 */
export function EmptyState({
  icon: Icon,
  graphic,
  title,
  description,
  actions,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-8' : 'py-16',
        className
      )}
    >
      {/* Graphic or Icon */}
      <div className="mb-4">
        {graphic ? (
          <div className="flex items-center justify-center">{graphic}</div>
        ) : Icon ? (
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50 ring-1 ring-border">
            <Icon className="h-7 w-7 text-muted-foreground/60" />
          </div>
        ) : null}
      </div>

      {/* Title */}
      <h3
        className={cn(
          'font-semibold tracking-tight text-foreground',
          compact ? 'text-base' : 'text-lg'
        )}
      >
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p
          className={cn(
            'mt-1 text-muted-foreground max-w-sm',
            compact ? 'text-sm' : 'text-sm/relaxed'
          )}
        >
          {description}
        </p>
      )}

      {/* Actions */}
      {actions && actions.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {actions.map((action, index) => (
            <Button
              key={index}
              variant={action.variant || 'default'}
              size={compact ? 'sm' : 'default'}
              onClick={action.onClick}
              asChild={!!action.href}
            >
              {action.href ? (
                <a href={action.href}>
                  {action.icon && <action.icon className="mr-2 h-4 w-4" />}
                  {action.label}
                </a>
              ) : (
                <>
                  {action.icon && <action.icon className="mr-2 h-4 w-4" />}
                  {action.label}
                </>
              )}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
