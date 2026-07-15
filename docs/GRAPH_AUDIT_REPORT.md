# WinnMatt POS — Knowledge Graph Audit Report

**Generated:** 2026-07-14  
**Tool:** [Graphify](https://github.com/Graphify-Labs/graphify) v0.9.15 (AST-only mode, no LLM)  
**Graph:** 2,025 nodes · 6,715 edges · 178 communities  
**Source:** Full project root (887 files, code-only — no semantic extraction for docs/images)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Graph Overview](#2-graph-overview)
3. [God Node Analysis](#3-god-node-analysis)
4. [useAuth() Deep Dive](#4-useauth-deep-dive)
5. [Weakly-Connected Islands](#5-weakly-connected-islands)
6. [Community Structure](#6-community-structure)
7. [Architecture Insights](#7-architecture-insights)
8. [Graph Health](#8-graph-health)
9. [Recommendations](#9-recommendations)

---

## 1. Executive Summary

The WinnMatt POS codebase was mapped into a knowledge graph using tree-sitter AST extraction (deterministic, no LLM, fully local). The graph reveals:

- **Core application**: 1,195 tightly-connected nodes (59% of total) where the real architecture lives
- **830 weakly-connected nodes** (41%) across 107 islands — including test files, archived mobile app code, external agent skills, and config files that never imported into the main app
- **Two universal hubs**: `Button()` (157 edges) and `useAuth()` (117 edges) — the most cross-community dependencies
- **No import cycles** — health check passed with zero circular dependencies
- **2,415 dangling edges** from skipped semantic extraction (code-only graph)

---

## 2. Graph Overview

| Metric | Value |
|--------|-------|
| Total nodes | 2,025 |
| Total edges | 6,715 |
| Communities | 178 (147 shown, 31 thin omitted) |
| Extraction confidence | 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS |
| Import cycles | **None detected** ✅ |
| Main component | 1,195 nodes |
| Weak islands | 107 islands, 830 nodes |
| Token cost | 0 (AST-only, no LLM) |

---

## 3. God Node Analysis

The 10 most-connected nodes (by degree) are all **shadcn/ui primitives** and **core React context hooks** — not domain-specific business logic:

| Rank | Node | Edges | Type | Role |
|------|------|-------|------|------|
| 1 | `Button()` | 157 | UI primitive | Universal leaf component |
| 2 | `Card()` | 123 | UI primitive | Layout container |
| 3 | `CardContent()` | 119 | UI primitive | Layout container |
| 4 | **`useAuth()`** | **117** | **Auth context** | **Universal auth dependency** |
| 5 | `CardHeader()` | 113 | UI primitive | Layout container |
| 6 | `Badge()` | 110 | UI primitive | Status indicator |
| 7 | `CardTitle()` | 108 | UI primitive | Layout container |
| 8 | `Input()` | 94 | UI primitive | Form input |
| 9 | `EmptyState()` | 90 | UI primitive | Empty state display |
| 10 | `Skeleton()` | 82 | UI primitive | Loading skeleton |

### What This Tells Us

**`Button()` — Universal UI Hub (157 edges, 41+ communities)**

`Button()` is a shadcn/ui component at `components/ui/button.tsx`. It's imported by virtually every page in the system — from POS to Finance to Audit Trail to Employee Management. Its betweenness centrality of **0.049** (highest in the graph) means it bridges more communities than any other node. This is a **structural artifact** of the shared component layer: `Button()` is a leaf dependency that everything imports but nothing depends on. The graph correctly identifies it as a utility hub — healthy code organization, not a problem.

**`useAuth()` — Universal Auth Dependency (117 edges, 28 communities)**

Unlike `Button()` (a passive leaf), `useAuth()` is an **active architectural dependency** — it represents the authentication gate every page must pass through. See Section 4 for the full analysis.

---

## 4. useAuth() Deep Dive

### Node Identity

| Field | Value |
|-------|-------|
| Graph ID | `contexts_auth_context_useauth` |
| Source | `contexts/auth-context.tsx` L272 |
| Community | 27 |
| Total edges | **117** |
| Communities spanned | **28** (of 178 total) |

### Pages Importing useAuth()

The 58 importing nodes span:

| Directory | Pages importing `useAuth()` |
|-----------|---------------------------|
| `components/` | 17 (dialogs, wrappers, shared UI) |
| `app/(dashboard)/` | 30+ route pages |
| Context/layout | 2 (layout.tsx, auth-context.tsx) |

Specific dashboard pages that depend on auth:

```
shifts/  loyalty/  supplier-returns/  returns/  tasks/  users/
permissions/  inventory/  attendance/  notifications/  cash-management/
security/  pos/  transfers/  tax-config/  purchase-requisitions/
purchases/  supplier-invoices/  bulk-operations/  operations/
developer/  employees/  sales-history/  expenses/  banking/
chart-of-accounts/  general-ledger/  warehouses/  stock-count/
settings/  purchase-orders/
```

### Why 28 Communities?

`useAuth()` lives in `contexts/auth-context.tsx` (a provider wrapping the entire app). Every route page that handles user-specific data must call `useAuth()` to get the current user, branch, role, and session. This creates **radial fan-out**: one provider context node with edges radiating outward to every page that reads it.

The 28 communities correspond to the 28 distinct functional areas (Finance, POS, Inventory, HR, etc.) — auth truly touches every domain.

### Betweenness Centrality Interpretation

With betweenness of **~0.032**, `useAuth()` is the second most-critical bridge node. If `useAuth()` were removed, the graph would fragment — Finance pages would have no path to POS pages through auth. This is architecturally correct: auth is meant to be a universal gate.

### Key Takeaway

Unlike `Button()` (passive utility hub), `useAuth()` is an **active cross-cutting concern** — it represents the security boundary of the application. Its high centrality is by design, not accident.

---

## 5. Weakly-Connected Islands

### Overview

**830 nodes** (41% of the graph) live in **107 disconnected islands** — subgraphs with zero import edges connecting them to the main application. Here's the breakdown:

| Category | Islands | Nodes | Root Cause |
|----------|---------|-------|------------|
| **Test files** | 31 | 141 | Tests mock deps instead of importing them |
| **Legacy agent skills** | 17 | 136 | `.agents/` contains external tools (deploy, vercel-optimize) not imported by app |
| **METATRON** | 1 | 111 | External AI toolkit in project root, not imported by POS code |
| **Root config files** | 15 | 96 | `tsconfig.json`, `package.json`, `next.config.mjs` etc. — config with no imports |
| **Archived mobile app** | 3 | 84 | `db/archived/` — React Native app removed in Phase 1, retained for reference |
| **app/ islands** | 20 | 65 | Route pages that import only UI primitives (no shared logic) |
| **Legacy `.opencode.disabled/`** | 1 | 57 | Disabled PowerShell skills |
| **scripts/** | 7 | 46 | One-off utility scripts (migration, verification) |
| **PowerSkills/** | 6 | 44 | PowerShell automation toolkit |
| **public/ assets** | 2 | 38 | PWA service worker, manifest, icons |
| **Other** | 4 | 12 | Misc isolated files |

### What Each Category Means

#### Test Files (141 nodes, 31 islands)

Tests use mocking patterns (`vi.mock()`, `mockFrom`, `mockSupabaseAdmin`) that bypass real imports. The AST sees `import { vi } from 'vitest'` but not `import { createSale } from '@/lib/sales-actions'` — because the test file's import is wrapped in `vi.mock()` before being resolved.

**Consequence:** Test nodes form their own disconnected mini-graphs. This is expected for Vitest/mocked tests. Import-level connectivity would require integration tests that use real modules.

#### Legacy Agent Skills (136 nodes, 17 islands)

The `.agents/` directory contains external skill packages (deploy-to-vercel, vercel-optimize, web-design-guidelines, etc.) that are:
- Not imported by the POS codebase
- Independent toolkits with their own ecosystem
- Stored in the project for agent reference, not for runtime use

**Consequence:** These are genuinely external dependencies. No action needed — they're supposed to be disconnected.

#### METATRON (111 nodes, 1 island)

A standalone AI toolkit project living in the project root directory. Contains Python files (`metatron.py`, `llm.py`, `db.py`, `tools.py`, `search.py`) with their own package structure. Not integrated into the POS application.

**Consequence:** This is a separate project sharing the same git repo. Consider moving to `external/metatron/` if it should stay, or removing if no longer needed.

#### Archived Mobile App (84 nodes, 3 islands)

The Phase 1-removed React Native mobile app (`db/archived/`), including:
- React Native screens (BarcodeScannerScreen, CustomerAppNavigation)
- API client files
- Offline storage and sync service

No edges lead from the current Next.js codebase into this directory. The code is genuinely dead.

#### Root Config Files (96 nodes, 15 islands)

Isolated config files (`tsconfig.json`, `next.config.mjs`, `eslint.config.mjs`, `postcss.config.mjs`, `vitest.config.ts`, `vercel.json`, `.graphifyignore`, etc.) — these define their own types/constants but aren't imported by anything. They're consumed by tooling (Node.js, Vite, ESLint) at build time, not by the app at import time.

#### app/ Islands (65 nodes, 20 islands)

A subtle category: route pages that import only UI primitives (`Button`, `Card`, `Badge`) without any shared business logic import. These pages form small disconnected stars around `Button()`/`Card()` but since those primitives live in a separate community, and the page doesn't import anything else from the main graph, it floats as its own island. Pages that import `useAuth()` or a shared module get pulled into the main component.

**Diagnosis:** Pages that are pure UI shells — they fetch data via server actions or inline queries that don't leave import traces in the AST.

---

## 6. Community Structure

### Top Communities by Size

| Community | Label | Nodes | Cohesion | Assessment |
|-----------|-------|-------|----------|------------|
| 0 | Finance & Analytics Pages | 68 | 0.10 | Weak — many independent sub-pages |
| 1 | POS & Transaction Components | 64 | 0.08 | Weak — broad category |
| 2 | Suppliers & Purchasing | 62 | 0.09 | Weak — separate concerns |
| 3 | Utility Functions & Formatting | 57 | 0.05 | Very weak — grab-bag of utilities |
| 4 | Purchase Order & AP | 55 | 0.09 | Weak — needs splitting |
| 5 | Enterprise Health & System | 46 | 0.14 | Moderate |
| 6 | Automation & Workflow Engine | 42 | 0.11 | Moderate |
| 7 | AI Command Palette | 42 | 0.08 | Weak |
| 8 | Mobile App Config | 38 | — | Archived |
| 9 | Security & Vulnerability | 33 | — | METATRON |
| 10 | TypeScript Config & Typings | 32 | — | Config |
| 11 | Mobile/Customer App Navigation | 31 | — | Archived |
| 12 | Sidebar & Dashboard Shell | 29 | — | Shell |
| 13 | Cash Management & Drawers | 28 | — | — |
| 14 | Notifications & Alerts | 28 | — | — |
| 15 | Employee Management | 28 | — | — |

### Cohesion Assessment

The top 4 communities (Finance, POS, Suppliers, Utility) all have cohesion scores between **0.05–0.10** — meaning their internal nodes are only weakly interconnected. This suggests:

- **Finance & Analytics (0.10):** Various sub-pages (Sales, Inventory, Customer, Financial, Workforce, Reports) grouped together but only loosely connected through shared components
- **POS & Transaction (0.08):** Many independent dialog/panel components that don't share much logic
- **Suppliers & Purchasing (0.09):** PO listings, AP detail, supplier profile — different concerns
- **Utility Functions (0.05):** The weakest — pure grab-bag of formatting, helpers, constants

**Interpretation:** Community detection grouped these by directory proximity, not by tight functional coupling. The graph is accurately reporting that these "communities" are administrative groupings, not strongly cohesive modules.

---

## 7. Architecture Insights

### Strengths (from graph)
1. **No circular imports** ✅ — 0 import cycles detected across 2,025 nodes
2. **Clean separation of concerns** — UI primitives, business logic, and config form distinct communities
3. **Auth is properly centralized** — `useAuth()` as the single auth gate with 117 edges
4. **Shared component layer** — `Button()`, `Card()`, `Badge()`, `Input()` reused across all domains
5. **Module layer exists** — `lib/modules/` nodes connect through shared contracts

### Patterns to Watch
1. **Test isolation** — 141 test nodes disconnected because of mocking patterns (expected, but means no integration-level graph coverage)
2. **Archived code still in repo** — 84 nodes of dead mobile app code in `db/archived/` + 111 nodes of METATRON
3. **Route pages as thin shells** — 65 nodes across 20 tiny islands are pages that only import UI components
4. **Weak community cohesion in Finance/POS/Suppliers** — these are broad directories with independent sub-pages, not tight modules

### Surprising Connections

| Connection | Edge | Between |
|------------|------|---------|
| `AICenterPage()` → `useToast()` | Calls | AI center triggers toasts |
| `AuditTrailPage()` → `q()` | Indirect | Audit page → script utility (weak) |
| Inferred edges across unrelated dirs | INFERRED (61 total) | Cross-module relationships |

---

## 8. Graph Health

### Diagnostics Summary

| Check | Status | Count |
|-------|--------|-------|
| Missing endpoint edges | ✅ OK | 0 |
| Self-loop edges | ✅ OK | 0 |
| Exact duplicate edges | ✅ OK | 0 |
| Import cycles | ✅ OK | 0 |
| Dangling endpoint edges | ⚠️ Expected | 2,415 |
| Collapsed (directed) edges | ⚠️ Minor | 20 |
| Collapsed (undirected) edges | ⚠️ Minor | 22 |

### Dangling Edges (2,415)

These are edges where the target node was not extracted because semantic extraction was skipped (code-only mode without Gemini API key). The edges reference concepts in documentation files, images, and configuration that would become real nodes if a full semantic pass were run. **Not a corruption** — a known limitation of code-only extraction.

---

## 9. Recommendations

### Based on Graph Findings

1. **Clean up dead code**: The 84 nodes in `db/archived/` (React Native app) and 111 nodes in `METATRON/` are genuinely disconnected — consider removing or moving outside the repo to reduce noise.

2. **Add integration tests**: 141 test nodes are disconnected because they mock imports. Integration tests with real module imports would create graph connectivity and catch cross-module breakage.

3. **Strengthen module cohesion**: The top communities have low cohesion (0.05–0.10). Consider splitting Finance, POS, and Suppliers into smaller sub-modules with clearer boundaries.

4. **Audit utility functions**: Community 3 ("Utility Functions & Formatting", cohesion 0.05) is a grab-bag — refactor into domain-specific utility modules.

5. **Consider a full semantic pass**: Adding Gemini API key and running `graphify extract . --update --mode deep` with the semantic pass would bring in the 399 documentation files, 30 images, and 1 PDF, connecting the `q()` function references and adding doc→code relationships.

6. **Commit `graphify-out/` to git**: Running `graphify hook install` would auto-rebuild on each commit (AST-only, free), keeping the graph fresh without manual rebuilds.

---

*Generated with [Graphify](https://github.com/Graphify-Labs/graphify) v0.9.15. 2,025 nodes, 6,715 edges, 178 communities. Code-only mode (no LLM tokens consumed).*
