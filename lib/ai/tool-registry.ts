import type { ToolDefinition, ToolContext, ToolResult } from './types'

/**
 * Central registry for all AI assistant tools
 */
class ToolRegistry {
  private tools = new Map<string, ToolDefinition>()

  /** Register a single tool */
  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`)
    }
    this.tools.set(tool.name, tool)
  }

  /** Register multiple tools at once */
  registerAll(tools: ToolDefinition[]): void {
    for (const tool of tools) {
      this.register(tool)
    }
  }

  /** Get a tool by name */
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name)
  }

  /** Get all registered tools */
  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values())
  }

  /** Get only read-only tools */
  getReadTools(): ToolDefinition[] {
    return this.getAll().filter(t => !t.isWrite)
  }

  /** Get only write tools */
  getWriteTools(): ToolDefinition[] {
    return this.getAll().filter(t => t.isWrite)
  }

  /** Execute a tool by name with given arguments and context */
  async execute(
    name: string,
    args: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> {
    const tool = this.get(name)
    if (!tool) {
      return { success: false, error: `Tool "${name}" not found` }
    }
    try {
      return await tool.handler(args, context)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }
}

/** Singleton instance */
export const toolRegistry = new ToolRegistry()

export { ToolRegistry }
