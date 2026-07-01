# POS & Dashboard UX Audit
**Date:** April 4, 2026  
**Focus:** Cashier workflow, real-world usability, app-wide UX consistency

---

## Executive Summary

The POS system has solid foundational workflow (search-focused, auto-refocus, hold/resume). However, **critical cashier friction points** exist around stock visibility, barcode scanning, and keyboard efficiency. Dashboard has extensive mock data and dead UI patterns. Broader app has inconsistent loading/error states and incomplete data-driven features.

---

## 1. CASHIER POS WORKFLOW AUDIT

### ✅ WORKING WELL
- ✓ Search input auto-focuses after add/checkout
- ✓ Product row-click (entire row clickable, no separate button)
- ✓ Cart always visible (left-right split layout)
- ✓ Quick payment methods (Cash/M-Pesa/Paybill)
- ✓ Change calculation for cash
- ✓ Hold/Resume sale feature
- ✓ Branch + user name displayed in header

### ⚠️ CRITICAL ISSUES (Cashier Speed)

#### 1.1 No Stock Visibility
**Problem:** ProductList shows 0 stock info. Cashier can't see:
- If product is in stock
- How many units available
- Low stock warnings
- Out-of-stock status

**Impact:** High friction — cashier adds items then discovers they're out of stock during checkout

**Database:** Inventory table exists with quantity per branch, but NOT being queried

**Affected Component:** `components/pos/product-list.tsx`

**Fix Needed:** Query inventory.quantity, show stock badge, disable adding out-of-stock items

---

#### 1.2 Barcode Scanner Not Functional
**Problem:** Barcode button exists but is fake/non-functional. Placeholder text says "scan barcode" but there's no scanning logic.

**Impact:** Real barcode scanners can't be integrated. Cashiers must type/search manually.

**Code Location:** `components/pos/product-search.tsx` line 51 - Button has no onClick handler

**Fix Needed:** 
1. Add click handler to barcode button
2. Clear search, focus input, insert barcode data programmatically
3. OR: Show barcode mode hint (device-specific)

---

#### 1.3 No Keyboard Shortcuts
**Problem:** Cashier relies entirely on mouse. No hotkeys for:
- Enter = Checkout (vs clicking button)
- Esc = Clear search
- Q = Quick quantity shortcut
- C = Clear cart
- H = Hold sale
- R = Resume sale

**Impact:** Slow workflow, no 10-finger efficiency possible

**Fix Needed:** Add useEffect with keyboard event listeners

---

#### 1.4 Product Quantity Input Only Via +/- Buttons
**Problem:** Small +/- buttons (h-7 w-7) force multiple clicks for large quantities (e.g., +15 units = 15 clicks)

**Impact:** Tedious for bulk orders, cashier must click many times

**Code Location:** `components/pos/shopping-cart.tsx` lines 170-185

**Fix Needed:** Allow direct input via click-to-edit on quantity display

---

#### 1.5 Product Columns Are Mock Data
**Problem:** ProductSearch uses `categories` from `mock-data` instead of database categories

**Impact:** Category filter doesn't match actual DB categories, filtering may be broken

**Code Location:** `components/pos/product-search.tsx` line 9

**Fix Needed:** Fetch categories from database, pass via props

---

#### 1.6 No Out-of-Stock Add Prevention
**Problem:** No check before `addToCart()` — user can add out-of-stock items, discovers later in checkout

**Impact:** Friction, potential invalid sales

**Fix Needed:** Show alert when attempting to add 0-stock items

---

### ⚠️ IMPORTANT ISSUES (Daily Usability)

#### 1.7 Checkout Completion Flow Unclear
**Problem:** After payment success, receipt dialog shows checkmark but no next action. Cashier is stuck wondering what to do.

**Impact:** Unclear handoff to next transaction

**Code Location:** `components/pos/payment-panel.tsx` lines 308-320

**Fix Needed:** Show clear "Close Receipt" → "New Transaction" flow, or auto-close after 3s

---

#### 1.8 Hold/Resume Sale Lacks Timestamps
**Problem:** Held sales show customer name + item count, but no timestamp. If multiple sales on hold, cashier can't tell which is which without opening each one.

**Impact:** Confusion with multiple held sales

**Fix Needed:** Add `createdAt` timestamp to held sales display

---

#### 1.9 Cart Totals Not Bold Enough
**Problem:** Total amount in payment area is readable but could be more visually prominent for cashier verification

**Impact:** Minor — human error on payment amount

**Fix Needed:** Increase font size or add visual emphasis

---

#### 1.10 Search Clear Button (X) Not Obvious
**Problem:** X button to clear search is small and conditional (only shows when search has text)

**Impact:** Cashier must manually delete text character by character

