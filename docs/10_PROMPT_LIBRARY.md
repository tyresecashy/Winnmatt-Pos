# WINNMATT POS — AI Prompt Library

author: OpenWork
verified_by: Repository Audit (Phase 1C)
verification_status: Verified
last_verified: 2026-07-14
confidence: Medium
stable_id: D-10
**Freshness:** 180 days (permanent)

**@see** [INDEX.md](INDEX.md) · [10_AI_ARCHITECTURE.md](10_AI_ARCHITECTURE.md) (AI system architecture) · `lib/ai/prompts.ts` (system prompt builder) · `lib/ai/executor.ts` (LLM integration)

---

## Executive Summary

The AI Functional Assistant uses a system prompt built by `lib/ai/prompts.ts` that serializes all tool schemas into the LLM context. This document catalogs the prompting patterns, tool schemas, and response formats used throughout the system. The prompt library is a living reference — patterns evolve as the AI assistant grows.

---

## System Prompt Architecture

### Builder (`lib/ai/prompts.ts`, 69 lines)

The system prompt is dynamically constructed by `buildSystemPrompt()`:

```
1. Role definition — "You are an AI assistant for the WINNMATT POS retail system…"
2. Tool catalog — Serialized JSON schemas from the tool registry
3. Response format — Instructions for text vs tool_call responses
4. Current context — Page-specific suggestions injected per-session
```

### Core System Prompt Pattern

```
You are an AI assistant for the WINNMATT POS retail system.
You can help users with sales, inventory, customers, suppliers,
employees, finance, and system administration tasks.

When the user asks a question, respond naturally.

When the user wants to perform an action, use the appropriate tool.

Available tools:
{serialized_tool_schemas}

Respond with:
  {"type":"text","content":"..."} — for natural language responses
  {"type":"tool_call","tool":"name","arguments":{...}} — to invoke a tool

Read-only tools execute immediately.
Write tools require user confirmation before execution.
```

---

## Tool Prompt Patterns

### Query Tool Pattern (Read-only)

Used for search, get, list, and summary operations.

**Pattern:**
```
Function: searchProducts
Description: Search for products by name, SKU, or barcode
Parameters:
  query (string): Search query
  limit (number, optional): Max results (default 25)
  category (string, optional): Filter by category
```

**LLM trigger phrases:** "find", "search for", "show me", "list", "look up"

### Mutation Tool Pattern (Write — requires confirmation)

Used for create, update, delete, and action operations.

**Pattern:**
```
Function: addProduct
Description: Create a new product in the catalog
Parameters:
  name (string): Product name
  sku (string, required): Unique SKU
  price (number): Selling price
  cost (number, optional): Cost price
  category (string, optional): Product category
```

**LLM trigger phrases:** "add", "create", "update", "change", "delete", "remove"

### Analysis Tool Pattern (Read-only)

Used for reports, metrics, and intelligence functions.

**Pattern:**
```
Function: getSalesSummary
Description: Get a summary of sales for a date range
Parameters:
  startDate (date, optional): Start date (default: today)
  endDate (date, optional): End date (default: today)
  branchId (string, optional): Filter by branch
```

**LLM trigger phrases:** "how many", "what's the", "report on", "analyze", "summary of"

---

## Page-Specific Suggestion Patterns

The AI assistant provides contextual suggestions on 10 routes. Each suggestion is a natural language question or action that maps to a tool call.

### Sales Page
```
Suggestions for sales page context:
- "Show me today's top-selling products"
- "What's our total revenue this week?"
- "Find transaction #1234"
```

### Inventory Page
```
Suggestions for inventory page context:
- "Which products are low in stock?"
- "Show me products in the Beverages category"
- "Transfer stock between branches"
```

### Customer Page
```
Suggestions for customer page context:
- "Search for customer John"
- "What's the loyalty tier for this customer?"
- "Show me customer purchase history"
```

---

## Response Format Patterns

### Successful Read Result

```
{
  "type": "text",
  "content": "Found 5 products matching 'coffee':\n\n1. **Coffee Beans** (#COF-001) — KES 1,200\n2. **Instant Coffee** (#COF-002) — KES 450\n..."
}
```

### Successful Write Action (Pending Confirmation)

```
{
  "type": "tool_call",
  "tool": "addProduct",
  "arguments": {
    "name": "Organic Coffee Beans",
    "sku": "COF-010",
    "price": 1500,
    "category": "Beverages"
  }
}
```

### Error Response

```
{
  "type": "text",
  "content": "I couldn't find a product with that SKU. Please check the SKU and try again."
}
```

### Fallback (API unavailable)

```
{
  "type": "text",
  "content": "I'm sorry, I'm having trouble connecting to my AI service right now. Please try again in a moment."
}
```

---

## Tool Descriptions for LLM Context

### Sales Tools
```json
{
  "name": "searchSales",
  "description": "Search sales by receipt number, date range, or payment method",
  "parameters": {
    "receipt_number": "string (optional)",
    "start_date": "date (optional)",
    "end_date": "date (optional)",
    "payment_method": "string (optional)"
  }
}
```

### Inventory Tools
```json
{
  "name": "getLowStockAlerts",
  "description": "Get list of products below reorder level",
  "parameters": {
    "branch_id": "string (optional)",
    "threshold": "number (optional)"
  }
}
```

### Customer Tools
```json
{
  "name": "searchCustomers",
  "description": "Search customers by name, phone, or email",
  "parameters": {
    "query": "string (required)",
    "limit": "number (optional)"
  }
}
```

---

## Known Limitations

1. **No few-shot examples** — Current prompts use function-description format without example inputs/outputs
2. **No multi-turn context** — Conversation history is passed but not used for disambiguation
3. **No tool chaining** — Each response handles one tool call; multi-step workflows require multiple user turns
4. **No dynamic tool selection** — All tools are always in context; no subset selection based on page
5. **No system prompt versioning** — Prompt changes are tracked via git but not versioned at runtime

---

## Future Direction

1. Add few-shot examples for complex tools (createPurchaseOrder, processPayroll)
2. Implement dynamic tool selection based on page context (reduce tokens)
3. Add system prompt versioning with A/B testing capability
4. Create specialized prompts for mobile POS voice interface
5. Add structured output formatting (tables, charts in text)
