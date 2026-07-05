"use client"
import { logger } from '@/lib/logger';

import { useState, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, User, X, Phone, Loader2, Mail } from "lucide-react"
import { searchCustomers } from "@/lib/customers-actions"
import { formatKSh, pointsToKSh } from "@/lib/currency"
import type { SelectedCustomer } from "@/app/(dashboard)/pos/page"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface CustomerLookupProps {
  selectedCustomer: SelectedCustomer | null
  onSelectCustomer: (customer: SelectedCustomer | null) => void
  loyaltyRedeemValue?: number
  /** Ref forwarded to the trigger button so keyboard shortcuts can open the popover */
  searchTriggerRef?: React.RefObject<HTMLButtonElement | null>
}

const customerTypeColors: Record<string, string> = {
  retail: "bg-blue-100 text-blue-700",
  wholesale: "bg-green-100 text-green-700",
  business: "bg-purple-100 text-purple-700",
}

const tierColors: Record<string, string> = {
  bronze: "bg-amber-100 text-amber-800",
  silver: "bg-slate-100 text-slate-700",
  gold: "bg-yellow-100 text-yellow-800",
  platinum: "bg-teal-100 text-teal-800",
  vip: "bg-purple-100 text-purple-800",
}

function getCustomerIdSuffix(id?: string) {
  if (!id) return "UNKNOWN"
  return id.slice(-6).toUpperCase()
}

export function CustomerLookup({ selectedCustomer, onSelectCustomer, loyaltyRedeemValue, searchTriggerRef }: CustomerLookupProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)

  // Handle real-time search from database
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query)
    
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      const results = await searchCustomers(query)
      setSearchResults(results)
    } catch (error) {
      logger.error('Error searching customers:', error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }, [])

  if (selectedCustomer) {
    return (
      <div className="px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium truncate">{selectedCustomer.name}</p>
              <Badge
                variant="secondary"
                className={`text-xs ${customerTypeColors[selectedCustomer.type] || ""}`}
              >
                {selectedCustomer.type}
              </Badge>
              {selectedCustomer.tier && (
                <Badge
                  variant="outline"
                  className={`text-[10px] ${tierColors[selectedCustomer.tier] || ""}`}
                >
                  {selectedCustomer.tier.charAt(0).toUpperCase() + selectedCustomer.tier.slice(1)}
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px] font-mono">
                ID {getCustomerIdSuffix(selectedCustomer.id)}
              </Badge>
            </div>
            <div className="mt-1 space-y-1">
              {selectedCustomer.phone ? (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {selectedCustomer.phone}
                </p>
              ) : null}
              {selectedCustomer.email ? (
                <p className="text-xs text-muted-foreground flex items-center gap-1 break-all">
                  <Mail className="h-3 w-3" />
                  {selectedCustomer.email}
                </p>
              ) : null}
              {!selectedCustomer.phone && !selectedCustomer.email ? (
                <p className="text-xs text-muted-foreground">
                  No phone or email on this customer record
                </p>
              ) : null}
              <p className="text-[11px] font-medium text-amber-700">
                Selected record: {selectedCustomer.name} #{getCustomerIdSuffix(selectedCustomer.id)}
              </p>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-[11px] text-muted-foreground">
                Exact customer ID is locked for this sale
              </p>
              <div className="text-xs font-medium text-primary flex items-center gap-1 shrink-0">
                <span>{selectedCustomer.loyalty_points?.toLocaleString()} pts</span>
                {loyaltyRedeemValue && (
                  <span className="text-muted-foreground">
                    ({formatKSh(pointsToKSh(selectedCustomer.loyalty_points || 0, loyaltyRedeemValue))})
                  </span>
                )}
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onSelectCustomer(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-3 border-b">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            ref={searchTriggerRef}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-start text-muted-foreground"
          >
            <Search className="mr-2 h-4 w-4" />
            Search customer by name or phone...
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[360px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput 
              placeholder="Enter name or phone..." 
              value={searchQuery}
              onValueChange={handleSearch}
            />
            <CommandList>
              {isSearching && (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
              
              {!isSearching && searchQuery && searchResults.length === 0 && (
                <CommandEmpty>No customer found.</CommandEmpty>
              )}

              {!isSearching && searchResults.length > 0 && (
                <CommandGroup heading={`Results (${searchResults.length})`}>
                  {searchResults.map((customer) => (
                    <CommandItem
                      key={customer.id}
                      value={customer.id}
                      onSelect={() => {
                        onSelectCustomer({
                          id: customer.id,
                          name: customer.name,
                          phone: customer.phone || "",
                          email: customer.email || "",
                          type: customer.type,
                          loyalty_points: customer.loyalty_points || 0,
                          tier: customer.tier || "bronze",
                        })
                        setOpen(false)
                        setSearchQuery("")
                        setSearchResults([])
                      }}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium truncate">{customer.name}</p>
                            <Badge variant="outline" className="text-[10px] font-mono">
                              ID {getCustomerIdSuffix(customer.id)}
                            </Badge>
                          </div>
                          <div className="mt-1 space-y-1">
                            {customer.phone ? (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {customer.phone}
                              </p>
                            ) : null}
                            {customer.email ? (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 break-all">
                                <Mail className="h-3 w-3" />
                                {customer.email}
                              </p>
                            ) : null}
                            {!customer.phone && !customer.email ? (
                              <p className="text-xs text-muted-foreground">
                                No phone or email on this record
                              </p>
                            ) : null}
                            <p className="text-[11px] font-medium text-primary">
                              {customer.loyalty_points?.toLocaleString() || 0} pts
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant="secondary"
                          className={`text-xs ${customerTypeColors[customer.type] || ""}`}
                        >
                          {customer.type}
                        </Badge>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {/* Walk-in Customer Option */}
              {!isSearching && (
                <CommandGroup heading="Customer Type">
                  <CommandItem
                    value="walk-in"
                    onSelect={() => {
                      onSelectCustomer(null)
                      setOpen(false)
                      setSearchQuery("")
                      setSearchResults([])
                    }}
                  >
                    <div className="flex items-center gap-3 w-full">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Walk-in Customer</p>
                        <p className="text-xs text-muted-foreground">No customer record</p>
                      </div>
                    </div>
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
