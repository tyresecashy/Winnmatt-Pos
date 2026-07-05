# Phase 12 Complete: TypeScript `any`-ban

## Goal
- Remove all ~49 `any` types across the codebase for stricter TypeScript safety

## Constraints & Preferences
- All changes must compile cleanly with `npx tsc --noEmit` (0 errors) and `npx eslint` (0 errors, 0 warnings)
- `catch (err: any)` blocks must become `catch (err: unknown)` with proper `instanceof Error` guards before accessing `.message`
- `Select` `onValueChange` handlers should use `string` instead of `any`
- Array callback parameters (`item: any`, `tx: any`, etc.) should be typed to match the actual data shape
- Index signatures (`[key: string]: any`) should use `unknown` instead
- Supabase query results (no generated DB types) use local minimal interfaces or inline types rather than `any`

## Progress
- **Phase 12: DONE** — All ~49 `any` types eliminated across the codebase
- TypeScript: `npx tsc --noEmit` → **0 errors**
- ESLint: `npx eslint lib/` → **0 errors, 0 warnings**
- Tests: **23/23 pass** (2 test files)

## Issues Encountered & Fixed During Phase 12
Phase 12 required more than just replacing `any` — removing `any` surfaced **pre-existing hidden type mismatches** that were previously masked. These all had to be fixed to get a clean build:

### Direct `any` replacements (10 files, ~20 sites)
- `catch (err: any)` → `catch (err: unknown)` with `instanceof Error` guards (in `staging-actions.ts` and others)
- `onValueChange={(value: any)` → `string` with `as` casts (customer-form-dialog.tsx, stock-adjustment-dialog.tsx)
- `[key: string]: any` → `[key: string]: unknown` (product-ingestion.types.ts)
- Local interfaces created for supabase query results replacing `any[]`: `ProductRow`, `InventoryRow`, `UserRow`, `BranchInfo`, `POSProduct`, `ProductMatchData`, `SuggestionRow`, `PriceAnalysisProduct`

### Hidden type mismatches surfaced by removing `any` (fixes beyond search/replace)
1. **`purchases/page.tsx`** — local `Product` interface had `cost_price: number` but data came from `getProductsForPOS` as `purchase_price?: number`. Fixed interface shape.
2. **`staging-review-table.tsx`** — used `a.message` but `PriceAnomaly` type has `description`. Also used `d.match_type` but `ProductDeduplication` has `dedup_method`. Fixed field names.
3. **`complete-payment-action.ts`** — `buildReceiptSaleFromSeed` returned `cashier.id` and `cashier.full_name` as `string | undefined` but `RawCashier` expects `string`. Also `branch` had same issue. Added `?? ''` fallbacks and proper type casts.
4. **`mpesa-actions.ts`** — filter callback had explicit `t: { sale?: { branch_id?: string } | null }` where supabase infers `sale` as array. Removed annotation, used `as unknown as` cast.
5. **`mpesa-service.ts`** — `Value` was `string | number` but assigned to `string` field. Also `phoneNumber` field missing from inline return type. Added `String()` conversion and `phoneNumber?: string` to type.
6. **`product-deduplicator.ts`** — `normalized_name` was `string | undefined` but `levenshteinSimilarity` expects `string`. Also `product_id` missing from `ProductMatchData`. Added `?? ''` defaults and `product_id?: string` to interface.
7. **`products-actions.ts`** — supabase's `.select('category:categories(...)')` infers `category` as `Array<{...}>` but local interfaces define it as single object. Added normalization in `getProductsForPOS` transform.
8. **`user-management.ts`** — same supabase join type issue (`branch` as array vs object). Casts changed to `as unknown as UserRow`. Also `role: string` → `role: 'owner' | 'admin' | 'manager' | 'cashier'` and `status: string` → `status: 'active' | 'inactive'`.

## Key Lessons
- Supabase `.select('relation:table(columns)')` joins are typed as arrays by the JS client, even for foreign-key-to-one relationships. Safety requires normalization in the transform layer.
- The `as Type` cast fails when the inferred and target types have incompatible shapes (e.g., array vs object). Use `as unknown as Type` instead.
- `catch (err: any)` → `catch (err: unknown)` + `instanceof Error ? .message : String(err)` is the safe pattern.
- shadcn/ui `Select` `onValueChange` always passes `string` — the setter may expect a union, requiring `as` cast.

---
# Phase 13 Complete: Sentry deprecation + TODOs

## What was done
1. **Sentry deprecation fix** — `next.config.mjs`: replaced deprecated `disableLogger: true` → `webpack.treeshake.removeDebugLogging: true` and `automaticVercelMonitors: false` → `webpack.automaticVercelMonitors: false` per v10 SDK deprecation warnings.
2. **0 `exhaustive-deps` warnings** — verified all remaining `exhaustive-deps` are intentionally suppressed via `// eslint-disable-next-line` (7 suppressions across `customer-details-dialog.tsx`, `stock-movements-dialog.tsx`, `shift-dashboard.tsx`, `shift-operations.tsx`, `add-user-dialog.tsx`). None unsuppressed.
3. **TODOs handled** — `price-audit-service.ts`: updated old `TODO` to confirmed-unused note (zero imports exist). `mpesa/callback/route.ts`: 2 TODOs about real-time notifications left as feature enhancement markers (not bugs).

## Final Verification
- `npx tsc --noEmit` → **0 errors**
- `npx eslint --no-cache --max-warnings 0 lib/ app/ components/` → **0 errors, 0 warnings**
- `npx vitest run` → **23/23 passed** (2 test files, 8s)

## Next Steps
- (none — all phases 1–13 complete)
