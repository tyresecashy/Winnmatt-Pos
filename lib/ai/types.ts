import type { UserProfile } from '@/contexts/auth-context'

/**
 * JSON Schema definition for a tool parameter (subset of JSON Schema draft-07)
 */
export interface ToolParameterSchema {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  description?: string
  enum?: string[]
  properties?: Record<string, ToolParameterSchema>
  items?: ToolParameterSchema
  required?: string[]
}

/**
 * A tool the AI assistant can call
 */
export interface ToolDefinition {
  /** Unique tool name (lower_snake_case) */
  name: string
  /** Human-readable description of what this tool does */
  description: string
  /** JSON Schema for expected arguments */
  parameters: ToolParameterSchema
  /** Whether this tool modifies data (needs user confirmation) */
  isWrite: boolean
  /** The handler function that executes the tool */
  handler: (args: Record<string, unknown>, context: ToolContext) => Promise<ToolResult>
}

/**
 * Context passed to every tool handler
 */
export interface ToolContext {
  profile: UserProfile
  branchId: string
  userId: string
}

/**
 * Result from executing a tool
 */
export interface ToolResult {
  success: boolean
  data?: unknown
  error?: string
  /** Human-readable summary of what was done (shown in chat) */
  summary?: string
}

/**
 * Raw tool call parsed from the LLM response
 */
export interface ParsedToolCall {
  type: 'tool_call'
  tool: string
  arguments: Record<string, unknown>
}

/**
 * Text-only response from the LLM
 */
export interface TextResponse {
  type: 'text'
  content: string
}

/**
 * An action pending user confirmation
 */
export interface PendingAction {
  type: 'action_pending'
  tool: string
  toolDescription: string
  arguments: Record<string, unknown>
  /** Human-readable summary of what will be done */
  summary: string
}

/**
 * Result after executing an action
 */
export interface ActionResult {
  type: 'action_result'
  tool: string
  result: ToolResult
}

/**
 * Error response
 */
export interface ErrorResponse {
  type: 'error'
  message: string
}

export type ExecutionResult = TextResponse | PendingAction | ActionResult | ErrorResponse

/**
 * Message shown in the AI chat UI
 */
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  /** Optional execution result for assistant action messages */
  executionResult?: ExecutionResult
  timestamp: string
}
