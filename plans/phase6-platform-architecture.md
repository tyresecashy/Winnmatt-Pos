# PHASE 6 — Platform Architecture Plan

## Reality Check

**Current State:** WINNMATT POS is a working 55-page Next.js app with Supabase backend, 50+ server actions, production M-Pesa integration, and a strong automation engine. It's a solid application.

**Goal:** Transform it into an extensible platform without rewriting everything from scratch.

**Approach:** Incremental platform-ification. Each item builds on what exists. No big-bang rewrites.

---

## Priority Tiers

### TIER 1 — Foundation (Do First)
These unlock everything else. Without them, platform features become fragile.

| # | Item | Effort | Impact | Why First |
|---|------|--------|--------|-----------|
| 1.1 | **Type Safety Refresh** | 2 days | High | 40+ tables, only 20 typed. Every future feature needs accurate types. |
| 1.2 | **Module Boundaries** | 3 days | High | Currently 55 pages in one route group with no separation. Need domain boundaries before API layer. |
| 1.3 | **Internal API Layer** | 4 days | Critical | Server actions work for Next.js but can't serve mobile apps or third parties. Need REST endpoints. |
| 1.4 | **Event Bus Expansion** | 2 days | High | Automation engine exists but only 5 event types emitted. Need full coverage. |

**Tier 1 Total: ~11 days**

---

### TIER 2 — Platform Core
These make WINNMATT a platform rather than an app.

| # | Item | Effort | Impact | Dependencies |
|---|------|--------|--------|--------------|
| 2.1 | **Plugin System** | 5 days | Critical | Tier 1 (API layer, event bus) |
| 2.2 | **Feature Flags** | 2 days | Medium | None (standalone) |
| 2.3 | **Search Engine** | 3 days | High | None (standalone) |
| 2.4 | **Multi-language (i18n)** | 4 days | High | None (standalone) |
| 2.5 | **Multi-currency** | 2 days | Medium | Finance module exists |

**Tier 2 Total: ~16 days**

---

### TIER 3 — Integration & Commerce
External connectivity and revenue channels.

| # | Item | Effort | Impact | Dependencies |
|---|------|--------|--------|--------------|
| 3.1 | **Webhook/Integration Hub** | 3 days | High | Tier 1 (API layer) |
| 3.2 | **Payment Gateway Abstraction** | 2 days | Medium | M-Pesa exists, need abstraction layer |
| 3.3 | **E-commerce Engine** | 5 days | Critical | Tier 1 + 3.1 |
| 3.4 | **Notification Platform** | 3 days | High | Tier 1 (event bus) |

**Tier 3 Total: ~13 days**

---

### TIER 4 — Mobile & PWA
Offline-first and mobile-native experiences.

| # | Item | Effort | Impact | Dependencies |
|---|------|--------|--------|--------------|
| 4.1 | **PWA / Offline Support** | 4 days | Critical | Tier 1 (API layer for cache strategy) |
| 4.2 | **Mobile-First POS Redesign** | 4 days | High | 4.1 |
| 4.3 | **Mobile App Architecture** | 5 days | High | 4.1 + Tier 1 |

**Tier 4 Total: ~13 days**

---

### TIER 5 — Enterprise & Scale
Advanced platform features for growth.

| # | Item | Effort | Impact | Dependencies |
|---|------|--------|--------|--------------|
| 5.1 | **White-label Support** | 3 days | Medium | Tier 2 (i18n, feature flags) |
| 5.2 | **Version Management** | 2 days | Medium | None |
| 5.3 | **Environment Manager** | 2 days | Low | None |
| 5.4 | **Developer Portal** | 3 days | Low | Tier 1 (API layer) |
| 5.5 | **GraphQL API** | 3 days | Medium | Tier 1 (REST API) |

**Tier 5 Total: ~13 days**

---

## Detailed Implementation Plan

### 1.1 — Type Safety Refresh (2 days)

**Problem:** `db.types.ts` covers ~20 of ~40+ tables. Every new feature adds untyped queries.

**Solution:**
```bash
# Regenerate types from current database schema
npx supabase gen types typescript --project-id aunnoikvfjgrlejccywv > lib/database.types.ts
```

**Deliverables:**
- [ ] Regenerate `lib/database.types.ts` from live schema
- [ ] Update all 50+ server action files to use generated types
- [ ] Remove manual interface definitions that duplicate DB schema
- [ ] Add type-safe Supabase client helper: ` typedClient() `
- [ ] CI check: types must match schema (prevent drift)