**Fix Needed:** Make X button always visible or use Esc key

---

### 🟢 NICE-TO-HAVE (Optimization)

#### 1.11 No Recent Transactions Summary
**Problem:** Recent transactions panel exists but seems disconnected from checkout flow

**Fix Needed:** Show summary card with last 3 sales for reference

#### 1.12 No Discount Presets
**Problem:** Item/cart discount requires manual input each time

**Fix Needed:** Quick-select discount percentages (5%, 10%, 15%)

#### 1.13 No Quick Customer Add
**Problem:** Customer lookup exists but can't add new customer on-the-fly during checkout

**Fix Needed:** Add customer dialog accessible from checkout

---

## 2. DASHBOARD & REPORTING AUDIT

### ⚠️ ALL DASHBOARD COMPONENTS USE MOCK DATA
**Problem:** Dashboard shows fake stats from hardcoded `todaySalesData`:
- Daily Sales (mock)
- Transactions (mock)
- Avg Basket Size (mock)
- Active Customers (mock)

**Affected Components:**
- `DashboardStats` - shows fake KSh values
- `SalesTrendChart` - mock chart data
- `BranchComparison` - mock branch comparison
- `TopProducts` - mock product ranking
- `PaymentBreakdown` - mock payment methods breakdown
- `SeasonalInsights` - mock seasonal data

**Impact:** No actionable business intelligence. Dashboard is beautiful but useless.

**Fix Needed:** Query actual sales data from database, compute real-time stats

---

### ⚠️ REPORTS PAGES HAVE DEAD UI
**Problem:** Pages exist but appear to use mock data:
- `/sales-history` - likely mock sales data
- `/reports` - likely mock reports  
- `/inventory` - uses mock stockMovements

**Data Sources:** Check if querying real DB or mock-data

---

### ⚠️ LOW STOCK ALERTS DISCONNECTED
**Problem:** Desktop component `LowStockAlerts` probably uses mock data. Real low stock alerts should come from inventory table.

**Fix Needed:** Query inventory table for `quantity < reorder_level`

---

## 3. BRANCH & MULTI-LOCATION ISSUES

### ⚠️ NO STOCK VISIBILITY PER BRANCH
**Problem:** POS shows current branch, but:
- Can't see stock levels for other branches
- Can't transfer inventory between branches
- No visibility when ordering from supplier

**Database:** Stock is tracked per (product, branch) but not exposed in UI

**Fix Needed:** Add inventory visibility across branches (read-only or transfer capability)

---

### ⚠️ BRANCH FILTER NOT IN PRODUCTS PAGE
**Problem:** Products page doesn't filter by branch — shows all products regardless of stock availability at current branch

**Fix Needed:** Add branch filter to products page, show branch-specific stock

---

## 4. LOADING & ERROR STATE ISSUES

### ⚠️ INCONSISTENT LOADING STATES
**Issues:**
- ProductList shows loading spinner ✓
- PaymentPanel has no loading state while processing payment
- ProductSearch has no loading state for category/search
- ProductDialog has no loading state while creating/updating
- Dashboard components have no loading state

**Fix Needed:** Add `isLoading` state to all async operations, show skeleton or spinner

---

### ⚠️ MINIMAL ERROR FEEDBACK
**Issues:**
- Products page shows error toast but dismisses after 5s
- PaymentPanel doesn't show error if payment fails
- ProductDialog doesn't show field-level errors
- POS page catches errors silently

**Fix Needed:** Add persistent error UI with retry actions

---

## 5. FORM & VALIDATION ISSUES

### ⚠️ NO FIELD-LEVEL ERRORS IN PRODUCT FORM
**Problem:** ProductDialog uses Zod validation but may not display field-level errors as user types

**Fix Needed:** Show error messages below/next to fields in real-time

---

## 6. SEARCH & FILTER ISSUES

### ⚠️ CATEGORY FILTER USES MOCK DATA
**Problem:** `components/pos/product-search.tsx` imports categories from mock-data, not database

**Current Code:**
```typescript
import { categories } from "@/lib/mock-data"
```

**Fix Needed:** Accept categories as prop from POS page (already fetched from DB)

---

### ⚠️ NO SEARCH RESULT COUNT
**Problem:** Search shows no indication of how many products matched

**Fix Needed:** Show "45 products" or "3 results found" below search box

---

## 7. CUSTOMERS & SUPPLIERS NOT IMPLEMENTED

### ⚠️ CUSTOMERS CRUD MISSING
**Problem:** `/customers` page exists but likely not fully implemented

**Fix Needed:** Build customers CRUD to enable loyalty tracking

---

### ⚠️ SUPPLIERS CRUD MISSING
**Problem:** `/suppliers` page exists but not connected to purchasing workflow

