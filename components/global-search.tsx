'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, Package, Users, Truck, UserCheck, Clock, Star } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { globalSearch, type SearchResult } from '@/lib/modules/system'
import { formatKSh } from '@/lib/currency'

// ─── Recent Searches (localStorage) ─────────────────────────────────────────

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
    const recent = getRecentSearches().filter(r => r !== query)
    recent.unshift(query)
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)))
  } catch {
    // Ignore localStorage errors
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

interface GlobalSearchProps {
  open: boolean
  onClose: () => void
}

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [recentSearches, setRecentSearches] = useState<string[]>(() => getRecentSearches())
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)

  // recentSearches initialized via useState lazy initializer above

  // Focus input when opened
  useEffect(() => {
    if (open) {
      const id = setTimeout(() => {
        inputRef.current?.focus()
        setQuery('')
        setResults([])
        setSelectedIndex(0)
      }, 100)
      return () => clearTimeout(id)
    }
  }, [open])

  // Search when query changes
  useEffect(() => {
    const debounceTimer = setTimeout(async () => {
      if (!query || query.trim().length < 2) {
        setResults([])
        return
      }
      setLoading(true)
      try {
        const response = await globalSearch(query, { limit: 20 } as any)
        if (Array.isArray(response)) {
          setResults(response as any)
          setSelectedIndex(0)
        }
      } catch (error) {
        console.error('Search error:', error)
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(debounceTimer)
  }, [query])

  const handleResultClick = useCallback((result: SearchResult) => {
    addRecentSearch(query)
    onClose()

    // Navigate based on entity type
    switch (result.entity_type) {
      case 'product':
        router.push(`/inventory?highlight=${result.entity_id}`)
        break
      case 'customer':
        router.push(`/customers?highlight=${result.entity_id}`)
        break
      case 'employee':
        router.push(`/employees?highlight=${result.entity_id}`)
        break
      case 'supplier':
        router.push(`/suppliers?highlight=${result.entity_id}`)
        break
    }
  }, [query, onClose, router]) // addRecentSearch removed — it's stable, not a hook dep

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const totalItems = query.trim().length >= 2 ? results.length : recentSearches.length

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => (prev + 1) % totalItems)
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => (prev - 1 + totalItems) % totalItems)
        break
      case 'Enter':
        e.preventDefault()
        if (query.trim().length >= 2 && results.length > 0) {
          handleResultClick(results[selectedIndex])
        } else if (recentSearches.length > 0) {
          setQuery(recentSearches[selectedIndex])
        }
        break
      case 'Escape':
        onClose()
        break
    }
  }, [query, results, recentSearches, selectedIndex, onClose, handleResultClick])

  function handleRecentClick(recent: string) {
    setQuery(recent)
  }

  function getEntityIcon(type: string) {
    switch (type) {
      case 'product': return <Package className="h-4 w-4" />
      case 'customer': return <Users className="h-4 w-4" />
      case 'employee': return <UserCheck className="h-4 w-4" />
      case 'supplier': return <Truck className="h-4 w-4" />
      default: return <Search className="h-4 w-4" />
    }
  }

  function getEntityColor(type: string) {
    switch (type) {
      case 'product': return 'bg-blue-100 text-blue-800'
      case 'customer': return 'bg-green-100 text-green-800'
      case 'employee': return 'bg-purple-100 text-purple-800'
      case 'supplier': return 'bg-orange-100 text-orange-800'
      default: return 'bg-accent text-foreground'
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-[10vh]">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-2xl mx-4 overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center border-b px-4">
          <Search className="h-5 w-5 text-muted-foreground mr-3" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search products, customers, employees, suppliers..."
            className="border-0 focus:ring-0 h-14 text-lg"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 hover:bg-accent rounded"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {loading && (
            <div className="p-4 text-center text-muted-foreground">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
              Searching...
            </div>
          )}

          {!loading && query.trim().length >= 2 && results.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <EmptyState title={`No results found for "${query}"`} compact />
              <p className="text-sm mt-1">Try different keywords</p>
            </div>
          )}

          {!loading && query.trim().length < 2 && recentSearches.length > 0 && (
            <div className="p-2">
              <div className="px-3 py-2 text-xs font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-3 w-3" />
                Recent Searches
              </div>
              {recentSearches.map((recent, index) => (
                <button
                  key={recent}
                  onClick={() => handleRecentClick(recent)}
                  className={`w-full px-3 py-2 text-left rounded-md flex items-center gap-3 hover:bg-accent ${
                    index === selectedIndex ? 'bg-accent' : ''
                  }`}
                >
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{recent}</span>
                </button>
              ))}
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="p-2">
              {results.map((result, index) => (
                <button
                  key={`${result.entity_type}-${result.entity_id}`}
                  onClick={() => handleResultClick(result)}
                  className={`w-full px-3 py-2 text-left rounded-md flex items-center gap-3 hover:bg-accent ${
                    index === selectedIndex ? 'bg-accent' : ''
                  }`}
                >
                  <div className={`p-2 rounded ${getEntityColor(result.entity_type)}`}>
                    {getEntityIcon(result.entity_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{result.title}</div>
                    <div className="text-sm text-muted-foreground truncate">
                      {result.subtitle}
                    </div>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {result.entity_type}
                  </Badge>
                </button>
              ))}
            </div>
          )}

          {!loading && query.trim().length < 2 && recentSearches.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">Start typing to search</p>
              <p className="text-sm mt-1">Search across products, customers, employees, and suppliers</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>Esc Close</span>
          </div>
          <span>Global Search</span>
        </div>
      </div>
    </div>
  )
}