**Files Modified:**
- `lib/database.types.ts` (regenerated)
- `lib/supabase-server.ts` (typed client helper)
- All `lib/*-actions.ts` files (update type references)

---

### 1.2 — Module Boundaries (3 days)

**Problem:** 55 pages in one `(dashboard)/` route group. No separation of concerns. Modules directly import from each other.

**Solution:** Domain-based route groups with shared contracts.

```
app/
  (auth)/                    # Authentication
    login/
    register/
  (pos)/                     # Point of Sale (touch-optimized)
    page.tsx                 # POS terminal
    [saleId]/
  (inventory)/               # Inventory Management
    products/
    stock/
    warehouses/
    transfers/
    batch-tracking/
  (finance)/                 # Financial Operations
    chart-of-accounts/
    general-ledger/
    banking/
    reports/
  (workforce)/               # HR & Payroll
    employees/
    attendance/
    payroll/
  (commerce)/                # Sales & Customers
    sales/
    customers/
    loyalty/
    invoices/
  (admin)/                   # Administration
    settings/
    branches/
    users/
    automation/
  (dashboard)/               # Executive Overview (keep for backward compat)
    page.tsx                 # Main dashboard
```

**Module Rules:**
1. Each module has its own `lib/<module>/` directory for actions and types
2. Cross-module communication only via events (no direct imports)
3. Shared utilities stay in `lib/shared/` (currency, formatting, auth)
4. Each module exports a public API through `lib/<module>/index.ts`

**Deliverables:**
- [ ] Create new route group structure
- [ ] Move pages into domain groups
- [ ] Extract module-specific actions into `lib/<module>/` directories
- [ ] Create shared contracts: `lib/shared/types.ts`
- [ ] Add ESLint rule: no cross-module direct imports

---

### 1.3 — Internal API Layer (4 days)

**Problem:** Server actions work for Next.js but can't serve mobile apps, third-party integrations, or external consumers.

**Solution:** REST API layer alongside server actions. Server actions stay for internal use; REST APIs for external consumption.

```
app/api/
  v1/
    auth/
      POST /login
      POST /logout
      GET  /me
    products/
      GET  /                  # List products
      GET  /[id]              # Get product
      POST /                  # Create product
      PUT  /[id]              # Update product
      DELETE /[id]            # Delete product
      GET  /[id]/inventory    # Stock levels
    sales/
      GET  /                  # List sales
      POST /                  # Create sale
      GET  /[id]              # Get sale details
      POST /[id]/void         # Void sale
      POST /[id]/return       # Return sale
    customers/
      GET  /                  # List customers
      POST /                  # Create customer
      GET  /[id]              # Get customer
      GET  /[id]/loyalty      # Loyalty balance
    inventory/
      GET  /movements         # Stock movements
      POST /transfer          # Create transfer
      POST /count             # Stock count
    finance/
      GET  /accounts          # Chart of accounts
      GET  /ledger            # General ledger
      GET  /reports/trial-balance
      GET  /reports/profit-loss
      GET  /reports/balance-sheet
    automation/
      GET  /rules             # Automation rules
      POST /events            # Emit event
      GET  /logs              # Event logs
```

**API Design:**
- Authentication: Bearer token (JWT from Supabase) or API key
- Rate limiting: 100 req/min per key
- Pagination: `?page=1&limit=20`
- Filtering: `?status=active&branch_id=xxx`
- Sorting: `?sort=created_at&order=desc`
- Versioning: `/api/v1/` prefix
- Error format: `{ error: { code, message, details } }`
- Response format: `{ data: T, meta: { total, page, limit } }`

**Deliverables:**
- [ ] API middleware: auth, rate limiting, CORS, request logging
- [ ] API response helpers: pagination, error formatting
- [ ] Product CRUD API (reference implementation)
- [ ] Sale API (most complex, good test)
- [ ] API documentation (OpenAPI/Swagger spec)
- [ ] API key management (admin UI)

**Files Created:**
- `lib/api/middleware.ts` — Auth, rate limit, CORS
- `lib/api/response.ts` — Response formatting
- `lib/api/validators.ts` — Input validation
- `app/api/v1/` — Route handlers

---

### 1.4 — Event Bus Expansion (2 days)

**Problem:** Automation engine exists but only fires 5 event types. Most operations don't emit events.

**Solution:** Emit events from ALL significant operations.

**Current Coverage:**
- `sale.completed` ✅
- `sale.voided` ✅
- `sale.returned` ✅
- `shift.opened` ✅
- `shift.closed` ✅
- `customer.created` ✅

