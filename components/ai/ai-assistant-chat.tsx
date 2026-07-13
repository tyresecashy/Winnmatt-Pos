'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Send, Bot, User, Sparkles, Package, DollarSign, Users, AlertTriangle, ShoppingCart } from 'lucide-react'
import { AIActionCard } from './ai-action-card'
import { AIActionResult } from './ai-action-result'
import type { ChatMessage, ExecutionResult } from '@/lib/ai/types'

export interface SuggestionItem {
  icon: React.ComponentType<{ className?: string }>
  label: string
  text: string
}

interface AIAssistantChatProps {
  messages: ChatMessage[]
  isLoading: boolean
  onSendMessage: (message: string) => void
  onConfirmAction: (tool: string, args: Record<string, unknown>) => Promise<{ success: boolean; error?: string; data?: unknown; summary?: string }>
  onCancelAction: () => void
  placeholder?: string
  suggestions?: SuggestionItem[]
}

const DEFAULT_SUGGESTIONS: SuggestionItem[] = [
  { icon: Package, label: 'Add a product', text: 'Add a new product Fresh Milk at KSh 150, SKU MLK-001, stock 50' },
  { icon: Users, label: 'Find customer', text: 'Search for customer named John' },
  { icon: DollarSign, label: 'Today\'s sales', text: 'What were our sales today?' },
  { icon: AlertTriangle, label: 'Low stock', text: 'Show me products that are low in stock' },
  { icon: ShoppingCart, label: 'Create supplier', text: 'Create a new supplier called Fresh Supplies Ltd, contact Peter, phone 0712345678' },
  { icon: Sparkles, label: 'Sales summary', text: 'Give me a sales summary for this month' },
]

export function AIAssistantChat({
  messages,
  isLoading,
  onSendMessage,
  onConfirmAction,
  onCancelAction,
  placeholder = 'Ask me to do something...',
  suggestions = DEFAULT_SUGGESTIONS,
}: AIAssistantChatProps) {
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = () => {
    if (inputValue.trim() && !isLoading) {
      onSendMessage(inputValue.trim())
      setInputValue('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSuggestion = (text: string) => {
    onSendMessage(text)
  }

  /**
   * Render a message's execution result (action card or result)
   */
  const renderExecutionResult = (msg: ChatMessage) => {
    if (!msg.executionResult) return null

    const exec = msg.executionResult

    if (exec.type === 'action_pending') {
      return (
        <div className="mt-2">
          <AIActionCard
            action={exec}
            onConfirm={onConfirmAction}
            onCancel={onCancelAction}
          />
        </div>
      )
    }

    if (exec.type === 'action_result') {
      return (
        <div className="mt-2">
          <AIActionResult result={exec} />
        </div>
      )
    }

    if (exec.type === 'error') {
      return (
        <div className="mt-2 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{exec.message}</p>
        </div>
      )
    }

    return null
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 px-4 overflow-y-auto" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Bot className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-lg font-semibold mb-1">AI Assistant</h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm">
              Ask me to manage products, check sales, find customers, or run reports. I can take action on your behalf.
            </p>

            {/* Suggestion chips */}
            <div className="grid grid-cols-2 gap-2 w-full max-w-md">
              {suggestions.map((suggestion, i) => {
                const Icon = suggestion.icon
                return (
                  <button
                    key={i}
                    onClick={() => handleSuggestion(suggestion.text)}
                    className="flex items-center gap-2 p-3 text-left text-sm rounded-lg border border-border bg-card hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <Icon className="h-4 w-4 text-primary shrink-0" />
                    <span>{suggestion.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="py-4 space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}

                <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-first' : ''}`}>
                  <div
                    className={`rounded-lg px-4 py-2.5 text-sm ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    {msg.content}
                  </div>

                  {/* Execution result (action card or result) */}
                  {renderExecutionResult(msg)}
                </div>

                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 mt-1">
                    <User className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="bg-muted rounded-lg px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-border p-3">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
