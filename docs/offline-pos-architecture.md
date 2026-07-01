# Offline POS Architecture

## Problem Statement
The Winnmatt POS app requires an active Supabase connection to process cash sales, M-Pesa payments, inventory lookups, and customer management. When connectivity is lost the POS becomes unusable, which is unacceptable in retail environments with unreliable internet.

## Requirements
- Cash sales must be completable offline (no internet)
- M-Pesa payments require internet (safaricom API) - must queue or fail gracefully
- Inventory must be cached locally for lookup during offline
- Customer lookup must work from a local cache
- When connectivity returns, offline sales must sync to Supabase
- Sync must handle conflicts (e.g., stock sold online while offline)
- Admin must be able to see sync status and pending offline transactions

## Proposed Architecture

### 1. Local Storage Layer
- Use IndexedDB (via idb library) as the offline data store
- Schema mirrors the Supabase tables but with additional `sync_status` and `local_updated_at` columns
- Tables to cache: products (read-only), inventory (read-only), customers (read-only), users (read-only)
- Tables to queue: sales, sale_items, stock_movements

### 2. Service Worker + Cache
- Next.js PWA setup with service worker for app shell caching
- Cache static assets (JS, CSS, fonts) via workbox
- Network-first strategy for API calls, falling back to IndexedDB

### 3. Sync Engine
- After connectivity returns, process queued operations in order
- For each offline sale:
  1. Re-validate inventory (check for conflicts)
  2. Apply sale to Supabase using existing createSaleWithContext
  3. On conflict (insufficient stock): mark as sync_failed, notify admin
  4. On success: update local sync_status to 'synced'
- Use a background sync (periodic or on-reconnect)

### 4. UI Changes
- Offline indicator badge in the POS header
- Read-only mode for M-Pesa (show "Requires internet" tooltip)
- Sync status page showing pending/failed items
- Toast notification when connectivity restores

### 5. Data Flow
```
User clicks "Complete Sale" →
  Check connectivity →
  if online: normal path (current behavior)
  if offline:
    1. Validate inventory from IndexedDB
    2. Save sale + items to IndexedDB (sync_status: 'pending')
    3. Print receipt from local data
    4. On reconnect: SyncEngine.processQueue()
```

### 6. Implementation Plan
| Phase | Task | Dependencies |
|-------|------|-------------|
| 1 | Install idb, configure PWA manifest + service worker | — |
| 2 | Create IndexedDB schema + migration helper | Phase 1 |
| 3 | Create offline data access layer (getProducts, getInventory, getCustomers) | Phase 2 |
| 4 | Modify completePaymentAction to detect offline and queue | Phase 3 |
| 5 | Build SyncEngine with conflict detection | Phase 3 |
| 6 | Add offline indicator + sync status UI | Phase 4 |
| 7 | Test: disable network, process 20+ cash sales, restore network, verify sync | Phase 5 |

## Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| IndexedDB storage limit (usually ~50MB) | Can't cache full product catalog | Implement LRU eviction, or use OPFS for larger data |
| Conflict on inventory during sync | Sale accepted offline but stock already sold | Mark as sync_failed, notify admin to resolve |
| Multiple tabs writing offline | Data inconsistency | Use a single sync queue shared across tabs via BroadcastChannel |
| M-Pesa callback missed | Payment in limbo | Force online check for M-Pesa before allowing the payment method |
