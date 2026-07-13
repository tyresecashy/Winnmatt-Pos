import { authenticateServerAction } from '@/lib/auth-helpers'
import { toolRegistry } from './tool-registry'
import { buildSystemPrompt } from './prompts'
import { allTools } from './tools'
import type {
  ExecutionResult,
  ParsedToolCall,
  ToolContext,
  ToolResult,
  ChatMessage,
} from './types'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

const FALLBACK_MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'qwen/qwen3-coder:free',
  'openrouter/free',
]

/** Register all domain tools on module load */
allTools.forEach(t => {
  try {
    toolRegistry.register(t)
  } catch {
    // Already registered — skip
  }
})

/**
 * Call OpenRouter with the given prompt and return the response text
 */
async function callOpenRouter(
  messages: { role: string; content: string }[],
  systemPrompt: string
): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    // Return a helpful offline message if no API key
    return JSON.stringify({
      type: 'text',
      content: 'AI assistant is not configured. Please set the OPENROUTER_API_KEY environment variable to enable AI features.',
    })
  }

  const modelsToTry = FALLBACK_MODELS

  for (const model of modelsToTry) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, 3000 * attempt))
      }

      try {
        const response = await fetch(OPENROUTER_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://winnmatt-pos.com',
            'X-Title': 'WINNMATT POS AI',
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              ...messages,
            ],
            temperature: 0.3,
            max_tokens: 2000,
          }),
        })

        if (response.ok) {
          const data = await response.json()
          return data.choices?.[0]?.message?.content || ''
        }

        if (response.status === 429) break // Rate limited, try next model
        if (response.status >= 500) continue // Server error, retry

        const errBody = await response.text()
        console.error(`[AI] Model ${model} error ${response.status}: ${errBody}`)
        break
      } catch {
        // Network error, retry
        continue
      }
    }
  }

  return JSON.stringify({
    type: 'text',
    content: 'AI is temporarily unavailable. Please try again in a moment.',
  })
}

/**
 * Try to parse the LLM response as a JSON tool call or text response.
 * Returns null if unparseable (caller should retry with correction).
 */
function parseLLMResponse(raw: string): ExecutionResult | ParsedToolCall | null {
  // Try to parse as JSON
  try {
    const parsed = JSON.parse(raw)

    if (parsed.type === 'text' && typeof parsed.content === 'string') {
      return { type: 'text', content: parsed.content }
    }

    if (parsed.type === 'tool_call' && parsed.tool && parsed.arguments) {
      return {
        type: 'tool_call',
        tool: parsed.tool,
        arguments: parsed.arguments,
      } as ParsedToolCall
    }

    // If it's valid JSON but wrong structure, try to extract
    if (parsed.tool && parsed.arguments) {
      return {
        type: 'tool_call',
        tool: parsed.tool,
        arguments: parsed.arguments,
      } as ParsedToolCall
    }

    if (parsed.content) {
      return { type: 'text', content: typeof parsed.content === 'string' ? parsed.content : JSON.stringify(parsed.content) }
    }

    return null
  } catch {
    // Not JSON — maybe it's plain text
    const text = raw.trim()
    if (text.length > 0) {
      return { type: 'text', content: text }
    }
    return null
  }
}

/**
 * Main entry point: takes a user message, sends to LLM with tool definitions,
 * parses the response, and either executes the tool or returns text/pending action.
 */
export async function execute(
  message: string,
  pageContext: string = '',
  history: ChatMessage[] = []
): Promise<ExecutionResult> {
  // 1. Authenticate
  const auth = await authenticateServerAction()
  if (!auth.success || !auth.profile) {
    return { type: 'error', message: auth.error || 'Authentication required' }
  }

  // Resolve user's branch
  const profile = auth.profile
  const branchId = profile.branch_id || ''
  const userId = profile.id || ''

  const toolContext: ToolContext = { profile, branchId, userId }

  // 2. Build system prompt with all available tools
  const tools = toolRegistry.getAll()
  const systemPrompt = buildSystemPrompt(tools, pageContext)

  // 3. Convert chat history to OpenRouter messages format
  const messages: { role: string; content: string }[] = history.map(msg => ({
    role: msg.role,
    content: msg.content,
  }))
  messages.push({ role: 'user', content: message })

  // 4. Call LLM (up to 3 attempts with correction on parse failure)
  let lastError = ''
  for (let attempt = 0; attempt < 3; attempt++) {
    const systemWithHistory = attempt > 0
      ? systemPrompt + `\n\nPrevious attempt failed to produce valid JSON. ${lastError}\nRemember: respond ONLY with valid JSON: either {"type":"text","content":"..."} or {"type":"tool_call","tool":"...","arguments":{...}}.`
      : systemPrompt

    const rawResponse = await callOpenRouter(messages, systemWithHistory)
    const parsed = parseLLMResponse(rawResponse)

    if (!parsed) {
      lastError = 'Response was not valid JSON or plain text.'
      continue
    }

    // 5. Handle the response
    if (parsed.type === 'text') {
      return parsed
    }

    if (parsed.type === 'tool_call') {
      const toolDef = toolRegistry.get(parsed.tool)

      if (!toolDef) {
        // Tool not found — ask LLM to correct
        lastError = `Tool "${parsed.tool}" is not available. Available tools: ${tools.map(t => t.name).join(', ')}`
        messages.push({
          role: 'assistant',
          content: rawResponse,
        })
        messages.push({
          role: 'user',
          content: `Tool "${parsed.tool}" not found. Available: ${tools.map(t => t.name).join(', ')}. Please pick one.`,
        })
        continue
      }

      // Validate required params
      const required = (toolDef.parameters.required || []) as string[]
      const missing = required.filter(r => parsed.arguments[r] === undefined)
      if (missing.length > 0) {
        lastError = `Missing required parameters: ${missing.join(', ')}`
        messages.push({
          role: 'assistant',
          content: rawResponse,
        })
        messages.push({
          role: 'user',
          content: `Missing required parameters: ${missing.join(', ')}. Please provide them.`,
        })
        continue
      }

      // Execute read tools immediately
      if (!toolDef.isWrite) {
        const result = await toolRegistry.execute(parsed.tool, parsed.arguments, toolContext)
        return { type: 'action_result', tool: parsed.tool, result }
      }

      // Write tools → return pending action for user confirmation
      const argsSummary = Object.entries(parsed.arguments)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ')

      return {
        type: 'action_pending',
        tool: parsed.tool,
        toolDescription: toolDef.description,
        arguments: parsed.arguments,
        summary: `${toolDef.description}\nParameters: ${argsSummary}`,
      }
    }

    // ActionResult or ErrorResponse — pass through
    return parsed
  }

  return {
    type: 'error',
    message: 'Failed to get a valid response from the AI. Please try rephrasing your request.',
  }
}

/**
 * Confirm and execute a pending action. Called from the UI when user clicks Confirm.
 */
export async function confirmAndExecute(
  toolName: string,
  toolArgs: Record<string, unknown>
): Promise<ToolResult> {
  const auth = await authenticateServerAction()
  if (!auth.success || !auth.profile) {
    return { success: false, error: auth.error || 'Authentication required' }
  }

  const context: ToolContext = {
    profile: auth.profile,
    branchId: auth.profile.branch_id || '',
    userId: auth.profile.id || '',
  }

  return toolRegistry.execute(toolName, toolArgs, context)
}