**Missing Events to Add:**
```
Inventory:
  - product.created
  - product.updated
  - product.price_changed
  - stock.received (purchase order)
  - stock.transferred
  - stock.counted
  - stock.adjusted

Finance:
  - invoice.created
  - invoice.paid
  - invoice.overdue
  - expense.approved
  - expense.rejected
  - journal_entry.posted
  - period.closed

Workforce:
  - employee.created
  - employee.clock_in
  - employee.clock_out
  - payroll.processed

System:
  - user.login
  - user.logout
  - settings.changed
  - integration.connected
  - integration.failed
```

**Deliverables:**
- [ ] Add `emitEvent()` calls to all 50+ server actions
- [ ] Create event catalog documentation
- [ ] Add event replay capability (for debugging)
- [ ] Create event dashboard (real-time event stream viewer)

---

### 2.1 — Plugin System (5 days)

**Problem:** Every new integration requires modifying core code. No way for third parties to extend WINNMATT.

**Solution:** Plugin architecture with lifecycle hooks.

**Plugin Architecture:**
```typescript
// Plugin manifest
interface Plugin {
  id: string
  name: string
  version: string
  description: string
  author: string
  
  // Lifecycle
  install: (ctx: PluginContext) => Promise<void>
  activate: (ctx: PluginContext) => Promise<void>
  deactivate: (ctx: PluginContext) => Promise<void>
  uninstall: (ctx: PluginContext) => Promise<void>
  
  // Extensions
  routes?: RouteDefinition[]
  actions?: ActionDefinition[]
  eventHandlers?: EventHandler[]
  uiExtensions?: UIExtension[]
  settings?: SettingsDefinition[]
}

interface PluginContext {
  db: SupabaseClient
  events: EventBus
  logger: Logger
  config: PluginConfig
  storage: PluginStorage
}
```

**Plugin Capabilities:**
1. **Routes** — Add new API endpoints
2. **Server Actions** — Add new business logic
3. **Event Handlers** — React to any event
4. **UI Extensions** — Add dashboard widgets, sidebar items, settings panels
5. **Database Migrations** — Create plugin-specific tables
6. **Scheduled Tasks** — Register background jobs

**Plugin Examples (built-in):**
- `@winnmatt/plugin-mpesa` — M-Pesa integration (already exists, just formalize)
- `@winnmatt/plugin-email` — Email notifications
- `@winnmatt/plugin-sms` — SMS gateway
- `@winnmatt/plugin-quickbooks` — QuickBooks sync
- `@winnmatt/plugin-kra` — KRA eTIMS compliance

**Deliverables:**
- [ ] Plugin loader and lifecycle manager
- [ ] Plugin storage (DB tables for installed plugins, configs)
- [ ] Plugin CLI: `winnmatt plugin install <id>`
- [ ] Plugin sandbox (isolated execution context)
- [ ] Plugin API (stable contract for plugin developers)
- [ ] 3 reference plugins (M-Pesa, Email, SMS)
- [ ] Plugin admin UI (install, configure, enable/disable)

**Database Tables:**
```sql
plugins (id, name, version, status, config, installed_at)
plugin_configs (plugin_id, key, value, encrypted)
plugin_logs (plugin_id, level, message, created_at)
```

---

### 2.2 — Feature Flags (2 days)

**Solution:** Simple DB-backed feature flag system.

```sql
feature_flags (
  id UUID PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,        -- 'pos.offline_mode'
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT false,
  rollout_percentage INT DEFAULT 100,
  target_branches UUID[],          -- NULL = all branches
  target_roles TEXT[],             -- NULL = all roles
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

**Deliverables:**
- [ ] Feature flag service: `isFeatureEnabled(key, context)`
- [ ] Admin UI: create/edit/toggle flags
- [ ] React hook: `useFeatureFlag(key)`
- [ ] API middleware: check flags before executing
- [ ] A/B testing support (percentage-based rollout)

---

### 2.3 — Search Engine (3 days)

**Solution:** Full-text search across all entities using PostgreSQL full-text search (no external service needed).

```sql
-- Search index
CREATE INDEX products_search_idx ON products 
  USING gin(to_tsvector('english', name || ' ' || sku || ' ' || coalesce(description, '')));

