'use client'

import { useState, useCallback, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { MessageCircle, X, Trash2, Command } from 'lucide-react'
import { useAIChat } from '@/hooks/use-ai-chat'
import { AIAssistantChat } from './ai-assistant-chat'
import { AICommandPalette } from './ai-command-palette'
import type { SuggestionItem } from './ai-assistant-chat'

// ─── Page Context ──────────────────────────────────────────────────────

const PAGE_CONTEXT: Record<string, string> = {
  '/dashboard': 'The user is on the main Dashboard — business overview, sales trend, top products, low stock alerts.',
  '/pos': 'The user is at the Point of Sale terminal — processing customer transactions.',
  '/ai-center': 'The user is in the AI Center — can run deep sales/inventory/finance analyses.',
  '/analytics': 'The user is on the Analytics Dashboard — cross-domain KPIs and chart overview.',
  '/analytics/sales': 'The user is viewing Sales Analytics — revenue, transactions, peak hours, payment methods, top products.',
  '/analytics/inventory': 'The user is viewing Inventory Analytics — stock turnover, dead stock, reorder predictions, supplier performance.',
  '/analytics/customers': 'The user is viewing Customer Analytics — segments, RFM scores, lifetime value, purchase patterns.',
  '/analytics/workforce': 'The user is viewing Workforce Analytics — task efficiency, attendance patterns, labor costs.',
  '/analytics/finance': 'The user is viewing Financial Analytics — P&L trend, cash flow, expense breakdown, margin analysis.',
  '/analytics/reports': 'The user is in the Report Builder — creating and scheduling custom reports.',
  '/customers': 'The user is managing customer relationships — customer list, CRM actions.',
  '/inventory': 'The user is viewing inventory levels — stock counts, adjustments, movements.',
  '/products': 'The user is browsing products — product catalog and details.',
  '/sales-history': 'The user is searching past sales transactions.',
  '/executive-dashboard': 'The user is viewing the Executive Dashboard — high-level business KPIs and insights.',
  '/finance': 'The user is viewing financial pages — accounts, transactions, budgeting.',
  '/employees': 'The user is managing employees — profiles, roles, payroll.',
  '/suppliers': 'The user is managing suppliers.',
  '/purchase-orders': 'The user is managing purchase orders.',
  '/promotions': 'The user is configuring promotions and discounts.',
  '/returns': 'The user is processing returns and refunds.',
  '/shifts': 'The user is managing employee shifts.',
  '/reports': 'The user is browsing reports.',
  '/settings': 'The user is configuring system settings.',
}

function getPageContext(pathname: string): string {
  if (PAGE_CONTEXT[pathname]) return PAGE_CONTEXT[pathname]
  const prefix = Object.keys(PAGE_CONTEXT).find((key) => pathname.startsWith(key))
  if (prefix) return PAGE_CONTEXT[prefix]
  return 'The user is using the Winnmatt POS system.'
}

// ─── Page-Specific Suggestions ─────────────────────────────────────────

const PAGE_SUGGESTIONS: Record<string, SuggestionItem[]> = {
  '/pos': [
    { icon: Command, label: 'Create a sale', text: 'Create a sale for customer Mary: 2x Fresh Milk (MLK-001) at KSh 150 each' },
    { icon: Command, label: 'Process payment', text: 'Process payment of KSh 1,500 via M-Pesa for the current sale' },
    { icon: Command, label: 'Open shift', text: 'Open a new shift for cash drawer 1' },
  ],
  '/dashboard': [
    { icon: Command, label: 'Today overview', text: 'What are today\'s sales and key metrics?' },
    { icon: Command, label: 'Top products', text: 'Which products sold the most this week?' },
    { icon: Command, label: 'Low stock', text: 'Show me products that are low in stock' },
  ],
  '/customers': [
    { icon: Command, label: 'Create customer', text: 'Create a new customer named Mary Wanjiku, phone 0722000111' },
    { icon: Command, label: 'Find customer', text: 'Search for customer named John' },
    { icon: Command, label: 'Customer history', text: 'Show purchase history for the last customer' },
  ],
  '/inventory': [
    { icon: Command, label: 'Stock levels', text: 'What is the current stock level of all products?' },
    { icon: Command, label: 'Transfer stock', text: 'Transfer 10 units of MLK-001 from Main Warehouse to Branch A' },
    { icon: Command, label: 'Adjust stock', text: 'Adjust stock for MLK-001: add 5 units due to recount' },
  ],
  '/products': [
    { icon: Command, label: 'Add product', text: 'Add a new product Fresh Milk at KSh 150, SKU MLK-001, stock 50' },
    { icon: Command, label: 'Update price', text: 'Update product Bread (BRD-001) to KSh 65' },
    { icon: Command, label: 'Reorder level', text: 'Set reorder level for MLK-001 to 20 units' },
  ],
  '/sales-history': [
    { icon: Command, label: 'Search sale', text: 'Search for sale INV-001' },
    { icon: Command, label: 'Today\'s sales', text: 'What were our sales today?' },
    { icon: Command, label: 'Monthly summary', text: 'Give me a sales summary for this month' },
  ],
  '/analytics': [
    { icon: Command, label: 'Revenue', text: 'What is the total revenue this month?' },
    { icon: Command, label: 'Top products', text: 'Which are our top-selling products?' },
    { icon: Command, label: 'Sales trend', text: 'Show the sales trend for the last 30 days' },
  ],
  '/employees': [
    { icon: Command, label: 'Find employee', text: 'Search for employee named James' },
    { icon: Command, label: 'Employee performance', text: 'Show performance metrics for top employees' },
  ],
  '/suppliers': [
    { icon: Command, label: 'Create supplier', text: 'Create a new supplier called Fresh Supplies Ltd, contact Peter, phone 0712345678' },
    { icon: Command, label: 'Supplier orders', text: 'Show orders from our main supplier' },
  ],
  '/finance': [
    { icon: Command, label: 'Revenue report', text: 'What is the total revenue this quarter?' },
    { icon: Command, label: 'Expense report', text: 'Show my expenses for this month' },
  ],
}

function getPageSuggestions(pathname: string): SuggestionItem[] {
  if (PAGE_SUGGESTIONS[pathname]) return PAGE_SUGGESTIONS[pathname]
  const prefix = Object.keys(PAGE_SUGGESTIONS).find((key) => pathname.startsWith(key))
  if (prefix) return PAGE_SUGGESTIONS[prefix]
  // Fallback: return empty to show defaults
  return []
}

// ─── Component ─────────────────────────────────────────────────────────

export function FloatingAIButton() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const context = getPageContext(pathname)
  const suggestions = getPageSuggestions(pathname)
  const paletteRef = useRef<{ open: () => void; sendToAI: (msg: string) => void }>(null)

  const {
    messages,
    isLoading,
    sendMessage,
    confirmAction,
    cancelAction,
    clearMessages,
  } = useAIChat(context)

  const handleConfirmAction = useCallback(
    async (tool: string, args: Record<string, unknown>) => {
      return confirmAction(tool, args)
    },
    [confirmAction]
  )

  // Open AI chat sheet and send a message from the command palette
  const handleSendToAI = useCallback((msg: string) => {
    setOpen(true)
    sendMessage(msg)
  }, [sendMessage])

  return (
    <>
      {/* Cmd+K Command Palette */}
      <AICommandPalette onSendToAI={handleSendToAI} openAIChat={() => setOpen(true)} />

      {/* Floating action button */}
      <Button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-shadow"
        size="icon"
        aria-label="Ask AI Assistant"
      >
        {messages.length > 0 ? (
          <span className="relative">
            <MessageCircle className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full" />
          </span>
        ) : (
          <MessageCircle className="h-5 w-5" />
        )}
      </Button>

      {/* AI Chat Sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[420px] sm:max-w-[500px] p-0 flex flex-col">
          <SheetHeader className="p-3 border-b shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle className="text-base">AI Assistant</SheetTitle>
                <SheetDescription className="text-xs">
                  Manage products, sales, customers & more &middot; Press <kbd className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">Cmd+K</kbd>
                </SheetDescription>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={clearMessages}
                    title="Clear conversation"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setOpen(false)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 bg-primary/5 rounded px-2 py-1 border border-primary/10 leading-relaxed">
              {context}
            </p>
          </SheetHeader>

          <div className="flex-1 overflow-hidden">
            <AIAssistantChat
              messages={messages}
              isLoading={isLoading}
              onSendMessage={sendMessage}
              onConfirmAction={handleConfirmAction}
              onCancelAction={cancelAction}
              suggestions={suggestions.length > 0 ? suggestions : undefined}
              placeholder="Ask me to do something..."
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
