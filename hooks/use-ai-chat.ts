'use client'

import { useState, useCallback, useRef } from 'react'
import type { ChatMessage, ExecutionResult, ToolResult } from '@/lib/ai/types'

/**
 * Hook managing the AI chat state and message flow.
 * Handles sending messages, pending action confirmation, and history.
 */
export function useAIChat(pageContext: string = '') {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [pendingAction, setPendingAction] = useState<{
    tool: string
    args: Record<string, unknown>
  } | null>(null)
  const idCounter = useRef(0)

  const addMessage = useCallback((role: 'user' | 'assistant', content: string, executionResult?: ExecutionResult) => {
    idCounter.current++
    const msg: ChatMessage = {
      id: `msg-${idCounter.current}`,
      role,
      content,
      executionResult,
      timestamp: new Date().toISOString(),
    }
    setMessages(prev => [...prev, msg])
    return msg
  }, [])

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return

    // Add user message and include it in the history sent to the LLM
    const userMsg = addMessage('user', content)
    setIsLoading(true)
    setPendingAction(null)

    try {
      // Dynamic import to avoid circular dependency
      const { aiExecute } = await import('@/lib/ai-actions')

      // Include the current message in history (React state hasn't flushed yet)
      const history = [...messages.slice(-9), userMsg]
      const result = await aiExecute(content, pageContext, history)

      // Handle the result
      if (result.type === 'text') {
        addMessage('assistant', result.content)
      } else if (result.type === 'action_pending') {
        setPendingAction({ tool: result.tool, args: result.arguments })
        addMessage('assistant', `I'd like to perform this action: ${result.toolDescription}`, result)
      } else if (result.type === 'action_result') {
        addMessage('assistant', result.result.summary || 'Action completed.', result)
      } else if (result.type === 'error') {
        addMessage('assistant', `Error: ${result.message}`, result)
      }
    } catch (error) {
      addMessage('assistant', `An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }, [pageContext, messages, isLoading, addMessage])

  const confirmAction = useCallback(async (toolName: string, toolArgs: Record<string, unknown>) => {
    setIsLoading(true)
    try {
      const { aiConfirmAction } = await import('@/lib/ai-actions')
      const result = await aiConfirmAction(toolName, toolArgs)

      // Update the last assistant message to include the result
      setMessages(prev => {
        const updated = [...prev]
        const lastIdx = updated.length - 1
        if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
          updated[lastIdx] = {
            ...updated[lastIdx],
            executionResult: {
              type: 'action_result',
              tool: toolName,
              result,
            },
          }
        }
        return updated
      })

      setPendingAction(null)
      return result
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Execution failed',
      } as ToolResult
    } finally {
      setIsLoading(false)
    }
  }, [])

  const cancelAction = useCallback(() => {
    setPendingAction(null)
    addMessage('assistant', 'Action cancelled.')
  }, [addMessage])

  const clearMessages = useCallback(() => {
    setMessages([])
    setPendingAction(null)
  }, [])

  return {
    messages,
    isLoading,
    sendMessage,
    confirmAction,
    cancelAction,
    clearMessages,
  }
}
