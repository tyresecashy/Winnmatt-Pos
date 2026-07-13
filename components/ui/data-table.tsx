'use client'

import React, { useState, useMemo, useCallback, useEffect, startTransition } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
  Download,
  RotateCcw,
  LucideIcon,
  Inbox,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────

export interface Column<T> {
  /** Unique key */
  key: string
  /** Header display text */
  header: string
  /** Render function for cell content */
  cell: (item: T) => React.ReactNode
  /** Optional sort function (provide to make column sortable) */
  sortFn?: (a: T, b: T, dir: 'asc' | 'desc') => number
  /** Optional searchable content for global filter */
  searchValue?: (item: T) => string
  /** Hide on small screens */
  hideOnMobile?: boolean
  /** Column className */
  className?: string
  /** Header className */
  headerClassName?: string
}

export interface DataTableAction<T> {
  label: string
  onClick: (items: T[]) => void
  icon?: LucideIcon
  variant?: 'default' | 'outline' | 'destructive' | 'secondary'
  /** Require selection to enable */
  requireSelection?: boolean
}

export interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  /** Unique key extractor */
  keyExtractor: (item: T) => string | number
  /** Loading state */
  loading?: boolean
  /** Error state */
  error?: string | null
  /** Empty state config (when no data and not loading) */
  empty?: {
    title?: string
    description?: string
    icon?: LucideIcon
    action?: {
      label: string
      onClick: () => void
    }
  }
  /** Enable global search filter */
  searchable?: boolean
  /** Search placeholder */
  searchPlaceholder?: string
  /** Enable pagination */
  paginated?: boolean
  /** Page size */
  pageSize?: number
  /** Enable row selection */
  selectable?: boolean
  /** Actions toolbar */
  actions?: DataTableAction<T>[]
  /** Refresh handler */
  onRefresh?: () => void
  /** Export handler (CSV) */
  onExport?: (items: T[]) => void
  /** Row click handler */
  onRowClick?: (item: T) => void
  /** Row className */
  rowClassName?: string | ((item: T) => string | undefined)
  /** Additional className */
  className?: string
}

// ─── Sort State ──────────────────────────────────────────────────

type SortDir = 'asc' | 'desc' | null

interface SortState {
  key: string
  dir: SortDir
}