-- Search function
CREATE OR REPLACE FUNCTION search_all(query TEXT, branch UUID DEFAULT NULL)
RETURNS TABLE (
  entity_type TEXT,
  id UUID,
  title TEXT,
  subtitle TEXT,
  rank REAL
) AS $$
  -- Products
  SELECT 'product'::TEXT, p.id, p.name, p.sku, ts_rank_cd(search_vector, query)
  FROM products p WHERE search_vector @@ query
  UNION ALL
  -- Customers
  SELECT 'customer'::TEXT, c.id, c.full_name, c.phone, ts_rank_cd(search_vector, query)
  FROM customers c WHERE search_vector @@ query
  UNION ALL
  -- etc.
  ORDER BY rank DESC LIMIT 50;
$$ LANGUAGE sql;
```

**Deliverables:**
- [ ] Database: full-text search indexes on all entities
- [ ] Search RPC: `search_all(query, branch_id, entity_types)`
- [ ] Server action: `globalSearch(query, filters)`
- [ ] UI: Global search dialog (Ctrl+K)
- [ ] Search analytics (what people search for)
- [ ] Recent searches, saved searches

---

### 2.4 — Multi-language / i18n (4 days)

**Solution:** next-intl for Next.js App Router.

```
messages/
  en.json          # English (default)
  sw.json          # Swahili
  fr.json          # French (future)
```

**Coverage Areas:**
- UI buttons, labels, errors
- Receipt templates
- Email templates
- Notification messages
- Report headers
- POS interface

**Deliverables:**
- [ ] Install next-intl, configure middleware
- [ ] Extract all hardcoded strings to locale files
- [ ] Create Swahili translations (primary secondary language for Kenya)
- [ ] Language switcher in settings
- [ ] Receipt multi-language support
- [ ] RTL support preparation (for Arabic future)

---

### 2.5 — Multi-currency (2 days)

**Solution:** Currency column on relevant tables + exchange rate service.

```sql
-- Add to tables that store money
ALTER TABLE products ADD COLUMN currency TEXT DEFAULT 'KES';
ALTER TABLE sales ADD COLUMN currency TEXT DEFAULT 'KES';
ALTER TABLE sales ADD COLUMN exchange_rate NUMERIC;

-- Exchange rates table
CREATE TABLE exchange_rates (
  id UUID PRIMARY KEY,
  from_currency TEXT NOT NULL,
  to_currency TEXT NOT NULL,
  rate NUMERIC NOT NULL,
  source TEXT,       -- 'central_bank', 'manual', 'api'
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Deliverables:**
- [ ] Database: currency columns, exchange_rates table
- [ ] Exchange rate service (manual + API fetch)
- [ ] Multi-currency display in UI
- [ ] Currency conversion in POS
- [ ] Multi-currency reports

---

## Execution Timeline

```
Week 1:  Tier 1 (Type Safety, Module Boundaries)
Week 2:  Tier 1 (API Layer)
Week 3:  Tier 1 (Event Bus) + Tier 2 start (Feature Flags, Search)
Week 4:  Tier 2 (Plugin System)
Week 5:  Tier 2 (i18n, Multi-currency) + Tier 3 start
Week 6:  Tier 3 (Webhooks, Payment Abstraction)
Week 7:  Tier 3 (E-commerce, Notifications)
Week 8:  Tier 4 (PWA, Mobile POS)
```

**Total Estimated Effort: ~55 days (11 weeks)**

---

## What NOT to Build Yet

These are important but should wait until the foundation is solid:

1. **GraphQL API** — REST first. GraphQL adds complexity. Add later when there are multiple consumers with different data needs.
2. **Mobile Native Apps** — PWA first. Native apps (React Native) only after PWA proves the offline-first architecture works.
3. **White-label** — Need plugin system and i18n first.
4. **Developer Portal** — Need stable API + plugins first.
5. **Background Job Queue** — App-level scheduler works for now. Redis/Bull only when scale demands it.
6. **E-commerce Engine** — Most complex item. Build API layer and webhooks first, then e-commerce becomes easier.

---

## Success Criteria

After Phase 6, WINNMATT should:

1. **Type-safe** — Zero `any` types in server actions
2. **Modular** — Each domain is independently deployable
3. **API-first** — Every feature accessible via REST API
4. **Event-driven** — All operations emit events, all modules react to events
5. **Extensible** — Plugins can add features without touching core
6. **Offline-capable** — POS works without internet
7. **Multi-language** — English + Swahili minimum
8. **Searchable** — Global search finds anything instantly
9. **Feature-flagged** — All features can be toggled per-branch/role
10. **Mobile-friendly** — Touch-optimized POS for tablets/phones
