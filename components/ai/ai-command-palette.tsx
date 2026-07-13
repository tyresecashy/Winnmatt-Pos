'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import {
  Package, Users, DollarSign, ShoppingCart, BarChart3,
  TrendingUp, Box, UserPlus, AlertTriangle, FileText,
  Settings, LogOut, LayoutDashboard, Menu,
} from 'lucide-react'

interface AICommandPaletteProps {
  onSendToAI: (message: string) => void
  openAIChat: () => void
}

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard', route: '/dashboard' },
  { icon: DollarSign, label: 'Point of Sale', route: '/pos' },
  { icon: BarChart3, label: 'Analytics', route: '/analytics' },
  { icon: Package, label: 'Products', route: '/products' },
  { icon: Box, label: 'Inventory', route: '/inventory' },
  { icon: Users, label: 'Customers', route: '/customers' },
  { icon: ShoppingCart, label: 'Purchases', route: '/purchases' },
  { icon: FileText, label: 'Reports', route: '/reports' },
  { icon: Settings, label: 'Settings', route: '/settings' },
]

const AI_COMMANDS = [
  { icon: TrendingUp, label: 'Sales summary', text: 'Give me a sales summary for this month' },
  { icon: AlertTriangle, label: 'Low stock alerts', text: 'Show me products that are low in stock' },
  { icon: UserPlus, label: 'Create customer', text: 'Create a new customer named Mary Wanjiku, phone 0722000111, email mary@example.com' },
  { icon: Package, label: 'Add product', text: 'Add a new product Fresh Milk at KSh 150, SKU MLK-001, stock 50' },
  { icon: DollarSign, label: 'Find a sale', text: 'Search for sale INV-001' },
  { icon: Users, label: 'Find employee', text: 'Search for employee named James' },
]

export function AICommandPalette({ onSendToAI, openAIChat }: AICommandPaletteProps) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  // Listen for Cmd+K / Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const handleAICommand = useCallback((text: string) => {
    setOpen(false)
    onSendToAI(text)
    openAIChat()
  }, [onSendToAI, openAIChat])

  const handleNavigate = useCallback((route: string) => {
    setOpen(false)
    router.push(route)
  }, [router])

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="AI Actions">
          {AI_COMMANDS.map((cmd) => {
            const Icon = cmd.icon
            return (
              <CommandItem key={cmd.label} onSelect={() => handleAICommand(cmd.text)}>
                <Icon className="mr-2 h-4 w-4" />
                <span>{cmd.label}</span>
              </CommandItem>
            )
          })}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <CommandItem key={item.label} onSelect={() => handleNavigate(item.route)}>
                <Icon className="mr-2 h-4 w-4" />
                <span>{item.label}</span>
              </CommandItem>
            )
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