// ─── Component ───────────────────────────────────────────────────

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  loading = false,
  error = null,
  empty,
  searchable = false,
  searchPlaceholder = 'Search...',
  paginated = false,
  pageSize = 10,
  selectable = false,
  actions,
  onRefresh,
  onExport,
  onRowClick,
  rowClassName,
  className,
}: DataTableProps<T>) {
  // ── State ──────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('')
  const [sort, setSort] = useState<SortState | null>(null)
  const [page, setPage] = useState(0)
  const [selectedKeys, setSelectedKeys] = useState<Set<string | number>>(new Set())

  // ── Sorting toggle ─────────────────────────────────────────
  const handleSort = useCallback((key: string) => {
    setSort((prev) => {
      if (prev?.key !== key) return { key, dir: 'asc' }
      if (prev.dir === 'asc') return { key, dir: 'desc' }
      return null
    })
    setPage(0)
  }, [])

  // ── Filtered & sorted data ─────────────────────────────────
  const processed = useMemo(() => {
    let items = [...data]

    // Global search filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      items = items.filter((item) =>
        columns.some((col) => {
          if (!col.searchValue) return false
          return col.searchValue(item).toLowerCase().includes(q)
        })
      )
    }

    // Sorting
    if (sort) {
      const col = columns.find((c) => c.key === sort.key)
      if (col?.sortFn) {
        items.sort((a, b) => col.sortFn!(a, b, sort.dir!))
      }
    }

    return items
  }, [data, searchQuery, sort, columns])

  // ── Pagination ─────────────────────────────────────────────
  const totalPages = paginated ? Math.max(1, Math.ceil(processed.length / pageSize)) : 1
  const safePage = Math.min(page, totalPages - 1)
  const pageItems = paginated
    ? processed.slice(safePage * pageSize, (safePage + 1) * pageSize)
    : processed

  // ── Selection ──────────────────────────────────────────────
  const toggleSelect = useCallback((key: string | number) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    setSelectedKeys((prev) => {
      const currentKeys = new Set(pageItems.map(keyExtractor))
      const allSelected = currentKeys.size > 0 && currentKeys.isSubsetOf(prev)
      if (allSelected) {
        const next = new Set(prev)
        currentKeys.forEach((k) => next.delete(k))
        return next
      } else {
        const next = new Set(prev)
        currentKeys.forEach((k) => next.add(k))
        return next
      }
    })
  }, [pageItems, keyExtractor])

  const selectedItems = useMemo(
    () => data.filter((item) => selectedKeys.has(keyExtractor(item))),
    [data, selectedKeys, keyExtractor]
  )

  // ── Reset page when data/search changes ────────────────────
  useEffect(() => { startTransition(() => { setPage(0) }) }, [searchQuery, sort])

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className={cn('space-y-4', className)}>
      {/* Toolbar */}
      {(searchable || actions?.length || onRefresh || onExport) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Search */}
          {searchable && (
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(0) }}
                className="pl-9"
              />
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {selectedItems.length > 0 && (
              <span className="text-sm text-muted-foreground mr-2">
                {selectedItems.length} selected
              </span>
            )}

            {actions?.map((action, i) => {
              const disabled = action.requireSelection && selectedItems.length === 0
              return (
                <Button
                  key={i}
                  variant={action.variant || 'outline'}
                  size="sm"
                  disabled={disabled}
                  onClick={() => action.onClick(selectedItems)}
                >
                  {action.icon && <action.icon className="mr-2 h-4 w-4" />}
                  {action.label}
                </Button>
              )
            })}

            {onExport && processed.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => onExport(processed)}>
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            )}

            {onRefresh && (
              <Button variant="ghost" size="sm" onClick={onRefresh}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <EmptyState
          icon={Inbox}
          title="Failed to load data"
          description={error}
          actions={onRefresh ? [{ label: 'Retry', onClick: onRefresh, variant: 'outline', icon: RotateCcw }] : undefined}
        />
      )}

      {/* Empty state (no data, no loading, no error) */}
      {!loading && !error && processed.length === 0 && !searchQuery && (
        <EmptyState
          icon={empty?.icon || Inbox}
          title={empty?.title || 'No data'}
          description={empty?.description}
          actions={
            empty?.action
              ? [{ label: empty.action.label, onClick: empty.action.onClick }]
              : undefined
          }
        />
      )}

      {/* Empty search results */}
      {!loading && !error && processed.length === 0 && searchQuery && (
        <EmptyState
          icon={Search}
          title="No results found"
          description={`No results match "${searchQuery}". Try a different search term.`}
          compact
        />
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3 rounded-lg border">
          <div className="border-b p-4">
            <Skeleton className="h-8 w-full" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-4 py-3">
              <Skeleton className="h-6 w-full" />
            </div>
          ))}
        </div>
      )}

      {/* Data table */}
      {!loading && processed.length > 0 && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                {selectable && (
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border"
                      checked={pageItems.length > 0 && pageItems.every((item) => selectedKeys.has(keyExtractor(item)))}
                      onChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                )}
                {columns.map((col) => {
                  const isSorted = sort?.key === col.key
                  const SortIcon = isSorted
                    ? sort?.dir === 'asc'
                      ? ChevronUp
                      : ChevronDown
                    : col.sortFn
                      ? ChevronsUpDown
                      : null

                  return (
                    <TableHead
                      key={col.key}
                      className={cn(
                        col.hideOnMobile && 'hidden md:table-cell',
                        col.sortFn && 'cursor-pointer select-none hover:text-foreground',
                        col.headerClassName
                      )}
                      onClick={() => col.sortFn && handleSort(col.key)}
                    >
                      <div className="flex items-center gap-1">
                        {col.header}
                        {SortIcon && (
                          <SortIcon className={cn('h-4 w-4', isSorted ? 'text-foreground' : 'text-muted-foreground')} />
                        )}
                      </div>
                    </TableHead>
                  )
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.map((item) => {
                const key = keyExtractor(item)
                const isSelected = selectedKeys.has(key)
                const customRowClass = typeof rowClassName === 'function' ? rowClassName(item) : rowClassName

                return (
                  <TableRow
                    key={key}
                    className={cn(
                      isSelected && 'bg-muted/50',
                      onRowClick && 'cursor-pointer',
                      customRowClass
                    )}
                    onClick={() => onRowClick?.(item)}
                    data-state={isSelected ? 'selected' : undefined}
                  >
                    {selectable && (
                      <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border"
                          checked={isSelected}
                          onChange={() => toggleSelect(key)}
                          aria-label={`Select row ${key}`}
                        />
                      </TableCell>
                    )}
                    {columns.map((col) => (
                      <TableCell
                        key={col.key}
                        className={cn(col.hideOnMobile && 'hidden md:table-cell', col.className)}
                      >
                        {col.cell(item)}
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {paginated && processed.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {safePage * pageSize + 1}–{Math.min((safePage + 1) * pageSize, processed.length)} of{' '}
            {processed.length}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={safePage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
              const pageNum = Math.max(0, Math.min(safePage - 2, totalPages - 5)) + i
              if (pageNum >= totalPages) return null
              return (
                <Button
                  key={pageNum}
                  variant={pageNum === safePage ? 'default' : 'outline'}
                  size="sm"
                  className="min-w-[2rem]"
                  onClick={() => setPage(pageNum)}
                >
                  {pageNum + 1}
                </Button>
              )
            })}
            <Button
              variant="outline"
              size="sm"
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
