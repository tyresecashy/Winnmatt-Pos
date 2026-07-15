'use client'

import { useState, useEffect, useCallback, useRef, startTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command'
import { globalSearch, type SearchResult } from '@/lib/modules/system'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  UserCheck,
  Truck,
  BarChart3,
  Warehouse,
  Plus,
  Search,
  Clock,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

// ─── Quick Actions ───────────────────────────────────────────────────────────

interface QuickAction {
  id: string
  label: string
  icon: typeof LayoutDashboard
  shortcut: string
  href: string
}

const quickActions: QuickAction[] = [
  { id: 'pos', label: 'Go to POS', icon: ShoppingCart, shortcut: '⌘P', href: '/pos' },
  { id: 'dashboard', label: 'View Dashboard', icon: LayoutDashboard, shortcut: '⌘D', href: '/dashboard' },
  { id: 'reports', label: 'View Reports', icon: BarChart3, shortcut: '⌘R', href: '/analytics/reports' },
  { id: 'inventory', label: 'View Inventory', icon: Warehouse, shortcut: '⌘I', href: '/inventory' },
  { id: 'new-product', label: 'New Product', icon: Plus, shortcut: '⌘⇧P', href: '/products/new' },
  { id: 'new-customer', label: 'New Customer', icon: Plus, shortcut: '⌘⇧C', href: '/customers/new' },
]

// ─── Recent Searches (localStorage) ──────────────────────────────────────────

const RECENT_SEARCHES_KEY = 'winnmatt_recent_searches'
const MAX_RECENT = 5

function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function addRecentSearch(query: string) {
  if (typeof window === 'undefined') return
  try {
    const recent = getRecentSearches().filter((r) => r !== query)
    recent.unshift(query)
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)))
  } catch {
    // Ignore localStorage errors
  }
}

// ─── Entity helpers ──────────────────────────────────────────────────────────

const entityConfig: Record<string, { icon: typeof Package; color: string }> = {
  product: { icon: Package, color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400' },
  customer: { icon: Users, color: 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400' },
  employee: { icon: UserCheck, color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400' },
  supplier: { icon: Truck, color: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400' },
}

function getEntityRoute(result: SearchResult): string {
  switch (result.entity_type) {
    case 'product': return `/inventory?highlight=${result.entity_id}`
    case 'customer': return `/customers?highlight=${result.entity_id}`
    case 'employee': return `/employees?highlight=${result.entity_id}`
    case 'supplier': return `/suppliers?highlight=${result.entity_id}`
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [recentSearches, setRecentSearches] = useState<string[]>(() => getRecentSearches())
  const [loading, setLoading] = useState(false)
  const pendingRef = useRef(0)

  // Reset on open
  useEffect(() => {
    startTransition(() => {
      if (open) {
        setQuery('')
        setResults([])
        setRecentSearches(getRecentSearches())
      }
    })
  }, [open])

  // Debounced search
  useEffect(() => {
    const id = ++pendingRef.current

    const timer = setTimeout(async () => {
      if (!query || query.trim().length < 2) {
        setResults([])
        return
      }

      setLoading(true)
      try {
        const response = await globalSearch(query, { limit: 20 } as Record<string, unknown>)
        // Only apply if this request is still current
        if (id === pendingRef.current && Array.isArray(response)) {
          setResults(response)
        }
      } catch {
        // Silently fail — cmdk will show empty state
      } finally {
        if (id === pendingRef.current) {
          setLoading(false)
        }
      }
    }, 200)

    return () => clearTimeout(timer)
  }, [query])

  const handleSelect = useCallback(
    (value: string) => {
      onClose()

      // Quick actions
      const action = quickActions.find((a) => a.id === value)
      if (action) {
        router.push(action.href)
        return
      }

      // Recent search — set query to trigger search
      if (value.startsWith('recent:')) {
        const term = value.slice(7)
        setQuery(term)
        return
      }

      // Search result — navigate
      const result = results.find(
        (r) => `${r.entity_type}:${r.entity_id}` === value
      )
      if (result) {
        addRecentSearch(query)
        router.push(getEntityRoute(result))
      }
    },
    [onClose, router, results, query]
  )

  // Group results by entity type
  const groupedResults = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.entity_type]) acc[r.entity_type] = []
    acc[r.entity_type].push(r)
    return acc
  }, {})

  const showSearchResults = query.trim().length >= 2
  const showRecent = query.trim().length < 2 && recentSearches.length > 0

  return (
    <CommandDialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <CommandInput
        placeholder="Search products, customers, employees, suppliers..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full mr-2" />
            Searching...
          </div>
        )}

        {/* Empty state */}
        {!loading && showSearchResults && results.length === 0 && (
          <CommandEmpty>
            <div className="py-4">
              <Search className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              <EmptyState title="No results found" compact />
              <p className="text-sm text-muted-foreground mt-1">
                Try different keywords for &ldquo;{query}&rdquo;
              </p>
            </div>
          </CommandEmpty>
        )}

        {/* Recent Searches */}
        {showRecent && (
          <CommandGroup heading="Recent Searches">
            {recentSearches.map((term) => (
              <CommandItem
                key={`recent:${term}`}
                value={`recent:${term}`}
                onSelect={handleSelect}
              >
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{term}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Quick Actions (always visible when not searching) */}
        {!showSearchResults && (
          <CommandGroup heading="Quick Actions">
            {quickActions.map((action) => (
              <CommandItem
                key={action.id}
                value={action.id}
                onSelect={handleSelect}
              >
                <action.icon className="h-4 w-4" />
                <span>{action.label}</span>
                <CommandShortcut>{action.shortcut}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Search results by entity group */}
        {showSearchResults &&
          Object.entries(groupedResults).map(([type, items]) => {
            const config = entityConfig[type] || entityConfig.product
            const Icon = config.icon
            return (
              <CommandGroup key={type} heading={`${type.charAt(0).toUpperCase() + type.slice(1)}s (${items.length})`}>
                {items.map((result) => (
                  <CommandItem
                    key={`${result.entity_type}:${result.entity_id}`}
                    value={`${result.entity_type}:${result.entity_id}`}
                    onSelect={handleSelect}
                  >
                    <div className={`p-1 rounded ${config.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="truncate">{result.title}</span>
                      {result.subtitle && (
                        <span className="ml-2 text-xs text-muted-foreground truncate">
                          {result.subtitle}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )
          })}

        {/* Initial state — show hint */}
        {!showSearchResults && !showRecent && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <Search className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="font-medium">Start typing to search</p>
            <p className="text-xs mt-1">Search across products, customers, employees, and suppliers</p>
          </div>
        )}
      </CommandList>
    </CommandDialog>
  )
}