**Fix Needed:** Build suppliers CRUD for order management

---

## 8. INVENTORY TRANSFERS NOT IMPLEMENTED

### ⚠️ TRANSFERS PAGE LIKELY DEAD
**Problem:** `/transfers` page exists but probably not functional

**Fix Needed:** Build inter-branch transfer workflow

---

---

## PRIORITY RANKING

### 🔴 CRITICAL (Cashier Can't Work Efficiently)
**These block daily cashier workflows and must be fixed first:**

1. **No Stock Visibility** - Cashier adds out-of-stock items 
   - Impact: High friction, invalid sales
   - Effort: Medium (query + display)
   - Implementation time: 1-2 hours

2. **Barcode Scanner Placeholder** - Barcode button doesn't work
   - Impact: Manual search only, no scanning integration
   - Effort: Medium (add handler + barcode device logic)
   - Implementation time: 1 hour

3. **No Keyboard Shortcuts** - Must use mouse for every action
   - Impact: Slow cashier workflow
   - Effort: Low (useEffect + keyboard listeners)
   - Implementation time: 30 min

4. **Quantity Input Only Via Buttons** - +15 units = 15 clicks
   - Impact: Tedious for bulk orders
   - Effort: Low (click-to-edit on number)
   - Implementation time: 30 min

### 🟡 IMPORTANT (Daily Usability)

5. **Checkout Completion Unclear** - Receipt → ??? (confused state)
   - Impact: Unclear handoff between transactions
   - Effort: Low (UX flow)
   - Implementation time: 20 min

6. **Mock Categories in POS** - Filter uses mock, not DB
   - Impact: Filter inconsistency
   - Effort: Low (prop passing)
   - Implementation time: 15 min

7. **Out-of-Stock Prevention** - No check before add
   - Impact: Invalid items in cart
   - Effort: Low (check + alert)
   - Implementation time: 20 min

8. **Hold/Resume Missing Timestamps** - Can't identify held sales
   - Impact: Confusion with multiple holds
   - Effort: Low (add createdAt)
   - Implementation time: 15 min

### 🟢 NICE-TO-HAVE (Can Wait)

9. **Dashboard All Mock Data** - Beautiful but useless stats
   - Impact: No business intelligence
   - Effort: High (query + compute real data)
   - Implementation time: 4-6 hours

10. **Inventory Consistency** - Branch stock visibility
    - Impact: Can't see cross-branch availability
    - Effort: High (multi-branch UX)
    - Implementation time: 3-4 hours

---

## IMPLEMENTATION ROADMAP

### Phase 1: Cashier Speed (Session 1-2, ~2 hours)
- [ ] Add stock visibility to ProductList
- [ ] Implement keyboard shortcuts for POS
- [ ] Add direct quantity input (click-to-edit)
- [ ] Make barcode button functional (at least placeholder handler)

### Phase 2: UX Polish (Session 2, ~1 hour)
- [ ] Fix checkout completion flow
- [ ] Add timestamps to held sales
- [ ] Pass DB categories to ProductSearch
- [ ] Add out-of-stock prevention

### Phase 3: Dashboard & Reports (Session 3-4, ~6 hours)
- [ ] Replace mock dashboard data with real queries
- [ ] Implement low stock alert query
- [ ] Build customers CRUD (enable Phase 4)
- [ ] Build suppliers CRUD (enable Phase 5)

### Phase 4: Inventory Management (Session 5, ~4 hours)
- [ ] Inventory transfers workflow
- [ ] Branch stock comparison
- [ ] Stock adjustment UI

---

## RECOMMENDED NEXT IMMEDIATE ACTION

**Implement Stock Visibility in POS** (Top Priority)

This is the #1 cashier friction point and only ~1-2 hours effort.

**Scope:**
1. Fetch inventory quantities from database (already in DB schema)
2. Display quantity badge on product rows
3. Disable "Add to Cart" if out of stock
4. Show low-stock warning (< reorder_level)
5. Prevent adding more than available quantity

**Files to Change:**
- `app/(dashboard)/pos/page.tsx` - fetch inventory with products
- `components/pos/product-list.tsx` - display quantity, handle out-of-stock
- `lib/products-actions.ts` - ensure getProductsForPOS includes inventory

**Expected Outcome:**
Cashier immediately sees "12 in stock" on each product, can't accidentally add 0-stock items, aware of stock levels while searching.

---

## SECONDARY RECOMMENDATIONS (Session Continuity)

After stock visibility:
1. **Keyboard shortcuts** - Enter for checkout, Esc to clear search (faster)
2. **Direct quantity input** - Click to edit quantity in cart (less clicking)
3. **Mock data cleanup** - Fix ProductSearch to use DB categories
4. **Barcode handler** - At least show "barcode scanned" feedback

