# WINNMATT POS — AI Architecture

author: OpenWork
verified_by: Repository Audit (Phase 1B)
verification_status: Verified
last_verified: 2026-07-14
confidence: High
stable_id: D-09
**Freshness:** 180 days (permanent)

**@see** [INDEX.md](INDEX.md) · [03_ARCHITECTURE.md](03_ARCHITECTURE.md) (system context) · [04_MODULE_MAP.md](04_MODULE_MAP.md) (AI module M-00) · [13_DECISIONS.md](13_DECISIONS.md) (C-008 ADR) · `AGENTS.md` (Sprint 8 implementation notes)

---

## Executive Summary

The AI Functional Assistant is a chat-based interface that understands natural language requests and maps them to tool calls. Built in Sprint 8, it uses OpenRouter (free tier) for NL-to-action parsing, a tool registry pattern for domain operations, and a confirmation workflow for write operations. The architecture is designed to gracefully degrade when the LLM API is unavailable.

**Status:** ✅ Core architecture implemented. 8 tool files, chat UI, floating FAB, command palette (Cmd+K).

---

## Architecture

```
User Input ──► use-ai-chat.ts (state hook)
                    │
                    ▼
        lib/ai-actions.ts (aiExecute)
                    │
                    ▼
        lib/ai/executor.ts
            │           │
            ▼           ▼
      OpenRouter     Tool Registry
      (LLM parse)    (8 tools)
            │           │
            ▼           ▼
      Response ────► Read tools: auto-execute
                     Write tools: → pending action → user confirms
```

### Key Files

| File | Purpose | Lines |
|------|---------|-------|
| `lib/ai/types.ts` | Core types: ToolDefinition, ToolContext, ToolResult, ChatMessage | 98 |
| `lib/ai/tool-registry.ts` | Singleton registry of all tool definitions | 58 |
| `lib/ai/executor.ts` | NL-to-action: calls OpenRouter, parses response, routes to tools | 242 |
| `lib/ai/prompts.ts` | System prompt builder with serialized tool schemas | 69 |
| `lib/ai/tools/index.ts` | Re-exports all tool modules | ~20 |
| `lib/ai-actions.ts` | Server actions: aiExecute, aiConfirmAction | ~130 |
| `hooks/use-ai-chat.ts` | Chat state management hook | ~200 |

---

## Tool Architecture

### Tool Files (8 domains)

| File | Tools |
|------|-------|
| `lib/ai/tools/products.ts` | addProduct, updateProduct, searchProducts, getProductDetails, setReorderLevel |
| `lib/ai/tools/customers.ts` | createCustomer, searchCustomers, getCustomerHistory, updateCustomer |
| `lib/ai/tools/sales.ts` | searchSales, getSaleDetails, voidSale, getSalesSummary |
| `lib/ai/tools/inventory.ts` | getStockLevel, getLowStockAlerts, transferStock, adjustInventory |
| `lib/ai/tools/suppliers.ts` | createSupplier, searchSuppliers, getSupplierOrders, createPurchaseOrder |
| `lib/ai/tools/employees.ts` | searchEmployees, getEmployeePerformance |
| `lib/ai/tools/finance.ts` | getRevenueReport, getExpenseReport, getAccountBalance |
| `lib/ai/tools/admin.ts` | createUser, assignRole, getBranchDetails, getSystemAuditLog, listBranches |

**Total: ~25 tools across 8 files + index.ts**

### Tool Format (JSON Schema)

Each tool is described as a JSON schema embedded in the system prompt:

```typescript
interface ToolDefinition {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, JSONSchema>
    required: string[]
  }
  execute(context: ToolContext, args: Record<string, unknown>): Promise<ToolResult>
}
```

### Read vs Write Tools

- **Read tools** (searchProducts, getStockLevel, searchSales, etc.) execute immediately on the server and return results to the chat.
- **Write tools** (addProduct, createCustomer, voidSale, etc.) return as pending actions; the user must confirm before execution via `aiConfirmAction`.

---

## LLM Integration

### OpenRouter (Free Tier)

| Setting | Value |
|---------|-------|
| Provider | OpenRouter |
| Default model | `meta-llama/llama-3.3-70b-instruct:free` |
| Fallback models | Multiple free-tier models tried in sequence |
| API Key | `OPENROUTER_API_KEY` env var (optional) |
| Auth | JSON prompting with strict tool_call format |
| Degradation | Returns human-readable error if all models fail |

### Prompt Strategy

The system prompt (`lib/ai/prompts.ts`) serializes all tool schemas into the LLM context. The LLM responds with either:
- `{"type":"text","content":"..."}` — Natural language response
- `{"type":"tool_call","tool":"name","arguments":{...}}` — Tool invocation request

---

## UI Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `floating-ai-button.tsx` | `components/ai/` | Floating FAB → triggers sheet |
| `ai-assistant-chat.tsx` | `components/ai/` | Chat interface with history, chips |
| `ai-action-card.tsx` | `components/ai/` | Pending write action (Confirm/Cancel) |
| `ai-action-result.tsx` | `components/ai/` | Execution result display |
| `command-palette.tsx` | `components/` | Cmd+K global command palette |

---

## Page-Specific Suggestions

The assistant provides contextual suggestions on 10 routes (dashboard, sales, POS, products, inventory, customers, suppliers, employees, finance, purchases). Each page's context is passed to the AI system prompt for relevant suggestions.

---

## Known Limitations

1. **No streaming responses** — LLM responses are delivered as complete blocks, not streamed token-by-token.
2. **No conversation memory** — The AI does not persist conversation state across sessions.
3. **OpenRouter dependency** — If OpenRouter is down or the API key is missing, the AI degrades to a static message; no fallback LLM.
4. **No rate limiting** — AI requests are not rate-limited separately from other API calls.
5. **No streaming or server-sent events** — Chat is request-response only.
6. **Tool coverage gaps** — No tools for finance operations, cash management, shift management, or system configuration.
7. **No user feedback loop** — No mechanism for users to rate or flag incorrect AI responses.

---

## Future Direction

1. Add streaming responses via SSE or WebSocket
2. Implement conversation persistence (save/recall chat history)
3. Add fallback LLM provider (e.g., local model via Ollama)
4. Expand tool coverage to all 25 modules
5. Add user feedback mechanism (👍/👎 on responses)
6. Implement rate limiting specific to AI requests
7. Voice input integration
